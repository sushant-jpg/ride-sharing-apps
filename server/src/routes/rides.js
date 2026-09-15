import { Router } from "express";
import { env } from "../config/env.js";
import { z } from "zod";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { auth, roles } from "../middleware/auth.js";
import { validate, rideInput, objectId, place } from "../validators/index.js";
import { Ride, EmergencyIncident, Payment } from "../models/index.js";
import * as service from "../services/rides.js";
import { check } from "../utils/errors.js";
import { hash } from "../services/auth.js";
import { emitAdmin } from "../services/events.js";
import { routeBetween } from "../services/maps.js";
import { quote } from "../services/fare.js";
import { CATEGORIES } from "../../../shared/constants/index.js";
const router = Router();
router.use(auth);
router.post(
  "/estimate",
  roles("PASSENGER"),
  validate(rideInput),
  async (req, res) => {
    const estimates = [];
    const input = req.validated.body;
    const route = await routeBetween([
      input.pickup,
      ...input.stops,
      input.destination,
    ]);
    for (const category of CATEGORIES) {
      let fare, promoError;
      try {
        fare = await quote(category.id, route, input.promoCode, req.user._id);
      } catch (error) {
        if (!input.promoCode || ![400, 409].includes(error.status)) throw error;
        promoError = error.message;
        fare = await quote(category.id, route, undefined, req.user._id);
      }
      estimates.push({
        category: category.id,
        pricing: fare.pricing,
        breakdown: fare.breakdown,
        promoError,
        ...route,
      });
    }
    res.json(estimates);
  },
);
router.post("/", roles("PASSENGER"), validate(rideInput), async (req, res) =>
  res.status(201).json(await service.createRide(req.validated.body, req.user)),
);
router.get("/current", async (req, res) => {
  const ride = await Ride.findOne({
    $or: [{ passenger: req.user._id }, { driver: req.user._id }],
    status: { $nin: ["TRIP_COMPLETED", "CANCELLED"] },
  });
  res.json(ride ? await service.getRide(ride._id, req.user) : null);
});
router.get("/history", async (req, res) =>
  res.json(
    await Ride.find({
      $or: [{ passenger: req.user._id }, { driver: req.user._id }],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("driver", "name rating")
      .populate("passenger", "name"),
  ),
);
router.param("id", (req, _res, next, id) => {
  try {
    objectId.parse(id);
    next();
  } catch (err) {
    next(err);
  }
});
router.get("/:id", async (req, res) =>
  res.json(await service.getRide(req.params.id, req.user)),
);
router.post(
  "/:id/cancel",
  validate(z.object({ reason: z.string().trim().min(3).max(300) })),
  async (req, res) =>
    res.json(
      await service.cancelRide(
        req.params.id,
        req.user._id,
        req.validated.body.reason,
      ),
    ),
);
router.post(
  "/:id/rate",
  validate(
    z.object({
      value: z.number().int().min(1).max(5),
      feedback: z.string().max(500).default(""),
    }),
  ),
  async (req, res) =>
    res
      .status(201)
      .json(
        await service.rateRide(
          req.params.id,
          req.user,
          req.validated.body.value,
          req.validated.body.feedback,
        ),
      ),
);
router.post("/:id/pin", roles("PASSENGER"), async (req, res) => {
  const pin = String(crypto.randomInt(1000, 10000));
  const ride = await Ride.findOneAndUpdate(
    {
      _id: req.params.id,
      passenger: req.user._id,
      status: {
        $in: [
          "SEARCHING",
          "SCHEDULED",
          "DRIVER_ASSIGNED",
          "DRIVER_ARRIVING",
          "DRIVER_ARRIVED",
        ],
      },
    },
    {
      $set: {
        verificationPinHash: await bcrypt.hash(pin, 10),
        pinAttempts: 0,
        pinLockedUntil: null,
      },
    },
  );
  check(ride, 409, "PIN cannot be regenerated for this ride");
  res.json({ pin });
});
router.patch(
  "/:id/payment-method",
  roles("PASSENGER"),
  validate(
    z.object({ paymentMethod: z.enum(["CASH", "WALLET", "MOCK_CARD"]) }),
  ),
  async (req, res) => {
    check(
      req.validated.body.paymentMethod !== "MOCK_CARD" ||
        (env.ENABLE_MOCK_PAYMENTS === "true" && env.NODE_ENV !== "production"),
      400,
      "Mock card payments are disabled",
    );
    const ride = await Ride.findOneAndUpdate(
      {
        _id: req.params.id,
        passenger: req.user._id,
        status: { $nin: ["TRIP_COMPLETED", "CANCELLED"] },
      },
      { $set: req.validated.body },
      { new: true },
    );
    check(ride, 409, "Cannot change payment method");
    res.json(ride);
  },
);
router.post("/:id/share", async (req, res) => {
  await service.getRide(req.params.id, req.user);
  const token = crypto.randomBytes(32).toString("hex");
  await Ride.updateOne(
    { _id: req.params.id },
    {
      $set: {
        shareHash: hash(token),
        shareExpires: new Date(Date.now() + 2 * 3600000),
      },
    },
  );
  res.json({ token, expiresIn: 7200 });
});
router.post(
  "/:id/sos",
  validate(z.object({ location: place })),
  async (req, res) => {
    const ride = await service.getRide(req.params.id, req.user);
    check(
      !["TRIP_COMPLETED", "CANCELLED", "SCHEDULED"].includes(ride.status),
      409,
      "Safety alerts require an active ride",
    );
    const incident = await EmergencyIncident.create({
      user: req.user._id,
      ride: ride._id,
      location: req.validated.body.location,
    });
    emitAdmin("safety:alert", { incidentId: incident._id });
    res.status(201).json({
      incident,
      message:
        "Incident recorded for the operations team. Emergency services are not automatically contacted.",
    });
  },
);
router.get("/:id/receipt", async (req, res) => {
  const ride = await service.getRide(req.params.id, req.user);
  res.json({ ride, payment: await Payment.findOne({ rideId: ride._id }) });
});
export default router;

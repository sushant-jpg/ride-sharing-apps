import { Router } from "express";
import { z } from "zod";
import { auth, roles } from "../middleware/auth.js";
import { validate, objectId, place } from "../validators/index.js";
import {
  DriverProfile,
  DriverLocation,
  Vehicle,
  RideOffer,
  Ride,
} from "../models/index.js";
import { check } from "../utils/errors.js";
import * as service from "../services/rides.js";
const router = Router();
router.use(auth, roles("DRIVER"));
router.get("/profile", async (req, res) =>
  res.json({
    profile: await DriverProfile.findOne({ user: req.user._id }),
    vehicle: await Vehicle.findOne({ driver: req.user._id }),
  }),
);
router.put(
  "/profile",
  validate(
    z.object({
      address: z.string().min(3).max(240),
      licenseNumber: z.string().min(3).max(60),
      licenseImage: z.url().max(1000),
      identityDocument: z.url().max(1000),
      vehicleRegistration: z.url().max(1000),
      brand: z.string().min(1).max(60),
      model: z.string().min(1).max(60),
      year: z.number().int().min(1980).max(2030),
      plateNumber: z.string().min(3).max(30),
      color: z.string().min(1).max(30),
      category: z.enum(["sajilo", "sathi", "parivar", "hariyo"]),
      seatCapacity: z.number().int().min(1).max(8),
      photoUrl: z.url().max(1000),
    }),
  ),
  async (req, res) => {
    check(
      !(await Ride.exists({
        driver: req.user._id,
        status: {
          $in: [
            "DRIVER_ASSIGNED",
            "DRIVER_ARRIVING",
            "DRIVER_ARRIVED",
            "TRIP_STARTED",
          ],
        },
      })),
      409,
      "Finish your current ride first",
    );
    const {
      address,
      licenseNumber,
      licenseImage,
      identityDocument,
      vehicleRegistration,
      ...vehicle
    } = req.validated.body;
    await DriverProfile.updateOne(
      { user: req.user._id },
      {
        $set: {
          address,
          licenseNumber,
          licenseImage,
          identityDocument,
          vehicleRegistration,
          status: "PENDING",
          online: false,
        },
      },
    );
    await Vehicle.findOneAndUpdate(
      { driver: req.user._id },
      { $set: { ...vehicle, verificationStatus: "PENDING" } },
      { upsert: true },
    );
    res.json({ message: "Documents submitted for review" });
  },
);
router.patch(
  "/status",
  validate(z.object({ online: z.boolean(), location: place.optional() })),
  async (req, res) => {
    const { online, location } = req.validated.body;
    const profile = await DriverProfile.findOne({ user: req.user._id });
    check(
      profile && profile.status === "APPROVED",
      403,
      "Your driver account needs approval",
    );
    check(
      !profile.activeRide,
      409,
      "Finish your ride before changing availability",
    );
    if (online) {
      check(location, 400, "A current location is required");
      check(
        await Vehicle.exists({
          driver: req.user._id,
          verificationStatus: "APPROVED",
        }),
        403,
        "Your vehicle needs approval",
      );
      await DriverLocation.findOneAndUpdate(
        { driver: req.user._id },
        {
          $set: {
            location: {
              type: "Point",
              coordinates: [location.longitude, location.latitude],
            },
          },
        },
        { upsert: true },
      );
    }
    profile.online = online;
    await profile.save();
    res.json(profile);
  },
);
router.patch("/location", validate(place), async (req, res) =>
  res.json(await service.updateLocation(req.user, req.validated.body)),
);
router.get("/offers", async (req, res) =>
  res.json(
    await RideOffer.find({
      driver: req.user._id,
      status: "PENDING",
      expiresAt: { $gt: new Date() },
    }).populate({
      path: "ride",
      select:
        "pickup destination rideCategory estimatedDistance estimatedDuration estimatedFare status",
    }),
  ),
);
router.get("/current-ride", async (req, res) => {
  const profile = await DriverProfile.findOne({ user: req.user._id });
  res.json(
    profile?.activeRide
      ? await service.getRide(profile.activeRide, req.user)
      : null,
  );
});
router.get("/earnings", async (req, res) => {
  const rides = await Ride.find({
    driver: req.user._id,
    status: "TRIP_COMPLETED",
  })
    .sort({ completedAt: -1 })
    .limit(1000)
    .lean();
  const summarize = (days) => {
    const subset = rides.filter(
      (r) => r.completedAt > Date.now() - days * 86400000,
    );
    const gross = subset.reduce((s, r) => s + r.finalFare, 0);
    const commission = subset.reduce(
      (s, r) => s + r.finalFare * r.pricing.commission,
      0,
    );
    return { rides: subset.length, gross, commission, net: gross - commission };
  };
  res.json({ today: summarize(1), week: summarize(7), month: summarize(30) });
});
router.param("id", (req, _res, next, id) => {
  try {
    objectId.parse(id);
    next();
  } catch (err) {
    next(err);
  }
});
router.post("/rides/:id/accept", async (req, res) =>
  res.json(await service.acceptRide(req.params.id, req.user)),
);
router.post("/rides/:id/reject", async (req, res) => {
  const result = await RideOffer.findOneAndUpdate(
    { ride: req.params.id, driver: req.user._id, status: "PENDING" },
    { $set: { status: "REJECTED" } },
  );
  check(result, 404, "Offer not found");
  res.json({ success: true });
});
router.post("/rides/:id/arriving", async (req, res) =>
  res.json(
    await service.transition(req.params.id, req.user, "DRIVER_ARRIVING"),
  ),
);
router.post("/rides/:id/arrived", async (req, res) =>
  res.json(await service.transition(req.params.id, req.user, "DRIVER_ARRIVED")),
);
router.post(
  "/rides/:id/start",
  validate(z.object({ pin: z.string().regex(/^\d{4}$/) })),
  async (req, res) =>
    res.json(
      await service.transition(
        req.params.id,
        req.user,
        "TRIP_STARTED",
        req.validated.body.pin,
      ),
    ),
);
router.post("/rides/:id/complete", async (req, res) =>
  res.json(await service.transition(req.params.id, req.user, "TRIP_COMPLETED")),
);
export default router;

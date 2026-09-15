import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { auth, roles } from "../middleware/auth.js";
import { validate, objectId } from "../validators/index.js";
import {
  User,
  DriverProfile,
  Vehicle,
  Ride,
  Payment,
  Promo,
  SupportTicket,
  EmergencyIncident,
  AdminAuditLog,
  FareConfig,
  Settings,
  RefreshToken,
} from "../models/index.js";
import {
  ADMIN_ROLES,
  ACTIVE,
  CATEGORIES,
} from "../../../shared/constants/index.js";
import { check } from "../utils/errors.js";
import { notify } from "../services/events.js";
const router = Router();
router.use(auth, roles(...ADMIN_ROLES));
const operations = roles("SUPER_ADMIN", "OPERATIONS_ADMIN");
const finance = roles("SUPER_ADMIN", "FINANCE_ADMIN");
const support = roles("SUPER_ADMIN", "SUPPORT_ADMIN", "OPERATIONS_ADMIN");
async function audit(req, action, target, details, session) {
  await AdminAuditLog.create(
    [{ actor: req.user._id, action, target, details }],
    { session },
  );
}
router.get("/dashboard", async (_req, res) => {
  const [
    users,
    drivers,
    activeDrivers,
    activeRides,
    completed,
    cancelled,
    payments,
    daily,
    categories,
    zones,
  ] = await Promise.all([
    User.countDocuments({ role: "PASSENGER" }),
    DriverProfile.countDocuments(),
    DriverProfile.countDocuments({ online: true, status: "APPROVED" }),
    Ride.countDocuments({ status: { $in: ACTIVE } }),
    Ride.countDocuments({ status: "TRIP_COMPLETED" }),
    Ride.countDocuments({ status: "CANCELLED" }),
    Ride.aggregate([
      { $match: { status: "TRIP_COMPLETED" } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$finalFare" },
          commission: {
            $sum: { $multiply: ["$finalFare", "$pricing.commission"] },
          },
          averageFare: { $avg: "$finalFare" },
        },
      },
    ]),
    Ride.aggregate([
      {
        $match: {
          status: "TRIP_COMPLETED",
          completedAt: { $gte: new Date(Date.now() - 30 * 86400000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$completedAt",
              timezone: "Asia/Kathmandu",
            },
          },
          rides: { $sum: 1 },
          revenue: { $sum: "$finalFare" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Ride.aggregate([{ $group: { _id: "$rideCategory", count: { $sum: 1 } } }]),
    Ride.aggregate([
      { $group: { _id: "$pickup.address", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);
  res.json({
    users,
    drivers,
    activeDrivers,
    activeRides,
    completed,
    cancelled,
    cancellationRate: (cancelled / Math.max(completed + cancelled, 1)) * 100,
    ...payments[0],
    daily,
    categories,
    zones,
  });
});
router.get("/drivers", support, async (_req, res) =>
  res.json(
    await DriverProfile.find()
      .populate("user", "name email phone rating")
      .sort({ createdAt: -1 })
      .limit(100),
  ),
);
router.get(
  "/drivers/:id/vehicle",
  support,
  validate(z.object({ id: objectId }), "params"),
  async (req, res) =>
    res.json(await Vehicle.findOne({ driver: req.params.id })),
);
router.patch(
  "/drivers/:id/status",
  operations,
  validate(z.object({ id: objectId }), "params"),
  validate(z.object({ status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]) })),
  async (req, res) => {
    await mongoose.connection.transaction(async (session) => {
      const driver = await DriverProfile.findOne({
        user: req.params.id,
      }).session(session);
      check(driver, 404, "Driver not found");
      check(!driver.activeRide, 409, "Driver has an active ride");
      if (req.validated.body.status === "APPROVED")
        check(
          driver.licenseImage &&
            driver.identityDocument &&
            (await Vehicle.exists({ driver: driver.user }).session(session)),
          400,
          "Driver documents and vehicle are required",
        );
      driver.status = req.validated.body.status;
      driver.online = false;
      await driver.save({ session });
      await Vehicle.updateOne(
        { driver: driver.user },
        {
          $set: {
            verificationStatus:
              driver.status === "APPROVED" ? "APPROVED" : "REJECTED",
          },
        },
        { session },
      );
      await audit(
        req,
        "DRIVER_STATUS",
        req.params.id,
        req.validated.body,
        session,
      );
    });
    await notify(
      req.params.id,
      "Driver account update",
      `Your driver account is ${req.validated.body.status.toLowerCase()}.`,
    );
    res.json({ success: true });
  },
);
router.get(
  "/users",
  support,
  validate(z.object({ q: z.string().max(80).optional() }), "query"),
  async (req, res) => {
    const filter = { role: "PASSENGER" };
    if (req.validated.query.q)
      filter.name = {
        $regex: req.validated.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    res.json(await User.find(filter).limit(100).sort({ createdAt: -1 }));
  },
);
router.patch(
  "/users/:id",
  operations,
  validate(z.object({ id: objectId }), "params"),
  validate(z.object({ suspended: z.boolean() })),
  async (req, res) => {
    await mongoose.connection.transaction(async (session) => {
      const user = await User.findOne({
        _id: req.params.id,
        role: { $in: ["PASSENGER", "DRIVER"] },
      }).session(session);
      check(user, 404, "User not found");
      check(
        !user.activeRide &&
          !(await DriverProfile.exists({
            user: user._id,
            activeRide: { $ne: null },
          }).session(session)),
        409,
        "Resolve the active ride first",
      );
      user.suspended = req.validated.body.suspended;
      await user.save({ session });
      if (user.suspended)
        await RefreshToken.updateMany(
          { user: user._id },
          { $set: { revokedAt: new Date() } },
          { session },
        );
      await audit(
        req,
        "USER_STATUS",
        req.params.id,
        req.validated.body,
        session,
      );
    });
    res.json({ success: true });
  },
);
router.get("/rides", async (_req, res) =>
  res.json(
    await Ride.find()
      .populate("passenger", "name")
      .populate("driver", "name")
      .sort({ createdAt: -1 })
      .limit(100),
  ),
);
router.get("/payments", finance, async (_req, res) =>
  res.json(await Payment.find().sort({ createdAt: -1 }).limit(100)),
);
router.post(
  "/payments/:id/confirm-cash",
  finance,
  validate(z.object({ id: objectId }), "params"),
  async (req, res) => {
    await mongoose.connection.transaction(async (session) => {
      const payment = await Payment.findOneAndUpdate(
        { _id: req.params.id, paymentMethod: "CASH", status: "PENDING" },
        { $set: { status: "PAID" } },
        { new: true, session },
      );
      check(payment, 409, "Payment already confirmed or unavailable");
      await Ride.updateOne(
        { _id: payment.rideId },
        { $set: { paymentStatus: "PAID" } },
        { session },
      );
      await audit(req, "CASH_CONFIRMED", req.params.id, {}, session);
    });
    res.json({ success: true });
  },
);
router.get("/promos", finance, async (_req, res) =>
  res.json(await Promo.find().limit(100)),
);
router.post(
  "/promos",
  finance,
  validate(
    z.object({
      code: z.string().regex(/^[A-Z0-9]{3,20}$/),
      type: z.enum(["FIXED", "PERCENT"]),
      value: z.number().positive().max(10000),
      maxDiscount: z.number().positive().max(10000),
      minimumAmount: z.number().nonnegative(),
      usageLimit: z.number().int().positive(),
      expiresAt: z.iso.datetime(),
    }),
  ),
  async (req, res) => {
    check(
      req.validated.body.type !== "PERCENT" || req.validated.body.value <= 100,
      400,
      "Percentage must not exceed 100",
    );
    const promo = await mongoose.connection.transaction(async (session) => {
      const [created] = await Promo.create([req.validated.body], { session });
      await audit(
        req,
        "PROMO_CREATED",
        String(created._id),
        req.validated.body,
        session,
      );
      return created;
    });
    res.status(201).json(promo);
  },
);
router.get("/support", support, async (_req, res) =>
  res.json(
    await SupportTicket.find()
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .limit(100),
  ),
);
router.patch(
  "/support/:id",
  support,
  validate(z.object({ id: objectId }), "params"),
  validate(
    z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) }),
  ),
  async (req, res) => {
    await mongoose.connection.transaction(async (session) => {
      check(
        await SupportTicket.findByIdAndUpdate(
          req.params.id,
          { $set: req.validated.body },
          { session },
        ),
        404,
        "Ticket not found",
      );
      await audit(
        req,
        "TICKET_STATUS",
        req.params.id,
        req.validated.body,
        session,
      );
    });
    res.json({ success: true });
  },
);
router.get("/safety", support, async (_req, res) =>
  res.json(
    await EmergencyIncident.find()
      .populate("user", "name phone")
      .sort({ createdAt: -1 })
      .limit(100),
  ),
);
router.patch(
  "/safety/:id",
  support,
  validate(z.object({ id: objectId }), "params"),
  async (req, res) => {
    await mongoose.connection.transaction(async (session) => {
      check(
        await EmergencyIncident.findByIdAndUpdate(
          req.params.id,
          { $set: { status: "RESOLVED" } },
          { session },
        ),
        404,
        "Incident not found",
      );
      await audit(req, "INCIDENT_RESOLVED", req.params.id, {}, session);
    });
    res.json({ success: true });
  },
);
router.get("/settings", finance, async (_req, res) =>
  res.json({
    fares: CATEGORIES.map((c) => c),
    overrides: await FareConfig.find(),
    demand: await Settings.findOne({ key: "global" }),
  }),
);
router.put(
  "/settings/fares/:category",
  finance,
  validate(
    z.object({ category: z.enum(["sajilo", "sathi", "parivar", "hariyo"]) }),
    "params",
  ),
  validate(
    z.object({
      baseFare: z.number().nonnegative().max(10000),
      pricePerKm: z.number().nonnegative().max(1000),
      pricePerMinute: z.number().nonnegative().max(1000),
      minimumFare: z.number().nonnegative().max(10000),
      bookingFee: z.number().nonnegative().max(1000),
      commission: z.number().min(0).max(0.5),
    }),
  ),
  async (req, res) => {
    await mongoose.connection.transaction(async (session) => {
      await FareConfig.findOneAndUpdate(
        { category: req.params.category },
        { $set: req.validated.body },
        { upsert: true, session },
      );
      await audit(
        req,
        "FARE_CHANGED",
        req.params.category,
        req.validated.body,
        session,
      );
    });
    res.json({ success: true });
  },
);
router.put(
  "/settings/demand",
  finance,
  validate(
    z.object({
      demandEnabled: z.boolean(),
      maxMultiplier: z.number().min(1).max(2),
    }),
  ),
  async (req, res) => {
    await mongoose.connection.transaction(async (session) => {
      await Settings.findOneAndUpdate(
        { key: "global" },
        { $set: req.validated.body },
        { upsert: true, session },
      );
      await audit(req, "DEMAND_CHANGED", "global", req.validated.body, session);
    });
    res.json({ success: true });
  },
);
router.get("/audit", roles("SUPER_ADMIN"), async (_req, res) =>
  res.json(await AdminAuditLog.find().sort({ createdAt: -1 }).limit(100)),
);
export default router;

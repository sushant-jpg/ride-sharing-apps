import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { auth, roles } from "../middleware/auth.js";
import { validate, objectId, place } from "../validators/index.js";
import {
  User,
  SavedPlace,
  Wallet,
  WalletTransaction,
  Notification,
  SupportTicket,
  Payment,
} from "../models/index.js";
import { publicUser } from "../services/auth.js";
import { check } from "../utils/errors.js";
import { env } from "../config/env.js";
const router = Router();
router.use(auth);
router.get("/users/profile", async (req, res) =>
  res.json(publicUser(req.user)),
);
router.patch(
  "/users/profile",
  validate(
    z.object({
      name: z.string().min(2).max(80).optional(),
      phone: z.string().min(7).max(25).optional(),
      emergencyContact: z.string().max(80).optional(),
      avatarUrl: z.union([z.url().max(1000), z.literal("")]).optional(),
    }),
  ),
  async (req, res) =>
    res.json(
      publicUser(
        await User.findByIdAndUpdate(
          req.user._id,
          { $set: req.validated.body },
          { new: true },
        ),
      ),
    ),
);
router.get("/places", async (req, res) =>
  res.json(await SavedPlace.find({ user: req.user._id })),
);
router.post(
  "/places",
  validate(z.object({ label: z.string().min(1).max(40), place })),
  async (req, res) =>
    res
      .status(201)
      .json(
        await SavedPlace.findOneAndUpdate(
          { user: req.user._id, label: req.validated.body.label },
          { $set: { place: req.validated.body.place } },
          { new: true, upsert: true },
        ),
      ),
);
router.delete(
  "/places/:id",
  validate(z.object({ id: objectId }), "params"),
  async (req, res) => {
    await SavedPlace.deleteOne({ _id: req.params.id, user: req.user._id });
    res.json({ success: true });
  },
);
router.get("/wallet", async (req, res) =>
  res.json(await Wallet.findOne({ user: req.user._id })),
);
router.get("/wallet/transactions", async (req, res) =>
  res.json(
    await WalletTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100),
  ),
);
router.post(
  "/wallet/mock-credit",
  roles("PASSENGER"),
  validate(z.object({ amount: z.number().int().min(100).max(5000) })),
  async (req, res) => {
    check(
      env.NODE_ENV !== "production" && env.ENABLE_MOCK_PAYMENTS === "true",
      403,
      "Development credits are disabled",
    );
    const wallet = await mongoose.connection.transaction(async (session) => {
      const updated = await Wallet.findOneAndUpdate(
        { user: req.user._id },
        { $inc: { balance: req.validated.body.amount } },
        { new: true, session },
      );
      await WalletTransaction.create(
        [
          {
            user: req.user._id,
            wallet: updated._id,
            amount: req.validated.body.amount,
            kind: "MOCK_CREDIT",
            reference: crypto.randomUUID(),
            description: "Development credits — no money charged",
          },
        ],
        { session },
      );
      return updated;
    });
    res.json(wallet);
  },
);
router.get("/payments", async (req, res) =>
  res.json(
    await Payment.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100),
  ),
);
router.get("/notifications", async (req, res) =>
  res.json(
    await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100),
  ),
);
router.post("/notifications/read", async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, read: false },
    { $set: { read: true } },
  );
  res.json({ success: true });
});
router.get("/support", async (req, res) =>
  res.json(
    await SupportTicket.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100),
  ),
);
router.post(
  "/support",
  validate(
    z.object({
      category: z.enum([
        "PAYMENT",
        "DRIVER",
        "PASSENGER",
        "LOST_ITEM",
        "SAFETY",
        "TECHNICAL",
      ]),
      message: z.string().min(10).max(2000),
      ride: objectId.optional(),
    }),
  ),
  async (req, res) => {
    if (req.validated.body.ride) {
      const { getRide } = await import("../services/rides.js");
      await getRide(req.validated.body.ride, req.user);
    }
    res.status(201).json(
      await SupportTicket.create({
        user: req.user._id,
        ...req.validated.body,
      }),
    );
  },
);
export default router;

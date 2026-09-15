import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User, RefreshToken, Wallet, DriverProfile } from "../models/index.js";
import { check } from "../utils/errors.js";
export const hash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
export const publicUser = (user) => {
  const {
    passwordHash: _passwordHash,
    resetHash: _resetHash,
    resetExpires: _resetExpires,
    verificationHash: _verificationHash,
    ...safe
  } = user.toObject();
  return safe;
};
export async function issueSession(
  user,
  userAgent,
  family = crypto.randomUUID(),
  session,
) {
  const refreshToken = crypto.randomBytes(48).toString("hex");
  await RefreshToken.create(
    [
      {
        user: user._id,
        hash: hash(refreshToken + env.JWT_REFRESH_SECRET),
        family,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        userAgent: userAgent?.slice(0, 300),
      },
    ],
    { session },
  );
  return {
    accessToken: jwt.sign({ sid: family }, env.JWT_ACCESS_SECRET, {
      subject: String(user._id),
      expiresIn: "15m",
    }),
    refreshToken,
    user: publicUser(user),
  };
}
export async function registerUser(data) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  return mongoose.connection.transaction(async (session) => {
    const [user] = await User.create(
      [
        {
          name: data.name,
          email: data.email,
          phone: data.phone,
          passwordHash,
          role: data.role,
        },
      ],
      { session },
    );
    await Wallet.create([{ user: user._id }], { session });
    if (user.role === "DRIVER")
      await DriverProfile.create([{ user: user._id }], { session });
    return user;
  });
}
export async function login(data) {
  const user = await User.findOne({ email: data.email }).select(
    "+passwordHash",
  );
  check(
    user &&
      !user.suspended &&
      (await bcrypt.compare(data.password, user.passwordHash)),
    401,
    "Email or password is incorrect",
    "INVALID_CREDENTIALS",
  );
  return user;
}
export async function rotate(raw, userAgent) {
  check(typeof raw === "string", 401, "Please sign in", "UNAUTHORIZED");
  const old = await RefreshToken.findOneAndUpdate(
    {
      hash: hash(raw + env.JWT_REFRESH_SECRET),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { revokedAt: new Date() } },
    { new: true },
  );
  if (!old) {
    const reused = await RefreshToken.findOne({
      hash: hash(raw + env.JWT_REFRESH_SECRET),
    });
    if (reused)
      await RefreshToken.updateMany(
        { family: reused.family },
        { $set: { revokedAt: new Date() } },
      );
    check(false, 401, "Session expired", "UNAUTHORIZED");
  }
  const user = await User.findById(old.user);
  check(user && !user.suspended, 401, "Account unavailable", "UNAUTHORIZED");
  return issueSession(user, userAgent, old.family);
}

import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { env } from "../config/env.js";
import { User, RefreshToken } from "../models/index.js";
import {
  hash,
  issueSession,
  registerUser,
  login,
  rotate,
} from "../services/auth.js";
const cookie = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth",
  maxAge: 7 * 86400000,
};
const cookieName = (req) =>
  `rn_refresh_${["passenger", "driver", "admin"].includes(req.headers["x-app-role"]) ? req.headers["x-app-role"] : "passenger"}`;
function respond(req, res, session) {
  const { refreshToken, ...body } = session;
  res.cookie(cookieName(req), refreshToken, cookie).json(body);
}
export async function register(req, res) {
  const user = await registerUser(req.validated.body);
  respond(req, res, await issueSession(user, req.headers["user-agent"]));
}
export async function signIn(req, res) {
  const user = await login(req.validated.body);
  respond(req, res, await issueSession(user, req.headers["user-agent"]));
}
export async function refresh(req, res) {
  respond(
    req,
    res,
    await rotate(req.cookies[cookieName(req)], req.headers["user-agent"]),
  );
}
export async function logout(req, res) {
  if (req.cookies[cookieName(req)])
    await RefreshToken.updateMany(
      { hash: hash(req.cookies[cookieName(req)] + env.JWT_REFRESH_SECRET) },
      { $set: { revokedAt: new Date() } },
    );
  res.clearCookie(cookieName(req), cookie).json({ success: true });
}
export async function forgot(req, res) {
  const user = await User.findOne({ email: req.validated.body.email });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetHash: hash(token),
          resetExpires: new Date(Date.now() + 30 * 60000),
        },
      },
    ); /* Provider adapter: token must be sent via verified email, never logs or public responses. */
  }
  res.status(202).json({
    message:
      "If the account exists, a reset can be requested through support. Email delivery is not configured yet.",
  });
}
export async function reset(req, res) {
  const user = await User.findOneAndUpdate(
    {
      resetHash: hash(req.validated.body.token),
      resetExpires: { $gt: new Date() },
    },
    {
      $set: {
        passwordHash: await bcrypt.hash(req.validated.body.password, 12),
      },
      $unset: { resetHash: 1, resetExpires: 1 },
    },
  );
  if (!user)
    return res.status(400).json({
      success: false,
      message: "Reset link is invalid or expired",
      code: "INVALID_TOKEN",
    });
  await RefreshToken.updateMany(
    { user: user._id },
    { $set: { revokedAt: new Date() } },
  );
  res.json({ success: true });
}

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User, RefreshToken } from "../models/index.js";
import { check } from "../utils/errors.js";
export async function authenticateToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    check(false, 401, "Please sign in again", "UNAUTHORIZED");
  }
  const user = await User.findById(payload.sub);
  check(user && !user.suspended, 401, "Account unavailable", "UNAUTHORIZED");
  check(
    await RefreshToken.exists({
      user: user._id,
      family: payload.sid,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }),
    401,
    "Session has ended",
    "UNAUTHORIZED",
  );
  return user;
}
export async function auth(req, _res, next) {
  try {
    req.user = await authenticateToken(
      req.headers.authorization?.split(" ")[1],
    );
    next();
  } catch (err) {
    next(err);
  }
}
export const roles =
  (...allowed) =>
  (req, _res, next) => {
    try {
      check(
        allowed.includes(req.user.role),
        403,
        "This action is not available for your role",
        "FORBIDDEN",
      );
      next();
    } catch (err) {
      next(err);
    }
  };

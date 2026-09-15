import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  validate,
  credentials,
  register as registerSchema,
} from "../validators/index.js";
import * as controller from "../controllers/auth.js";
import { auth } from "../middleware/auth.js";
import { RefreshToken } from "../models/index.js";
const router = Router();
router.use(
  rateLimit({
    windowMs: 15 * 60000,
    limit: process.env.NODE_ENV === "test" ? 1000 : 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
router.post("/register", validate(registerSchema), controller.register);
router.post("/login", validate(credentials), controller.signIn);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.post("/logout-all", auth, async (req, res) => {
  await RefreshToken.updateMany(
    { user: req.user._id },
    { $set: { revokedAt: new Date() } },
  );
  res.json({ success: true });
});
router.post(
  "/forgot-password",
  validate(z.object({ email: z.email().transform((v) => v.toLowerCase()) })),
  controller.forgot,
);
router.post(
  "/reset-password",
  validate(
    z.object({
      token: z.string().length(64),
      password: credentials.shape.password,
    }),
  ),
  controller.reset,
);
export default router;

import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { z, ZodError } from "zod";
import mongoose from "mongoose";
import { env, origins } from "./config/env.js";
import { logger } from "./utils/logger.js";
import authRouter from "./routes/auth.js";
import rideRouter from "./routes/rides.js";
import driverRouter from "./routes/drivers.js";
import accountRouter from "./routes/account.js";
import adminRouter from "./routes/admin.js";
import { auth } from "./middleware/auth.js";
import { validate } from "./validators/index.js";
import { searchPlaces, reversePlace } from "./services/maps.js";
import { Ride, DriverLocation } from "./models/index.js";
import { hash } from "./services/auth.js";
import { CATEGORIES } from "../../shared/constants/index.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      !origins.includes(req.headers.origin)
    )
      return res.status(403).json({
        success: false,
        message: "Origin not allowed",
        code: "FORBIDDEN",
      });
    next();
  });
  // Reject MongoDB operator keys recursively; queries are additionally constructed from validated primitives.
  app.use((req, res, next) => {
    const unsafe = (value) =>
      value &&
      typeof value === "object" &&
      Object.entries(value).some(
        ([key, v]) => key.startsWith("$") || key.includes(".") || unsafe(v),
      );
    if (unsafe(req.body))
      return res.status(400).json({
        success: false,
        message: "Invalid input keys",
        code: "VALIDATION_ERROR",
      });
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: env.NODE_ENV === "test" ? 10000 : 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.get("/api/health", (_req, res) =>
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      status:
        mongoose.connection.readyState === 1 ? "ok" : "database_unavailable",
    }),
  );
  app.get("/api/config", (_req, res) =>
    res.json({
      brand: "Ride Nepaljung",
      categories: CATEGORIES,
      mockPayments:
        env.ENABLE_MOCK_PAYMENTS === "true" && env.NODE_ENV !== "production",
    }),
  );
  app.use("/api/auth", authRouter);
  app.get(
    "/api/maps/search",
    auth,
    validate(z.object({ q: z.string().trim().min(2).max(160) }), "query"),
    async (req, res) => res.json(await searchPlaces(req.validated.query.q)),
  );
  app.get(
    "/api/maps/reverse",
    auth,
    validate(
      z.object({
        latitude: z.coerce.number().min(-90).max(90),
        longitude: z.coerce.number().min(-180).max(180),
      }),
      "query",
    ),
    async (req, res) =>
      res.json(
        await reversePlace(
          req.validated.query.latitude,
          req.validated.query.longitude,
        ),
      ),
  );
  app.get("/api/tracking/:token", async (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(req.params.token))
      return res.status(404).json({ message: "Tracking link expired" });
    const ride = await Ride.findOne({
      shareHash: hash(req.params.token),
      shareExpires: { $gt: new Date() },
      status: { $nin: ["TRIP_COMPLETED", "CANCELLED"] },
    }).select("status driver destination");
    if (!ride)
      return res.status(404).json({ message: "Tracking link expired" });
    const location = await DriverLocation.findOne({ driver: ride.driver });
    res.json({
      status: ride.status,
      destination: ride.destination,
      location: location?.location,
    });
  });
  app.use("/api/rides", rideRouter);
  app.use("/api/drivers", driverRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", accountRouter);
  app.use((_req, res) =>
    res.status(404).json({
      success: false,
      message: "Endpoint not found",
      code: "NOT_FOUND",
    }),
  );
  app.use((err, _req, res, _next) => {
    let status = err.status || 500,
      code = err.code || "INTERNAL_ERROR",
      message = err.message;
    if (err instanceof ZodError) {
      status = 400;
      code = "VALIDATION_ERROR";
      message = err.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    }
    if (err.code === 11000) {
      status = 409;
      code = "DUPLICATE";
      message = "This record already exists";
    }
    if (err.name === "CastError") {
      status = 400;
      code = "VALIDATION_ERROR";
      message = "Invalid identifier";
    }
    if (status >= 500) {
      logger.error({ error: err.message }, "Request failed");
      message = "Something went wrong. Please try again.";
    }
    res.status(status).json({ success: false, message, code });
  });
  return app;
}

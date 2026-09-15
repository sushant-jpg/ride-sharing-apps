import {
  Ride,
  RideOffer,
  DriverProfile,
  DriverLocation,
} from "../models/index.js";
import { matchRide } from "../services/matching.js";
import { rideChanged } from "../services/events.js";
import { logger } from "../utils/logger.js";
let working = false;
export async function tick() {
  if (working) return;
  working = true;
  try {
    const due = await Ride.find({
      status: "SCHEDULED",
      scheduledAt: { $lte: new Date(Date.now() + 5 * 60000) },
    }).limit(50);
    for (const ride of due) {
      const changed = await Ride.findOneAndUpdate(
        { _id: ride._id, status: "SCHEDULED" },
        {
          $set: {
            status: "SEARCHING",
            nextMatchAt: new Date(),
            requestedAt: new Date(),
          },
        },
        { new: true },
      );
      if (changed) rideChanged(changed);
    }
    const searching = await Ride.find({
      status: "SEARCHING",
      nextMatchAt: { $lte: new Date() },
    }).limit(50);
    for (const ride of searching) await matchRide(ride._id);
    await RideOffer.updateMany(
      { status: "PENDING", expiresAt: { $lte: new Date() } },
      { $set: { status: "EXPIRED" } },
    );
    const fresh = await DriverLocation.find({
      updatedAt: { $gt: new Date(Date.now() - 60000) },
    }).distinct("driver");
    await DriverProfile.updateMany(
      { online: true, activeRide: null, user: { $nin: fresh } },
      { $set: { online: false } },
    );
  } catch (err) {
    logger.error({ error: err.message }, "Ride dispatch job failed");
  } finally {
    working = false;
  }
}
export function startJobs() {
  const timer = setInterval(tick, 5000);
  timer.unref();
  return () => clearInterval(timer);
}

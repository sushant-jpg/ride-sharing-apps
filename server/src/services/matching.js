import {
  DriverLocation,
  DriverProfile,
  Vehicle,
  User,
  Ride,
  RideOffer,
} from "../models/index.js";
import { distance } from "./maps.js";
import { emitUser, rideChanged } from "./events.js";
import { cancelRide } from "./rides.js";
export function driverScore({
  distanceKm,
  rating = 5,
  acceptanceRate = 1,
  idleMinutes = 0,
}) {
  return (
    0.65 * (1 - Math.min(distanceKm / 10, 1)) +
    (0.2 * rating) / 5 +
    0.1 * acceptanceRate +
    0.05 * Math.min(idleMinutes / 60, 1)
  );
}
export async function matchRide(id) {
  const ride = await Ride.findOneAndUpdate(
    { _id: id, status: "SEARCHING", nextMatchAt: { $lte: new Date() } },
    {
      $inc: { matchRound: 1 },
      $set: { nextMatchAt: new Date(Date.now() + 25000) },
    },
    { new: true },
  );
  if (!ride) return;
  if (ride.matchRound > 4) {
    await cancelRide(ride._id, ride.passenger, "No available drivers nearby");
    return;
  }
  const radius = [2, 4, 7, 10][ride.matchRound - 1];
  const locations = await DriverLocation.find({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [ride.pickup.longitude, ride.pickup.latitude],
        },
        $maxDistance: radius * 1000,
      },
    },
    updatedAt: { $gt: new Date(Date.now() - 60000) },
  }).limit(60);
  const existing = await RideOffer.find({ ride: ride._id }).distinct("driver");
  const offered = new Set(existing.map(String));
  const ranked = [];
  for (const location of locations) {
    if (offered.has(String(location.driver))) continue;
    const profile = await DriverProfile.findOne({
      user: location.driver,
      online: true,
      available: true,
      activeRide: null,
      status: "APPROVED",
    });
    if (!profile) continue;
    const vehicle = await Vehicle.findOne({
      driver: location.driver,
      category: ride.rideCategory,
      verificationStatus: "APPROVED",
    });
    if (!vehicle) continue;
    const user = await User.findOne({ _id: location.driver, suspended: false });
    if (!user) continue;
    const km = distance(ride.pickup, {
      latitude: location.location.coordinates[1],
      longitude: location.location.coordinates[0],
    });
    ranked.push({
      driver: user._id,
      score: driverScore({
        distanceKm: km,
        rating: user.rating,
        acceptanceRate: profile.acceptanceRate,
        idleMinutes: profile.lastAssignedAt
          ? (Date.now() - profile.lastAssignedAt) / 60000
          : 60,
      }),
    });
  }
  for (const candidate of ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)) {
    const offer = await RideOffer.create({
      ride: ride._id,
      driver: candidate.driver,
      expiresAt: new Date(Date.now() + 22000),
    });
    emitUser(candidate.driver, "ride:offer", {
      offerId: offer._id,
      rideId: ride._id,
    });
  }
  rideChanged(ride);
}

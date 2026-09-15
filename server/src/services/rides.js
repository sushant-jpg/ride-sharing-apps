import mongoose from "mongoose";
import { env } from "../config/env.js";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import {
  Ride,
  User,
  DriverProfile,
  Vehicle,
  RideOffer,
  DriverLocation,
  Promo,
  PromoRedemption,
  Rating,
} from "../models/index.js";
import { ACTIVE, TRANSITIONS } from "../../../shared/constants/index.js";
import { check } from "../utils/errors.js";
import { routeBetween, distance } from "./maps.js";
import { quote, calculateFare, round } from "./fare.js";
import { settle } from "./payments.js";
import { rideChanged, notify, emitUser } from "./events.js";
import { logger } from "../utils/logger.js";
export async function estimate(data, user) {
  const route = await routeBetween([
    data.pickup,
    ...data.stops,
    data.destination,
  ]);
  const fare = await quote(data.rideCategory, route, data.promoCode, user);
  return { ...route, ...fare };
}
export async function createRide(data, user) {
  check(
    data.paymentMethod !== "MOCK_CARD" ||
      (env.ENABLE_MOCK_PAYMENTS === "true" && env.NODE_ENV !== "production"),
    400,
    "Mock card payments are disabled",
  );
  const { pricing, breakdown, promo, ...route } = await estimate(
    data,
    user._id,
  );
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
  check(
    !scheduledAt ||
      (scheduledAt > Date.now() + 10 * 60000 &&
        scheduledAt < Date.now() + 30 * 86400000),
    400,
    "Schedule between 10 minutes and 30 days ahead",
  );
  const pin = String(crypto.randomInt(1000, 10000));
  const verificationPinHash = await bcrypt.hash(pin, 10);
  const ride = await mongoose.connection.transaction(async (session) => {
    const passenger = await User.findOneAndUpdate(
      { _id: user._id, activeRide: null },
      { $set: { activeRide: new mongoose.Types.ObjectId() } },
      { new: true, session },
    );
    check(
      passenger,
      409,
      "You already have an active or scheduled ride",
      "ACTIVE_RIDE",
    );
    const [created] = await Ride.create(
      [
        {
          _id: passenger.activeRide,
          passenger: user._id,
          pickup: data.pickup,
          destination: data.destination,
          stops: data.stops,
          rideCategory: data.rideCategory,
          paymentMethod: data.paymentMethod,
          pricing,
          estimatedDistance: route.distanceKm,
          estimatedDuration: route.durationMinutes,
          estimatedFare: breakdown.estimatedFare,
          fareBreakdown: breakdown,
          route: route.geometry,
          routeSource: route.source,
          verificationPinHash,
          status: scheduledAt ? "SCHEDULED" : "SEARCHING",
          scheduledAt,
          requestedAt: new Date(),
          nextMatchAt: new Date(),
          promo: promo?._id,
        },
      ],
      { session },
    );
    if (promo) {
      const reserved = await Promo.findOneAndUpdate(
        {
          _id: promo._id,
          used: { $lt: promo.usageLimit },
          expiresAt: { $gt: new Date() },
        },
        { $inc: { used: 1 } },
        { session },
      );
      check(reserved, 409, "Promo usage limit reached");
      await PromoRedemption.create(
        [{ promo: promo._id, user: user._id, ride: created._id }],
        { session },
      );
    }
    return created;
  });
  // PIN is returned only to the passenger at creation; it can be regenerated before trip start.
  rideChanged(ride);
  logger.info({ rideId: ride._id }, "Ride created");
  return { ride: await getRide(ride._id, user), pin };
}
export async function getRide(id, user) {
  const ride = await Ride.findById(id)
    .populate("driver", "name phone avatarUrl rating")
    .populate("vehicle")
    .populate("passenger", "name phone avatarUrl rating")
    .lean();
  check(ride, 404, "Ride not found");
  check(
    String(ride.passenger._id) === String(user._id) ||
      String(ride.driver?._id) === String(user._id) ||
      user.role.endsWith("ADMIN"),
    403,
    "This ride is private",
  );
  delete ride.shareHash;
  delete ride.verificationPinHash;
  if (ride.driver)
    ride.driverLocation = await DriverLocation.findOne({
      driver: ride.driver._id,
    }).lean();
  return ride;
}
export async function acceptRide(id, driver) {
  const ride = await mongoose.connection.transaction(async (session) => {
    const offer = await RideOffer.findOne({
      ride: id,
      driver: driver._id,
      status: "PENDING",
      expiresAt: { $gt: new Date() },
    }).session(session);
    check(offer, 409, "This offer has expired");
    const available = await DriverProfile.findOneAndUpdate(
      {
        user: driver._id,
        status: "APPROVED",
        online: true,
        available: true,
        activeRide: null,
      },
      {
        $set: { available: false, activeRide: id, lastAssignedAt: new Date() },
      },
      { new: true, session },
    );
    check(available, 409, "You are not available for a ride");
    const vehicle = await Vehicle.findOne({
      driver: driver._id,
      verificationStatus: "APPROVED",
    }).session(session);
    check(vehicle, 403, "An approved vehicle is required");
    const assigned = await Ride.findOneAndUpdate(
      {
        _id: id,
        status: "SEARCHING",
        driver: null,
        rideCategory: vehicle.category,
      },
      {
        $set: {
          driver: driver._id,
          vehicle: vehicle._id,
          status: "DRIVER_ASSIGNED",
          acceptedAt: new Date(),
        },
      },
      { new: true, session },
    );
    check(assigned, 409, "Another driver has accepted this ride", "RIDE_TAKEN");
    await RideOffer.updateMany(
      { ride: id },
      { $set: { status: "EXPIRED" } },
      { session },
    );
    await RideOffer.updateOne(
      { _id: offer._id },
      { $set: { status: "ACCEPTED" } },
      { session },
    );
    return assigned;
  });
  rideChanged(ride);
  await notify(
    ride.passenger,
    "Your ride is on its way",
    `${driver.name} accepted your ride.`,
    ride._id,
  );
  logger.info({ rideId: id }, "Ride accepted");
  return getRide(id, driver);
}
export async function transition(id, driver, target, pin) {
  let result;
  if (target === "TRIP_STARTED") {
    const ride = await Ride.findOne({
      _id: id,
      driver: driver._id,
      status: "DRIVER_ARRIVED",
    }).select("+verificationPinHash");
    check(ride, 409, "Arrive at the pickup before starting");
    check(
      !ride.pinLockedUntil || ride.pinLockedUntil <= new Date(),
      429,
      "Too many PIN attempts. Wait five minutes.",
    );
    if (!(await bcrypt.compare(pin || "", ride.verificationPinHash))) {
      await Ride.updateOne(
        { _id: id },
        {
          $inc: { pinAttempts: 1 },
          $set: {
            pinLockedUntil:
              ride.pinAttempts >= 4 ? new Date(Date.now() + 300000) : null,
          },
        },
      );
      check(false, 400, "Incorrect trip PIN", "INVALID_PIN");
    }
  }
  result = await mongoose.connection.transaction(async (session) => {
    const ride = await Ride.findOne({ _id: id, driver: driver._id }).session(
      session,
    );
    check(ride, 404, "Assigned ride not found");
    check(
      TRANSITIONS[ride.status].includes(target),
      409,
      `Cannot move from ${ride.status} to ${target}`,
      "INVALID_TRANSITION",
    );
    const previous = ride.status;
    ride.status = target;
    if (target === "DRIVER_ARRIVED") ride.driverArrivedAt = new Date();
    if (target === "TRIP_STARTED") {
      ride.startedAt = new Date();
      const location = await DriverLocation.findOne({
        driver: driver._id,
      }).session(session);
      if (location) {
        ride.lastTrackPoint = location.location;
        ride.lastTrackAt = new Date();
      }
    }
    if (target === "TRIP_COMPLETED") {
      ride.completedAt = new Date();
      ride.actualDuration = round((ride.completedAt - ride.startedAt) / 60000);
      // Missing GPS does not produce a zero-distance fare. Explicitly retain the quoted route estimate.
      const km =
        ride.actualDistance > 0.1
          ? ride.actualDistance
          : ride.estimatedDistance;
      ride.actualDistance = round(km);
      const final = calculateFare(ride.pricing, km, ride.actualDuration, {
        multiplier: ride.fareBreakdown.demandMultiplier,
        discount: ride.fareBreakdown.discount,
      });
      ride.finalFare = final.estimatedFare;
      await settle(ride, session);
      await DriverProfile.updateOne(
        { user: driver._id, activeRide: ride._id },
        { $set: { available: true, activeRide: null } },
        { session },
      );
      await User.updateOne(
        { _id: ride.passenger, activeRide: ride._id },
        { $set: { activeRide: null } },
        { session },
      );
    }
    const updated = await Ride.findOneAndUpdate(
      { _id: id, status: previous },
      {
        $set: {
          status: ride.status,
          driverArrivedAt: ride.driverArrivedAt,
          startedAt: ride.startedAt,
          completedAt: ride.completedAt,
          actualDistance: ride.actualDistance,
          actualDuration: ride.actualDuration,
          finalFare: ride.finalFare,
          paymentStatus: ride.paymentStatus,
          lastTrackPoint: ride.lastTrackPoint,
          lastTrackAt: ride.lastTrackAt,
        },
      },
      { new: true, session },
    );
    check(updated, 409, "Ride changed; refresh and try again");
    return updated;
  });
  rideChanged(result);
  await notify(
    result.passenger,
    target.replaceAll("_", " "),
    "Your ride status has been updated.",
    id,
  );
  return getRide(id, driver);
}
export async function cancelRide(id, userId, reason) {
  const ride = await mongoose.connection.transaction(async (session) => {
    const current = await Ride.findById(id).session(session);
    check(current, 404, "Ride not found");
    const passenger = String(current.passenger) === String(userId),
      driver = String(current.driver) === String(userId);
    check(passenger || driver, 403, "You cannot cancel this ride");
    check(
      TRANSITIONS[current.status].includes("CANCELLED") &&
        !(driver && current.status === "TRIP_STARTED"),
      409,
      "Ride cannot be cancelled in this state",
    );
    const updated = await Ride.findOneAndUpdate(
      { _id: id, status: current.status },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledBy: userId,
          cancellationReason: reason,
        },
      },
      { new: true, session },
    );
    check(updated, 409, "Ride changed; try again");
    await User.updateOne(
      { _id: current.passenger, activeRide: id },
      { $set: { activeRide: null } },
      { session },
    );
    if (current.driver)
      await DriverProfile.updateOne(
        { user: current.driver, activeRide: id },
        { $set: { available: true, activeRide: null } },
        { session },
      );
    await RideOffer.updateMany(
      { ride: id, status: "PENDING" },
      { $set: { status: "EXPIRED" } },
      { session },
    );
    return updated;
  });
  rideChanged(ride);
  logger.info({ rideId: id }, "Ride cancelled");
  return ride;
}
export async function updateLocation(driver, coordinates) {
  const profile = await DriverProfile.findOne({
    user: driver._id,
    status: "APPROVED",
    online: true,
  });
  check(profile, 403, "Go online with an approved account to share location");
  const previous = await DriverLocation.findOne({ driver: driver._id });
  if (previous) {
    const seconds = (Date.now() - previous.updatedAt) / 1000;
    check(seconds >= 2, 429, "Please wait before sending another location");
    const km = distance(
      {
        latitude: previous.location.coordinates[1],
        longitude: previous.location.coordinates[0],
      },
      coordinates,
    );
    check(
      km <= Math.max(0.1, seconds * 0.05),
      400,
      "Location update exceeds a plausible travel speed",
    );
  }
  const point = {
    type: "Point",
    coordinates: [coordinates.longitude, coordinates.latitude],
  };
  const location = await DriverLocation.findOneAndUpdate(
    { driver: driver._id },
    { $set: { location: point } },
    { upsert: true, new: true },
  );
  if (profile.activeRide) {
    const ride = await Ride.findById(profile.activeRide);
    if (ride?.status === "TRIP_STARTED") {
      let increment = 0;
      if (ride.lastTrackPoint)
        increment = distance(
          {
            latitude: ride.lastTrackPoint.coordinates[1],
            longitude: ride.lastTrackPoint.coordinates[0],
          },
          coordinates,
        );
      await Ride.updateOne(
        {
          _id: ride._id,
          status: "TRIP_STARTED",
          lastTrackAt: ride.lastTrackAt,
        },
        {
          $inc: { actualDistance: increment },
          $set: { lastTrackPoint: point, lastTrackAt: new Date() },
        },
      );
    }
    if (ride && ACTIVE.includes(ride.status))
      emitUser(ride.passenger, "driver:location", {
        rideId: ride._id,
        location,
      });
  }
  return location;
}
export async function rateRide(id, user, value, feedback) {
  return mongoose.connection.transaction(async (session) => {
    const ride = await Ride.findOne({
      _id: id,
      status: "TRIP_COMPLETED",
      $or: [{ passenger: user._id }, { driver: user._id }],
    }).session(session);
    check(ride, 403, "Only completed ride participants can rate");
    const recipient =
      String(ride.passenger) === String(user._id)
        ? ride.driver
        : ride.passenger;
    const [rating] = await Rating.create(
      [{ ride: id, author: user._id, recipient, value, feedback }],
      { session },
    );
    const target = await User.findById(recipient).session(session);
    target.rating =
      (target.rating * target.ratingCount + value) / (target.ratingCount + 1);
    target.ratingCount++;
    await target.save({ session });
    return rating;
  });
}

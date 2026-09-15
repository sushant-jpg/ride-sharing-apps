import mongoose from "mongoose";
import { STATUSES, ADMIN_ROLES } from "../../../shared/constants/index.js";
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  ...extra,
});
const point = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);
const place = new Schema(
  {
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { _id: false },
);
const model = (name, fields, indexes = []) => {
  const schema = new Schema(fields, { timestamps: true, strict: "throw" });
  for (const [key, opts] of indexes) schema.index(key, opts);
  return mongoose.model(name, schema);
};
export const User = model("User", {
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, unique: true },
  passwordHash: { type: String, select: false },
  phone: String,
  role: {
    type: String,
    enum: ["PASSENGER", "DRIVER", ...ADMIN_ROLES],
    default: "PASSENGER",
  },
  suspended: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  avatarUrl: String,
  emergencyContact: String,
  activeRide: ref("Ride", { default: null }),
  rating: { type: Number, default: 5 },
  ratingCount: { type: Number, default: 0 },
  resetHash: { type: String, select: false },
  resetExpires: Date,
  verificationHash: { type: String, select: false },
});
export const DriverProfile = model("DriverProfile", {
  user: ref("User", { unique: true }),
  address: String,
  licenseNumber: String,
  licenseImage: String,
  identityDocument: String,
  vehicleRegistration: String,
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
    default: "PENDING",
  },
  online: { type: Boolean, default: false },
  available: { type: Boolean, default: true },
  activeRide: ref("Ride", { default: null }),
  acceptanceRate: { type: Number, default: 1 },
  lastAssignedAt: Date,
});
export const Vehicle = model("Vehicle", {
  driver: ref("User", { unique: true }),
  brand: String,
  model: String,
  year: Number,
  plateNumber: { type: String, unique: true },
  color: String,
  category: String,
  seatCapacity: Number,
  photoUrl: String,
  verificationStatus: {
    type: String,
    default: "PENDING",
    enum: ["PENDING", "APPROVED", "REJECTED"],
  },
});
export const Ride = model(
  "Ride",
  {
    passenger: ref("User"),
    driver: ref("User", { default: null }),
    vehicle: ref("Vehicle"),
    pickup: place,
    destination: place,
    stops: [place],
    rideCategory: String,
    pricing: Schema.Types.Mixed,
    route: [[Number]],
    routeSource: String,
    estimatedDistance: Number,
    estimatedDuration: Number,
    estimatedFare: Number,
    fareBreakdown: Schema.Types.Mixed,
    actualDistance: { type: Number, default: 0 },
    actualDuration: Number,
    finalFare: Number,
    paymentMethod: { type: String, enum: ["CASH", "WALLET", "MOCK_CARD"] },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    status: { type: String, enum: STATUSES, default: "SEARCHING" },
    verificationPinHash: { type: String, select: false },
    pinAttempts: { type: Number, default: 0 },
    pinLockedUntil: Date,
    requestedAt: Date,
    acceptedAt: Date,
    driverArrivedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: ref("User"),
    cancellationReason: String,
    scheduledAt: Date,
    matchRound: { type: Number, default: 0 },
    nextMatchAt: Date,
    promo: ref("Promo"),
    shareHash: { type: String, select: false },
    shareExpires: Date,
    lastTrackPoint: point,
    lastTrackAt: Date,
  },
  [
    [{ passenger: 1, createdAt: -1 }, {}],
    [{ driver: 1, status: 1 }, {}],
    [{ status: 1, nextMatchAt: 1 }, {}],
  ],
);
export const RideOffer = model(
  "RideOffer",
  {
    ride: ref("Ride"),
    driver: ref("User"),
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"],
      default: "PENDING",
    },
    expiresAt: Date,
  },
  [[{ ride: 1, driver: 1 }, { unique: true }]],
);
export const Payment = model("Payment", {
  rideId: ref("Ride", { unique: true }),
  userId: ref("User"),
  amount: Number,
  paymentMethod: String,
  status: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"] },
  transactionReference: String,
});
export const Wallet = model("Wallet", {
  user: ref("User", { unique: true }),
  balance: { type: Number, default: 0 },
});
export const WalletTransaction = model(
  "WalletTransaction",
  {
    wallet: ref("Wallet"),
    user: ref("User"),
    ride: ref("Ride"),
    amount: Number,
    kind: String,
    reference: { type: String, unique: true },
    description: String,
  },
  [[{ user: 1, createdAt: -1 }, {}]],
);
export const Rating = model(
  "Rating",
  {
    ride: ref("Ride"),
    author: ref("User"),
    recipient: ref("User"),
    value: { type: Number, min: 1, max: 5 },
    feedback: String,
  },
  [[{ ride: 1, author: 1 }, { unique: true }]],
);
export const Promo = model("Promo", {
  code: { type: String, unique: true, uppercase: true },
  type: { type: String, enum: ["FIXED", "PERCENT"] },
  value: Number,
  maxDiscount: Number,
  expiresAt: Date,
  minimumAmount: { type: Number, default: 0 },
  usageLimit: Number,
  used: { type: Number, default: 0 },
});
export const PromoRedemption = model(
  "PromoRedemption",
  { promo: ref("Promo"), user: ref("User"), ride: ref("Ride") },
  [[{ promo: 1, user: 1 }, { unique: true }]],
);
export const SavedPlace = model(
  "SavedPlace",
  { user: ref("User"), label: String, place },
  [[{ user: 1, label: 1 }, { unique: true }]],
);
export const Notification = model(
  "Notification",
  {
    user: ref("User"),
    title: String,
    message: String,
    ride: ref("Ride"),
    read: { type: Boolean, default: false },
  },
  [[{ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }]],
);
export const SupportTicket = model("SupportTicket", {
  user: ref("User"),
  ride: ref("Ride"),
  category: {
    type: String,
    enum: [
      "PAYMENT",
      "DRIVER",
      "PASSENGER",
      "LOST_ITEM",
      "SAFETY",
      "TECHNICAL",
    ],
  },
  message: String,
  status: {
    type: String,
    enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
    default: "OPEN",
  },
});
export const EmergencyIncident = model("EmergencyIncident", {
  user: ref("User"),
  ride: ref("Ride"),
  location: place,
  status: { type: String, enum: ["OPEN", "RESOLVED"], default: "OPEN" },
});
export const DriverLocation = model(
  "DriverLocation",
  { driver: ref("User", { unique: true }), location: point },
  [
    [{ location: "2dsphere" }, {}],
    [{ updatedAt: 1 }, { expireAfterSeconds: 300 }],
  ],
);
export const RefreshToken = model(
  "RefreshToken",
  {
    user: ref("User"),
    hash: { type: String, unique: true },
    family: String,
    expiresAt: Date,
    revokedAt: Date,
    userAgent: String,
  },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const AdminAuditLog = model("AdminAuditLog", {
  actor: ref("User"),
  action: String,
  target: String,
  details: Schema.Types.Mixed,
});
export const FareConfig = model("FareConfig", {
  category: { type: String, unique: true },
  baseFare: Number,
  pricePerKm: Number,
  pricePerMinute: Number,
  minimumFare: Number,
  bookingFee: Number,
  commission: Number,
});
export const Settings = model("Settings", {
  key: { type: String, unique: true },
  demandEnabled: { type: Boolean, default: false },
  maxMultiplier: { type: Number, default: 1.4 },
});

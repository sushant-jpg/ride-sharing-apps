import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import {
  User,
  DriverProfile,
  Vehicle,
  Wallet,
  WalletTransaction,
  Ride,
  Payment,
  FareConfig,
  Settings,
  Promo,
  SavedPlace,
} from "./models/index.js";
import { CATEGORIES, PLACES } from "../../shared/constants/index.js";
import { calculateFare } from "./services/fare.js";
if (env.NODE_ENV === "production")
  throw new Error("Seed is disabled in production");
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 10)
  throw new Error(
    "Set SEED_PASSWORD to a development-only password of at least 10 characters",
  );
await connectDB();
if (await User.exists({})) {
  console.error(
    "Database is not empty. Seed refuses to overwrite existing records.",
  );
  await mongoose.disconnect();
  process.exit(1);
}
const passwordHash = await bcrypt.hash(password, 12);
const people = [
  "Aarav",
  "Asha",
  "Bikash",
  "Diya",
  "Kiran",
  "Manisha",
  "Nabin",
  "Prisha",
  "Rohan",
  "Sita",
];
for (const category of CATEGORIES) {
  const {
    id,
    baseFare,
    pricePerKm,
    pricePerMinute,
    minimumFare,
    bookingFee,
    commission,
  } = category;
  await FareConfig.create({
    category: id,
    baseFare,
    pricePerKm,
    pricePerMinute,
    minimumFare,
    bookingFee,
    commission,
  });
}
await Settings.create({
  key: "global",
  demandEnabled: false,
  maxMultiplier: 1.4,
});
for (let i = 0; i < 10; i++) {
  const passenger = await User.create({
    name: `${people[i]} Sharma`,
    email: `passenger${i + 1}@ride.test`,
    phone: `98000000${String(i).padStart(2, "0")}`,
    passwordHash,
    role: "PASSENGER",
  });
  const driver = await User.create({
    name: `${people[(i + 3) % 10]} Thapa`,
    email: `driver${i + 1}@ride.test`,
    phone: `98100000${String(i).padStart(2, "0")}`,
    passwordHash,
    role: "DRIVER",
  });
  const pw = await Wallet.create({ user: passenger._id, balance: 1000 });
  await WalletTransaction.create({
    wallet: pw._id,
    user: passenger._id,
    amount: 1000,
    kind: "SEED_CREDIT",
    reference: `seed:${passenger._id}`,
    description: "Development welcome credit",
  });
  await Wallet.create({ user: driver._id, balance: 0 });
  const category = CATEGORIES[i % 4];
  await DriverProfile.create({
    user: driver._id,
    status: "APPROVED",
    address: "Nepalgunj, Banke",
    licenseNumber: `DEMO-${1000 + i}`,
    licenseImage: "https://example.com/development-license",
    identityDocument: "https://example.com/development-id",
    vehicleRegistration: "https://example.com/development-registration",
    online: false,
  });
  const vehicle = await Vehicle.create({
    driver: driver._id,
    brand: category.vehicleType === "motorcycle" ? "Bajaj" : "Tata",
    model: category.vehicleType === "motorcycle" ? "Pulsar" : "Tiago",
    year: 2024,
    plateNumber: `DEMO BHE ${1000 + i}`,
    color: "Pearl white",
    category: category.id,
    seatCapacity: category.capacity,
    verificationStatus: "APPROVED",
  });
  await SavedPlace.create({
    user: passenger._id,
    label: "Home",
    place: PLACES[0],
  });
  await SavedPlace.create({
    user: passenger._id,
    label: "Work",
    place: PLACES[5],
  });
  const fare = calculateFare(category, 3.8, 12);
  const date = new Date(Date.now() - (i + 1) * 86400000);
  const ride = await Ride.create({
    passenger: passenger._id,
    driver: driver._id,
    vehicle: vehicle._id,
    pickup: PLACES[0],
    destination: PLACES[3],
    rideCategory: category.id,
    pricing: category,
    estimatedDistance: 3.8,
    estimatedDuration: 12,
    estimatedFare: fare.estimatedFare,
    actualDistance: 3.8,
    actualDuration: 12,
    finalFare: fare.estimatedFare,
    fareBreakdown: fare,
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    status: "TRIP_COMPLETED",
    requestedAt: date,
    startedAt: date,
    completedAt: new Date(+date + 720000),
  });
  await Payment.create({
    rideId: ride._id,
    userId: passenger._id,
    amount: fare.estimatedFare,
    paymentMethod: "CASH",
    status: "PAID",
    transactionReference: `seed:${ride._id}`,
  });
}
await User.create({
  name: "Nepaljung Operations",
  email: "admin@ride.test",
  passwordHash,
  role: "SUPER_ADMIN",
  phone: "9800000099",
});
await Promo.create({
  code: "NAMASTE",
  type: "PERCENT",
  value: 15,
  maxDiscount: 100,
  minimumAmount: 100,
  usageLimit: 100,
  expiresAt: new Date(Date.now() + 30 * 86400000),
});
console.log(
  "Seeded 10 passengers, 10 approved offline drivers, 10 vehicles, 10 completed rides, and admin@ride.test. Use your SEED_PASSWORD.",
);
await mongoose.disconnect();

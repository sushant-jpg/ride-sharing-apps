import crypto from "node:crypto";
import { Payment, Wallet, WalletTransaction } from "../models/index.js";
import { check } from "../utils/errors.js";
import { env } from "../config/env.js";
import { round } from "./fare.js";
// All writes are part of the ride-completion transaction. Providers must be idempotent by ride ID.
export async function settle(ride, session) {
  const amount = ride.finalFare;
  const paid = ride.paymentMethod !== "CASH";
  if (ride.paymentMethod === "MOCK_CARD")
    check(
      env.ENABLE_MOCK_PAYMENTS === "true" && env.NODE_ENV !== "production",
      400,
      "Mock card payments are disabled",
    );
  if (ride.paymentMethod === "WALLET") {
    const wallet = await Wallet.findOneAndUpdate(
      { user: ride.passenger, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true, session },
    );
    check(
      wallet,
      402,
      "Wallet balance is too low. Add credits or change payment method.",
      "INSUFFICIENT_FUNDS",
    );
    await WalletTransaction.create(
      [
        {
          wallet: wallet._id,
          user: ride.passenger,
          ride: ride._id,
          amount: -amount,
          kind: "RIDE_PAYMENT",
          reference: `ride:${ride._id}:debit`,
          description: "Ride payment",
        },
      ],
      { session },
    );
  }
  const commission = round(amount * ride.pricing.commission);
  const earnings = paid ? round(amount - commission) : -commission;
  const driverWallet = await Wallet.findOneAndUpdate(
    { user: ride.driver },
    { $inc: { balance: earnings } },
    { new: true, session },
  );
  check(driverWallet, 409, "Driver wallet is missing");
  await WalletTransaction.create(
    [
      {
        wallet: driverWallet._id,
        user: ride.driver,
        ride: ride._id,
        amount: earnings,
        kind: paid ? "EARNINGS" : "CASH_COMMISSION",
        reference: `ride:${ride._id}:earnings`,
        description: paid
          ? "Trip earnings after platform fee"
          : "Platform fee; driver collects cash fare",
      },
    ],
    { session },
  );
  await Payment.create(
    [
      {
        rideId: ride._id,
        userId: ride.passenger,
        amount,
        paymentMethod: ride.paymentMethod,
        status: paid ? "PAID" : "PENDING",
        transactionReference: crypto.randomUUID(),
      },
    ],
    { session },
  );
  ride.paymentStatus = paid ? "PAID" : "PENDING";
}

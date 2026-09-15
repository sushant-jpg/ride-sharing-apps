import { CATEGORIES } from "../../../shared/constants/index.js";
import {
  FareConfig,
  Settings,
  DriverProfile,
  Ride,
  Promo,
  PromoRedemption,
} from "../models/index.js";
import { check } from "../utils/errors.js";
export const round = (value) => Math.round(value * 100) / 100;
export function calculateFare(
  pricing,
  distanceKm,
  durationMinutes,
  { multiplier = 1, discount = 0 } = {},
) {
  const baseFare = pricing.baseFare,
    distanceFare = round(distanceKm * pricing.pricePerKm),
    timeFare = round(durationMinutes * pricing.pricePerMinute),
    bookingFee = pricing.bookingFee;
  const subtotal = round(
    Math.max(
      pricing.minimumFare,
      (baseFare + distanceFare + timeFare + bookingFee) * multiplier,
    ),
  );
  return {
    distanceKm: round(distanceKm),
    durationMinutes: round(durationMinutes),
    baseFare,
    distanceFare,
    timeFare,
    bookingFee,
    demandMultiplier: multiplier,
    subtotal,
    discount: Math.min(discount, subtotal),
    estimatedFare: round(Math.max(0, subtotal - discount)),
  };
}
export async function quote(category, route, promoCode, user) {
  const defaults = CATEGORIES.find((c) => c.id === category);
  check(defaults, 400, "Unknown ride category");
  const custom = await FareConfig.findOne({ category }).lean();
  const pricing = { ...defaults, ...custom };
  const settings = await Settings.findOne({ key: "global" });
  let multiplier = 1;
  if (settings?.demandEnabled) {
    const [drivers, requests] = await Promise.all([
      DriverProfile.countDocuments({
        online: true,
        available: true,
        status: "APPROVED",
      }),
      Ride.countDocuments({
        status: "SEARCHING",
        requestedAt: { $gt: new Date(Date.now() - 300000) },
      }),
    ]);
    multiplier = round(
      Math.min(
        settings.maxMultiplier,
        Math.max(1, requests / Math.max(drivers * 2, 1)),
      ),
    );
  }
  let breakdown = calculateFare(
    pricing,
    route.distanceKm,
    route.durationMinutes,
    { multiplier },
  );
  let promo;
  if (promoCode) {
    promo = await Promo.findOne({ code: promoCode.toUpperCase() });
    check(
      promo &&
        promo.expiresAt > new Date() &&
        promo.used < promo.usageLimit &&
        breakdown.subtotal >= promo.minimumAmount,
      400,
      "This promo is not available",
    );
    check(
      !(await PromoRedemption.exists({ promo: promo._id, user })),
      409,
      "You have already used this promo",
    );
    const discount = Math.min(
      promo.maxDiscount,
      promo.type === "FIXED"
        ? promo.value
        : (breakdown.subtotal * promo.value) / 100,
    );
    breakdown = calculateFare(
      pricing,
      route.distanceKm,
      route.durationMinutes,
      { multiplier, discount: round(discount) },
    );
  }
  return { pricing, breakdown, promo };
}

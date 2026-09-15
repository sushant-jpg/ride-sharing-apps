import { z } from "zod";
export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid identifier");
export const place = z.object({
  address: z.string().trim().min(1).max(240),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(72),
});
export const register = credentials.extend({
  name: z.string().trim().min(2).max(80),
  phone: z.string().min(7).max(25),
  role: z.enum(["PASSENGER", "DRIVER"]).default("PASSENGER"),
});
export const rideInput = z.object({
  pickup: place,
  destination: place,
  stops: z.array(place).max(2).default([]),
  rideCategory: z.enum(["sajilo", "sathi", "parivar", "hariyo"]),
  paymentMethod: z.enum(["CASH", "WALLET", "MOCK_CARD"]).default("CASH"),
  promoCode: z.string().max(30).optional(),
  scheduledAt: z.iso.datetime().optional(),
});
export const validate =
  (schema, source = "body") =>
  (req, _res, next) => {
    try {
      req.validated = { ...req.validated, [source]: schema.parse(req[source]) };
      next();
    } catch (err) {
      next(err);
    }
  };

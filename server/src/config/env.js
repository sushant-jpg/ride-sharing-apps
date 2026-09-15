import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CLIENT_URL: z
    .string()
    .default(
      "http://localhost:5173,http://localhost:5174,http://localhost:5175",
    ),
  ROUTING_URL: z.url().default("https://router.project-osrm.org"),
  GEOCODING_URL: z.url().default("https://nominatim.openstreetmap.org"),
  ENABLE_MOCK_PAYMENTS: z.string().default("false"),
});
export const env = schema.parse(process.env);
if (
  env.NODE_ENV === "production" &&
  (env.JWT_ACCESS_SECRET.includes("replace-with") ||
    env.JWT_REFRESH_SECRET.includes("replace-with"))
)
  throw new Error("Replace example secrets before deployment");
export const origins = env.CLIENT_URL.split(",");

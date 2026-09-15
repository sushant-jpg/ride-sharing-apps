import pino from "pino";
export const logger = pino({
  redact: ["password", "token", "pin", "authorization", "cookie"],
  level: process.env.NODE_ENV === "test" ? "silent" : "info",
});

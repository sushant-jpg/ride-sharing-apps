import http from "node:http";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { configureSockets } from "./sockets/index.js";
import { startJobs } from "./jobs/index.js";
import { logger } from "./utils/logger.js";
await connectDB();
const server = http.createServer(createApp());
const io = configureSockets(server);
const stopJobs = startJobs();
server.listen(env.PORT, () =>
  logger.info({ port: env.PORT }, "Ride Nepaljung API ready"),
);
async function shutdown() {
  stopJobs();
  io.close();
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

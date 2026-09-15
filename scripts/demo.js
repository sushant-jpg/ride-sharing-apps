// A real, temporary MongoDB replica set for local evaluation without Docker.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
process.env.MONGOMS_DOWNLOAD_DIR ||= "/tmp/ride-nepaljung-mongodb";
const db = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
  binary: { version: "7.0.24" },
});
const demoEnv = {
  ...process.env,
  NODE_ENV: "development",
  MONGODB_URI: db.getUri("ride_nepaljung"),
  JWT_ACCESS_SECRET: crypto.randomBytes(48).toString("hex"),
  JWT_REFRESH_SECRET: crypto.randomBytes(48).toString("hex"),
  ENABLE_MOCK_PAYMENTS: "true",
  SEED_PASSWORD: "LocalRide-2026!",
  PASSENGER_PORT: "5183",
  DRIVER_PORT: "5184",
  ADMIN_PORT: "5185",
  CLIENT_URL:
    "http://localhost:5183,http://localhost:5184,http://localhost:5185",
};
const seed = spawn(process.execPath, ["server/src/seed.js"], {
  env: demoEnv,
  stdio: "inherit",
});
const code = await new Promise((resolve) => seed.on("exit", resolve));
if (code !== 0) {
  await db.stop();
  process.exit(code || 1);
}
const child = spawn("npm", ["run", "dev"], {
  env: demoEnv,
  stdio: "inherit",
  detached: true,
});
console.log(
  "Temporary local database ready. Passenger: http://localhost:5183 | Driver: http://localhost:5184 | Admin: http://localhost:5185",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* Child already exited. */
  }
  await db.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", stop);

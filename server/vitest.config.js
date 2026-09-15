import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 180000,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      MONGODB_URI: "mongodb://127.0.0.1:27017/test",
      JWT_ACCESS_SECRET: "test-only-access-secret-32-characters-long",
      JWT_REFRESH_SECRET: "test-only-refresh-secret-32-characters-long",
      ENABLE_MOCK_PAYMENTS: "true",
      MONGOMS_DOWNLOAD_DIR: "/tmp/ride-nepaljung-mongodb",
    },
  },
});

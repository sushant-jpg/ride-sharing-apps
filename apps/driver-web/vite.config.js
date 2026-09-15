import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules") && id.includes("leaflet"))
            return "maps";
          if (
            id.includes("node_modules") &&
            (id.includes("/zod/") ||
              id.includes("react-hook-form") ||
              id.includes("@hookform"))
          )
            return "forms";
        },
      },
    },
  },
  server: {
    port: Number(process.env.DRIVER_PORT || 5174),
    strictPort: true,
    fs: { allow: ["../.."] },
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: process.env.API_PROXY_TARGET || "http://localhost:4000",
        ws: true,
      },
    },
  },
});

import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: ["@napi-rs/canvas"],
    },
  },
  optimizeDeps: {
    exclude: ["@napi-rs/canvas"],
  },
  server: {
    proxy: {
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
        rewriteWsOrigin: true,
      },
      "/drawing.bmp": {
        target: "http://localhost:3001",
      },
    },
  },
});

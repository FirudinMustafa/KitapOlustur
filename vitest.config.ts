import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@workflows": path.resolve(__dirname, "./workflows"),
    },
  },
  test: {
    environment: "node",
  },
});

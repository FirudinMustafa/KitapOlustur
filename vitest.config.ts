import { configDefaults, defineConfig } from "vitest/config";
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
    // Agent worktrees live under .claude/worktrees with their own copy of
    // every test - without this a run collected five copies of the suite.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});

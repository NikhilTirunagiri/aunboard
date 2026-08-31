import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests import aunboard from SOURCE, not from packages/aunboard/dist: CI runs
// `pnpm -r test` before `pnpm -r build`, so a dist-based import would be a build-order
// landmine. The published entry point is exercised by the package's own test suite.
export default defineConfig({
  esbuild: { jsx: "automatic", jsxDev: true },
  resolve: {
    alias: {
      aunboard: fileURLToPath(new URL("../../packages/aunboard/src/index.ts", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost/" } },
    globals: true,
  },
});

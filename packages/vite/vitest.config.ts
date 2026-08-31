import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Test against the sibling package's source so `pnpm -r test` does not
      // depend on build order.
      "@aunboard/plugin-core": fileURLToPath(
        new URL("../plugin-core/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
  },
});

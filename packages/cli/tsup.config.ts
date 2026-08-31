import { defineConfig } from "tsup";

export default defineConfig([
  // The CLI itself: Node ESM with a shebang so `bin` is directly executable.
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    platform: "node",
    target: "node18",
    // Both entries write into dist/ and tsup runs array configs concurrently, so the
    // output folder is cleared by the `build` script instead of by either config.
    clean: false,
    dts: false,
    banner: { js: "#!/usr/bin/env node" },
    // Installed by the user, imported dynamically at runtime — never bundled.
    external: ["playwright"],
  },
  // The browser-injectable locator engine: the SAME resolve/wait/activate source the
  // runtime uses, emitted as an IIFE that hangs `resolveLocator`/`matchElements` (and
  // friends) off `window.__aunboard`. CI and runtime therefore share one algorithm.
  {
    entry: { inject: "src/browser/inject.ts" },
    format: ["iife"],
    platform: "browser",
    target: "es2020",
    globalName: "__aunboard",
    clean: false,
    dts: false,
    footer: { js: "window.__aunboard = __aunboard;" },
    outExtension: () => ({ js: ".global.js" }),
  },
]);

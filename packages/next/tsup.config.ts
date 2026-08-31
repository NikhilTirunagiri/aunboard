import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/loader.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "node18",
  platform: "node",
  // `import.meta.url` in the ESM build, `__filename` in the CJS build: the
  // config wrapper has to point webpack at the loader file next to itself.
  shims: true,
  external: ["next", "webpack", "@aunboard/plugin-core", "tinyglobby", "picomatch"],
});

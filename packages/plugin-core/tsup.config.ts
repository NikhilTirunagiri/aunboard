import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "node18",
  platform: "node",
  external: ["@babel/parser", "@babel/traverse", "@babel/types", "magic-string"],
});

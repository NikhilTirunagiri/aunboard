import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import webpack from "webpack";

import { withAunboard } from "../src/index";
import aunboardLoader from "../src/loader";
import { PRICING, tourFor, writeIn } from "./harness";

/**
 * An end-to-end run through the real webpack: real rule normalization, real
 * `beforeCompile`, the real loader-runner calling our loader with a real
 * `LoaderContext`. Everything else in this suite talks to stand-ins.
 */

let root: string;
let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "aunboard-next-wp-")));
  logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/**
 * The fixture is `.jsx`, not `.tsx`: webpack 5.110 has a built-in TypeScript
 * experiment that claims `.tsx` before any loader can, and this suite is about
 * aunboard's loader, not about how Next configures SWC.
 *
 * webpack `require`s its loaders, so a TypeScript source file cannot be one.
 * These two shims are plain CommonJS: the first hands webpack the loader under
 * test, the second turns the (still JSX) result into a plain string module so
 * webpack's own parser never has to read JSX.
 */
function shims(): { loader: string; capture: string } {
  const loader = writeIn(
    root,
    "shims/aunboard-loader.cjs",
    `module.exports = function (...args) { return globalThis.__aunboardLoader.apply(this, args); };\n`,
  );
  const capture = writeIn(
    root,
    "shims/capture.cjs",
    `module.exports = function (source) { return "module.exports = " + JSON.stringify(source) + ";"; };\n`,
  );
  (globalThis as any).__aunboardLoader = aunboardLoader;
  return { loader, capture };
}

function compile(config: any): Promise<webpack.Stats> {
  return new Promise((resolve, reject) => {
    webpack(config, (error, stats) => {
      if (error) return reject(error);
      if (!stats) return reject(new Error("no stats"));
      if (stats.hasErrors()) return reject(new Error(stats.toString({ errors: true })));
      resolve(stats);
    });
  });
}

/** The webpack config Next would hand to the `webpack` callback. */
function baseConfig(capture: string): any {
  return {
    mode: "development",
    devtool: false,
    context: root,
    entry: join(root, "app/Pricing.jsx"),
    output: { path: join(root, ".next"), filename: "bundle.js" },
    resolve: { extensions: [".jsx", ".js"] },
    module: { rules: [{ test: /\.[jt]sx$/, use: capture }] },
    plugins: [],
  };
}

describe("a real webpack build", () => {
  it("stamps the tour's element and writes the id map", async () => {
    writeIn(root, "app/Pricing.jsx", PRICING);
    const tourFile = writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b1"));
    const { loader, capture } = shims();

    const wrapped = withAunboard({}, { logger }) as Record<string, any>;
    const config = wrapped.webpack(baseConfig(capture), { dev: false, dir: root, isServer: false });
    // Point the rule at the CommonJS shim; everything else is what the wrapper built.
    config.module.rules[0].use[0].loader = loader;

    const stats = await compile(config);
    const bundle = readFileSync(join(root, ".next/bundle.js"), "utf8");

    // The pre-loader ran before the capture loader, on the original JSX.
    expect(bundle).toContain('data-aun=\\"PricingCard.b1\\"');
    expect(bundle).not.toContain("PricingCard.b2");

    // `beforeCompile` ran the once-per-compilation pass.
    expect(JSON.parse(readFileSync(join(root, "aunboard.ids.json"), "utf8")).ids).toHaveProperty(
      "PricingCard.b1",
    );
    expect(logger.info.mock.calls.flat().join("\n")).toContain("stamping 1 id(s)");

    // The tour file is a build dependency, so editing it invalidates the module.
    expect([...stats.compilation.fileDependencies]).toContain(tourFile);
  });

  it("fails the build when a tour points at an element that is gone", async () => {
    writeIn(root, "app/Pricing.jsx", PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b9"));
    const { loader, capture } = shims();

    const wrapped = withAunboard({}, { logger }) as Record<string, any>;
    const config = wrapped.webpack(baseConfig(capture), { dev: false, dir: root });
    config.module.rules[0].use[0].loader = loader;

    await expect(compile(config)).rejects.toThrow(/PricingCard\.b9/);
  });

  it("stamps every element in dev", async () => {
    writeIn(root, "app/Pricing.jsx", PRICING);
    const { loader, capture } = shims();

    const wrapped = withAunboard({}, { logger }) as Record<string, any>;
    const config = wrapped.webpack(baseConfig(capture), { dev: true, dir: root });
    config.module.rules[0].use[0].loader = loader;

    await compile(config);
    const bundle = readFileSync(join(root, ".next/bundle.js"), "utf8");
    expect(bundle.match(/data-aun/g)).toHaveLength(3);
  });
});

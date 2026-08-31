import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withAunboard } from "../src/index";
import type { AunboardOptions, StampState } from "../src/types";
import {
  PRICING,
  aunboardRule,
  compilerFor,
  fakeWebpackConfig,
  runLoader,
  tourFor,
  writeIn,
  type FakeWebpackConfig,
} from "./harness";

let root: string;
let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

beforeEach(() => {
  // realpath: webpack reports the real path of a module, and so does the loader.
  root = realpathSync(mkdtempSync(join(tmpdir(), "aunboard-next-")));
  logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/**
 * Build a config the way Next would, run the one pass, and hand back the
 * webpack config the loader options hang off.
 */
function compiled(options: AunboardOptions = {}, dev = false): FakeWebpackConfig {
  const wrapped = withAunboard({}, { logger, ...options }) as Record<string, any>;
  const config: FakeWebpackConfig = wrapped.webpack(fakeWebpackConfig(), { dev, dir: root });
  compilerFor(config).compile();
  return config;
}

const PRICING_FILE = "app/Pricing.tsx";

describe("the loader: stamping", () => {
  it("stamps only the elements committed tours reference", () => {
    writeIn(root, PRICING_FILE, PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b1"));

    const run = runLoader(compiled(), join(root, PRICING_FILE), PRICING);

    expect(run.error).toBeNull();
    expect(run.code).toContain('<button onClick={buy} data-aun="PricingCard.b1">');
    expect(run.code).toContain("<button onClick={cancel}>");
    expect(run.code.match(/data-aun/g)).toHaveLength(1);
  });

  it("stamps ids reached only through a scope or a reveal locator", () => {
    writeIn(root, PRICING_FILE, PRICING);
    writeIn(
      root,
      "tours/new-engineer.tour.json",
      tourFor("PricingCard.b1", {
        locator: {
          tag: "button",
          hook: { attr: "data-aun", value: "PricingCard.b1" },
          scope: { tag: "section", hook: { attr: "data-aun", value: "PricingCard.s1" } },
        },
        reveal: [{ tag: "button", hook: { attr: "data-aun", value: "PricingCard.b2" } }],
      }),
    );

    const run = runLoader(compiled(), join(root, PRICING_FILE), PRICING);
    expect(run.code).toContain('data-aun="PricingCard.s1"');
    expect(run.code).toContain('data-aun="PricingCard.b1"');
    expect(run.code).toContain('data-aun="PricingCard.b2"');
  });

  it("leaves a module alone when no tour references anything in it", () => {
    writeIn(root, PRICING_FILE, PRICING);
    const run = runLoader(compiled(), join(root, PRICING_FILE), PRICING);
    expect(run.code).toBe(PRICING);
    expect(run.code).not.toContain("data-aun");
  });

  it("stamps everything in dev so the recorder can pick any element", () => {
    writeIn(root, PRICING_FILE, PRICING);
    const run = runLoader(compiled({}, true), join(root, PRICING_FILE), PRICING);
    expect(run.code.match(/data-aun/g)).toHaveLength(3);
  });

  it("stamps the original id after the element was reordered", () => {
    writeIn(root, PRICING_FILE, PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b1"));
    compiled();

    const swapped = PRICING.replace(
      /<button onClick=\{buy\}>Buy now<\/button>\s*<button onClick=\{cancel\}>Cancel<\/button>/,
      `<button onClick={cancel}>Cancel</button>\n      <button onClick={buy}>Buy now</button>`,
    );
    writeIn(root, PRICING_FILE, swapped);

    const run = runLoader(compiled(), join(root, PRICING_FILE), swapped);
    expect(run.code).toContain('<button onClick={buy} data-aun="PricingCard.b1">');
    expect(run.code).not.toContain('<button onClick={cancel} data-aun="PricingCard.b1">');
  });

  it("is idempotent: stamping stamped output changes nothing", () => {
    writeIn(root, PRICING_FILE, PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b1"));

    const config = compiled();
    const first = runLoader(config, join(root, PRICING_FILE), PRICING);
    const second = runLoader(config, join(root, PRICING_FILE), first.code);

    expect(second.code).toBe(first.code);
    expect(second.map).toBeUndefined(); // nothing changed, no new map
  });
});

describe("the loader: sourcemaps", () => {
  it("returns a map that traces stamped output back to the original source", () => {
    writeIn(root, PRICING_FILE, PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b1"));

    const file = join(root, PRICING_FILE);
    const run = runLoader(compiled(), file, PRICING);
    const map = run.map as any;

    expect(map).toBeTruthy();
    expect(map.version).toBe(3);
    expect(map.sources).toEqual([file]);
    expect(map.sourcesContent).toEqual([PRICING]);

    // A token that sits *after* the inserted attribute still maps to where it
    // really is in the developer's file.
    const outLines = run.code.split("\n");
    const outLine = outLines.findIndex((line) => line.includes('data-aun="PricingCard.b1"'));
    const srcLines = PRICING.split("\n");
    const srcLine = srcLines.findIndex((line) => line.includes("Buy now"));

    const traced = originalPositionFor(new TraceMap(map), {
      line: outLine + 1,
      column: outLines[outLine].indexOf("Buy now"),
    });
    expect(traced.line).toBe(srcLine + 1);
    expect(traced.column).toBe(srcLines[srcLine].indexOf("Buy now"));
  });

  it("passes an incoming map straight through when it changes nothing", () => {
    writeIn(root, PRICING_FILE, PRICING);
    const incoming = { version: 3, sources: ["x"], names: [], mappings: "" };
    const run = runLoader(compiled(), join(root, PRICING_FILE), PRICING, incoming);
    expect(run.map).toBe(incoming);
  });
});

describe("the loader: what it refuses to touch", () => {
  it("passes the source through untouched before the first pass has run", () => {
    writeIn(root, PRICING_FILE, PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b1"));

    // A config whose plugin never fired: `ready` is still false.
    const wrapped = withAunboard({}, { logger }) as Record<string, any>;
    const config: FakeWebpackConfig = wrapped.webpack(fakeWebpackConfig(), { dev: false, dir: root });

    const run = runLoader(config, join(root, PRICING_FILE), PRICING);
    expect(run.code).toBe(PRICING);
    expect(run.error).toBeNull();
  });

  it("honours include and exclude", () => {
    writeIn(root, PRICING_FILE, PRICING);
    const config = compiled({ include: /\.tsx$/, exclude: /generated/ }, true);

    expect(runLoader(config, join(root, "app/generated/A.tsx"), PRICING).code).toBe(PRICING);
    expect(runLoader(config, join(root, "app/A.jsx"), PRICING).code).toBe(PRICING);
    expect(runLoader(config, join(root, "app/A.tsx"), PRICING).code).toContain("data-aun");
  });

  it("warns and passes through source it cannot parse", () => {
    writeIn(root, PRICING_FILE, PRICING);
    const run = runLoader(compiled({}, true), join(root, PRICING_FILE), "<<< not javascript {");

    expect(run.error).toBeNull();
    expect(run.code).toBe("<<< not javascript {");
    expect(run.warnings.map((warning) => warning.message).join("\n")).toContain("could not stamp");
  });
});

describe("the loader: webpack integration", () => {
  it("declares the tour files as dependencies so a tour edit invalidates the cache", () => {
    writeIn(root, PRICING_FILE, PRICING);
    const tour = writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b1"));

    const run = runLoader(compiled(), join(root, PRICING_FILE), PRICING);
    expect(run.dependencies).toEqual([tour]);
  });

  it("reads its state from the rule's loader options", () => {
    writeIn(root, PRICING_FILE, PRICING);
    const config = compiled();
    const state = aunboardRule(config).use[0].options.state as StampState;

    expect(state.ready).toBe(true);
    expect(state.root).toBe(root);
    expect(Object.keys(state.assignments)).toContain("app/Pricing.tsx");
  });
});

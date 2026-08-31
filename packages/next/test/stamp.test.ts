import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AunboardWebpackPlugin } from "../src/plugin";
import { StampRunner } from "../src/stamp";
import type { AunboardOptions } from "../src/types";
import { FakeCompiler, PRICING, tourFor, writeIn } from "./harness";

let root: string;
let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

beforeEach(() => {
  // realpath: webpack reports the real path of a module, and so does the loader.
  root = realpathSync(mkdtempSync(join(tmpdir(), "aunboard-next-")));
  logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function runner(options: AunboardOptions = {}, dev = false): StampRunner {
  return new StampRunner({ logger, ...options }, { root, dev });
}

/** Drive one pass the way webpack's `beforeCompile` hook would. */
function compile(instance: StampRunner, compiler = new FakeCompiler()): FakeCompiler {
  new AunboardWebpackPlugin(instance).apply(compiler as never);
  compiler.compile();
  return compiler;
}

const logged = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.flat().join("\n");

describe("the once-per-compilation pass: id map", () => {
  it("writes aunboard.ids.json on the first compilation", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    compile(runner());

    const map = JSON.parse(readFileSync(join(root, "aunboard.ids.json"), "utf8"));
    expect(map.version).toBe(1);
    expect(Object.keys(map.ids).sort()).toEqual([
      "PricingCard.b1",
      "PricingCard.b2",
      "PricingCard.s1",
    ]);
    expect(map.ids["PricingCard.b1"]).toMatchObject({
      file: "app/Pricing.tsx",
      component: "PricingCard",
      tag: "button",
    });
  });

  it("finds source under both routers", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    writeIn(root, "pages/index.jsx", `export default function Home(){ return <main>hi</main>; }`);
    writeIn(root, "src/components/Nav.tsx", `export function Nav(){ return <nav>n</nav>; }`);
    compile(runner());

    const map = JSON.parse(readFileSync(join(root, "aunboard.ids.json"), "utf8"));
    expect(Object.keys(map.ids)).toContain("PricingCard.b1");
    expect(Object.keys(map.ids)).toContain("Home.m1");
    expect(Object.keys(map.ids)).toContain("Nav.n1");
  });

  it("does not rewrite the file when nothing changed", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    compile(runner());
    logger.info.mockClear();
    compile(runner());
    expect(logged(logger.info)).not.toContain("updated");
  });

  it("keeps ids and updates the file when a component moves", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    compile(runner());
    const before = JSON.parse(readFileSync(join(root, "aunboard.ids.json"), "utf8"));

    rmSync(join(root, "app/Pricing.tsx"));
    writeIn(root, "src/billing/Plan.tsx", PRICING);
    compile(runner());

    const after = JSON.parse(readFileSync(join(root, "aunboard.ids.json"), "utf8"));
    expect(Object.keys(after.ids).sort()).toEqual(Object.keys(before.ids).sort());
    expect(after.ids["PricingCard.b1"].file).toBe("src/billing/Plan.tsx");
    expect(after.ids["PricingCard.b1"].sig).toBe(before.ids["PricingCard.b1"].sig);
    expect(logged(logger.info)).toContain('"PricingCard.b1" moved');
  });

  it("logs a component rename", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    compile(runner());
    writeIn(root, "app/Pricing.tsx", PRICING.replace(/PricingCard/g, "PlanCard"));
    compile(runner());
    expect(logged(logger.info)).toContain("component renamed");
  });

  it("honours a custom idMap path and can be told not to write", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    compile(runner({ idMap: "./config/ids.json", write: false }));
    expect(() => readFileSync(join(root, "config/ids.json"), "utf8")).toThrow();

    compile(runner({ idMap: "./config/ids.json" }));
    expect(readFileSync(join(root, "config/ids.json"), "utf8")).toContain("PricingCard.b1");
  });

  it("warns about an id claimed by two files", () => {
    writeIn(root, "app/a.tsx", `export function Card(){ return <button>a</button>; }`);
    writeIn(root, "app/b.tsx", `export function Card(){ return <button>b</button>; }`);
    compile(runner());
    expect(logged(logger.warn)).toContain('id "Card.b1" is claimed by');
  });

  it("logs one summary line naming what it will stamp", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b1"));
    compile(runner());

    const summary = logger.info.mock.calls.flat().find((line) => String(line).includes("elements in"));
    expect(summary).toContain("3 elements in 1 files");
    expect(summary).toContain("1 tour reference(s) in 1 tour file(s)");
    expect(summary).toContain("stamping 1 id(s)");
  });

  it("says it is stamping everything in dev", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    compile(runner({}, true));
    expect(logged(logger.info)).toContain("stamping all elements (dev)");
  });
});

describe("the once-per-compilation pass: scheduling", () => {
  it("runs once for a round of compilers and again on the next round", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    const instance = runner();
    const client = new FakeCompiler();
    const server = new FakeCompiler();
    new AunboardWebpackPlugin(instance).apply(client as never);
    new AunboardWebpackPlugin(instance).apply(server as never);

    const passes = () =>
      logger.info.mock.calls.flat().filter((line) => String(line).includes("elements in")).length;

    client.compile();
    expect(passes()).toBe(1);
    server.compile();
    expect(passes()).toBe(1); // the server compiler reuses the client's pass

    // A dev rebuild: the same compiler asks again, so a fresh pass runs.
    client.compile();
    expect(passes()).toBe(2);
    server.compile();
    expect(passes()).toBe(2);
  });

  it("picks up a tour added between rounds", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    const instance = runner();
    const compiler = new FakeCompiler();
    new AunboardWebpackPlugin(instance).apply(compiler as never);

    compiler.compile();
    expect(instance.state.stampIds.size).toBe(0);

    writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b1"));
    compiler.compile();
    expect([...instance.state.stampIds]).toEqual(["PricingCard.b1"]);
  });

  it("marks the state ready only after a pass", () => {
    const instance = runner();
    expect(instance.state.ready).toBe(false);
    compile(instance);
    expect(instance.state.ready).toBe(true);
  });
});

describe("broken tours", () => {
  it("fails the build when a tour references an id that matches nothing", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b9"));

    expect(() => compile(runner())).toThrow(/PricingCard\.b9/);
  });

  it("names the tour, the step and the tour file in the error", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("Gone.b1"));

    let error: Error | undefined;
    try {
      compile(runner());
    } catch (thrown) {
      error = thrown as Error;
    }
    expect(error).toBeInstanceOf(Error);
    const message = error!.message;
    expect(message).toContain("[aunboard]");
    expect(message).toContain('"Gone.b1"');
    expect(message).toContain("New Engineer Onboarding");
    expect(message).toContain("new-engineer");
    expect(message).toContain("Start here");
    expect(message).toContain("new-engineer.tour.json");
    expect(message).toContain("will not guess a replacement");
  });

  it("fails when the element a tour points at is deleted", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b1"));
    compile(runner());

    writeIn(root, "app/Pricing.tsx", PRICING.replace("<button onClick={buy}>Buy now</button>", ""));
    expect(() => compile(runner())).toThrow(/PricingCard\.b1/);
  });

  it("logs instead of throwing in dev", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("Gone.b1"));

    expect(() => compile(runner({}, true))).not.toThrow();
    expect(logged(logger.error)).toContain("Gone.b1");
  });

  it("can be told to fail in dev too, and not to fail a build", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("Gone.b1"));

    expect(() => compile(runner({ failOnMissing: true }, true))).toThrow(/Gone\.b1/);
    expect(() => compile(runner({ failOnMissing: false }, false))).not.toThrow();
  });

  it("still resolves after a move plus a rename, so no false failure", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    writeIn(root, "tours/new-engineer.tour.json", tourFor("PricingCard.b1"));
    compile(runner());

    rmSync(join(root, "app/Pricing.tsx"));
    writeIn(root, "src/billing/Plan.tsx", PRICING);
    compile(runner());

    writeIn(root, "src/billing/Plan.tsx", PRICING.replace(/PricingCard/g, "PlanCard"));
    const instance = runner();
    expect(() => compile(instance)).not.toThrow();
    expect([...instance.state.stampIds]).toEqual(["PricingCard.b1"]);
  });
});

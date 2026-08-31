import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aunboard } from "../src/index";

type Logger = { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

let root: string;
let logger: Logger;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "aunboard-vite-"));
  logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function write(relative: string, contents: string): string {
  const path = join(root, relative);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

const PRICING = `
export function PricingCard() {
  return (
    <section className="card">
      <button onClick={buy}>Buy now</button>
      <button onClick={cancel}>Cancel</button>
    </section>
  );
}
`;

function tourFor(id: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    tour: {
      id: "new-engineer",
      name: "New Engineer Onboarding",
      steps: [
        {
          label: "Start here",
          description: "Buy the plan.",
          locator: { tag: "button", hook: { attr: "data-aun", value: id } },
          ...extra,
        },
      ],
    },
  });
}

/** Drive the plugin hooks the way Vite would. */
async function start(plugin: ReturnType<typeof aunboard>, command: "build" | "serve" = "build") {
  (plugin.configResolved as (c: unknown) => void).call(plugin, { root, command, logger });
  await (plugin.buildStart as () => void | Promise<void>).call({} as never);
  return plugin;
}

function runTransform(plugin: ReturnType<typeof aunboard>, file: string, code: string) {
  return (
    plugin.transform as (
      this: unknown,
      code: string,
      id: string,
    ) => { code: string; map: unknown } | null
  ).call({} as never, code, file);
}

describe("plugin shape", () => {
  it("is a pre-enforced Vite plugin named aunboard", () => {
    const plugin = aunboard();
    expect(plugin.name).toBe("aunboard");
    expect(plugin.enforce).toBe("pre");
    expect(typeof plugin.transform).toBe("function");
    expect(typeof plugin.buildStart).toBe("function");
  });
});

describe("buildStart: id map", () => {
  it("writes aunboard.ids.json on first run", async () => {
    write("src/Pricing.tsx", PRICING);
    await start(aunboard());

    const map = JSON.parse(readFileSync(join(root, "aunboard.ids.json"), "utf8"));
    expect(map.version).toBe(1);
    expect(Object.keys(map.ids).sort()).toEqual([
      "PricingCard.b1",
      "PricingCard.b2",
      "PricingCard.s1",
    ]);
    expect(map.ids["PricingCard.b1"]).toMatchObject({
      file: "src/Pricing.tsx",
      component: "PricingCard",
      tag: "button",
    });
  });

  it("does not rewrite the file when nothing changed", async () => {
    write("src/Pricing.tsx", PRICING);
    await start(aunboard());
    logger.info.mockClear();
    await start(aunboard());
    expect(logger.info.mock.calls.flat().join("\n")).not.toContain("updated");
  });

  it("keeps ids and updates the file when a component moves", async () => {
    write("src/Pricing.tsx", PRICING);
    await start(aunboard());
    const before = JSON.parse(readFileSync(join(root, "aunboard.ids.json"), "utf8"));

    rmSync(join(root, "src/Pricing.tsx"));
    write("src/billing/Plan.tsx", PRICING);
    await start(aunboard());

    const after = JSON.parse(readFileSync(join(root, "aunboard.ids.json"), "utf8"));
    expect(Object.keys(after.ids).sort()).toEqual(Object.keys(before.ids).sort());
    expect(after.ids["PricingCard.b1"].file).toBe("src/billing/Plan.tsx");
    expect(after.ids["PricingCard.b1"].sig).toBe(before.ids["PricingCard.b1"].sig);
    expect(logger.info.mock.calls.flat().join("\n")).toContain('"PricingCard.b1" moved');
  });

  it("honours a custom idMap path and can be told not to write", async () => {
    write("src/Pricing.tsx", PRICING);
    await start(aunboard({ idMap: "./config/ids.json", write: false }));
    expect(() => readFileSync(join(root, "config/ids.json"), "utf8")).toThrow();
  });

  it("warns about an id claimed by two files", async () => {
    write("src/a.tsx", `export function Card(){ return <button>a</button>; }`);
    write("src/b.tsx", `export function Card(){ return <button>b</button>; }`);
    await start(aunboard());
    expect(logger.warn.mock.calls.flat().join("\n")).toContain('id "Card.b1" is claimed by');
  });
});

describe("transform: stamping", () => {
  it("stamps only the elements committed tours reference", async () => {
    write("src/Pricing.tsx", PRICING);
    write("tours/new-engineer.tour.json", tourFor("PricingCard.b1"));

    const plugin = await start(aunboard());
    const out = runTransform(plugin, join(root, "src/Pricing.tsx"), PRICING)!;

    expect(out.code).toContain('<button onClick={buy} data-aun="PricingCard.b1">');
    expect(out.code).toContain("<button onClick={cancel}>");
    expect(out.code.match(/data-aun/g)).toHaveLength(1);
    expect(out.map).toBeTruthy();
  });

  it("also stamps ids referenced only by a nested scope or a reveal locator", async () => {
    write("src/Pricing.tsx", PRICING);
    write(
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

    const plugin = await start(aunboard());
    const out = runTransform(plugin, join(root, "src/Pricing.tsx"), PRICING)!;
    expect(out.code).toContain('data-aun="PricingCard.s1"');
    expect(out.code).toContain('data-aun="PricingCard.b1"');
    expect(out.code).toContain('data-aun="PricingCard.b2"');
  });

  it("stamps nothing in build when there are no tours", async () => {
    write("src/Pricing.tsx", PRICING);
    const plugin = await start(aunboard());
    expect(runTransform(plugin, join(root, "src/Pricing.tsx"), PRICING)).toBeNull();
  });

  it("stamps everything in serve so the recorder can pick any element", async () => {
    write("src/Pricing.tsx", PRICING);
    const plugin = await start(aunboard(), "serve");
    const out = runTransform(plugin, join(root, "src/Pricing.tsx"), PRICING)!;
    expect(out.code.match(/data-aun/g)).toHaveLength(3);
  });

  it("lets stampAll be forced on in build and off in serve", async () => {
    write("src/Pricing.tsx", PRICING);

    const forcedOn = await start(aunboard({ stampAll: true }), "build");
    expect(runTransform(forcedOn, join(root, "src/Pricing.tsx"), PRICING)!.code).toContain(
      "data-aun",
    );

    const forcedOff = await start(aunboard({ stampAll: false }), "serve");
    expect(runTransform(forcedOff, join(root, "src/Pricing.tsx"), PRICING)).toBeNull();
  });

  it("stamps the original id after the element was reordered", async () => {
    write("src/Pricing.tsx", PRICING);
    write("tours/new-engineer.tour.json", tourFor("PricingCard.b1"));
    await start(aunboard());

    const swapped = PRICING.replace(
      /<button onClick=\{buy\}>Buy now<\/button>\s*<button onClick=\{cancel\}>Cancel<\/button>/,
      `<button onClick={cancel}>Cancel</button>\n      <button onClick={buy}>Buy now</button>`,
    );
    write("src/Pricing.tsx", swapped);

    const plugin = await start(aunboard());
    const out = runTransform(plugin, join(root, "src/Pricing.tsx"), swapped)!;
    expect(out.code).toContain('<button onClick={buy} data-aun="PricingCard.b1">');
    expect(out.code).not.toContain('<button onClick={cancel} data-aun="PricingCard.b1">');
  });
});

describe("transform: include / exclude", () => {
  it("only transforms .jsx and .tsx by default", async () => {
    write("src/Pricing.tsx", PRICING);
    const plugin = await start(aunboard(), "serve");
    expect(runTransform(plugin, join(root, "src/Pricing.ts"), PRICING)).toBeNull();
    expect(runTransform(plugin, join(root, "node_modules/x/Thing.tsx"), PRICING)).toBeNull();
    expect(runTransform(plugin, join(root, "src/Pricing.tsx"), PRICING)).not.toBeNull();
  });

  it("honours custom include and exclude patterns", async () => {
    write("src/Pricing.tsx", PRICING);
    const plugin = await start(
      aunboard({ include: /\.tsx$/, exclude: /generated/ }),
      "serve",
    );
    expect(runTransform(plugin, join(root, "src/generated/A.tsx"), PRICING)).toBeNull();
    expect(runTransform(plugin, join(root, "src/A.tsx"), PRICING)).not.toBeNull();
  });

  it("ignores a query suffix on the module id", async () => {
    write("src/Pricing.tsx", PRICING);
    const plugin = await start(aunboard(), "serve");
    expect(runTransform(plugin, `${join(root, "src/Pricing.tsx")}?t=123`, PRICING)).not.toBeNull();
  });
});

describe("broken tours", () => {
  it("fails the build when a tour references an id that matches nothing", async () => {
    write("src/Pricing.tsx", PRICING);
    write("tours/new-engineer.tour.json", tourFor("PricingCard.b9"));

    await expect(start(aunboard())).rejects.toThrow(/PricingCard\.b9/);
  });

  it("names the tour, the step and the tour file in the error", async () => {
    write("src/Pricing.tsx", PRICING);
    write("tours/new-engineer.tour.json", tourFor("Gone.b1"));

    const error = await start(aunboard()).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('"Gone.b1"');
    expect(message).toContain("New Engineer Onboarding");
    expect(message).toContain("new-engineer");
    expect(message).toContain("Start here");
    expect(message).toContain("new-engineer.tour.json");
  });

  it("fails when the element a tour points at is deleted", async () => {
    write("src/Pricing.tsx", PRICING);
    write("tours/new-engineer.tour.json", tourFor("PricingCard.b1"));
    await start(aunboard());

    write("src/Pricing.tsx", PRICING.replace("<button onClick={buy}>Buy now</button>", ""));
    await expect(start(aunboard())).rejects.toThrow(/PricingCard\.b1/);
  });

  it("still resolves after a move plus a rename, so no false failure", async () => {
    write("src/Pricing.tsx", PRICING);
    write("tours/new-engineer.tour.json", tourFor("PricingCard.b1"));
    await start(aunboard());

    rmSync(join(root, "src/Pricing.tsx"));
    write("src/billing/Plan.tsx", PRICING);
    await start(aunboard());

    const renamed = PRICING.replace("PricingCard", "PlanCard");
    write("src/billing/Plan.tsx", renamed);
    const plugin = await start(aunboard());

    const out = runTransform(plugin, join(root, "src/billing/Plan.tsx"), renamed)!;
    expect(out.code).toContain('<button onClick={buy} data-aun="PricingCard.b1">');
  });

  it("logs instead of throwing in serve", async () => {
    write("src/Pricing.tsx", PRICING);
    write("tours/new-engineer.tour.json", tourFor("Gone.b1"));

    await expect(start(aunboard(), "serve")).resolves.toBeTruthy();
    expect(logger.error.mock.calls.flat().join("\n")).toContain("Gone.b1");
  });

  it("can be told to fail in serve too", async () => {
    write("src/Pricing.tsx", PRICING);
    write("tours/new-engineer.tour.json", tourFor("Gone.b1"));
    await expect(start(aunboard({ failOnMissing: true }), "serve")).rejects.toThrow(/Gone\.b1/);
  });
});

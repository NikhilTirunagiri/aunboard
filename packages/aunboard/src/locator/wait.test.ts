import { describe, it, expect, afterEach } from "vitest";
import { resolveLocatorWhenReady } from "./wait";
import type { ElementLocator } from "./types";

afterEach(() => { document.body.innerHTML = ""; });
const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Run" } };

describe("resolveLocatorWhenReady", () => {
  it("resolves immediately when present", async () => {
    document.body.innerHTML = `<button>Run</button>`;
    const el = await resolveLocatorWhenReady(loc, { timeout: 500 });
    expect(el?.tagName).toBe("BUTTON");
  });
  it("resolves once a late element mounts", async () => {
    const p = resolveLocatorWhenReady(loc, { timeout: 1000 });
    setTimeout(() => { document.body.innerHTML = `<button>Run</button>`; }, 50);
    expect((await p)?.tagName).toBe("BUTTON");
  });
  it("resolves null on timeout", async () => {
    expect(await resolveLocatorWhenReady(loc, { timeout: 100 })).toBeNull();
  });
});

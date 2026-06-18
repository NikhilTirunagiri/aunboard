import { describe, it, expect } from "vitest";
import { locatorDurability } from "./durability";
import type { ElementLocator } from "../locator";

describe("locatorDurability", () => {
  it("rates a hook as stable", () => {
    const loc: ElementLocator = { tag: "div", hook: { attr: "data-explain", value: "deals.new" } };
    expect(locatorDurability(loc).tier).toBe("stable");
  });

  it("rates a real role + name as stable", () => {
    const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Save deal" }, text: "Save deal" };
    expect(locatorDurability(loc).tier).toBe("stable");
  });

  it("rates a positional (nth) locator as fragile and reports the position", () => {
    const loc: ElementLocator = { tag: "input", role: { role: "spinbutton" }, nth: 0, nthOf: 37 };
    const d = locatorDurability(loc);
    expect(d.tier).toBe("fragile");
    expect(d.reason).toMatch(/1 of 37/);
  });

  it("rates a container whose name is its own content as weak", () => {
    // A table named after its cells (role.name === text) drifts with the data.
    const loc: ElementLocator = {
      tag: "table",
      role: { role: "table", name: "Metric$300,000$500,000" },
      text: "Metric$300,000$500,000",
    };
    expect(locatorDurability(loc).tier).toBe("weak");
  });

  it("does NOT flag a button whose name equals its text (that's the legit label)", () => {
    const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Run" }, text: "Run" };
    expect(locatorDurability(loc).tier).toBe("stable");
  });

  it("rates a role with no name as weak", () => {
    const loc: ElementLocator = { tag: "input", role: { role: "textbox" } };
    expect(locatorDurability(loc).tier).toBe("weak");
  });

  it("rates a text-only locator as weak", () => {
    const loc: ElementLocator = { tag: "span", text: "Total budget" };
    expect(locatorDurability(loc).tier).toBe("weak");
  });
});

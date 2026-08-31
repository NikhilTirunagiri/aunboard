import { describe, it, expect } from "vitest";
import { scoreLocator, locatorSignals, isStamped, SIGNAL_SCORE } from "./score";
import type { ElementLocator } from "./types";

const stamped: ElementLocator = { tag: "button", hook: { attr: "data-aun", value: "PricingCard.b1" } };
const hook: ElementLocator = { tag: "button", hook: { attr: "data-testid", value: "cta" } };
const roleName: ElementLocator = { tag: "button", role: { role: "button", name: "Buy" }, text: "Buy" };
const textOnly: ElementLocator = { tag: "span", text: "Total" };
const positional: ElementLocator = { tag: "td", text: "42", nth: 3, nthOf: 9 };

describe("scoreLocator", () => {
  it("ranks signals in the documented durability order (lower is better)", () => {
    const ranked = [stamped, hook, roleName, textOnly, positional].map(scoreLocator);
    const sorted = [...ranked].sort((a, b) => a - b);
    expect(ranked).toEqual(sorted);
  });

  it("scores a build-stamped locator at the durability ceiling", () => {
    expect(scoreLocator(stamped)).toBe(0);
    expect(isStamped(stamped)).toBe(true);
    expect(isStamped(hook)).toBe(false);
  });

  it("makes a positional locator dramatically worse than any content signal", () => {
    expect(scoreLocator(positional)).toBeGreaterThan(scoreLocator(textOnly) * 10);
  });

  it("weights the strongest signal most heavily", () => {
    // role+name plus text must still beat text alone.
    expect(scoreLocator(roleName)).toBeLessThan(scoreLocator(textOnly) * 2);
  });

  it("charges a scope ancestor at a discount but never for free", () => {
    const scoped: ElementLocator = { ...textOnly, scope: roleName };
    expect(scoreLocator(scoped)).toBeGreaterThan(scoreLocator(textOnly));
  });

  it("reports the signals a locator actually carries", () => {
    expect(locatorSignals(stamped)).toEqual(["stamped"]);
    expect(locatorSignals(positional)).toEqual(["text", "nth"]);
    expect(locatorSignals({ tag: "div" })).toEqual(["tag"]);
    expect(SIGNAL_SCORE.stamped).toBeLessThan(SIGNAL_SCORE.hook);
  });
});

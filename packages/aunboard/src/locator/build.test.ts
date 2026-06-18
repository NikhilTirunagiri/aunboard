import { describe, it, expect } from "vitest";
import { buildLocator } from "./build";
import { resolveLocator } from "./resolve";

function setBody(html: string) {
  document.body.innerHTML = html;
}

describe("buildLocator", () => {
  it("prefers an existing hook and short-circuits", () => {
    setBody(`<button data-testid="run">Run</button>`);
    const loc = buildLocator(document.querySelector("button")!);
    expect(loc.hook).toEqual({ attr: "data-testid", value: "run" });
    expect(loc.role).toBeUndefined();
  });

  it("captures role + name for a plain button", () => {
    setBody(`<button>Run projection</button>`);
    const loc = buildLocator(document.querySelector("button")!);
    expect(loc.role).toEqual({ role: "button", name: "Run projection" });
  });

  it("produces a locator that re-finds the same element across duplicate names (round trip)", () => {
    setBody(`<header><button>Save</button></header><main><button>Save</button></main>`);
    const target = document.querySelector("main button")!;
    const loc = buildLocator(target);
    expect(resolveLocator(loc).element).toBe(target);
  });

  it("adds nth when identical elements remain ambiguous with no identifiable ancestor", () => {
    setBody(`<ul><li><a>Open</a></li><li><a>Open</a></li></ul>`);
    const second = document.querySelectorAll("a")[1]!;
    const loc = buildLocator(second);
    expect(resolveLocator(loc).element).toBe(second);
  });

  it("guarantees uniqueness across mixed table content via a scoping ancestor", () => {
    setBody(`
      <section aria-label="Returns"><table><tbody><tr><td>2025</td><td>8.1%</td></tr></tbody></table></section>
      <section aria-label="Construction"><table><tbody><tr><td>2025</td><td>3.0%</td></tr></tbody></table></section>`);
    const target = document.querySelectorAll("section")[1].querySelectorAll("td")[0];
    const loc = buildLocator(target as HTMLElement);
    expect(resolveLocator(loc).element).toBe(target);
  });
});

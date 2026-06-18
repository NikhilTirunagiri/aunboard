import { describe, it, expect } from "vitest";
import { resolveLocator } from "./resolve";
import type { ElementLocator } from "./types";

describe("resolveLocator", () => {
  it("matches by hook attribute first", () => {
    document.body.innerHTML = `<button data-testid="run">Run</button>`;
    const loc: ElementLocator = { tag: "button", hook: { attr: "data-testid", value: "run" } };
    const r = resolveLocator(loc);
    expect(r.element).toBe(document.querySelector("button"));
    expect(r.matchedBy).toBe("hook");
    expect(r.candidateCount).toBe(1);
  });

  it("matches by role + accessible name", () => {
    document.body.innerHTML = `<button>Cancel</button><button>Run projection</button>`;
    const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Run projection" } };
    const r = resolveLocator(loc);
    expect((r.element as HTMLElement).textContent).toBe("Run projection");
    expect(r.matchedBy).toBe("role");
  });

  it("uses nth to disambiguate identical matches", () => {
    document.body.innerHTML = `<a>Open</a><a>Open</a><a>Open</a>`;
    const loc: ElementLocator = { tag: "a", text: "Open", nth: 2 };
    const r = resolveLocator(loc);
    expect(r.element).toBe(document.querySelectorAll("a")[2]);
    expect(r.candidateCount).toBe(3);
    expect(r.matchedBy).toBe("text");
  });

  it("scopes the search to a resolved ancestor", () => {
    document.body.innerHTML = `
      <section aria-label="A"><button>Go</button></section>
      <section aria-label="B"><button>Go</button></section>`;
    const loc: ElementLocator = {
      tag: "button",
      role: { role: "button", name: "Go" },
      scope: { tag: "section", role: { role: "region", name: "B" } },
    };
    const r = resolveLocator(loc);
    expect(r.element).toBe(document.querySelectorAll("section")[1].querySelector("button"));
  });

  it("fails (no global fallback) when a scoped locator's scope is gone", () => {
    // The element matches globally, but its recorded scope no longer exists. Broadening to
    // the whole document could confidently match the wrong element, so we return not-found.
    document.body.innerHTML = `<main><button>Go</button></main>`;
    const loc: ElementLocator = {
      tag: "button",
      role: { role: "button", name: "Go" },
      scope: { tag: "section", role: { role: "region", name: "Gone" } },
    };
    const r = resolveLocator(loc);
    expect(r.element).toBeNull();
    expect(r.candidateCount).toBe(0);
  });

  it("returns not-found rather than guessing when signals fail (path is not a blind fallback)", () => {
    document.body.innerHTML = `<button>Other</button>`;
    const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Run" }, path: "button" };
    const r = resolveLocator(loc);
    expect(r.element).toBeNull();
    expect(r.matchedBy).toBeNull();
    expect(r.candidateCount).toBe(0);
  });
});

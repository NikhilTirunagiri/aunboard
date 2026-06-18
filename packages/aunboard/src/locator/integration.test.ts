// packages/label-mode/src/locator/integration.test.ts
import { describe, it, expect } from "vitest";
import { buildLocator } from "./build";
import { resolveLocator } from "./resolve";

describe("locator engine — record/replay resilience", () => {
  it("re-finds an element after non-ambiguating DOM changes", () => {
    document.body.innerHTML = `<main><button>Run projection</button></main>`;
    const loc = buildLocator(document.querySelector("button")!);

    // Re-render: new wrapper + additional, differently-named buttons.
    document.body.innerHTML = `
      <div class="shell">
        <header><button>Sign out</button></header>
        <main><button>Cancel</button><button>Run projection</button></main>
      </div>`;

    const r = resolveLocator(loc);
    expect((r.element as HTMLElement).textContent).toBe("Run projection");
  });

  it("reports not-found instead of guessing when the element is gone", () => {
    document.body.innerHTML = `<button>Run projection</button>`;
    const loc = buildLocator(document.querySelector("button")!);

    document.body.innerHTML = `<button>Something else</button>`;
    const r = resolveLocator(loc);
    expect(r.element).toBeNull();
  });

  it("returns not-found when DOM drift creates a duplicate (no guessing)", () => {
    document.body.innerHTML = `<button>Save</button>`;
    const loc = buildLocator(document.querySelector("button")!);
    document.body.innerHTML = `<button>Save</button><button>Save</button>`;
    expect(resolveLocator(loc).element).toBeNull();
  });

  it("nth-drift: returns null when candidate count changes since capture (wrong-element guard)", () => {
    // Two identical anchors — capture the 2nd (nth:1, nthOf:2).
    document.body.innerHTML = `<a>Open</a><a>Open</a>`;
    const anchors = document.querySelectorAll("a");
    const loc = buildLocator(anchors[1]!);
    expect(loc.nth).toBe(1);
    expect(loc.nthOf).toBe(2);

    // Mutate DOM to THREE identical anchors — candidate count changed, must not guess.
    document.body.innerHTML = `<a>Open</a><a>Open</a><a>Open</a>`;
    expect(resolveLocator(loc).element).toBeNull();
  });

  it("nth round-trip resolves correctly when count is unchanged", () => {
    // Two identical anchors — capture the 2nd (nth:1, nthOf:2).
    document.body.innerHTML = `<a>Open</a><a>Open</a>`;
    const anchors = document.querySelectorAll("a");
    const loc = buildLocator(anchors[1]!);
    expect(loc.nth).toBe(1);
    expect(loc.nthOf).toBe(2);

    // Same two anchors remain — should resolve to the 2nd one.
    document.body.innerHTML = `<a>Open</a><a>Open</a>`;
    const resolved = resolveLocator(loc);
    expect(resolved.element).not.toBeNull();
    expect(resolved.element).toBe(document.querySelectorAll("a")[1]);
  });
});

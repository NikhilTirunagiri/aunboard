import { describe, it, expect, afterEach } from "vitest";
import { resolveLocator, matchElements } from "./resolve";
import type { ElementLocator } from "./types";

afterEach(() => { document.body.innerHTML = ""; });

describe("tag widening", () => {
  it("still finds an element whose tag changed but whose role + name did not", () => {
    // A very common refactor: <button> becomes <a role="button"> (or a styled div).
    // The recorded locator says tag "button"; role + name is the real identity.
    document.body.innerHTML = `<a href="/buy" role="button">Buy now</a>`;
    const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Buy now" } };
    const r = resolveLocator(loc);
    expect(r.element).not.toBeNull();
    expect(r.element!.tagName.toLowerCase()).toBe("a");
    expect(r.matchedBy).toBe("role");
  });

  it("prefers the recorded tag when both an old and a new element match", () => {
    document.body.innerHTML = `
      <a href="/x" role="button">Save</a>
      <button>Save</button>`;
    const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Save" } };
    // The fast path finds the real <button> and never widens, so this stays unambiguous.
    expect(resolveLocator(loc).element!.tagName.toLowerCase()).toBe("button");
  });

  it("does NOT widen for a role with no name", () => {
    // A bare role matches far too broadly to search on alone.
    document.body.innerHTML = `<div role="textbox"></div>`;
    const loc: ElementLocator = { tag: "input", role: { role: "textbox" } };
    expect(resolveLocator(loc).element).toBeNull();
  });

  it("does NOT widen for a text-only locator", () => {
    // Widening on text would match every ancestor containing that text.
    document.body.innerHTML = `<div><p>Total budget</p></div>`;
    const loc: ElementLocator = { tag: "span", text: "Total budget" };
    expect(resolveLocator(loc).element).toBeNull();
  });

  it("refuses to resolve when widening finds two equally good matches", () => {
    document.body.innerHTML = `
      <a role="button">Delete</a>
      <div role="button">Delete</div>`;
    const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Delete" } };
    // Ambiguous with no nth — the engine must report not-found rather than pick one.
    const r = resolveLocator(loc);
    expect(r.element).toBeNull();
    expect(r.candidateCount).toBe(2);
  });
});

describe("shadow DOM", () => {
  function withShadow(hostTag = "my-widget", inner = `<button>Submit</button>`) {
    const host = document.createElement(hostTag);
    document.body.appendChild(host);
    host.attachShadow({ mode: "open" }).innerHTML = inner;
    return host;
  }

  it("finds an element inside an open shadow root", () => {
    withShadow();
    const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Submit" } };
    const r = resolveLocator(loc);
    expect(r.element).not.toBeNull();
    expect(r.element!.textContent).toBe("Submit");
  });

  it("finds an element nested two shadow roots deep", () => {
    const outer = document.createElement("outer-el");
    document.body.appendChild(outer);
    const outerRoot = outer.attachShadow({ mode: "open" });
    const inner = document.createElement("inner-el");
    outerRoot.appendChild(inner);
    inner.attachShadow({ mode: "open" }).innerHTML = `<button>Deep</button>`;

    const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Deep" } };
    expect(resolveLocator(loc).element!.textContent).toBe("Deep");
  });

  it("finds a hooked element inside a shadow root", () => {
    withShadow("my-widget", `<button data-aun="Widget.b1">Go</button>`);
    const loc: ElementLocator = { tag: "button", hook: { attr: "data-aun", value: "Widget.b1" } };
    const r = resolveLocator(loc);
    expect(r.element).not.toBeNull();
    expect(r.matchedBy).toBe("hook");
  });

  it("cannot see into a closed shadow root, and says so rather than guessing", () => {
    const host = document.createElement("closed-el");
    document.body.appendChild(host);
    host.attachShadow({ mode: "closed" }).innerHTML = `<button>Hidden</button>`;
    const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Hidden" } };
    expect(resolveLocator(loc).element).toBeNull();
  });

  it("prefers a light-DOM match over a shadow one", () => {
    document.body.innerHTML = `<button id="light">Submit</button>`;
    withShadow();
    const loc: ElementLocator = { tag: "button", role: { role: "button", name: "Submit" } };
    expect(resolveLocator(loc).element!.id).toBe("light");
  });
});

describe("malformed input", () => {
  it("returns no matches instead of throwing on an unusable selector", () => {
    const loc: ElementLocator = { tag: "!!!not a selector!!!" };
    expect(() => matchElements(loc)).not.toThrow();
    expect(matchElements(loc)).toEqual([]);
  });
});

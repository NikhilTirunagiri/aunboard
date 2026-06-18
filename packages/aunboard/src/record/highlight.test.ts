import { describe, it, expect, afterEach } from "vitest";
import { meaningfulTarget } from "./highlight";

afterEach(() => { document.body.innerHTML = ""; });

describe("meaningfulTarget", () => {
  it("returns the clicked element when it is already interactive", () => {
    document.body.innerHTML = `<button id="b">Run</button>`;
    const b = document.getElementById("b")!;
    expect(meaningfulTarget(b)).toBe(b);
  });
  it("climbs from a non-semantic inner span to its interactive ancestor", () => {
    document.body.innerHTML = `<button id="b"><span id="s">Run</span></button>`;
    expect(meaningfulTarget(document.getElementById("s")!)).toBe(document.getElementById("b"));
  });
  it("returns the element itself if it has a meaningful role even without an ancestor", () => {
    document.body.innerHTML = `<table id="t"><tbody><tr><td>x</td></tr></tbody></table>`;
    expect(meaningfulTarget(document.getElementById("t")!)).toBe(document.getElementById("t"));
  });
  it("returns null for body / empty-space clicks", () => {
    expect(meaningfulTarget(document.body)).toBeNull();
  });
  it("ignores label-mode's own UI (data-lm-ui subtree)", () => {
    document.body.innerHTML = `<div data-lm-ui><button id="ui">x</button></div>`;
    expect(meaningfulTarget(document.getElementById("ui")!)).toBeNull();
  });
  it("recognizes a multi-token explicit role (normalized to its first token)", () => {
    document.body.innerHTML = `<div id="d" role="button menu">Go</div>`;
    expect(meaningfulTarget(document.getElementById("d")!)).toBe(document.getElementById("d"));
  });
});

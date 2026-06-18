import { describe, it, expect, afterEach } from "vitest";
import { captureClick } from "./capture";

afterEach(() => { document.body.innerHTML = ""; });

describe("captureClick", () => {
  it("returns the meaningful element and a resolvable locator", () => {
    document.body.innerHTML = `<button><span id="s">Run projection</span></button>`;
    const out = captureClick(document.getElementById("s")!);
    expect(out).not.toBeNull();
    expect(out!.element.tagName).toBe("BUTTON");
    expect(out!.locator.tag).toBe("button");
  });
  it("returns null for own-UI clicks", () => {
    document.body.innerHTML = `<div data-lm-ui><button id="x">x</button></div>`;
    expect(captureClick(document.getElementById("x")!)).toBeNull();
  });
});

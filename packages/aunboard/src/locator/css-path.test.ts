import { describe, it, expect } from "vitest";
import { cssPath, isStableId, cssEscape } from "./css-path";

describe("isStableId", () => {
  it("accepts normal ids, rejects React useId() and empty", () => {
    expect(isStableId("email")).toBe(true);
    expect(isStableId(":r0:")).toBe(false);
    expect(isStableId("")).toBe(false);
  });
});

describe("cssEscape", () => {
  it("escapes characters that break selectors", () => {
    expect(cssEscape("a.b")).toContain("\\");
  });
});

describe("cssPath", () => {
  it("short-circuits to a stable id selector", () => {
    document.body.innerHTML = `<div id="root"><button>x</button></div>`;
    expect(cssPath(document.querySelector("#root")!)).toBe("#root");
  });

  it("uses nth-of-type among same-tag siblings and anchors to an id", () => {
    document.body.innerHTML = `<div id="list"><a>1</a><a>2</a><a>3</a></div>`;
    const third = document.querySelectorAll("a")[2] as HTMLElement;
    const sel = cssPath(third);
    expect(sel).toBe("#list > a:nth-of-type(3)");
    expect(document.querySelector(sel)).toBe(third);
  });

  it("ignores unstable React ids when anchoring", () => {
    document.body.innerHTML = `<div id=":r5:"><span><button>x</button></span></div>`;
    const btn = document.querySelector("button")!;
    const sel = cssPath(btn);
    expect(sel).not.toContain(":r5:");
    expect(document.querySelector(sel)).toBe(btn);
  });
});

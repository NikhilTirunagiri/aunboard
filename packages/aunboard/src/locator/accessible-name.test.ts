import { describe, it, expect } from "vitest";
import { implicitRole, accessibleName, normalizeText, TEXT_CAP } from "./accessible-name";

function html(s: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = s;
  return d.firstElementChild as HTMLElement;
}

describe("implicitRole", () => {
  it("maps native tags to ARIA roles", () => {
    expect(implicitRole(html(`<button>x</button>`))).toBe("button");
    expect(implicitRole(html(`<h2>x</h2>`))).toBe("heading");
    expect(implicitRole(html(`<nav>x</nav>`))).toBe("navigation");
    expect(implicitRole(html(`<section aria-label="a">x</section>`))).toBe("region");
  });
  it("treats <a> as a link only when it has href", () => {
    expect(implicitRole(html(`<a href="/x">x</a>`))).toBe("link");
    expect(implicitRole(html(`<a>x</a>`))).toBeUndefined();
  });
  it("derives input roles from type", () => {
    expect(implicitRole(html(`<input type="email">`))).toBe("textbox");
    expect(implicitRole(html(`<input type="submit">`))).toBe("button");
    expect(implicitRole(html(`<input type="checkbox">`))).toBe("checkbox");
  });
  it("prefers an explicit role attribute", () => {
    expect(implicitRole(html(`<div role="tab">x</div>`))).toBe("tab");
  });
  it("maps fieldset to group and figure to figure", () => {
    expect(implicitRole(html(`<fieldset>x</fieldset>`))).toBe("group");
    expect(implicitRole(html(`<figure>x</figure>`))).toBe("figure");
  });
  it("returns undefined for generic containers", () => {
    expect(implicitRole(html(`<div>x</div>`))).toBeUndefined();
  });
});

describe("accessibleName", () => {
  it("prefers aria-label", () => {
    expect(accessibleName(html(`<button aria-label="Close">x</button>`))).toBe("Close");
  });
  it("resolves aria-labelledby", () => {
    document.body.innerHTML = `<span id="t">Run</span><button aria-labelledby="t">x</button>`;
    expect(accessibleName(document.querySelector("button")!)).toBe("Run");
  });
  it("uses an associated label for form controls", () => {
    document.body.innerHTML = `<label for="e">Email</label><input id="e" type="email">`;
    expect(accessibleName(document.querySelector("input")!)).toBe("Email");
  });
  it("falls back to img alt", () => {
    expect(accessibleName(html(`<img alt="Logo">`))).toBe("Logo");
  });
  it("falls back to normalized text content", () => {
    expect(accessibleName(html(`<button>  Run   projection </button>`))).toBe("Run projection");
  });
  it("names a table from its <caption>, not its cell content", () => {
    const t = html(`<table><caption>LP returns by ticket</caption><tbody><tr><td>$300,000</td></tr></tbody></table>`);
    expect(accessibleName(t)).toBe("LP returns by ticket");
  });
  it("names a fieldset from its <legend>", () => {
    const f = html(`<fieldset><legend>Project info</legend><input></fieldset>`);
    expect(accessibleName(f)).toBe("Project info");
  });
  it("names a figure from its <figcaption>", () => {
    const f = html(`<figure><canvas></canvas><figcaption>Waterfall chart</figcaption></figure>`);
    expect(accessibleName(f)).toBe("Waterfall chart");
  });
  it("still prefers aria-label over a caption", () => {
    const t = html(`<table aria-label="Returns"><caption>Other</caption><tbody><tr><td>1</td></tr></tbody></table>`);
    expect(accessibleName(t)).toBe("Returns");
  });
});

describe("normalizeText", () => {
  it("collapses whitespace, trims, and caps length at 80", () => {
    expect(normalizeText(html(`<p>  a\n  b  </p>`))).toBe("a b");
    expect(normalizeText(html(`<p>${"x".repeat(100)}</p>`)).length).toBe(TEXT_CAP);
  });
});

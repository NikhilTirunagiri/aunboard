import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandGlobs, globToRegExp } from "./glob";

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "aunboard-glob-"));
  mkdirSync(join(dir, "tours"));
  mkdirSync(join(dir, "src", "features"), { recursive: true });
  mkdirSync(join(dir, "node_modules", "pkg"), { recursive: true });
  writeFileSync(join(dir, "tours", "a.tour.json"), "{}");
  writeFileSync(join(dir, "tours", "b.tour.json"), "{}");
  writeFileSync(join(dir, "tours", "notes.md"), "");
  writeFileSync(join(dir, "src", "features", "deep.tour.json"), "{}");
  writeFileSync(join(dir, "node_modules", "pkg", "vendor.tour.json"), "{}");
  return dir;
}

describe("globToRegExp", () => {
  it("keeps * inside a single segment", () => {
    const re = globToRegExp("tours/*.tour.json");
    expect(re.test("tours/a.tour.json")).toBe(true);
    expect(re.test("tours/nested/a.tour.json")).toBe(false);
    expect(re.test("tours/a.json")).toBe(false);
  });

  it("lets **/ cross segments, including zero of them", () => {
    const re = globToRegExp("**/*.tour.json");
    expect(re.test("a.tour.json")).toBe(true);
    expect(re.test("src/features/deep.tour.json")).toBe(true);
  });

  it("treats dots literally", () => {
    expect(globToRegExp("a.tour.json").test("axtourxjson")).toBe(false);
  });
});

describe("expandGlobs", () => {
  it("matches the default tours glob", () => {
    const dir = fixture();
    const files = expandGlobs(["./tours/*.tour.json"], dir);
    expect(files.map((f) => f.replace(`${dir}/`, ""))).toEqual(["tours/a.tour.json", "tours/b.tour.json"]);
  });

  it("finds *.tour.json anywhere with a globstar, skipping node_modules", () => {
    const dir = fixture();
    const files = expandGlobs(["**/*.tour.json"], dir).map((f) => f.replace(`${dir}/`, ""));
    expect(files).toContain("src/features/deep.tour.json");
    expect(files).toContain("tours/a.tour.json");
    expect(files.some((f) => f.includes("node_modules"))).toBe(false);
  });

  it("accepts a plain file path with no magic characters", () => {
    const dir = fixture();
    expect(expandGlobs(["tours/a.tour.json"], dir)).toEqual([join(dir, "tours", "a.tour.json")]);
  });

  it("de-duplicates overlapping patterns and sorts the result", () => {
    const dir = fixture();
    const files = expandGlobs(["tours/*.tour.json", "**/*.tour.json"], dir);
    expect(new Set(files).size).toBe(files.length);
    expect([...files].sort()).toEqual(files);
  });

  it("returns nothing for a pattern that matches nothing", () => {
    expect(expandGlobs(["nope/*.tour.json"], fixture())).toEqual([]);
  });
});

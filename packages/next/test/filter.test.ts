import { join, resolve, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { createFilter } from "../src/filter";
import { sourceRoots } from "../src/roots";

const root = resolve(sep, "project");
const file = (relative: string) => join(root, ...relative.split("/"));

describe("createFilter", () => {
  it("defaults to everything when include is empty", () => {
    const filter = createFilter(null, null, root);
    expect(filter(file("app/page.tsx"))).toBe(true);
  });

  it("matches RegExp include and exclude against the absolute path", () => {
    const filter = createFilter(/\.[jt]sx$/, /node_modules/, root);
    expect(filter(file("app/page.tsx"))).toBe(true);
    expect(filter(file("app/page.jsx"))).toBe(true);
    expect(filter(file("app/page.ts"))).toBe(false);
    expect(filter(file("node_modules/x/a.tsx"))).toBe(false);
  });

  it("matches glob strings against both the absolute and the relative path", () => {
    const filter = createFilter("app/**/*.tsx", null, root);
    expect(filter(file("app/nested/page.tsx"))).toBe(true);
    expect(filter(file("src/page.tsx"))).toBe(false);
  });

  it("takes arrays, and exclude wins over include", () => {
    const filter = createFilter(["app/**/*.tsx", /\.jsx$/], ["**/*.stories.tsx"], root);
    expect(filter(file("app/page.tsx"))).toBe(true);
    expect(filter(file("lib/thing.jsx"))).toBe(true);
    expect(filter(file("app/page.stories.tsx"))).toBe(false);
  });

  it("gives the same answer twice for a sticky regexp", () => {
    const filter = createFilter(/\.tsx$/g, null, root);
    expect(filter(file("app/page.tsx"))).toBe(true);
    expect(filter(file("app/page.tsx"))).toBe(true);
  });
});

describe("sourceRoots", () => {
  it("takes the static prefix of a glob", () => {
    expect(sourceRoots(["src/**/*.{jsx,tsx}"], root)).toEqual([resolve(root, "src")]);
  });

  it("expands a leading brace group into one directory each", () => {
    expect(sourceRoots(["{app,pages,src,components}/**/*.{jsx,tsx}"], root).sort()).toEqual(
      [
        resolve(root, "app"),
        resolve(root, "components"),
        resolve(root, "pages"),
        resolve(root, "src"),
      ].sort(),
    );
  });

  it("collapses to the project root when a glob could match anywhere", () => {
    expect(sourceRoots(["**/*.tsx"], root)).toEqual([resolve(root)]);
    expect(sourceRoots(["src/**/*.tsx", "**/*.jsx"], root)).toEqual([resolve(root)]);
  });

  it("keeps every glob's root, deduplicated", () => {
    expect(sourceRoots(["src/a/**/*.tsx", "src/a/**/*.jsx", "lib/**/*.tsx"], root).sort()).toEqual(
      [resolve(root, "lib"), resolve(root, "src/a")].sort(),
    );
  });
});

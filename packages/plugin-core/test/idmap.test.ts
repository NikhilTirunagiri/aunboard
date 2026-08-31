import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  normalizeIdMap,
  readIdMap,
  scanFiles,
  serializeIdMap,
  toMapPath,
  writeIdMapIfChanged,
} from "../src/idmap";
import { emptyIdMap } from "../src/types";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aunboard-idmap-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("toMapPath", () => {
  it("returns a root-relative posix path", () => {
    expect(toMapPath(join(dir, "src", "a", "B.tsx"), dir)).toBe("src/a/B.tsx");
  });
});

describe("readIdMap / normalizeIdMap", () => {
  it("treats a missing file as an empty map", () => {
    expect(readIdMap(join(dir, "nope.json"))).toEqual(emptyIdMap());
  });

  it("throws a clear error on invalid JSON", () => {
    const path = join(dir, "aunboard.ids.json");
    writeFileSync(path, "{ nope");
    expect(() => readIdMap(path)).toThrow(/is not valid JSON/);
  });

  it("drops malformed entries but keeps good ones", () => {
    const map = normalizeIdMap({
      version: 1,
      ids: {
        good: { file: "src/a.tsx", component: "A", tag: "button", sig: "abc123" },
        bad: { file: "src/a.tsx" },
        alsoBad: "nope",
      },
    });
    expect(Object.keys(map.ids)).toEqual(["good"]);
  });

  it("normalizes junk to an empty map", () => {
    expect(normalizeIdMap(null).ids).toEqual({});
    expect(normalizeIdMap([]).ids).toEqual({});
  });
});

describe("serializeIdMap / writeIdMapIfChanged", () => {
  const map = {
    version: 1,
    ids: {
      "Z.b1": { file: "src/z.tsx", component: "Z", tag: "button", sig: "aaa111" },
      "A.b1": { file: "src/a.tsx", component: "A", tag: "button", sig: "bbb222" },
    },
  };

  it("sorts keys and ends with a newline", () => {
    const text = serializeIdMap(map);
    expect(text.endsWith("\n")).toBe(true);
    expect(Object.keys(JSON.parse(text).ids)).toEqual(["A.b1", "Z.b1"]);
  });

  it("writes on first run and reports it", () => {
    const path = join(dir, "aunboard.ids.json");
    expect(writeIdMapIfChanged(path, map)).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8")).ids["A.b1"].component).toBe("A");
  });

  it("does not rewrite an unchanged file", () => {
    const path = join(dir, "aunboard.ids.json");
    writeIdMapIfChanged(path, map);
    const before = statSync(path).mtimeMs;
    expect(writeIdMapIfChanged(path, map)).toBe(false);
    expect(statSync(path).mtimeMs).toBe(before);
  });

  it("creates missing directories", () => {
    const path = join(dir, "deep", "nested", "aunboard.ids.json");
    expect(writeIdMapIfChanged(path, map)).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("A.b1");
  });
});

describe("scanFiles", () => {
  it("discovers elements across files with root-relative paths", () => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "A.tsx"), `export function A(){ return <button>a</button>; }`);
    writeFileSync(join(dir, "src", "B.tsx"), `export function B(){ return <div>b</div>; }`);

    const found = scanFiles([join(dir, "src", "A.tsx"), join(dir, "src", "B.tsx")], { root: dir });
    expect(found.map((el) => `${el.file}:${el.id}`)).toEqual(["src/A.tsx:A.b1", "src/B.tsx:B.d1"]);
  });

  it("reports rather than throws on a syntax error when onError is given", () => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "Bad.tsx"), `export function Bad(){ return <div>; }`);
    const errors: string[] = [];
    const found = scanFiles([join(dir, "src", "Bad.tsx")], {
      root: dir,
      onError: (file) => errors.push(file),
    });
    expect(found).toEqual([]);
    expect(errors).toHaveLength(1);
  });

  it("throws on a syntax error when no handler is given", () => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "Bad.tsx"), `export function Bad(){ return <div>; }`);
    expect(() => scanFiles([join(dir, "src", "Bad.tsx")], { root: dir })).toThrow();
  });
});

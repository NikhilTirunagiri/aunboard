import { describe, it, expect } from "vitest";
import { serializeTour, parseTour, ARTIFACT_VERSION } from "./artifact";
import type { Tour } from "../tour/types";

const tour: Tour = {
  id: "demo", name: "Product Demo",
  steps: [{ locator: { tag: "button", role: { role: "button", name: "Run" } }, label: "Run", description: "Runs it." }],
};

describe("artifact", () => {
  it("round-trips a tour through serialize/parse", () => {
    const json = serializeTour(tour);
    expect(JSON.parse(json).version).toBe(ARTIFACT_VERSION);
    expect(parseTour(json)).toEqual(tour);
  });
  it("throws on a wrong version", () => {
    expect(() => parseTour(JSON.stringify({ version: 999, tour }))).toThrow(/version/i);
  });
  it("throws on a missing locator in a step", () => {
    const bad = JSON.stringify({ version: ARTIFACT_VERSION, tour: { id: "x", name: "x", steps: [{ label: "a", description: "b" }] } });
    expect(() => parseTour(bad)).toThrow(/locator/i);
  });
  it("throws on a malformed tour (missing name/steps)", () => {
    const bad = JSON.stringify({ version: ARTIFACT_VERSION, tour: { id: "x" } });
    expect(() => parseTour(bad)).toThrow();
  });
  it("throws on a step missing label/description", () => {
    const bad = JSON.stringify({
      version: ARTIFACT_VERSION,
      tour: { id: "x", name: "x", steps: [{ locator: { tag: "button" } }] },
    });
    expect(() => parseTour(bad)).toThrow(/label|description/i);
  });

  it("accepts a step with an empty description (parity with the recorder)", () => {
    const ok = JSON.stringify({
      version: ARTIFACT_VERSION,
      tour: { id: "x", name: "x", steps: [{ locator: { tag: "button" }, label: "a", description: "" }] },
    });
    expect(() => parseTour(ok)).not.toThrow();
  });

  it("throws on a non-string route", () => {
    const bad = JSON.stringify({
      version: ARTIFACT_VERSION,
      tour: { id: "x", name: "x", steps: [{ locator: { tag: "button" }, label: "a", description: "b", route: 5 }] },
    });
    expect(() => parseTour(bad)).toThrow(/route/i);
  });

  it("accepts a step with a valid reveal array", () => {
    const ok = JSON.stringify({
      version: ARTIFACT_VERSION,
      tour: { id: "x", name: "x", steps: [{
        locator: { tag: "img" }, label: "a", description: "",
        reveal: [{ tag: "button", role: { role: "tab", name: "Cash Flow" } }],
      }] },
    });
    expect(() => parseTour(ok)).not.toThrow();
    expect(parseTour(ok).steps[0].reveal?.[0].tag).toBe("button");
  });

  it("throws on a reveal entry with no tag", () => {
    const bad = JSON.stringify({
      version: ARTIFACT_VERSION,
      tour: { id: "x", name: "x", steps: [{ locator: { tag: "img" }, label: "a", description: "", reveal: [{ role: { role: "tab" } }] }] },
    });
    expect(() => parseTour(bad)).toThrow(/tag/i);
  });

  it("throws on a non-numeric nth / a scope missing its tag", () => {
    const badNth = JSON.stringify({
      version: ARTIFACT_VERSION,
      tour: { id: "x", name: "x", steps: [{ locator: { tag: "a", nth: "2" }, label: "a", description: "b" }] },
    });
    expect(() => parseTour(badNth)).toThrow(/nth/i);

    const badScope = JSON.stringify({
      version: ARTIFACT_VERSION,
      tour: { id: "x", name: "x", steps: [{ locator: { tag: "a", scope: { role: { role: "region" } } }, label: "a", description: "b" }] },
    });
    expect(() => parseTour(badScope)).toThrow(/tag/i);
  });
});

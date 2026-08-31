import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { collectStampIds, collectStampRefs, collectTourRefs, toursFromJson } from "../src/tours";

const hook = (value: string) => ({ tag: "button", hook: { attr: "data-aun", value } });

const TOUR = {
  id: "new-engineer",
  name: "New Engineer Onboarding",
  steps: [
    {
      label: "Start here",
      description: "The primary action.",
      locator: {
        tag: "button",
        hook: { attr: "data-aun", value: "PricingCard.b1" },
        scope: {
          tag: "section",
          hook: { attr: "data-aun", value: "PricingCard.s1" },
          scope: hook("App.d1"),
        },
      },
      reveal: [hook("Nav.b2"), { tag: "div", scope: hook("Sidebar.d3") }],
    },
    {
      label: "Then this",
      description: "No stamp here.",
      locator: { tag: "a", role: { role: "link", name: "Docs" } },
    },
  ],
};

describe("collectTourRefs", () => {
  it("finds the step locator, its whole scope chain, and every reveal locator", () => {
    const refs = collectTourRefs(TOUR);
    expect(new Set(refs.map((r) => r.id))).toEqual(
      new Set(["PricingCard.b1", "PricingCard.s1", "App.d1", "Nav.b2", "Sidebar.d3"]),
    );
  });

  it("carries the tour and step context needed for a good error message", () => {
    const ref = collectTourRefs(TOUR, "tours/new-engineer.tour.json").find(
      (r) => r.id === "PricingCard.b1",
    )!;
    expect(ref).toMatchObject({
      tourId: "new-engineer",
      tourName: "New Engineer Onboarding",
      stepLabel: "Start here",
      stepIndex: 0,
      source: "tours/new-engineer.tour.json",
    });
  });

  it("ignores locators with no hook and hooks with a different attribute", () => {
    const tour = {
      id: "t",
      steps: [
        { label: "a", locator: { tag: "a", role: { role: "link" } } },
        { label: "b", locator: { tag: "b", hook: { attr: "data-testid", value: "nope" } } },
      ],
    };
    expect(collectTourRefs(tour)).toEqual([]);
  });

  it("honours a custom attribute", () => {
    const tour = {
      id: "t",
      steps: [{ label: "a", locator: { tag: "b", hook: { attr: "data-tour", value: "X.b1" } } }],
    };
    expect(collectTourRefs(tour, undefined, "data-tour").map((r) => r.id)).toEqual(["X.b1"]);
  });

  it("falls back to a positional step label", () => {
    const tour = { id: "t", steps: [{ locator: hook("A.b1") }] };
    expect(collectTourRefs(tour)[0].stepLabel).toBe("step 1");
  });

  it("tolerates a tour with no steps", () => {
    expect(collectTourRefs({ id: "t" })).toEqual([]);
  });
});

describe("toursFromJson", () => {
  it("reads the committed envelope", () => {
    expect(toursFromJson({ version: 1, tour: TOUR })).toEqual([TOUR]);
  });

  it("reads a bare tour", () => {
    expect(toursFromJson(TOUR)).toEqual([TOUR]);
  });

  it("reads a tours map", () => {
    expect(toursFromJson({ version: 1, tours: { "new-engineer": TOUR } })).toEqual([TOUR]);
  });

  it("reads an array of envelopes", () => {
    expect(toursFromJson([{ version: 1, tour: TOUR }, TOUR])).toEqual([TOUR, TOUR]);
  });

  it("returns nothing for junk", () => {
    expect(toursFromJson(null)).toEqual([]);
    expect(toursFromJson("nope")).toEqual([]);
    expect(toursFromJson({ hello: "world" })).toEqual([]);
  });
});

describe("collectStampIds from disk", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "aunboard-tours-"));
    writeFileSync(join(dir, "a.tour.json"), JSON.stringify({ version: 1, tour: TOUR }));
    writeFileSync(
      join(dir, "b.tour.json"),
      JSON.stringify({
        version: 1,
        tour: { id: "second", name: "Second", steps: [{ label: "s", locator: hook("Other.b1") }] },
      }),
    );
    writeFileSync(join(dir, "broken.tour.json"), "{ not json");
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("unions the ids across tour files", () => {
    const ids = collectStampIds([join(dir, "a.tour.json"), join(dir, "b.tour.json")]);
    expect(ids).toEqual(
      new Set(["PricingCard.b1", "PricingCard.s1", "App.d1", "Nav.b2", "Sidebar.d3", "Other.b1"]),
    );
  });

  it("records the source file on each reference", () => {
    const refs = collectStampRefs([join(dir, "b.tour.json")]);
    expect(refs).toHaveLength(1);
    expect(refs[0].source).toBe(join(dir, "b.tour.json"));
  });

  it("skips an unreadable file by default", () => {
    expect(collectStampIds([join(dir, "broken.tour.json"), join(dir, "missing.json")])).toEqual(
      new Set(),
    );
  });

  it("throws on an unreadable file in strict mode", () => {
    expect(() => collectStampIds([join(dir, "broken.tour.json")], { strict: true })).toThrow(
      /could not read tour file/,
    );
  });

  it("returns an empty set for no tour files", () => {
    expect(collectStampIds([])).toEqual(new Set());
  });
});

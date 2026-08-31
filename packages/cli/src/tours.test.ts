import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTourFiles, parseTourFile } from "./tours";

const locator = { tag: "button", hook: { attr: "data-tour-id", value: "save" } };

function envelope(tour: unknown, version: unknown = 1): string {
  return JSON.stringify({ version, tour });
}

const validTour = {
  id: "new-engineer",
  name: "New Engineer Onboarding",
  steps: [{ locator, label: "Save", description: "Saves the form.", route: "/settings" }],
};

describe("parseTourFile", () => {
  it("accepts a valid version-1 envelope", () => {
    const tour = parseTourFile(envelope(validTour));
    expect(tour.id).toBe("new-engineer");
    expect(tour.steps).toHaveLength(1);
    expect(tour.steps[0]!.locator.hook).toEqual({ attr: "data-tour-id", value: "save" });
  });

  it("accepts nested scope and reveal locators", () => {
    const tour = parseTourFile(
      envelope({
        ...validTour,
        steps: [
          {
            locator: { tag: "button", text: "Save", scope: { tag: "form", role: { role: "form" } } },
            reveal: [{ tag: "button", role: { role: "button", name: "Advanced" } }],
            label: "Save",
            description: "",
          },
        ],
      }),
    );
    expect(tour.steps[0]!.reveal).toHaveLength(1);
  });

  it("allows an empty description (the recorder permits label-only steps)", () => {
    expect(() => parseTourFile(envelope({ ...validTour, steps: [{ locator, label: "Save", description: "" }] }))).not.toThrow();
  });

  it("rejects the wrong artifact version", () => {
    expect(() => parseTourFile(envelope(validTour, 2))).toThrow(/unsupported artifact version 2/);
  });

  it("rejects a missing envelope version", () => {
    expect(() => parseTourFile(JSON.stringify({ tour: validTour }))).toThrow(/unsupported artifact version/);
  });

  it("rejects a tour missing id/name/steps", () => {
    expect(() => parseTourFile(envelope({ name: "No id", steps: [] }))).toThrow(/missing id\/name\/steps/);
  });

  it("rejects a malformed locator (no tag)", () => {
    expect(() =>
      parseTourFile(envelope({ ...validTour, steps: [{ locator: { role: { role: "button" } }, label: "x", description: "" }] })),
    ).toThrow(/step 0 locator is missing a "tag"/);
  });

  it("rejects a malformed nested scope locator", () => {
    expect(() =>
      parseTourFile(
        envelope({ ...validTour, steps: [{ locator: { tag: "button", scope: { role: {} } }, label: "x", description: "" }] }),
      ),
    ).toThrow(/step 0 scope locator is missing a "tag"/);
  });

  it("rejects a non-numeric nth", () => {
    expect(() =>
      parseTourFile(envelope({ ...validTour, steps: [{ locator: { tag: "li", nth: "2" }, label: "x", description: "" }] })),
    ).toThrow(/non-numeric "nth"/);
  });

  it("rejects a step with no label", () => {
    expect(() => parseTourFile(envelope({ ...validTour, steps: [{ locator, description: "d" }] }))).toThrow(
      /step 0 is missing label\/description/,
    );
  });

  it("rejects a non-string route", () => {
    expect(() =>
      parseTourFile(envelope({ ...validTour, steps: [{ locator, label: "x", description: "", route: 7 }] })),
    ).toThrow(/non-string "route"/);
  });

  it("rejects a non-array reveal", () => {
    expect(() =>
      parseTourFile(envelope({ ...validTour, steps: [{ locator, label: "x", description: "", reveal: {} }] })),
    ).toThrow(/"reveal" must be an array of locators/);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseTourFile("{ not json")).toThrow();
  });
});

describe("loadTourFiles", () => {
  it("splits parseable files from broken ones and reports cwd-relative paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "aunboard-tours-"));
    const good = join(dir, "good.tour.json");
    const bad = join(dir, "bad.tour.json");
    writeFileSync(good, envelope(validTour));
    writeFileSync(bad, envelope(validTour, 99));

    const result = loadTourFiles([good, bad], dir);

    expect(result.tours).toHaveLength(1);
    expect(result.tours[0]!.file).toBe("good.tour.json");
    expect(result.tours[0]!.tour.id).toBe("new-engineer");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.file).toBe("bad.tour.json");
    expect(result.errors[0]!.error).toMatch(/unsupported artifact version 99/);
  });
});

import { describe, it, expect } from "vitest";
import { validateTours } from "./validate";
import type { Tours } from "./types";

const step = (over: Partial<Tours[string]["steps"][number]> = {}) => ({
  locator: { tag: "button" },
  label: "Save step",
  description: "what it does",
  ...over,
});

describe("validateTours", () => {
  it("accepts a well-formed tour", () => {
    const tours: Tours = { demo: { id: "demo", name: "Demo", steps: [step()] } };
    expect(() => validateTours(tours)).not.toThrow();
  });

  // Regression: the recorder lets you save a step with no description, and that is exactly
  // what the real exported artifacts contain (demo-tour.json had 7/8 empty). validateTours
  // used to throw on those during render — crashing the documented commit/staging path.
  it("accepts steps with an empty description (the recorder allows it)", () => {
    const tours: Tours = { demo: { id: "demo", name: "Demo", steps: [step({ description: "" })] } };
    expect(() => validateTours(tours)).not.toThrow();
  });

  it("still requires a non-empty label", () => {
    const tours: Tours = { demo: { id: "demo", name: "Demo", steps: [step({ label: "  " })] } };
    expect(() => validateTours(tours)).toThrow(/label/i);
  });

  it("rejects a non-string description", () => {
    const tours = { demo: { id: "demo", name: "Demo", steps: [step({ description: undefined as unknown as string })] } } as Tours;
    expect(() => validateTours(tours)).toThrow(/description/i);
  });

  it("rejects a mismatched id / map key", () => {
    const tours: Tours = { demo: { id: "other", name: "Demo", steps: [step()] } };
    expect(() => validateTours(tours)).toThrow(/mismatched/i);
  });

  it("rejects a tour with no steps", () => {
    const tours: Tours = { demo: { id: "demo", name: "Demo", steps: [] } };
    expect(() => validateTours(tours)).toThrow(/at least one step/i);
  });

  it("rejects a step whose locator has no tag", () => {
    const tours = { demo: { id: "demo", name: "Demo", steps: [{ label: "x", description: "y", locator: {} }] } } as unknown as Tours;
    expect(() => validateTours(tours)).toThrow(/locator/i);
  });
});

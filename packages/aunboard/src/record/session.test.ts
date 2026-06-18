import { describe, it, expect } from "vitest";
import { emptySession, sessionReducer } from "./session";
import type { TourStep } from "../tour/types";

const step = (label: string): TourStep => ({
  locator: { tag: "button" }, label, description: `${label} desc`,
});

describe("sessionReducer", () => {
  it("starts empty with the given id/name", () => {
    const s = emptySession("demo", "Demo");
    expect(s).toEqual({ id: "demo", name: "Demo", steps: [] });
  });
  it("adds steps in order", () => {
    let s = emptySession("demo", "Demo");
    s = sessionReducer(s, { type: "ADD", step: step("A") });
    s = sessionReducer(s, { type: "ADD", step: step("B") });
    expect(s.steps.map((x) => x.label)).toEqual(["A", "B"]);
  });
  it("removes a step by index", () => {
    let s = emptySession("demo", "Demo");
    s = sessionReducer(s, { type: "ADD", step: step("A") });
    s = sessionReducer(s, { type: "ADD", step: step("B") });
    s = sessionReducer(s, { type: "REMOVE", index: 0 });
    expect(s.steps.map((x) => x.label)).toEqual(["B"]);
  });
  it("reorders a step (move down)", () => {
    let s = emptySession("demo", "Demo");
    ["A", "B", "C"].forEach((l) => (s = sessionReducer(s, { type: "ADD", step: step(l) })));
    s = sessionReducer(s, { type: "MOVE", from: 0, to: 2 });
    expect(s.steps.map((x) => x.label)).toEqual(["B", "C", "A"]);
  });
  it("replaces a step's narration", () => {
    let s = emptySession("demo", "Demo");
    s = sessionReducer(s, { type: "ADD", step: step("A") });
    s = sessionReducer(s, { type: "EDIT", index: 0, patch: { label: "A2", description: "d2" } });
    expect(s.steps[0]).toMatchObject({ label: "A2", description: "d2" });
  });
});

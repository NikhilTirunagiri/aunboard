import { describe, it, expect } from "vitest";
import { tourReducer, clampIndex, isLastStep, FIRST_STEP, type TourState } from "./machine";

const TOTAL = 3;
const at = (status: TourState["status"], index: number, token: number): TourState => ({
  status,
  index,
  token,
});

describe("tour machine helpers", () => {
  it("clampIndex stays in [0, total-1]", () => {
    expect(clampIndex(-2, TOTAL)).toBe(0);
    expect(clampIndex(99, TOTAL)).toBe(2);
    expect(clampIndex(1, TOTAL)).toBe(1);
    expect(clampIndex(0, 0)).toBe(0);
  });

  it("isLastStep detects the final index", () => {
    expect(isLastStep(2, TOTAL)).toBe(true);
    expect(isLastStep(1, TOTAL)).toBe(false);
  });
});

describe("tourReducer", () => {
  const init = at("idle", 0, 0);

  it("START enters navigating and bumps the token", () => {
    const s = tourReducer(init, { type: "START", index: 0 }, TOTAL);
    expect(s).toEqual(at("navigating", 0, 1));
  });

  it("START clamps an out-of-range index", () => {
    const s = tourReducer(init, { type: "START", index: 10 }, TOTAL);
    expect(s.index).toBe(2);
  });

  it("WAITING then ARRIVED keep index and token, only move status", () => {
    const navigating = at("navigating", 1, 5);
    const waiting = tourReducer(navigating, { type: "WAITING" }, TOTAL);
    expect(waiting).toEqual(at("waiting", 1, 5));
    const running = tourReducer(waiting, { type: "ARRIVED" }, TOTAL);
    expect(running).toEqual(at("running", 1, 5));
  });

  it("NEXT advances and bumps the token", () => {
    const s = tourReducer(at("running", 0, 1), { type: "NEXT" }, TOTAL);
    expect(s).toEqual(at("navigating", 1, 2));
  });

  it("NEXT on the last step ends the tour without bumping the token", () => {
    const s = tourReducer(at("running", 2, 7), { type: "NEXT" }, TOTAL);
    expect(s).toEqual(at("done", 2, 7));
  });

  it("PREV goes back, not below FIRST_STEP", () => {
    expect(tourReducer(at("running", 2, 3), { type: "PREV" }, TOTAL)).toEqual(at("navigating", 1, 4));
    expect(tourReducer(at("running", 0, 3), { type: "PREV" }, TOTAL)).toEqual(
      at("navigating", FIRST_STEP, 4),
    );
  });

  it("NOT_FOUND moves to not-found, preserving index and token", () => {
    expect(tourReducer(at("waiting", 1, 4), { type: "NOT_FOUND" }, TOTAL)).toEqual(at("not-found", 1, 4));
  });

  it("STOP returns to idle, preserving index and token", () => {
    expect(tourReducer(at("running", 2, 9), { type: "STOP" }, TOTAL)).toEqual(at("idle", 2, 9));
  });

  it("GOTO enters navigating, clamps the index, and bumps the token", () => {
    expect(tourReducer(at("running", 0, 1), { type: "GOTO", index: 2 }, TOTAL)).toEqual(at("navigating", 2, 2));
    expect(tourReducer(at("running", 0, 1), { type: "GOTO", index: 9 }, TOTAL)).toEqual(at("navigating", 2, 2));
  });
});

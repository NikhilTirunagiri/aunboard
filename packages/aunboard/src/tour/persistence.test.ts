import { describe, it, expect, beforeEach } from "vitest";
import { loadProgress, saveProgress, clearProgress } from "./persistence";

describe("tour persistence", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing is saved", () => {
    expect(loadProgress("onboard")).toBeNull();
  });

  it("round-trips progress", () => {
    saveProgress("onboard", { stepIndex: 3, completed: false });
    expect(loadProgress("onboard")).toEqual({ stepIndex: 3, completed: false });
  });

  it("clears progress", () => {
    saveProgress("onboard", { stepIndex: 1, completed: true });
    clearProgress("onboard");
    expect(loadProgress("onboard")).toBeNull();
  });

  it("returns null on malformed stored data", () => {
    localStorage.setItem("label-mode:tour:onboard", "{not json");
    expect(loadProgress("onboard")).toBeNull();
  });
});

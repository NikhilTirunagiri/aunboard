import { describe, it, expect } from "vitest";
import { isLabelModeEnabled } from "./env";

describe("isLabelModeEnabled", () => {
  it("is enabled in development", () => {
    expect(isLabelModeEnabled("development", undefined)).toBe(true);
  });
  it("is disabled in production by default", () => {
    expect(isLabelModeEnabled("production", undefined)).toBe(false);
  });
  it("can be force-enabled in production via explicit flag (for staging builds)", () => {
    expect(isLabelModeEnabled("production", true)).toBe(true);
  });
  it("can be force-disabled even in development", () => {
    expect(isLabelModeEnabled("development", false)).toBe(false);
  });
});

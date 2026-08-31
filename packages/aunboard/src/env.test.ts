import { describe, it, expect } from "vitest";
import { isAunboardEnabled } from "./env";

describe("isAunboardEnabled", () => {
  it("is enabled in development", () => {
    expect(isAunboardEnabled("development", undefined)).toBe(true);
  });
  it("is disabled in production by default", () => {
    expect(isAunboardEnabled("production", undefined)).toBe(false);
  });
  it("can be force-enabled in production via explicit flag (for staging builds)", () => {
    expect(isAunboardEnabled("production", true)).toBe(true);
  });
  it("can be force-disabled even in development", () => {
    expect(isAunboardEnabled("development", false)).toBe(false);
  });
});

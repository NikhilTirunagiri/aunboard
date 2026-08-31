import { describe, expect, it } from "vitest";
import { MISSING_PLAYWRIGHT_MESSAGE, loadPlaywright, resolveStepUrl } from "./driver";
import { MISSING_BUNDLE_MESSAGE } from "./inject-bundle";

describe("resolveStepUrl", () => {
  it("joins an absolute route onto the base url", () => {
    expect(resolveStepUrl("http://localhost:3000", "/settings")).toBe("http://localhost:3000/settings");
    expect(resolveStepUrl("http://localhost:3000/", "/settings")).toBe("http://localhost:3000/settings");
  });

  it("keeps a base path prefix for absolute routes", () => {
    expect(resolveStepUrl("http://localhost:3000/app", "/settings")).toBe("http://localhost:3000/app/settings");
  });

  it("returns the base url when the step has no route", () => {
    expect(resolveStepUrl("http://localhost:3000", undefined)).toBe("http://localhost:3000");
  });

  it("resolves a relative route against the base", () => {
    expect(resolveStepUrl("http://localhost:3000/app", "settings")).toBe("http://localhost:3000/app/settings");
  });
});

describe("loadPlaywright", () => {
  // Playwright is an optional peer dependency: the user installs it. Simulate both worlds
  // with an injected loader so the test never depends on a real browser being present.
  it("fails with actionable install instructions when Playwright is absent", async () => {
    const absent = async () => {
      throw new Error("Cannot find package 'playwright'");
    };
    await expect(loadPlaywright(absent)).rejects.toThrow(/Playwright is required/);
    expect(MISSING_PLAYWRIGHT_MESSAGE).toContain("npm i -D playwright");
    expect(MISSING_PLAYWRIGHT_MESSAGE).toContain("npx playwright install chromium");
  });

  it("returns the module when Playwright is installed", async () => {
    const chromium = { launch: async () => ({}) };
    await expect(loadPlaywright(async () => ({ chromium }))).resolves.toEqual({ chromium });
  });
});

describe("inject bundle", () => {
  it("has an actionable message when the browser bundle has not been built", () => {
    expect(MISSING_BUNDLE_MESSAGE).toMatch(/inject\.global\.js/);
  });
});

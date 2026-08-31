import { describe, expect, it } from "vitest";

import { withAunboard } from "../src/index";

/**
 * Next's `NextConfig` is an interface with no index signature, so a wrapper
 * typed as `Record<string, unknown>` would not accept it. These stand in for it
 * at typecheck time — the assertions are incidental, the annotations are the
 * test.
 */
interface FakeNextConfig {
  reactStrictMode?: boolean;
  experimental?: { typedRoutes?: boolean };
  webpack?: (config: any, context: any) => any;
}

describe("the public signature", () => {
  it("returns the config type it was given", () => {
    const config: FakeNextConfig = { reactStrictMode: true };
    const wrapped: FakeNextConfig = withAunboard(config);
    expect(wrapped.reactStrictMode).toBe(true);
    expect(typeof wrapped.webpack).toBe("function");
  });

  it("returns a config function when it was given one", () => {
    const configFn = (phase: string): FakeNextConfig => ({
      reactStrictMode: phase === "phase-production-build",
    });
    const wrapped: (phase: string, context: any) => FakeNextConfig = withAunboard(configFn);
    expect(wrapped("phase-production-build", {}).reactStrictMode).toBe(true);
  });

  it("accepts options alongside either form", () => {
    const wrapped: FakeNextConfig = withAunboard({}, { attr: "data-aun", stampAll: false });
    expect(typeof wrapped.webpack).toBe("function");
  });
});

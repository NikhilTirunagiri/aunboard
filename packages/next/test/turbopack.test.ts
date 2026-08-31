import { describe, expect, it, vi } from "vitest";

import { TURBOPACK_WARNING, isTurbopack, warnIfTurbopack } from "../src/turbopack";
import { withAunboard } from "../src/index";
import { aunboardRule, fakeWebpackConfig } from "./harness";

function logger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("isTurbopack", () => {
  it("detects the env var Next sets for --turbopack", () => {
    expect(isTurbopack({ TURBOPACK: "1" }, [])).toBe(true);
    expect(isTurbopack({ TURBOPACK_DEV: "1" }, [])).toBe(true);
    expect(isTurbopack({ TURBOPACK_BUILD: "1" }, [])).toBe(true);
    expect(isTurbopack({ NEXT_TURBOPACK: "1" }, [])).toBe(true);
  });

  it("detects the flag on the command line, for runners that drop the env var", () => {
    expect(isTurbopack({}, ["node", "next", "dev", "--turbopack"])).toBe(true);
    expect(isTurbopack({}, ["node", "next", "dev", "--turbo"])).toBe(true);
  });

  it("is false for a plain webpack build", () => {
    expect(isTurbopack({}, ["node", "next", "build"])).toBe(false);
    expect(isTurbopack({ NODE_ENV: "production" }, ["node", "next", "dev"])).toBe(false);
    // A flag that merely mentions turbo is not the turbopack flag.
    expect(isTurbopack({}, ["node", "next", "dev", "--turbo-trace"])).toBe(false);
  });
});

describe("the Turbopack warning", () => {
  it("says stamping is skipped and what the consequence is", () => {
    expect(TURBOPACK_WARNING).toContain("Turbopack");
    expect(TURBOPACK_WARNING).toContain("stamping is skipped");
    expect(TURBOPACK_WARNING).toContain("semantic locators");
    expect(TURBOPACK_WARNING).toContain("--turbopack");
  });

  it("is emitted once, however many times the config is evaluated", () => {
    const log = logger();
    const once = { warned: false };

    expect(warnIfTurbopack(log, once, { TURBOPACK: "1" }, [])).toBe(true);
    expect(warnIfTurbopack(log, once, { TURBOPACK: "1" }, [])).toBe(true);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).toBe(TURBOPACK_WARNING);
  });

  it("says nothing when webpack is doing the build", () => {
    const log = logger();
    expect(warnIfTurbopack(log, { warned: false }, {}, ["node", "next", "build"])).toBe(false);
    expect(log.warn).not.toHaveBeenCalled();
  });
});

describe("withAunboard under Turbopack", () => {
  const withEnv = <T,>(value: string | undefined, body: () => T): T => {
    const previous = process.env.TURBOPACK;
    if (value === undefined) delete process.env.TURBOPACK;
    else process.env.TURBOPACK = value;
    try {
      return body();
    } finally {
      if (previous === undefined) delete process.env.TURBOPACK;
      else process.env.TURBOPACK = previous;
    }
  };

  it("warns once and still returns a working config", () => {
    const log = logger();
    const wrapped = withEnv("1", () =>
      withAunboard({ reactStrictMode: true }, { logger: log }),
    ) as Record<string, any>;

    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).toBe(TURBOPACK_WARNING);
    expect(wrapped.reactStrictMode).toBe(true);

    // Turbopack never calls it, but the webpack path still works if it does.
    const config = wrapped.webpack(fakeWebpackConfig(), { dev: true, dir: process.cwd() });
    expect(aunboardRule(config)).toBeTruthy();
  });

  it("does not warn when Turbopack is not in play", () => {
    const log = logger();
    withEnv(undefined, () => withAunboard({}, { logger: log }));
    expect(log.warn).not.toHaveBeenCalled();
  });
});

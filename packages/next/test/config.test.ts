import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withAunboard } from "../src/index";
import type { AunboardOptions, StampState } from "../src/types";
import {
  PRICING,
  aunboardRule,
  compilerFor,
  fakeWebpackConfig,
  writeIn,
  type FakeWebpackConfig,
} from "./harness";

let root: string;
let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

beforeEach(() => {
  // realpath: webpack reports the real path of a module, and so does the loader.
  root = realpathSync(mkdtempSync(join(tmpdir(), "aunboard-next-")));
  logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** Run the wrapped config's webpack callback the way Next would. */
function callWebpack(
  wrapped: Record<string, any>,
  config: FakeWebpackConfig = fakeWebpackConfig(),
  context: { dev?: boolean; dir?: string; isServer?: boolean } = {},
): FakeWebpackConfig {
  return wrapped.webpack(config, { dev: false, dir: root, isServer: false, ...context });
}

function stateOf(config: FakeWebpackConfig): StampState {
  return aunboardRule(config).use[0].options.state as StampState;
}

function options(extra: AunboardOptions = {}): AunboardOptions {
  return { logger, ...extra };
}

describe("withAunboard: config shapes", () => {
  it("wraps an object config without mutating it", () => {
    const original = { reactStrictMode: true, images: { unoptimized: true } };
    const wrapped = withAunboard(original, options());

    expect(wrapped).not.toBe(original);
    expect(wrapped.reactStrictMode).toBe(true);
    expect((wrapped as any).images).toEqual({ unoptimized: true });
    expect(typeof (wrapped as any).webpack).toBe("function");
    expect("webpack" in original).toBe(false);
  });

  it("wraps a function config, forwarding phase and context", () => {
    const configFn = vi.fn((phase: string) => ({ reactStrictMode: phase === "phase-production-build" }));
    const wrapped = withAunboard(configFn, options());

    expect(typeof wrapped).toBe("function");
    const resolved = wrapped("phase-production-build", { defaultConfig: {} }) as Record<string, any>;

    expect(configFn).toHaveBeenCalledWith("phase-production-build", { defaultConfig: {} });
    expect(resolved.reactStrictMode).toBe(true);
    expect(typeof resolved.webpack).toBe("function");
  });

  it("survives being called with no config at all", () => {
    const wrapped = withAunboard(undefined, options()) as Record<string, any>;
    const config = callWebpack(wrapped);
    expect(aunboardRule(config)).toBeTruthy();
  });
});

describe("withAunboard: an existing webpack function", () => {
  it("calls it and passes its return value through", () => {
    const replacement = fakeWebpackConfig({ marker: "mine" });
    const userWebpack = vi.fn((_config: FakeWebpackConfig, _context: unknown) => replacement);
    const wrapped = withAunboard({ webpack: userWebpack }, options()) as Record<string, any>;

    const config = fakeWebpackConfig();
    const returned = callWebpack(wrapped, config, { dev: true });

    expect(userWebpack).toHaveBeenCalledTimes(1);
    expect(returned).toBe(replacement);
    // It was handed the config aunboard had already registered on.
    expect(userWebpack.mock.calls[0][0]).toBe(config);
    expect(userWebpack.mock.calls[0][1]).toMatchObject({ dev: true, dir: root });
    expect(aunboardRule(config)).toBeTruthy();
  });

  it("falls back to the config when the user's function returns nothing", () => {
    const userWebpack = vi.fn((_config: FakeWebpackConfig) => undefined);
    const wrapped = withAunboard({ webpack: userWebpack }, options()) as Record<string, any>;

    const config = fakeWebpackConfig();
    expect(callWebpack(wrapped, config)).toBe(config);
    expect(userWebpack).toHaveBeenCalledTimes(1);
  });

  it("lets the user's function see and keep aunboard's rule", () => {
    const seen: any[] = [];
    const userWebpack = (config: FakeWebpackConfig) => {
      seen.push(...config.module.rules);
      return config;
    };
    const wrapped = withAunboard({ webpack: userWebpack }, options()) as Record<string, any>;
    const config = callWebpack(wrapped);

    expect(seen).toHaveLength(1);
    expect(seen[0].enforce).toBe("pre");
    expect(config.module.rules).toContain(seen[0]);
  });

  it("keeps a user webpack function that lives on a function config", () => {
    const userWebpack = vi.fn((config: FakeWebpackConfig) => config);
    const wrapped = withAunboard(() => ({ webpack: userWebpack }), options());
    const resolved = wrapped("phase-development-server", {}) as Record<string, any>;

    callWebpack(resolved);
    expect(userWebpack).toHaveBeenCalledTimes(1);
  });
});

describe("withAunboard: the registered rule", () => {
  it("is a pre-loader for jsx/tsx only, outside node_modules", () => {
    const wrapped = withAunboard({}, options()) as Record<string, any>;
    const rule = aunboardRule(callWebpack(wrapped));

    expect(rule.enforce).toBe("pre");
    expect(rule.test.test("/app/page.tsx")).toBe(true);
    expect(rule.test.test("/app/page.jsx")).toBe(true);
    expect(rule.test.test("/app/page.ts")).toBe(false);
    expect(rule.test.test("/app/page.js")).toBe(false);
    expect(rule.exclude.test(join("/app", "node_modules", "x", "a.tsx"))).toBe(true);
    expect(rule.use[0].loader).toMatch(/loader\.(ts|js|cjs)$/);
  });

  it("goes in front of the rules Next already configured", () => {
    const existing = { test: /\.tsx$/, use: "next-swc-loader" };
    const config = fakeWebpackConfig({ module: { rules: [existing] } });
    const wrapped = withAunboard({}, options()) as Record<string, any>;
    callWebpack(wrapped, config);

    expect(config.module.rules).toHaveLength(2);
    expect(config.module.rules[1]).toBe(existing);
  });

  it("scopes include to the directories the src globs can reach", () => {
    const wrapped = withAunboard({}, options()) as Record<string, any>;
    expect(aunboardRule(callWebpack(wrapped)).include.sort()).toEqual(
      [
        resolve(root, "app"),
        resolve(root, "components"),
        resolve(root, "pages"),
        resolve(root, "src"),
      ].sort(),
    );

    const scoped = withAunboard({}, options({ src: "src/**/*.tsx" })) as Record<string, any>;
    expect(aunboardRule(callWebpack(scoped)).include).toEqual([resolve(root, "src")]);
  });

  it("creates module.rules and plugins when the config has neither", () => {
    const config = { } as FakeWebpackConfig;
    const wrapped = withAunboard({}, options()) as Record<string, any>;
    wrapped.webpack(config, { dev: false, dir: root });

    expect(config.module.rules).toHaveLength(1);
    expect(config.plugins).toHaveLength(1);
  });

  it("registers once even if the config is wrapped twice", () => {
    const wrapped = withAunboard(withAunboard({}, options()), options()) as Record<string, any>;
    const config = callWebpack(wrapped);

    expect(config.module.rules).toHaveLength(1);
    expect(config.plugins).toHaveLength(1);
  });

  it("keeps plugins the config already had", () => {
    const existing = { apply() {} };
    const config = fakeWebpackConfig({ plugins: [existing] });
    const wrapped = withAunboard({}, options()) as Record<string, any>;
    callWebpack(wrapped, config);

    expect(config.plugins[0]).toBe(existing);
    expect(config.plugins).toHaveLength(2);
  });
});

describe("withAunboard: option defaults", () => {
  it("stamps everything in dev and only tour ids in a build", () => {
    const wrapped = withAunboard({}, options()) as Record<string, any>;
    expect(stateOf(callWebpack(wrapped, fakeWebpackConfig(), { dev: true })).stampAll).toBe(true);
    expect(stateOf(callWebpack(wrapped, fakeWebpackConfig(), { dev: false })).stampAll).toBe(false);
  });

  it("lets stampAll be forced either way", () => {
    const off = withAunboard({}, options({ stampAll: false })) as Record<string, any>;
    expect(stateOf(callWebpack(off, fakeWebpackConfig(), { dev: true })).stampAll).toBe(false);

    const on = withAunboard({}, options({ stampAll: true })) as Record<string, any>;
    expect(stateOf(callWebpack(on, fakeWebpackConfig(), { dev: false })).stampAll).toBe(true);
  });

  it("defaults attr, root and the include filter", () => {
    const wrapped = withAunboard({}, options()) as Record<string, any>;
    const state = stateOf(callWebpack(wrapped));

    expect(state.attr).toBe("data-aun");
    expect(state.root).toBe(root);
    expect(state.filter(join(root, "app/page.tsx"))).toBe(true);
    expect(state.filter(join(root, "app/page.ts"))).toBe(false);
    expect(state.filter(join(root, "node_modules/x/a.tsx"))).toBe(false);
  });

  it("honours custom attr, include and exclude", () => {
    const wrapped = withAunboard(
      {},
      options({ attr: "data-hook", include: /\.tsx$/, exclude: /generated/ }),
    ) as Record<string, any>;
    const state = stateOf(callWebpack(wrapped));

    expect(state.attr).toBe("data-hook");
    expect(state.filter(join(root, "app/generated/page.tsx"))).toBe(false);
    expect(state.filter(join(root, "app/page.jsx"))).toBe(false);
    expect(state.filter(join(root, "app/page.tsx"))).toBe(true);
  });

  it("falls back to cwd and NODE_ENV when Next passes no context", () => {
    const wrapped = withAunboard({}, options()) as Record<string, any>;
    const state = stateOf(wrapped.webpack(fakeWebpackConfig(), undefined));
    expect(state.root).toBe(process.cwd());
  });
});

describe("withAunboard: shared state across compilers", () => {
  it("gives the client and server compilers the same state object", () => {
    const wrapped = withAunboard({}, options()) as Record<string, any>;
    const client = callWebpack(wrapped, fakeWebpackConfig(), { isServer: false });
    const server = callWebpack(wrapped, fakeWebpackConfig(), { isServer: true });

    expect(stateOf(client)).toBe(stateOf(server));
  });

  it("runs the once-per-compilation pass once for a client + server round", () => {
    writeIn(root, "app/Pricing.tsx", PRICING);
    const wrapped = withAunboard({}, options()) as Record<string, any>;
    const client = callWebpack(wrapped, fakeWebpackConfig(), { isServer: false });
    const server = callWebpack(wrapped, fakeWebpackConfig(), { isServer: true });

    compilerFor(client).compile();
    const summaries = () => logger.info.mock.calls.flat().filter((line) => String(line).includes("elements in"));
    expect(summaries()).toHaveLength(1);

    compilerFor(server).compile();
    expect(summaries()).toHaveLength(1);
  });
});

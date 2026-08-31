import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import aunboardLoader, { type LoaderContextLike } from "../src/loader";

/** A stand-in for the slice of webpack's config that this package touches. */
export interface FakeWebpackConfig {
  module: { rules: any[] };
  plugins: any[];
  [key: string]: unknown;
}

export function fakeWebpackConfig(extra: Partial<FakeWebpackConfig> = {}): FakeWebpackConfig {
  return { module: { rules: [] }, plugins: [], ...extra };
}

type BeforeCompile = (params: unknown, callback: (error?: Error | null) => void) => void;

/** A stand-in for webpack's `Compiler`, just enough to fire `beforeCompile`. */
export class FakeCompiler {
  readonly taps: BeforeCompile[] = [];
  readonly hooks = {
    beforeCompile: {
      tapAsync: (_name: string, handler: BeforeCompile) => {
        this.taps.push(handler);
      },
    },
  };

  /** Fire `beforeCompile`, rethrowing whatever a tap passed to its callback. */
  compile(): void {
    for (const tap of this.taps) {
      let failure: Error | null | undefined;
      tap({}, (error) => {
        failure = error;
      });
      if (failure) throw failure;
    }
  }
}

/** Apply every aunboard plugin in a config to a fresh fake compiler. */
export function compilerFor(config: FakeWebpackConfig): FakeCompiler {
  const compiler = new FakeCompiler();
  for (const plugin of config.plugins) plugin.apply(compiler as never);
  return compiler;
}

/** The rule `withAunboard` unshifted onto the config. */
export function aunboardRule(config: FakeWebpackConfig): any {
  const rule = config.module.rules.find((candidate: any) =>
    candidate?.use?.[0]?.loader?.includes("loader"),
  );
  if (!rule) throw new Error("no aunboard rule in the config");
  return rule;
}

export interface LoaderRun {
  code: string;
  map: unknown;
  error: Error | null;
  dependencies: string[];
  warnings: Error[];
}

/** Run the loader the way webpack would, with the options from the rule. */
export function runLoader(
  config: FakeWebpackConfig,
  file: string,
  source: string,
  inputMap?: unknown,
): LoaderRun {
  const rule = aunboardRule(config);
  const run: LoaderRun = { code: source, map: undefined, error: null, dependencies: [], warnings: [] };
  const context: LoaderContextLike = {
    resourcePath: file,
    getOptions: () => rule.use[0].options,
    addDependency: (dependency) => run.dependencies.push(dependency),
    emitWarning: (warning) => run.warnings.push(warning),
    callback: (error, content, sourceMap) => {
      run.error = error;
      run.code = content ?? "";
      run.map = sourceMap;
    },
  };
  aunboardLoader.call(context, source, inputMap);
  return run;
}

/** Write a file inside a temp project, creating parents. */
export function writeIn(root: string, relative: string, contents: string): string {
  const path = join(root, relative);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

export const PRICING = `
export function PricingCard() {
  return (
    <section className="card">
      <button onClick={buy}>Buy now</button>
      <button onClick={cancel}>Cancel</button>
    </section>
  );
}
`;

export function tourFor(id: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    tour: {
      id: "new-engineer",
      name: "New Engineer Onboarding",
      steps: [
        {
          label: "Start here",
          description: "Buy the plan.",
          locator: { tag: "button", hook: { attr: "data-aun", value: id } },
          ...extra,
        },
      ],
    },
  });
}

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

import type { StampRunner } from "./stamp";

export const PLUGIN_NAME = "AunboardWebpackPlugin";

/** The slice of webpack's `Compiler` this plugin uses. */
export interface CompilerLike {
  hooks: {
    beforeCompile: {
      tapAsync(
        name: string,
        handler: (params: unknown, callback: (error?: Error | null) => void) => void,
      ): void;
    };
  };
}

/**
 * Runs aunboard's once-per-compilation pass before webpack starts building.
 *
 * `beforeCompile` is the closest thing webpack has to Rollup's `buildStart`: it
 * fires before any module is read, so the loader is guaranteed to see a
 * populated {@link StampRunner.state}. It is tapped asynchronously purely so a
 * broken tour reference becomes a real build failure rather than an exception
 * thrown through webpack's hook plumbing.
 *
 * Next creates a separate compiler for client, server and edge builds and calls
 * the config function once for each. They all get their own plugin instance but
 * share one runner, which is what keeps the pass to once per round.
 */
export class AunboardWebpackPlugin {
  constructor(private readonly runner: StampRunner) {}

  apply(compiler: CompilerLike): void {
    compiler.hooks.beforeCompile.tapAsync(PLUGIN_NAME, (_params, callback) => {
      try {
        this.runner.runFor(compiler);
      } catch (error) {
        callback(error as Error);
        return;
      }
      callback();
    });
  }
}

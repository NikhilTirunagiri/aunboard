import { toMapPath, transform } from "@aunboard/plugin-core";

import type { AunboardLoaderOptions, StampState } from "./types";

/** The slice of webpack's `LoaderContext` this loader uses. */
export interface LoaderContextLike {
  resourcePath: string;
  getOptions(): unknown;
  addDependency(file: string): void;
  emitWarning?(warning: Error): void;
  callback(error: Error | null, content?: string, sourceMap?: unknown): void;
}

function stateOf(options: unknown): StampState | undefined {
  if (typeof options !== "object" || options === null) return undefined;
  const state = (options as Partial<AunboardLoaderOptions>).state;
  return state && typeof state === "object" ? state : undefined;
}

/**
 * Stamp `data-aun` ids onto the JSX host elements committed tours reference.
 *
 * Registered by `withAunboard` as a `pre` loader, so it sees your original JSX
 * before Next's SWC pass rewrites it, and it is the first thing in the chain —
 * `inputMap` is therefore normally absent. It always hands webpack a sourcemap
 * (the freshly generated one when it edited, the incoming one when it did not)
 * so everything downstream keeps mapping back to your real source.
 *
 * Shared state arrives by reference through the loader options: the loader is
 * loaded by path in its own module instance, so a module-level singleton would
 * not be the same object the config wrapper populated.
 */
export default function aunboardLoader(
  this: LoaderContextLike,
  source: string,
  inputMap?: unknown,
): void {
  const callback = this.callback.bind(this);
  const state = stateOf(this.getOptions());

  if (!state || !state.ready) {
    callback(null, source, inputMap);
    return;
  }

  const file = this.resourcePath;
  if (!state.filter(file)) {
    callback(null, source, inputMap);
    return;
  }

  // What gets stamped depends on the committed tours, not just on this file, so
  // webpack's persistent cache has to be invalidated when a tour file changes.
  for (const tourFile of state.tourFiles) this.addDependency(tourFile);

  let result: { code: string; map: unknown } | null;
  try {
    result = transform(source, file, {
      attr: state.attr,
      stampAll: state.stampAll,
      stampIds: state.stampIds,
      idOverrides: state.assignments[toMapPath(file, state.root)],
    });
  } catch (error) {
    // A file Next can compile but Babel cannot parse must not fail the build:
    // stamping is an enhancement, and an unstamped element still resolves
    // through the tour's other locator signals. Say so, loudly enough to fix.
    this.emitWarning?.(
      new Error(`[aunboard] could not stamp ${file}: ${(error as Error).message}`),
    );
    callback(null, source, inputMap);
    return;
  }

  if (!result) {
    callback(null, source, inputMap);
    return;
  }
  callback(null, result.code, result.map ?? inputMap);
}

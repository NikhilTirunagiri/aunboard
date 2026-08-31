import type { IdAssignments } from "@aunboard/plugin-core";

/**
 * A glob string, a RegExp, an array of either, or `null`/`undefined` for
 * "no opinion" — the same shape Vite's `createFilter` accepts, so the two
 * adapters take the same options object.
 */
export type FilterPattern = string | RegExp | ReadonlyArray<string | RegExp> | null | undefined;

/** Where diagnostics go. `console` satisfies this. */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface AunboardOptions {
  /** Glob(s) for committed tour files. Default `./tours/*.tour.json`. */
  tours?: string | string[];
  /** Path to the committed id map. Default `./aunboard.ids.json`. */
  idMap?: string;
  /** Glob(s) for source files to scan for stampable elements. Default `{app,src,pages,components}/**\/*.{jsx,tsx}`. */
  src?: string | string[];
  /**
   * Stamp every host element instead of only tour-referenced ones.
   * Defaults to `true` in `next dev` (so the recorder can pick anything) and
   * `false` in `next build` (so production ships only what tours actually use).
   */
  stampAll?: boolean;
  /** Modules to transform. Default: any `.jsx`/`.tsx` outside `node_modules`. */
  include?: FilterPattern;
  /** Modules to skip. */
  exclude?: FilterPattern;
  /** Attribute to stamp. Default `data-aun`. */
  attr?: string;
  /** Write back `aunboard.ids.json` when it changed. Default `true`. */
  write?: boolean;
  /**
   * Throw when a committed tour references an id that matches no element.
   * Default: `true` during `next build`, `false` during `next dev` (a broken
   * tour must never ship, but it should not take the dev server down either).
   */
  failOnMissing?: boolean;
  /** Where diagnostics go. Default `console`. */
  logger?: Logger;
}

/**
 * Everything the loader needs, computed once per compilation by the webpack
 * plugin and handed to the loader by reference through its options.
 *
 * It is passed by reference on purpose: the loader is loaded by path, in its
 * own module instance (and possibly a different module format), so a
 * module-level singleton would not be shared with the config wrapper.
 */
export interface StampState {
  /** Project root — Next's `dir`. */
  root: string;
  /** Attribute to stamp. */
  attr: string;
  /** Stamp every host element (dev). */
  stampAll: boolean;
  /** Ids committed tours reference *and* that resolved to a real element. */
  stampIds: Set<string>;
  /** `file -> elementKey -> id`, from `rematchIds`. */
  assignments: IdAssignments;
  /** Absolute paths of the tour files this pass read, for loader invalidation. */
  tourFiles: string[];
  /** Does this module get stamped? Applies the `include`/`exclude` options. */
  filter: (file: string) => boolean;
  /** False until the first pass has run — the loader passes source through untouched. */
  ready: boolean;
}

/** The options object the config wrapper hands to the loader. */
export interface AunboardLoaderOptions {
  state: StampState;
}

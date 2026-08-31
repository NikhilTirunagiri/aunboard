import { resolve } from "node:path";

import {
  DEFAULT_STAMP_ATTR,
  collectStampRefs,
  findIdCollisions,
  isCleanReport,
  readIdMap,
  rematchIds,
  scanFiles,
  summarizeReport,
  toMapPath,
  writeIdMapIfChanged,
  type RematchReport,
  type StampRef,
} from "@aunboard/plugin-core";
import { globSync } from "tinyglobby";

import { createFilter } from "./filter";
import type { AunboardOptions, Logger, StampState } from "./types";

export const DEFAULT_TOURS = "./tours/*.tour.json";
export const DEFAULT_ID_MAP = "./aunboard.ids.json";
/**
 * Next has no single conventional source directory: the App Router lives in
 * `app/` (or `src/app/`), the Pages Router in `pages/`, and shared components
 * usually sit beside them. Scanning all four covers both routers without
 * assuming either.
 */
export const DEFAULT_SRC = "{app,pages,src,components}/**/*.{jsx,tsx}";
export const DEFAULT_INCLUDE = /\.[jt]sx$/;
export const DEFAULT_EXCLUDE = /node_modules/;

export function asArray(value: string | string[] | undefined, fallback: string[]): string[] {
  if (value === undefined) return fallback;
  return Array.isArray(value) ? value : [value];
}

function missingIdError(refs: StampRef[], report: RematchReport): string {
  const lines = refs.map(
    (ref) =>
      `  - "${ref.id}" referenced by tour "${ref.tourName}" (${ref.tourId}), step "${ref.stepLabel}"` +
      (ref.source ? `\n    in ${ref.source}` : ""),
  );
  const known = report.missing.length
    ? `\n\nIds in aunboard.ids.json that no longer match any element: ${report.missing.join(", ")}`
    : "";
  // Prefixed here, unlike the Vite adapter: webpack surfaces a thrown error's
  // message verbatim, with nothing to say which plugin raised it.
  return (
    `[aunboard] ${refs.length} tour reference(s) point at an element that no longer exists:\n` +
    `${lines.join("\n")}${known}\n\n` +
    `The element was deleted or changed enough that its signature no longer matches. ` +
    `Re-record the step, or restore the element. aunboard will not guess a replacement: ` +
    `pointing a tour at the wrong element is worse than failing the build.`
  );
}

export interface StampRunnerContext {
  /** Project root — Next's `dir`. */
  root: string;
  /** `next dev` rather than `next build`. */
  dev: boolean;
}

/**
 * The `buildStart` equivalent: glob the tours, glob the source, re-match every
 * known id, write `aunboard.ids.json`, log the summary, and fail a production
 * build whose tours point at elements that no longer exist.
 *
 * Runs **once per compilation**, not once per file — and once per *round*
 * across Next's parallel client/server/edge compilers, which share one runner
 * and therefore one {@link StampState}.
 */
export class StampRunner {
  readonly state: StampState;

  private readonly options: AunboardOptions;
  private readonly logger: Logger;
  private readonly dev: boolean;
  /** Compilers that have already consumed the current pass. */
  private readonly participants = new Set<unknown>();
  private hasRun = false;

  constructor(options: AunboardOptions, context: StampRunnerContext) {
    this.options = options;
    this.logger = options.logger ?? console;
    this.dev = context.dev;
    this.state = {
      root: context.root,
      attr: options.attr ?? DEFAULT_STAMP_ATTR,
      stampAll: options.stampAll ?? context.dev,
      stampIds: new Set(),
      assignments: {},
      tourFiles: [],
      filter: createFilter(
        options.include ?? DEFAULT_INCLUDE,
        options.exclude ?? DEFAULT_EXCLUDE,
        context.root,
      ),
      ready: false,
    };
  }

  /**
   * Called from each compiler's `beforeCompile`. The first compiler of a round
   * does the work; the others reuse it. A compiler asking twice means a new
   * round started (a dev rebuild), so the pass runs again and picks up edited
   * tours.
   */
  runFor(compiler: unknown): void {
    if (this.hasRun && !this.participants.has(compiler)) {
      this.participants.add(compiler);
      return;
    }
    this.participants.clear();
    this.participants.add(compiler);
    this.hasRun = true;
    this.run();
  }

  /** The whole pass, unconditionally. Exposed for tests and for one-shot use. */
  run(): void {
    const { options, logger, state } = this;
    const root = state.root;
    const attr = state.attr;

    const tourGlobs = asArray(options.tours, [DEFAULT_TOURS]);
    const srcGlobs = asArray(options.src, [DEFAULT_SRC]);
    const idMapPath = resolve(root, options.idMap ?? DEFAULT_ID_MAP);

    const tourFiles = globSync(tourGlobs, {
      cwd: root,
      absolute: true,
      ignore: ["**/node_modules/**"],
    });
    const refs = collectStampRefs(tourFiles, { attr });

    const sourceFiles = globSync(srcGlobs, {
      cwd: root,
      absolute: true,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    });
    const discovered = scanFiles(sourceFiles, {
      root,
      attr,
      onError: (file, error) => logger.warn(`[aunboard] skipped ${file}: ${error.message}`),
    });

    const previous = readIdMap(idMapPath);
    const result = rematchIds(previous, discovered);

    // Only ids that resolved to a real element may be stamped.
    const resolvable = new Set<string>();
    for (const perFile of Object.values(result.assignments)) {
      for (const id of Object.values(perFile)) resolvable.add(id);
    }

    state.assignments = result.assignments;
    state.stampIds = new Set(refs.map((ref) => ref.id).filter((id) => resolvable.has(id)));
    state.tourFiles = tourFiles;
    state.ready = true;

    if (options.write !== false) {
      if (writeIdMapIfChanged(idMapPath, result.map)) {
        logger.info(`[aunboard] updated ${toMapPath(idMapPath, root)}`);
      }
    }

    const summary = summarizeReport(result.report);
    if (!isCleanReport(result.report) || discovered.length > 0) {
      logger.info(
        `[aunboard] ${discovered.length} elements in ${sourceFiles.length} files: ${summary}` +
          ` | ${refs.length} tour reference(s) in ${tourFiles.length} tour file(s)` +
          ` | stamping ${state.stampAll ? "all elements (dev)" : `${state.stampIds.size} id(s)`}`,
      );
    }
    for (const move of result.report.moved) {
      logger.info(`[aunboard] "${move.id}" moved ${move.from} -> ${move.to}`);
    }
    for (const rename of result.report.renamed) {
      logger.info(`[aunboard] "${rename.id}" component renamed ${rename.from} -> ${rename.to}`);
    }

    for (const collision of findIdCollisions(discovered)) {
      logger.warn(
        `[aunboard] id "${collision.id}" is claimed by elements in ${collision.files.join(", ")}. ` +
          `Rename one of the components so tours can target it unambiguously.`,
      );
    }

    const broken = refs.filter((ref) => !resolvable.has(ref.id));
    if (broken.length) {
      const message = missingIdError(broken, result.report);
      const shouldFail = options.failOnMissing ?? !this.dev;
      if (shouldFail) throw new Error(message);
      logger.error(message);
    }
  }
}

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
  transform as transformCode,
  writeIdMapIfChanged,
  type IdAssignments,
  type RematchReport,
  type StampRef,
} from "@aunboard/plugin-core";
import { globSync } from "tinyglobby";
import { createFilter, type FilterPattern, type Plugin } from "vite";

export interface AunboardOptions {
  /** Glob(s) for committed tour files. Default `./tours/*.tour.json`. */
  tours?: string | string[];
  /** Path to the committed id map. Default `./aunboard.ids.json`. */
  idMap?: string;
  /** Glob(s) for source files to scan for stampable elements. Default `src/**\/*.{jsx,tsx}`. */
  src?: string | string[];
  /**
   * Stamp every host element instead of only tour-referenced ones.
   * Defaults to `true` in `serve` (so the recorder can pick anything) and
   * `false` in `build` (so production ships only what tours actually use).
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
   * Default: `true` during `build`, `false` during `serve` (a broken tour must
   * never ship, but it should not take the dev server down either).
   */
  failOnMissing?: boolean;
}

const DEFAULT_INCLUDE = /\.[jt]sx$/;
const DEFAULT_EXCLUDE = /node_modules/;

function asArray(value: string | string[] | undefined, fallback: string[]): string[] {
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
  // No "[aunboard]" prefix: Vite already prefixes thrown plugin errors with the
  // plugin name, and the logger.error path below adds it explicitly.
  return (
    `${refs.length} tour reference(s) point at an element that no longer exists:\n` +
    `${lines.join("\n")}${known}\n\n` +
    `The element was deleted or changed enough that its signature no longer matches. ` +
    `Re-record the step, or restore the element. aunboard will not guess a replacement: ` +
    `pointing a tour at the wrong element is worse than failing the build.`
  );
}

/**
 * Stamp `data-aun` ids onto exactly the JSX elements committed tours reference.
 *
 * Tours store DOM locators. Text- and position-based locators rot as the UI
 * changes; a build-time stamp does not. The host app needs no source edits,
 * only this plugin.
 */
export function aunboard(options: AunboardOptions = {}): Plugin {
  const attr = options.attr ?? DEFAULT_STAMP_ATTR;
  const filter = createFilter(
    options.include ?? DEFAULT_INCLUDE,
    options.exclude ?? DEFAULT_EXCLUDE,
  );

  let root = process.cwd();
  let command: "build" | "serve" = "build";
  let stampAll = false;
  let logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void } =
    console;

  let stampIds = new Set<string>();
  let assignments: IdAssignments = {};

  return {
    name: "aunboard",
    enforce: "pre",

    configResolved(config) {
      root = config.root ?? process.cwd();
      command = config.command ?? "build";
      stampAll = options.stampAll ?? command === "serve";
      if (config.logger) logger = config.logger;
    },

    buildStart() {
      const tourGlobs = asArray(options.tours, ["./tours/*.tour.json"]);
      const srcGlobs = asArray(options.src, ["src/**/*.{jsx,tsx}"]);
      const idMapPath = resolve(root, options.idMap ?? "./aunboard.ids.json");

      const tourFiles = globSync(tourGlobs, { cwd: root, absolute: true, ignore: ["**/node_modules/**"] });
      const refs = collectStampRefs(tourFiles, { attr });

      const sourceFiles = globSync(srcGlobs, {
        cwd: root,
        absolute: true,
        ignore: ["**/node_modules/**", "**/dist/**"],
      });
      const discovered = scanFiles(sourceFiles, {
        root,
        attr,
        onError: (file, error) => logger.warn(`[aunboard] skipped ${file}: ${error.message}`),
      });

      const previous = readIdMap(idMapPath);
      const result = rematchIds(previous, discovered);
      assignments = result.assignments;

      // Only ids that resolved to a real element may be stamped.
      const resolvable = new Set<string>();
      for (const perFile of Object.values(assignments)) {
        for (const id of Object.values(perFile)) resolvable.add(id);
      }
      stampIds = new Set(refs.map((ref) => ref.id).filter((id) => resolvable.has(id)));

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
            ` | stamping ${stampAll ? "all elements (dev)" : `${stampIds.size} id(s)`}`,
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
        const shouldFail = options.failOnMissing ?? command === "build";
        if (shouldFail) throw new Error(message);
        logger.error(`[aunboard] ${message}`);
      }
    },

    transform(code, id) {
      const [file] = id.split("?");
      if (!filter(file)) return null;
      const mapPath = toMapPath(file, root);
      const result = transformCode(code, file, {
        attr,
        stampAll,
        stampIds,
        idOverrides: assignments[mapPath],
      });
      if (!result) return null;
      return { code: result.code, map: result.map };
    },
  };
}

export default aunboard;
export type { FilterPattern, Plugin };

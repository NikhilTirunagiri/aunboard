import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";
// The single source of truth for the `{ version: 1, tour: {...} }` envelope and its
// recursive locator validation. Importing it (rather than restating the rules) means the
// CLI can never drift from what the recorder writes.
import { parseTour } from "../../aunboard/src/record/artifact";
import type { Tour } from "./types";

export interface LoadedTour {
  /** Absolute path on disk. */
  path: string;
  /** cwd-relative, posix-separated path — what reporters show. */
  file: string;
  tour: Tour;
}

export interface TourLoadError {
  path: string;
  file: string;
  error: string;
}

export interface LoadedTours {
  tours: LoadedTour[];
  errors: TourLoadError[];
}

/** Parse one tour file's contents with the recorder's own validation rules. */
export function parseTourFile(contents: string): Tour {
  return parseTour(contents);
}

/** Read and validate every file, splitting the good from the broken. */
export function loadTourFiles(paths: string[], cwd: string = process.cwd()): LoadedTours {
  const tours: LoadedTour[] = [];
  const errors: TourLoadError[] = [];

  for (const path of paths) {
    const file = relative(cwd, path).split(sep).join("/") || path;
    try {
      tours.push({ path, file, tour: parseTourFile(readFileSync(path, "utf8")) });
    } catch (err) {
      errors.push({ path, file, error: (err as Error).message });
    }
  }

  return { tours, errors };
}

import { readFileSync } from "node:fs";

import { DEFAULT_STAMP_ATTR } from "./types";

/**
 * Structural mirrors of aunboard's `ElementLocator` / `Tour` types. Duplicated
 * on purpose: this package is build-time only and must not pull the runtime
 * library (or React) into a bundler config.
 */
export interface LocatorLike {
  tag?: string;
  hook?: { attr: string; value: string };
  scope?: LocatorLike;
  [key: string]: unknown;
}

export interface TourStepLike {
  locator?: LocatorLike;
  reveal?: LocatorLike[];
  label?: string;
  [key: string]: unknown;
}

export interface TourLike {
  id?: string;
  name?: string;
  steps?: TourStepLike[];
  [key: string]: unknown;
}

/** One tour reference to a stamped id, with enough context to write a good error. */
export interface StampRef {
  id: string;
  tourId: string;
  tourName: string;
  stepLabel: string;
  stepIndex: number;
  /** Tour file the reference came from, when read from disk. */
  source?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Pull the tours out of a parsed tour file.
 *
 * Accepts the committed envelope `{ version: 1, tour: {...} }`, plus a bare
 * tour, a `{ tours: { id: tour } }` map, and an array of any of those.
 */
export function toursFromJson(data: unknown): TourLike[] {
  if (Array.isArray(data)) return data.flatMap((item) => toursFromJson(item));
  if (!isObject(data)) return [];
  if (isObject(data.tour)) return [data.tour as TourLike];
  if (isObject(data.tours)) return Object.values(data.tours).filter(isObject) as TourLike[];
  if (Array.isArray(data.steps)) return [data as TourLike];
  return [];
}

function walkLocator(locator: LocatorLike | undefined, attr: string, out: Set<string>): void {
  if (!isObject(locator)) return;
  const hook = locator.hook;
  if (isObject(hook) && hook.attr === attr && typeof hook.value === "string" && hook.value) {
    out.add(hook.value);
  }
  walkLocator(locator.scope, attr, out);
}

/**
 * Every stamped id one tour references: each step's own locator, the scope
 * chain hanging off it, and every reveal locator (and their scope chains).
 */
export function collectTourRefs(
  tour: TourLike,
  source?: string,
  attr: string = DEFAULT_STAMP_ATTR,
): StampRef[] {
  const refs: StampRef[] = [];
  const steps = Array.isArray(tour.steps) ? tour.steps : [];
  steps.forEach((step, stepIndex) => {
    if (!isObject(step)) return;
    const ids = new Set<string>();
    walkLocator(step.locator, attr, ids);
    for (const reveal of Array.isArray(step.reveal) ? step.reveal : []) {
      walkLocator(reveal, attr, ids);
    }
    for (const id of ids) {
      refs.push({
        id,
        tourId: typeof tour.id === "string" ? tour.id : "(unnamed tour)",
        tourName: typeof tour.name === "string" ? tour.name : (tour.id as string) ?? "(unnamed tour)",
        stepLabel: typeof step.label === "string" ? step.label : `step ${stepIndex + 1}`,
        stepIndex,
        source,
      });
    }
  });
  return refs;
}

export interface CollectOptions {
  attr?: string;
  /** Throw instead of skipping when a tour file cannot be read or parsed. */
  strict?: boolean;
}

/** Read tour files from disk and return every stamped-id reference in them. */
export function collectStampRefs(
  tourFiles: readonly string[],
  options: CollectOptions = {},
): StampRef[] {
  const attr = options.attr ?? DEFAULT_STAMP_ATTR;
  const refs: StampRef[] = [];
  for (const file of tourFiles) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      if (options.strict) {
        throw new Error(`[aunboard] could not read tour file ${file}: ${(error as Error).message}`);
      }
      continue;
    }
    for (const tour of toursFromJson(parsed)) refs.push(...collectTourRefs(tour, file, attr));
  }
  return refs;
}

/**
 * The set of ids the build must stamp: every `data-aun` hook value any
 * committed tour references, including nested `scope` locators and `reveal`
 * locators.
 */
export function collectStampIds(
  tourFiles: readonly string[],
  options: CollectOptions = {},
): Set<string> {
  return new Set(collectStampRefs(tourFiles, options).map((ref) => ref.id));
}

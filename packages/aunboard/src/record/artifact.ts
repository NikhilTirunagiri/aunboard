import type { Tour, TourStep } from "../tour/types";
import type { ElementLocator } from "../locator";

export const ARTIFACT_VERSION = 1;

interface Envelope { version: number; tour: Tour; }

export function serializeTour(tour: Tour): string {
  return JSON.stringify({ version: ARTIFACT_VERSION, tour } satisfies Envelope, null, 2);
}

/** Validate a locator's shape (recurses into `scope`) so a corrupt file fails at parse, not replay. */
function validateLocatorShape(loc: unknown, where: string): asserts loc is ElementLocator {
  if (!loc || typeof loc !== "object") {
    throw new Error(`aunboard: ${where} is missing a valid locator.`);
  }
  const l = loc as Record<string, unknown>;
  if (typeof l.tag !== "string" || l.tag.length === 0) {
    throw new Error(`aunboard: ${where} locator is missing a "tag".`);
  }
  if (l.nth !== undefined && typeof l.nth !== "number") {
    throw new Error(`aunboard: ${where} locator has a non-numeric "nth".`);
  }
  if (l.nthOf !== undefined && typeof l.nthOf !== "number") {
    throw new Error(`aunboard: ${where} locator has a non-numeric "nthOf".`);
  }
  if (l.scope !== undefined) validateLocatorShape(l.scope, `${where} scope`);
}

/**
 * Forward migrations, keyed by the version they upgrade FROM. To add artifact version 2:
 * bump ARTIFACT_VERSION, then register `1: (tour) => ...` here. Committed tours written by
 * older versions of aunboard keep working — which matters, because these files live in users'
 * repositories and we do not get to rewrite them.
 */
const MIGRATIONS: Record<number, (tour: Tour) => Tour> = {};

function migrate(tour: Tour, from: number): Tour {
  let current = tour;
  for (let v = from; v < ARTIFACT_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) {
      throw new Error(
        `aunboard: cannot upgrade a version ${from} tour (no migration from version ${v}). ` +
          `Re-record the tour, or install the aunboard version that wrote it.`,
      );
    }
    current = step(current);
  }
  return current;
}

export function parseTour(json: string): Tour {
  const data = JSON.parse(json) as Partial<Envelope>;
  const version = data.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error(`aunboard: malformed tour artifact (missing or invalid "version").`);
  }
  // A file from a NEWER aunboard may use signals this build cannot resolve. Refusing is the
  // honest outcome: silently ignoring unknown fields would replay a tour that is only
  // partially understood, which is how a step ends up pointing at the wrong element.
  if (version > ARTIFACT_VERSION) {
    throw new Error(
      `aunboard: tour artifact version ${version} is newer than this build supports ` +
        `(${ARTIFACT_VERSION}). Upgrade the aunboard package.`,
    );
  }
  const tour = data.tour;
  if (!tour || typeof tour.id !== "string" || typeof tour.name !== "string" || !Array.isArray(tour.steps)) {
    throw new Error("aunboard: malformed tour artifact (missing id/name/steps).");
  }
  tour.steps.forEach((s: Partial<TourStep>, i) => {
    validateLocatorShape(s.locator, `step ${i}`);
    // `label` is required; `description` must be a string but may be empty (the recorder
    // lets you save a step with just a label).
    if (typeof s.label !== "string" || typeof s.description !== "string") {
      throw new Error(`aunboard: step ${i} is missing label/description.`);
    }
    if (s.route !== undefined && typeof s.route !== "string") {
      throw new Error(`aunboard: step ${i} has a non-string "route".`);
    }
    if (s.reveal !== undefined) {
      if (!Array.isArray(s.reveal)) {
        throw new Error(`aunboard: step ${i} "reveal" must be an array of locators.`);
      }
      s.reveal.forEach((r, j) => validateLocatorShape(r, `step ${i} reveal ${j}`));
    }
  });
  return version === ARTIFACT_VERSION ? tour : migrate(tour, version);
}

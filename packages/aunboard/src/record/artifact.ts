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

export function parseTour(json: string): Tour {
  const data = JSON.parse(json) as Partial<Envelope>;
  if (data.version !== ARTIFACT_VERSION) {
    throw new Error(`aunboard: unsupported artifact version ${data.version} (expected ${ARTIFACT_VERSION}).`);
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
  return tour;
}

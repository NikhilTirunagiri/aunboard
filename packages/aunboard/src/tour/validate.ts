import type { Tours } from "./types";

/**
 * Validate tours at startup so authoring mistakes are loud, not silent. Each step
 * must have a valid locator with a tag, plus non-empty label and description.
 */
export function validateTours(tours: Tours): Tours {
  for (const [id, tour] of Object.entries(tours)) {
    if (tour.id !== id) {
      throw new Error(`aunboard: tour "${id}" has mismatched id "${tour.id}".`);
    }
    if (typeof tour.name !== "string" || tour.name.trim().length === 0) {
      throw new Error(`aunboard: tour "${id}" is missing a non-empty "name".`);
    }
    if (!Array.isArray(tour.steps) || tour.steps.length === 0) {
      throw new Error(`aunboard: tour "${id}" must have at least one step.`);
    }
    tour.steps.forEach((step, i) => {
      if (!step.locator || typeof step.locator.tag !== "string" || step.locator.tag.length === 0) {
        throw new Error(
          `aunboard: tour "${id}" step ${i} is missing a valid locator with a "tag".`,
        );
      }
      if (typeof step.label !== "string" || step.label.trim().length === 0) {
        throw new Error(`aunboard: tour "${id}" step ${i} is missing a non-empty "label".`);
      }
      // `description` is optional content (the recorder lets you save a step with just a
      // label; the Explore tooltip / Walkthrough narration falls back to the label when it
      // is blank). It must be a string — but an empty string is allowed, matching parseTour
      // and the recorder so that record → export → commit → import never rejects its own output.
      if (typeof step.description !== "string") {
        throw new Error(
          `aunboard: tour "${id}" step ${i} (label "${step.label}") has a non-string "description".`,
        );
      }
      if (step.reveal !== undefined) {
        if (!Array.isArray(step.reveal)) {
          throw new Error(`aunboard: tour "${id}" step ${i} "reveal" must be an array of locators.`);
        }
        step.reveal.forEach((r, j) => {
          if (!r || typeof r.tag !== "string" || r.tag.length === 0) {
            throw new Error(`aunboard: tour "${id}" step ${i} reveal ${j} is missing a valid locator with a "tag".`);
          }
        });
      }
    });
  }
  return tours;
}

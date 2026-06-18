import type { ElementLocator } from "../locator";

/** One step in a tour: spotlights an element found by locator. */
export interface TourStep {
  /** Multi-signal locator for re-finding the element at replay. */
  locator: ElementLocator;
  /**
   * Optional elements to click (in order) to reveal the target before it's resolved — e.g. a
   * tab or accordion that holds the target but doesn't change the URL. At replay usher resolves
   * and clicks each reveal, then resolves `locator`. Skipped if the target is already present.
   */
  reveal?: ElementLocator[];
  /** Short name: shown as the Explore badge label and Walkthrough popover title. */
  label: string;
  /** Meaning: shown as the Explore tooltip text and Walkthrough narration. */
  description: string;
  /** Route this step lives on, e.g. "/dashboard". Omit = current route. */
  route?: string;
}

/** An ordered, named walkthrough. */
export interface Tour {
  /** Stable id, e.g. "new-engineer". Must equal its key in a Tours map. */
  id: string;
  /** Human name, e.g. "New Engineer Onboarding". */
  name: string;
  /** Optional one-liner: who this tour is for / what it covers. */
  description?: string;
  /** Steps in presentation order. */
  steps: TourStep[];
}

/** Collection of tours keyed by id. Ship one; extend non-breakingly. */
export type Tours = Record<string, Tour>;

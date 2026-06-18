/** A durable, multi-signal description of a DOM element — the "index card". */
export interface ElementLocator {
  /** Lowercased tag name; always present (e.g. "button"). */
  tag: string;
  /** Level 1 (most robust): an explicit stable hook already on the element. */
  hook?: { attr: string; value: string };
  /** Level 2: ARIA role + accessible name. */
  role?: { role: string; name?: string };
  /** Level 3: normalized, length-capped visible text. */
  text?: string;
  /** Optional ancestor anchor that scopes the search (recursive locator). */
  scope?: ElementLocator;
  /** Disambiguator: 0-based index among matches within scope. */
  nth?: number;
  /** candidate count when `nth` was captured; resolve only trusts `nth` if the count is unchanged (else not-found). */
  nthOf?: number;
  /**
   * Level 4 (last resort): structural CSS path. Captured for future
   * low-confidence recovery; NOT used by resolveLocator in this version.
   */
  path?: string;
}

/** Outcome of resolving a locator back to a live element. */
export interface ResolveResult {
  element: HTMLElement | null;
  matchedBy: "hook" | "role" | "text" | null;
  /** How many candidates the signals matched (1 = unambiguous). */
  candidateCount: number;
}

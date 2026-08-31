import type { ElementLocator } from "./types";

/**
 * Numeric durability scoring for locators — LOWER IS BETTER.
 *
 * The model is adapted from Playwright's `selectorGenerator.ts`, which ranks candidate
 * locators by how likely they are to still match the same element after the page changes.
 * We reuse its ordering (and its scale, so the numbers stay recognisable) because it encodes
 * a lot of hard-won knowledge about which DOM signals survive real-world refactors.
 *
 * Two signals sit *above* anything Playwright generates:
 *   - `stamped` (`data-aun`) is written at build time by @aunboard/vite from the committed
 *     tours. It is derived from the component tree, not the rendered output, so it survives
 *     copy edits, restyling, reordering and data changes. Nothing is more durable.
 *   - `hook` is a stable attribute the host app already maintains for its own reasons.
 */
export const SIGNAL_SCORE = {
  stamped: 0,
  hook: 1,
  roleName: 100,
  label: 140,
  alt: 160,
  text: 180,
  cssId: 500,
  roleOnly: 510,
  tag: 530,
  nth: 10_000,
  cssPath: 10_000_000,
} as const;

export type SignalKind = keyof typeof SIGNAL_SCORE;

/** Score boundaries separating the three durability tiers. */
export const TIER_MAX = {
  /** At or below this, the locator rests on an explicit, maintained contract. */
  stable: SIGNAL_SCORE.roleName,
  /** Above `stable` and at or below this, it rests on content that can drift. */
  weak: SIGNAL_SCORE.tag,
} as const;

/** The ordered signals a locator actually carries, strongest first. */
export function locatorSignals(loc: ElementLocator): SignalKind[] {
  const signals: SignalKind[] = [];
  if (loc.hook) signals.push(loc.hook.attr === "data-aun" ? "stamped" : "hook");
  else {
    if (loc.role?.name) signals.push("roleName");
    else if (loc.role) signals.push("roleOnly");
    if (loc.text !== undefined) signals.push("text");
    if (signals.length === 0) signals.push("tag");
  }
  if (loc.nth !== undefined) signals.push("nth");
  return signals;
}

/**
 * Durability score for a locator (lower is better).
 *
 * A locator's strength is its STRONGEST identity signal — signals on a single element are
 * conjunctive corroboration, not a selector chain, so carrying both `role+name` and `text`
 * makes a locator more confident, never less. (This is where the model deliberately parts
 * company with Playwright's weighting: there, extra tokens lengthen a selector *path* and are
 * rightly penalised; here they describe the same element twice.) Multiple agreeing signals
 * therefore earn a small discount.
 *
 * `nth` is different in kind. It is not evidence about the element, it is an admission that we
 * could not identify it at all — so it is added on top and dwarfs every content signal.
 *
 * A `scope` ancestor is added at a discount: scoping genuinely disambiguates, but it also
 * introduces a second element that must keep resolving, so it can never be free.
 */
export function scoreLocator(loc: ElementLocator): number {
  const own = locatorSignals(loc).filter((s) => s !== "nth");
  let score = own.length
    ? Math.min(...own.map((s) => SIGNAL_SCORE[s]))
    : SIGNAL_SCORE.tag;
  if (own.length > 1) score -= Math.round(score * 0.1); // corroborated by a second signal
  if (loc.nth !== undefined) score += SIGNAL_SCORE.nth;
  if (loc.scope) score += Math.round(scoreLocator(loc.scope) / 4);
  return score;
}

/** True when the locator rests on a build-stamped id — the durability ceiling. */
export function isStamped(loc: ElementLocator): boolean {
  return loc.hook?.attr === "data-aun";
}

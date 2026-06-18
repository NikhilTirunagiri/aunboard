import type { ElementLocator } from "../locator";

export type DurabilityTier = "stable" | "weak" | "fragile";

export interface Durability {
  tier: DurabilityTier;
  /** One-line explanation + remedy, shown to the author at record time. */
  reason: string;
}

// Roles whose accessible name is meant to come from a label/attribute — NOT their own text.
// If such an element's captured name equals its visible text, the name was synthesized from
// content (e.g. a table named after its cells) and will drift, so we flag it. Roles like
// button/link/heading/tab are excluded: for those, name === text is the legitimate label.
const CONTAINER_ROLES = new Set([
  "table", "grid", "row", "list", "listitem", "region", "navigation",
  "banner", "contentinfo", "complementary", "main", "article", "group", "figure", "form",
]);

/**
 * Classify how durable a captured locator is, from its shape alone — so the recorder can warn
 * the author *while recording* instead of letting a fragile step silently vanish at replay.
 *
 * - stable: a hook (data-explain/testid/stable id) or a real role + name.
 * - weak: relies on visible text, a content-derived name, or a role with no name.
 * - fragile: relies on positional `nth` (breaks the moment the match count changes).
 */
export function locatorDurability(loc: ElementLocator): Durability {
  if (loc.hook) {
    return { tier: "stable", reason: `Durable — matched by ${loc.hook.attr}="${loc.hook.value}".` };
  }
  if (loc.nth !== undefined) {
    const where = loc.scope ? "this section" : "the page";
    const pos = loc.nthOf !== undefined ? ` (${loc.nth + 1} of ${loc.nthOf})` : "";
    return {
      tier: "fragile",
      reason: `Matched by position${pos} — not unique here, so it breaks if ${where} changes. Give it a unique name or data-explain.`,
    };
  }
  if (loc.role?.name) {
    if (CONTAINER_ROLES.has(loc.role.role) && loc.role.name === loc.text) {
      return {
        tier: "weak",
        reason: `Name is taken from its contents — drifts when the data changes. Add an aria-label, <caption>, or <legend>.`,
      };
    }
    return { tier: "stable", reason: `Durable — matched by ${loc.role.role} "${loc.role.name}".` };
  }
  if (loc.role) {
    return {
      tier: "weak",
      reason: `Matched by role "${loc.role.role}" with no name. Add an accessible name to keep it stable.`,
    };
  }
  if (loc.text) {
    return {
      tier: "weak",
      reason: `Matched by visible text — breaks if the text changes. Add a stable name or data-explain.`,
    };
  }
  return { tier: "weak", reason: `Low-confidence match. Add a stable name or data-explain.` };
}

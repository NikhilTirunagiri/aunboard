// packages/label-mode/src/locator/resolve.ts
import type { ElementLocator, ResolveResult } from "./types";
import { implicitRole, accessibleName, normalizeText } from "./accessible-name";
import { cssEscape } from "./css-path";

/**
 * All elements matching a locator's hook/role/text signals within its scope,
 * in document order. Ignores `nth` and `path` (those are applied by resolveLocator).
 */
export function matchElements(
  locator: ElementLocator,
  root: ParentNode = (typeof document !== "undefined" ? document.body : (null as unknown as ParentNode)),
): HTMLElement[] {
  let scopeRoot: ParentNode = root;
  if (locator.scope) {
    const scoped = resolveLocator(locator.scope, root);
    // The scope was recorded because the element wasn't globally unique. If the scope is
    // gone, broadening the search to the whole document risks confidently matching the
    // WRONG element — exactly what this engine refuses to do. Fail (return no matches).
    if (!scoped.element) return [];
    scopeRoot = scoped.element;
  }

  if (locator.hook) {
    const sel = `[${locator.hook.attr}="${cssEscape(locator.hook.value)}"]`;
    return Array.from(scopeRoot.querySelectorAll(sel)) as HTMLElement[];
  }

  let candidates = Array.from(scopeRoot.querySelectorAll(locator.tag)) as HTMLElement[];

  if (locator.role) {
    candidates = candidates.filter(
      (c) =>
        implicitRole(c) === locator.role!.role &&
        (locator.role!.name === undefined || accessibleName(c) === locator.role!.name),
    );
  }

  if (locator.text !== undefined) {
    const byText = candidates.filter((c) => normalizeText(c) === locator.text);
    if (byText.length >= 1) candidates = byText; // only narrow if text doesn't zero everything out
  }

  return candidates;
}

/** Resolve a locator to a single live element, with confidence metadata. */
export function resolveLocator(
  locator: ElementLocator,
  root: ParentNode = (typeof document !== "undefined" ? document.body : (null as unknown as ParentNode)),
): ResolveResult {
  const matches = matchElements(locator, root);
  const notFound: ResolveResult = { element: null, matchedBy: null, candidateCount: matches.length };

  if (locator.nth !== undefined) {
    // Only trust the nth index when the candidate count is unchanged from capture time.
    // If nthOf is undefined (legacy locator without count), allow it through for back-compat.
    if (locator.nthOf !== undefined && matches.length !== locator.nthOf) {
      return notFound;
    }
    const element = matches[locator.nth] ?? null;
    if (!element) return notFound;
    const matchedBy = locator.hook ? "hook" : locator.role ? "role" : "text";
    return { element, matchedBy, candidateCount: matches.length };
  }

  if (matches.length === 1) {
    const matchedBy = locator.hook ? "hook" : locator.role ? "role" : "text";
    return { element: matches[0]!, matchedBy, candidateCount: matches.length };
  }

  // No confident signal matched (zero results, or ambiguous with no nth).
  // We deliberately do NOT fall back to locator.path —
  // a blind structural match is exactly the wrong-element guess we want to avoid.
  return notFound;
}

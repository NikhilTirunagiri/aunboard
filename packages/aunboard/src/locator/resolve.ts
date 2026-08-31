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

  const selector = locator.hook
    ? `[${cssEscape(locator.hook.attr)}="${cssEscape(locator.hook.value)}"]`
    : locator.tag;

  // Fast path: the element is still the tag we recorded, in the light DOM.
  let matched = applySignals(query(scopeRoot, selector), locator);
  if (matched.length) return matched;

  // Widening 1 — the tag changed. `<button>` becomes `<a role="button">`, a `<div>` gains
  // `role="tab"`. The tag was only ever a cheap prefilter; a role WITH an accessible name is
  // the actual identity, and it is specific enough to search on alone. We deliberately do not
  // widen for a bare role or for text — those match far too broadly (a text-only locator would
  // match every ancestor containing that text), and a wrong element is worse than none.
  const canWiden = !locator.hook && locator.role?.name !== undefined;
  if (canWiden) {
    matched = applySignals(query(scopeRoot, "*"), locator);
    if (matched.length) return matched;
  }

  // Widening 2 — the element lives inside a shadow root. querySelectorAll does not pierce
  // shadow boundaries, so a component library (Lit, Shoelace, Ionic) is invisible to the
  // paths above. Only walked as a last resort: it is the expensive branch.
  const deep = queryShadow(scopeRoot, canWiden ? "*" : selector);
  if (deep.length) matched = applySignals(deep, locator);
  return matched;
}

/** querySelectorAll, tolerating a malformed selector rather than throwing mid-resolve. */
function query(root: ParentNode, selector: string): HTMLElement[] {
  try {
    return Array.from(root.querySelectorAll(selector)) as HTMLElement[];
  } catch {
    return [];
  }
}

/**
 * Matches within *open* shadow roots, depth-first. Closed roots are unreachable by design —
 * nothing can see into them, so a step on such an element correctly reports not-found.
 */
function queryShadow(root: ParentNode, selector: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (node: ParentNode) => {
    for (const el of query(node, "*")) {
      const shadow = el.shadowRoot;
      if (!shadow) continue;
      out.push(...query(shadow, selector));
      visit(shadow);
    }
  };
  visit(root);
  return out;
}

/** Narrow candidates by the locator's role and text signals. */
function applySignals(candidates: HTMLElement[], locator: ElementLocator): HTMLElement[] {
  let out = candidates;

  if (locator.role) {
    out = out.filter(
      (c) =>
        implicitRole(c) === locator.role!.role &&
        (locator.role!.name === undefined || accessibleName(c) === locator.role!.name),
    );
  }

  if (locator.text !== undefined) {
    const byText = out.filter((c) => normalizeText(c) === locator.text);
    if (byText.length >= 1) out = byText; // only narrow if text doesn't zero everything out
  }

  return out;
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

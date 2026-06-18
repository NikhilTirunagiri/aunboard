// packages/label-mode/src/locator/build.ts
import type { ElementLocator } from "./types";
import { implicitRole, accessibleName, normalizeText } from "./accessible-name";
import { matchElements } from "./resolve";
import { cssPath, isStableId } from "./css-path";

const HOOK_ATTRS = ["data-explain", "data-testid", "data-test"];

function findHook(el: Element): { attr: string; value: string } | undefined {
  for (const attr of HOOK_ATTRS) {
    const v = el.getAttribute(attr);
    if (v) return { attr, value: v };
  }
  const id = el.getAttribute("id");
  if (id && isStableId(id)) return { attr: "id", value: id };
  return undefined;
}

function isIdentifiable(el: Element): boolean {
  if (findHook(el)) return true;
  return implicitRole(el) !== undefined && accessibleName(el) !== "";
}

function nearestIdentifiableAncestor(el: Element, root: ParentNode): Element | null {
  const stop = root instanceof Element ? root : el.ownerDocument.body;
  let p = el.parentElement;
  while (p && p !== stop && p.tagName.toLowerCase() !== "body") {
    if (isIdentifiable(p)) return p;
    p = p.parentElement;
  }
  return null;
}

function isUnique(loc: ElementLocator, el: Element, root: ParentNode): boolean {
  const matches = matchElements(loc, root);
  return matches.length === 1 && matches[0] === el;
}

/** Produce a durable, uniqueness-checked locator for `el`. */
export function buildLocator(el: Element, root: ParentNode = (typeof document !== "undefined" ? document.body : (null as unknown as ParentNode))): ElementLocator {
  const tag = el.tagName.toLowerCase();
  const loc: ElementLocator = { tag };

  // Level 1 — an existing hook is unique by convention; short-circuit.
  const hook = findHook(el);
  if (hook) {
    loc.hook = hook;
    return loc;
  }

  // Level 2/3 — role + name, then text.
  const role = implicitRole(el);
  if (role) {
    const name = accessibleName(el);
    loc.role = name ? { role, name } : { role };
  }
  const text = normalizeText(el);
  if (text) loc.text = text;

  // Captured for future low-confidence recovery; not used by resolveLocator yet.
  loc.path = cssPath(el);

  if (isUnique(loc, el, root)) return loc;

  // Enrich with a scoping ancestor.
  const scopeEl = nearestIdentifiableAncestor(el, root);
  if (scopeEl) {
    loc.scope = buildLocator(scopeEl, root);
    if (isUnique(loc, el, root)) return loc;
  }

  // Final disambiguator: positional index among remaining matches.
  const matches = matchElements(loc, root);
  const idx = matches.indexOf(el as HTMLElement);
  if (idx >= 0) {
    loc.nth = idx;
    loc.nthOf = matches.length;
  }
  return loc;
}

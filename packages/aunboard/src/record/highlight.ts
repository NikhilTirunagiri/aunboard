import { implicitRole } from "../locator";

const MAX_CLIMB_DEPTH = 8;
const INTERACTIVE = new Set(["a", "button", "input", "select", "textarea", "summary", "label"]);
const MEANINGFUL_ROLES = new Set([
  "button", "link", "checkbox", "radio", "tab", "menuitem", "textbox", "combobox",
  "table", "grid", "list", "listitem", "navigation", "form", "dialog", "heading", "img",
]);

/** True if `el` (or an ancestor) is inside label-mode's own UI. */
function inOwnUi(el: Element): boolean {
  return el.closest("[data-lm-ui]") !== null;
}

function isMeaningful(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (INTERACTIVE.has(tag)) return true;
  if (el.hasAttribute("data-explain") || el.hasAttribute("data-testid")) return true;
  // implicitRole reads + normalizes the role attribute (multi-token → first token),
  // so call it directly rather than re-reading getAttribute("role") here.
  const role = implicitRole(el);
  return role !== undefined && MEANINGFUL_ROLES.has(role);
}

/**
 * Climb from `start` to the nearest semantically meaningful element.
 * Returns null for body, empty space, or label-mode's own UI.
 */
export function meaningfulTarget(start: Element | null): Element | null {
  if (!start || start === document.body || start === document.documentElement) return null;
  if (inOwnUi(start)) return null;
  let el: Element | null = start;
  let climbs = 0;
  while (el && el !== document.body && climbs < MAX_CLIMB_DEPTH) {
    if (isMeaningful(el)) return el;
    el = el.parentElement;
    climbs++;
  }
  // Nothing semantic found — fall back to the original element if it is a real, sized node.
  if (start instanceof HTMLElement && start.offsetParent !== null) return start;
  return null;
}

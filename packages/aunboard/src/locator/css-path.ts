/** Escape a string for safe use inside a CSS attribute/id selector. */
export function cssEscape(v: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(v);
  // Minimal polyfill: escape any char that is not a word char, hyphen, or non-ASCII.
  return v.replace(/[^a-zA-Z0-9_-￿-]/g, (c) => `\\${c}`);
}

/** A DOM id is "stable" if it is non-empty and not a React useId() value (those contain ":"). */
export function isStableId(id: string): boolean {
  return id.length > 0 && !id.includes(":");
}

/** Build a structural CSS selector for `el`; used only as a last-resort signal. */
export function cssPath(el: Element): string {
  if (el.id && isStableId(el.id)) return `#${cssEscape(el.id)}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (
    node &&
    node.nodeType === 1 &&
    node.tagName.toLowerCase() !== "html" &&
    node.tagName.toLowerCase() !== "body"
  ) {
    let part = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    if (parent && parent.id && isStableId(parent.id)) {
      parts.unshift(`#${cssEscape(parent.id)}`);
      break;
    }
    node = parent;
  }
  return parts.join(" > ");
}

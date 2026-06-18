// packages/label-mode/src/locator/accessible-name.ts
import { cssEscape } from "./css-path";

const IMPLICIT_ROLES: Record<string, string> = {
  button: "button",
  nav: "navigation",
  main: "main",
  header: "banner",
  footer: "contentinfo",
  aside: "complementary",
  section: "region",
  article: "article",
  h1: "heading", h2: "heading", h3: "heading",
  h4: "heading", h5: "heading", h6: "heading",
  table: "table",
  textarea: "textbox",
  select: "combobox",
  img: "img",
  fieldset: "group",
  figure: "figure",
};

const INPUT_TYPE_ROLES: Record<string, string> = {
  button: "button", submit: "button", reset: "button", image: "button",
  checkbox: "checkbox", radio: "radio", range: "slider",
  search: "searchbox", number: "spinbutton",
  email: "textbox", tel: "textbox", text: "textbox",
  url: "textbox", password: "textbox",
};

/** Derive the ARIA role of an element (explicit role attr, else native mapping). */
export function implicitRole(el: Element): string | undefined {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit.trim().split(/\s+/)[0] || undefined;
  const tag = el.tagName.toLowerCase();
  if (tag === "a") return el.hasAttribute("href") ? "link" : undefined;
  if (tag === "input") {
    const type = (el.getAttribute("type") ?? "text").toLowerCase();
    return INPUT_TYPE_ROLES[type];
  }
  return IMPLICIT_ROLES[tag];
}

function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

export const TEXT_CAP = 80;

/** Normalized, length-capped visible text of an element. */
export function normalizeText(el: Element): string {
  return clean(el.textContent).slice(0, TEXT_CAP);
}

/** Best-effort accessible name (aria-label → labelledby → label → alt → visible text). */
export function accessibleName(el: Element): string {
  const ariaLabel = clean(el.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;

  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    const names = labelledby
      .split(/\s+/)
      .map((id) => clean(el.ownerDocument.getElementById(id)?.textContent))
      .filter(Boolean);
    if (names.length) return names.join(" ");
  }

  const tag = el.tagName.toLowerCase();

  if (tag === "input" || tag === "textarea" || tag === "select") {
    const id = el.getAttribute("id");
    if (id) {
      const lbl = el.ownerDocument.querySelector(`label[for="${cssEscape(id)}"]`);
      const n = clean(lbl?.textContent);
      if (n) return n;
    }
    const wrapping = el.closest("label");
    const n = clean(wrapping?.textContent);
    if (n) return n;
    return clean(el.getAttribute("placeholder"));
  }

  if (tag === "img") return clean(el.getAttribute("alt"));

  // Captioned containers name themselves via a dedicated child (per the accessible-name
  // spec), not their full contents. Reading these keeps locators for tables/fieldsets/figures
  // stable even as the data inside them changes — no aria-label or hook required.
  if (tag === "table") {
    const caption = directChildText(el, "caption");
    if (caption) return caption;
  }
  if (tag === "fieldset") {
    const legend = directChildText(el, "legend");
    if (legend) return legend;
  }
  if (tag === "figure") {
    const figcaption = directChildText(el, "figcaption");
    if (figcaption) return figcaption;
  }

  return normalizeText(el);
}

/** Cleaned text of the first direct child with the given tag name (empty if none). */
function directChildText(el: Element, childTag: string): string {
  for (const child of Array.from(el.children)) {
    if (child.tagName.toLowerCase() === childTag) return clean(child.textContent);
  }
  return "";
}

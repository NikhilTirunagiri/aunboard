import MagicString from "magic-string";

import { discoverElements, type DiscoverOptions } from "./discover";
import { DEFAULT_STAMP_ATTR, elementKey } from "./types";

export interface TransformOptions extends DiscoverOptions {
  /**
   * Ids to stamp. Derived from the committed tours. When omitted (and
   * `stampAll` is false) nothing is stamped: production ships only the hooks
   * real tours actually reference.
   */
  stampIds?: Iterable<string>;
  /** Stamp every host element. Dev mode, so the recorder can pick anything. */
  stampAll?: boolean;
  /** `elementKey(el)` -> id, from `rematchIds().assignments[file]`. */
  idOverrides?: Record<string, string>;
  /** Produce a sourcemap (default `true`). */
  sourcemap?: boolean;
}

export type TransformResult = {
  code: string;
  map: ReturnType<MagicString["generateMap"]> | null;
};

function escapeAttrValue(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Stamp `data-aun="<id>"` onto the JSX host elements whose id is requested.
 *
 * Returns `null` when nothing changed, so callers can leave the module alone.
 *
 * Guarantees:
 * - only lowercase host elements are touched (fragments and components are DOM-less)
 * - an element that already has the attribute is never rewritten, which makes
 *   this idempotent and lets a hand-written stamp win
 * - the attribute is appended after the last existing attribute, so it survives
 *   a `{...spread}` that would otherwise clobber it, and no existing attribute
 *   is moved or reformatted
 * - edits are surgical (magic-string), so the sourcemap stays accurate
 */
export function transform(
  code: string,
  id: string,
  options: TransformOptions = {},
): TransformResult | null {
  const attr = options.attr ?? DEFAULT_STAMP_ATTR;
  const stampAll = options.stampAll ?? false;
  const stampIds = options.stampIds ? new Set(options.stampIds) : undefined;

  if (!stampAll && (!stampIds || stampIds.size === 0)) return null;
  if (!code.includes("<")) return null;

  const elements = discoverElements(code, id, options);
  if (elements.length === 0) return null;

  const magic = new MagicString(code);
  let edits = 0;

  for (const el of elements) {
    if (el.hasStamp) continue; // never overwrite an existing stamp
    const resolved = options.idOverrides?.[elementKey(el)] ?? el.id;
    if (!stampAll && !stampIds!.has(resolved)) continue;
    magic.appendLeft(el.insertPos, ` ${attr}="${escapeAttrValue(resolved)}"`);
    edits++;
  }

  if (edits === 0) return null;

  return {
    code: magic.toString(),
    map:
      options.sourcemap === false
        ? null
        : magic.generateMap({ hires: true, source: id, includeContent: true }),
  };
}

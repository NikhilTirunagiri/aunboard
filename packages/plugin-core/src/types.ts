/** The attribute aunboard stamps onto JSX host elements. */
export const DEFAULT_STAMP_ATTR = "data-aun";

/** Current on-disk version of `aunboard.ids.json`. */
export const ID_MAP_VERSION = 1;

/**
 * One entry in `aunboard.ids.json`.
 *
 * Deliberately contains no line/column information: the whole point of `sig` is
 * to survive edits above the element, reformatting and reordering.
 */
export interface IdMapEntry {
  /** Source file the element was last seen in, relative to the project root, posix separators. */
  file: string;
  /** Enclosing component (or function) name the element was last seen in. */
  component: string;
  /** Lowercase host tag name, e.g. `"button"`. */
  tag: string;
  /** Short stable hash of the element's fuzzy source signature. */
  sig: string;
}

/** The committed id map. */
export interface IdMap {
  version: number;
  /** Keyed by stable id, e.g. `"PricingCard.b1"`. */
  ids: Record<string, IdMapEntry>;
}

/** Identity of a JSX host element as found in the current source. */
export interface ElementInfo {
  /** Default, position-derived id: `<Component>.<tagInitial><ordinal>`. */
  id: string;
  file: string;
  component: string;
  tag: string;
  sig: string;
  /** 1-based ordinal within (component, tag initial), in JSX source order. */
  ordinal: number;
  /** First letter of the tag name. */
  initial: string;
}

/** An {@link ElementInfo} plus the positions the transform needs. */
export interface DiscoveredElement extends ElementInfo {
  /** Character offset to insert ` data-aun="..."` at (after the last attribute). */
  insertPos: number;
  /** True when the element already carries the stamp attribute. */
  hasStamp: boolean;
  /** Value of an existing static stamp attribute, if any. */
  existingStamp?: string;
  /** 1-based line of the opening element (diagnostics only — never part of `sig`). */
  line: number;
  /** 0-based column of the opening element (diagnostics only). */
  column: number;
}

/** What `rematchIds` did to each known id. */
export interface RematchReport {
  /** Ids that matched exactly where they were. */
  kept: string[];
  /** Ids whose element now lives in a different file. */
  moved: { id: string; from: string; to: string }[];
  /** Ids whose enclosing component was renamed. */
  renamed: { id: string; from: string; to: string }[];
  /** Ids whose element moved within its component (the default name would now differ). */
  reordered: { id: string; from: string; to: string }[];
  /** Ids with no matching element in the current source. Never deleted, never reassigned. */
  missing: string[];
  /** Ids minted for elements that were not in the map before. */
  added: string[];
}

/**
 * Per-file overrides for the transform: `elementKey(el)` -> the id to stamp.
 *
 * A reordered/renamed/moved element keeps its original id, which no longer equals
 * the id its position would produce, so the transform needs to be told.
 */
export type IdAssignments = Record<string, Record<string, string>>;

export interface RematchResult {
  map: IdMap;
  report: RematchReport;
  assignments: IdAssignments;
}

/** Stable key for one element within a file. */
export function elementKey(el: Pick<ElementInfo, "component" | "tag" | "sig" | "ordinal">): string {
  return `${el.component}|${el.tag}|${el.sig}|${el.ordinal}`;
}

/** An empty, well-formed id map. */
export function emptyIdMap(): IdMap {
  return { version: ID_MAP_VERSION, ids: {} };
}

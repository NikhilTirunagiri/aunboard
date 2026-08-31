import {
  ID_MAP_VERSION,
  elementKey,
  type ElementInfo,
  type IdAssignments,
  type IdMap,
  type IdMapEntry,
  type RematchReport,
  type RematchResult,
} from "./types";

export interface RematchOptions {
  /**
   * Mint ids for elements that are not in the map yet (default `true`).
   * Set `false` to keep the map to exactly the ids it already contains.
   */
  addNew?: boolean;
}

const SEP = " :: ";

function exactKey(el: Pick<ElementInfo, "file" | "component" | "tag" | "sig">): string {
  return [el.file, el.component, el.tag, el.sig].join(SEP);
}
function componentKey(el: Pick<ElementInfo, "component" | "tag" | "sig">): string {
  return [el.component, el.tag, el.sig].join(SEP);
}
function fileKey(el: Pick<ElementInfo, "file" | "tag" | "sig">): string {
  return [el.file, el.tag, el.sig].join(SEP);
}

function index(
  elements: readonly ElementInfo[],
  key: (el: ElementInfo) => string,
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  elements.forEach((el, i) => {
    const k = key(el);
    const bucket = map.get(k);
    if (bucket) bucket.push(i);
    else map.set(k, [i]);
  });
  return map;
}

function entryOf(el: ElementInfo): IdMapEntry {
  return { file: el.file, component: el.component, tag: el.tag, sig: el.sig };
}

/**
 * Re-locate every known id in the current source.
 *
 * Pure: takes the committed map plus everything discovered in this build and
 * returns a new map, a report, and the per-file id overrides the transform needs.
 *
 * Matching runs in passes so that a perfect match always wins the element it
 * wants before a weaker match can claim it:
 *
 *  1. exact   - same file + component + tag + sig, and the same default name
 *  2. reorder - same file + component + tag + sig, different ordinal
 *  3. move    - same component + tag + sig, different file
 *  4. rename  - same file + tag + sig, different component
 *  5. missing - nothing matched
 *
 * A discovered element is claimed by at most one id, and an id is never
 * reassigned to an element that does not carry its signature. An id with no
 * match is reported as `missing` and kept in the map verbatim; silently
 * pointing it at a different element is the exact failure mode this exists to
 * prevent.
 */
export function rematchIds(
  map: IdMap,
  discovered: readonly ElementInfo[],
  options: RematchOptions = {},
): RematchResult {
  const addNew = options.addNew ?? true;
  const elements = [...discovered];
  const claimed = new Array<boolean>(elements.length).fill(false);

  const byExact = index(elements, exactKey);
  const byComponent = index(elements, componentKey);
  const byFile = index(elements, fileKey);

  const report: RematchReport = {
    kept: [],
    moved: [],
    renamed: [],
    reordered: [],
    missing: [],
    added: [],
  };

  const nextIds: Record<string, IdMapEntry> = {};
  const assignments: IdAssignments = {};
  const assign = (el: ElementInfo, id: string) => {
    (assignments[el.file] ??= {})[elementKey(el)] = id;
  };

  const pick = (bucket: number[] | undefined, filter?: (el: ElementInfo) => boolean): number => {
    if (!bucket) return -1;
    for (const i of bucket) {
      if (claimed[i]) continue;
      if (filter && !filter(elements[i])) continue;
      return i;
    }
    return -1;
  };

  const knownIds = Object.keys(map.ids ?? {}).sort();
  const pending = new Set(knownIds);

  // Pass 1 - exact, same default name.
  for (const id of knownIds) {
    const entry = map.ids[id];
    const i = pick(byExact.get(exactKey(entry)), (el) => el.id === id);
    if (i < 0) continue;
    claimed[i] = true;
    pending.delete(id);
    nextIds[id] = entryOf(elements[i]);
    assign(elements[i], id);
    report.kept.push(id);
  }

  // Pass 2 - exact signature in place, different ordinal.
  for (const id of [...pending]) {
    const entry = map.ids[id];
    const i = pick(byExact.get(exactKey(entry)));
    if (i < 0) continue;
    claimed[i] = true;
    pending.delete(id);
    nextIds[id] = entryOf(elements[i]);
    assign(elements[i], id);
    report.reordered.push({ id, from: id, to: elements[i].id });
  }

  // Pass 3 - same component + tag + sig somewhere else.
  for (const id of [...pending]) {
    const entry = map.ids[id];
    const i = pick(byComponent.get(componentKey(entry)));
    if (i < 0) continue;
    const el = elements[i];
    claimed[i] = true;
    pending.delete(id);
    nextIds[id] = entryOf(el);
    assign(el, id);
    if (el.file !== entry.file) report.moved.push({ id, from: entry.file, to: el.file });
    else report.reordered.push({ id, from: id, to: el.id });
  }

  // Pass 4 - same file + tag + sig, the component around it was renamed.
  for (const id of [...pending]) {
    const entry = map.ids[id];
    const i = pick(byFile.get(fileKey(entry)));
    if (i < 0) continue;
    const el = elements[i];
    claimed[i] = true;
    pending.delete(id);
    nextIds[id] = entryOf(el);
    assign(el, id);
    report.renamed.push({ id, from: entry.component, to: el.component });
  }

  // Pass 5 - nothing matched. Keep the entry untouched and flag it.
  for (const id of [...pending]) {
    nextIds[id] = { ...map.ids[id] };
    report.missing.push(id);
  }

  // Everything still unclaimed is new. Its default name may already be taken by
  // an id that was reordered/moved onto another element, so disambiguate with
  // the signature rather than stamping two elements identically.
  const taken = new Set(Object.keys(nextIds));
  for (let i = 0; i < elements.length; i++) {
    if (claimed[i]) continue;
    const el = elements[i];
    let id = el.id;
    if (taken.has(id)) {
      id = `${el.id}~${el.sig}`;
      let n = 2;
      while (taken.has(id)) id = `${el.id}~${el.sig}~${n++}`;
    }
    taken.add(id);
    assign(el, id);
    if (addNew) {
      nextIds[id] = entryOf(el);
      report.added.push(id);
    }
  }

  const sorted: Record<string, IdMapEntry> = {};
  for (const id of Object.keys(nextIds).sort()) sorted[id] = nextIds[id];

  report.kept.sort();
  report.missing.sort();
  report.added.sort();

  return {
    map: { version: map.version ?? ID_MAP_VERSION, ids: sorted },
    report,
    assignments,
  };
}

/** True when the report contains nothing that changes the committed file. */
export function isCleanReport(report: RematchReport): boolean {
  return (
    report.moved.length === 0 &&
    report.renamed.length === 0 &&
    report.reordered.length === 0 &&
    report.missing.length === 0 &&
    report.added.length === 0
  );
}

/** One-line human summary of a rematch, for build logs. */
export function summarizeReport(report: RematchReport): string {
  return [
    `${report.kept.length} kept`,
    `${report.moved.length} moved`,
    `${report.renamed.length} renamed`,
    `${report.reordered.length} reordered`,
    `${report.added.length} added`,
    `${report.missing.length} missing`,
  ].join(", ");
}

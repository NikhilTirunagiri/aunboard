import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { discoverElements, type DiscoverOptions } from "./discover";
import {
  ID_MAP_VERSION,
  emptyIdMap,
  type DiscoveredElement,
  type IdMap,
  type IdMapEntry,
} from "./types";

/** Project-root-relative, posix-separated path, as stored in the id map. */
export function toMapPath(file: string, root: string): string {
  const abs = isAbsolute(file) ? file : resolve(root, file);
  return relative(root, abs).split(sep).join("/");
}

function isEntry(value: unknown): value is IdMapEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.file === "string" &&
    typeof entry.component === "string" &&
    typeof entry.tag === "string" &&
    typeof entry.sig === "string"
  );
}

/** Validate and normalize a parsed `aunboard.ids.json`. Unknown shapes yield an empty map. */
export function normalizeIdMap(data: unknown): IdMap {
  if (typeof data !== "object" || data === null) return emptyIdMap();
  const raw = data as { version?: unknown; ids?: unknown };
  const ids: Record<string, IdMapEntry> = {};
  if (typeof raw.ids === "object" && raw.ids !== null) {
    for (const [id, entry] of Object.entries(raw.ids)) {
      if (isEntry(entry)) {
        ids[id] = { file: entry.file, component: entry.component, tag: entry.tag, sig: entry.sig };
      }
    }
  }
  return { version: typeof raw.version === "number" ? raw.version : ID_MAP_VERSION, ids };
}

/** Read `aunboard.ids.json`. A missing file is not an error: it is an empty map. */
export function readIdMap(path: string): IdMap {
  if (!existsSync(path)) return emptyIdMap();
  try {
    return normalizeIdMap(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    throw new Error(`[aunboard] ${path} is not valid JSON: ${(error as Error).message}`);
  }
}

/** Canonical, diff-friendly serialization: sorted keys, two-space indent, trailing newline. */
export function serializeIdMap(map: IdMap): string {
  const ids: Record<string, IdMapEntry> = {};
  for (const id of Object.keys(map.ids).sort()) ids[id] = map.ids[id];
  return `${JSON.stringify({ version: map.version ?? ID_MAP_VERSION, ids }, null, 2)}\n`;
}

/** Write the map only when the bytes would change. Returns true if it wrote. */
export function writeIdMapIfChanged(path: string, map: IdMap): boolean {
  const next = serializeIdMap(map);
  if (existsSync(path)) {
    try {
      if (readFileSync(path, "utf8") === next) return false;
    } catch {
      /* fall through and rewrite */
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next, "utf8");
  return true;
}

export interface ScanOptions extends DiscoverOptions {
  /** Project root that `file` paths are recorded relative to. */
  root: string;
  /** Called instead of throwing when a file fails to parse. */
  onError?: (file: string, error: Error) => void;
}

/**
 * Discover every stampable element across a set of source files.
 * Paths in the result are root-relative and posix-separated.
 */
export function scanFiles(files: readonly string[], options: ScanOptions): DiscoveredElement[] {
  const { root, onError, ...discover } = options;
  const out: DiscoveredElement[] = [];
  for (const file of files) {
    const abs = isAbsolute(file) ? file : resolve(root, file);
    let code: string;
    try {
      code = readFileSync(abs, "utf8");
    } catch (error) {
      onError?.(abs, error as Error);
      continue;
    }
    try {
      out.push(...discoverElements(code, toMapPath(abs, root), discover));
    } catch (error) {
      if (!onError) throw error;
      onError(abs, error as Error);
    }
  }
  return out;
}

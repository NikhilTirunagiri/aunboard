import { readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const MAGIC = /[*?]/;
/** Never descend into these — a stray copy of a tour file in here is noise, not a tour. */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", ".turbo", ".cache"]);

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

/** Normalize a user-supplied pattern: posix separators, no leading "./". */
export function normalizePattern(pattern: string): string {
  return pattern.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Minimal glob → RegExp. Supports `*` (within a segment), `**` (across segments) and `?`.
 * Everything else is literal — no character classes or braces, which keeps this dependency-free
 * without pretending to be a full glob implementation.
 */
export function globToRegExp(pattern: string): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        i++;
        if (pattern[i + 1] === "/") {
          i++;
          out += "(?:[^/]+/)*"; // `**/` also matches zero directories
        } else {
          out += ".*";
        }
      } else {
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else if (/[.+^${}()|[\]\\]/.test(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

function walk(dir: string, depth: number, out: string[]): void {
  if (depth > 24) return; // pathological symlink loops
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory — nothing to match
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, depth + 1, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
}

/**
 * Expand glob patterns (or plain file paths) to a sorted, de-duplicated list of
 * absolute file paths. Patterns that match nothing simply contribute nothing.
 */
export function expandGlobs(patterns: string[], cwd: string = process.cwd()): string[] {
  const found = new Set<string>();

  for (const raw of patterns) {
    const pattern = normalizePattern(raw);
    if (pattern.length === 0) continue;

    if (!MAGIC.test(pattern)) {
      const full = resolve(cwd, pattern);
      try {
        if (statSync(full).isFile()) found.add(full);
      } catch {
        /* no such file — not a match */
      }
      continue;
    }

    const segments = pattern.split("/");
    const firstMagic = segments.findIndex((s) => MAGIC.test(s));
    const baseDir = resolve(cwd, segments.slice(0, firstMagic).join("/") || ".");
    const absolutePattern = isAbsolute(pattern);
    const re = globToRegExp(pattern);

    const files: string[] = [];
    walk(baseDir, 0, files);
    for (const file of files) {
      const key = absolutePattern ? toPosix(file) : toPosix(relative(cwd, file));
      if (re.test(key)) found.add(file);
    }
  }

  return [...found].sort();
}

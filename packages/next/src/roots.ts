import { resolve } from "node:path";

const MAGIC = /[*?[\]!]|\{.*\}/;
/** A leading `{app,pages}` group: no nested magic, so it expands to real directories. */
const PLAIN_BRACES = /^\{([^{}*?[\]]+)\}$/;

/**
 * The directories a set of source globs can possibly match.
 *
 * Used as the webpack rule's `include`, so Next only runs the loader over files
 * that could plausibly need stamping. `"src/**\/*.tsx"` yields `<root>/src`;
 * `"{app,src}/**\/*.tsx"` yields both; a glob with magic in its first segment
 * yields the project root, since it could match anywhere.
 */
export function sourceRoots(globs: readonly string[], root: string): string[] {
  const roots = new Set<string>();

  for (const glob of globs) {
    const segments = glob.replace(/\\/g, "/").split("/");
    const prefix: string[] = [];
    let branches: string[] = [];

    for (const segment of segments) {
      const braces = PLAIN_BRACES.exec(segment);
      if (braces) {
        branches = braces[1].split(",").map((part) => part.trim()).filter(Boolean);
        break;
      }
      if (MAGIC.test(segment)) break;
      prefix.push(segment);
    }

    const base = prefix.join("/");
    if (branches.length) {
      for (const branch of branches) roots.add(resolve(root, base, branch));
    } else if (base) {
      roots.add(resolve(root, base));
    } else {
      // Nothing static to anchor on: the glob could match anywhere.
      return [resolve(root)];
    }
  }

  const resolved = [...roots];
  // A root that contains the project root is the project root.
  if (resolved.some((path) => path === resolve(root))) return [resolve(root)];
  return resolved.length ? resolved : [resolve(root)];
}

import { isAbsolute, relative, resolve, sep } from "node:path";

import picomatch from "picomatch";

import type { FilterPattern } from "./types";

function toArray(pattern: FilterPattern): Array<string | RegExp> {
  if (pattern === null || pattern === undefined) return [];
  return Array.isArray(pattern) ? [...pattern] : [pattern as string | RegExp];
}

function posix(path: string): string {
  return path.split(sep).join("/");
}

/**
 * Vite's `createFilter`, minus the Vite dependency.
 *
 * A RegExp is tested against the absolute path; a glob string is matched
 * against both the absolute path and the root-relative path, so
 * `"src/**\/*.tsx"` works the way you would write it in a config file.
 */
export function createFilter(
  include: FilterPattern,
  exclude: FilterPattern,
  root: string = process.cwd(),
): (file: string) => boolean {
  const compile = (pattern: string | RegExp): ((file: string) => boolean) => {
    if (pattern instanceof RegExp) {
      // A fresh lastIndex per test: a /g regexp is stateful and would
      // otherwise return alternating answers for the same file.
      return (file) => new RegExp(pattern.source, pattern.flags.replace("g", "")).test(file);
    }
    const absolutePattern = posix(isAbsolute(pattern) ? pattern : resolve(root, pattern));
    const matchAbsolute = picomatch(absolutePattern, { dot: true });
    const matchRelative = picomatch(posix(pattern), { dot: true });
    return (file) => {
      const abs = posix(file);
      const rel = posix(relative(root, file));
      return matchAbsolute(abs) || matchRelative(rel) || matchRelative(abs);
    };
  };

  const includes = toArray(include).map(compile);
  const excludes = toArray(exclude).map(compile);

  return (file: string): boolean => {
    if (excludes.some((test) => test(file))) return false;
    if (includes.length === 0) return true;
    return includes.some((test) => test(file));
  };
}

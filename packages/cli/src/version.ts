import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Version of this package, read from its package.json at runtime. Works from both
 * `dist/cli.js` and `src/` (vitest), so there is no build-time define to keep in sync.
 */
export function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [join(here, "../package.json"), join(here, "../../package.json")]) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, "utf8")) as { name?: string; version?: string };
      if (pkg.name === "@aunboard/cli" && typeof pkg.version === "string") return pkg.version;
    } catch {
      /* try the next candidate */
    }
  }
  return "0.0.0";
}

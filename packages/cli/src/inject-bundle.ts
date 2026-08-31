import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MISSING_BUNDLE_MESSAGE =
  "aunboard: the browser locator bundle (dist/inject.global.js) is missing. Reinstall @aunboard/cli, or run `pnpm build` if you are working from a checkout.";

/**
 * Source of the IIFE locator bundle, injected into every page. Looked up next to the built
 * CLI first (dist/), then from src/ so the package works when run straight from a checkout.
 */
export function loadInjectScript(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [join(here, "inject.global.js"), join(here, "../dist/inject.global.js")]) {
    try {
      return readFileSync(candidate, "utf8");
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error(MISSING_BUNDLE_MESSAGE);
}

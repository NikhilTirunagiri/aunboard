import type { Logger } from "./types";

export const TURBOPACK_WARNING =
  "[aunboard] Turbopack is active, so build-time stamping is skipped: " +
  "Turbopack does not run webpack loaders, and a Rust/WASM SWC plugin is not part of this package yet. " +
  "Your app still works and tours still replay — but without data-aun stamps they fall back to their " +
  "semantic locators (role + accessible name, text, scope, index), which are the signals that rot when " +
  "the UI changes. Run `next dev` and `next build` without --turbopack to get stamped tours.";

/**
 * Is this process running Next under Turbopack?
 *
 * Next sets `TURBOPACK=1` for `next dev --turbopack` and `next build
 * --turbopack` (and the older `--turbo`); the argv check covers the wrappers
 * and monorepo task runners that re-exec Next without forwarding that env var.
 */
export function isTurbopack(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv,
): boolean {
  if (env.TURBOPACK || env.TURBOPACK_DEV || env.TURBOPACK_BUILD || env.NEXT_TURBOPACK) return true;
  return argv.some((arg) => arg === "--turbo" || arg === "--turbopack");
}

/** One warning per `withAunboard()` call, however many times Next reloads the config. */
export function warnIfTurbopack(
  logger: Logger,
  once: { warned: boolean },
  env?: NodeJS.ProcessEnv,
  argv?: readonly string[],
): boolean {
  if (!isTurbopack(env, argv)) return false;
  if (!once.warned) {
    once.warned = true;
    logger.warn(TURBOPACK_WARNING);
  }
  return true;
}

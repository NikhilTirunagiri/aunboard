/**
 * Browser-injectable locator engine.
 *
 * This entry is bundled by tsup into an IIFE (`dist/inject.global.js`) that the CLI
 * injects into every page it opens. It re-exports the *runtime's own* resolution code —
 * no reimplementation — so a step that CI calls resolvable is resolvable at replay, and
 * a step CI fails would have failed in the product too.
 */
export { resolveLocator, matchElements } from "../../../aunboard/src/locator/resolve";
export { resolveLocatorWhenReady } from "../../../aunboard/src/locator/wait";
export { activateElement } from "../../../aunboard/src/locator/activate";
export { implicitRole, accessibleName, normalizeText } from "../../../aunboard/src/locator/accessible-name";

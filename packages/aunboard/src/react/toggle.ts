import type { LabelMode } from "./context";

/** Pure cycle: off -> explore -> walkthrough -> off (walkthrough skipped without tours). */
export function nextMode(current: LabelMode, hasTours: boolean): LabelMode {
  if (current === "off") return "explore";
  if (current === "explore") return hasTours ? "walkthrough" : "off";
  return "off";
}

/**
 * Install the Cmd/Ctrl+/ shortcut. Cycles Off -> Explore -> Walkthrough -> Off, skipping
 * Walkthrough when `hasTours()` is false. Returns an uninstall function.
 */
export function installModeShortcut(
  setMode: (updater: (prev: LabelMode) => LabelMode) => void,
  hasTours: () => boolean,
): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setMode((prev) => nextMode(prev, hasTours()));
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

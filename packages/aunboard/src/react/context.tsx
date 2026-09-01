import { createContext, useContext } from "react";
import type { Tours } from "../tour/types";

export type AunboardMode = "off" | "explore" | "walkthrough" | "record";

export interface AunboardValue {
  /**
   * False when the overlay is switched off for this environment. The context is still
   * provided, so a tour trigger living in shared UI can render (disabled) instead of
   * crashing the tree. `setMode` is a no-op while this is false.
   */
  enabled: boolean;
  mode: AunboardMode;
  /**
   * Value-only facade. The provider's internal useState setter (which is what's passed to
   * installModeShortcut) also accepts the updater form; this narrowed type is not interchangeable
   * with that setter.
   */
  setMode: (mode: AunboardMode) => void;
  tours: Tours;
  activeTourId: string | null;
  setActiveTourId: (id: string | null) => void;
}

export const AunboardContext = createContext<AunboardValue | null>(null);

/** The value supplied when the overlay is switched off. `enabled` is false; nothing acts. */
export const DISABLED_VALUE: AunboardValue = {
  enabled: false,
  mode: "off",
  setMode: () => {},
  tours: {},
  activeTourId: null,
  setActiveTourId: () => {},
};

/**
 * Read/drive aunboard from anywhere under the provider.
 *
 * Safe to call when the overlay is disabled for the environment — you get `enabled: false`
 * and inert setters rather than an exception, so a "Start tour" button can live in shared UI
 * without every consumer having to know whether aunboard is switched on. Still throws when
 * there is no provider at all, which is a wiring mistake rather than a state.
 */
export function useAunboard(): AunboardValue {
  const ctx = useContext(AunboardContext);
  if (!ctx) throw new Error("aunboard: useAunboard must be used inside <AunboardProvider>.");
  return ctx;
}

/**
 * Like `useAunboard`, but returns null instead of throwing when there is no provider above.
 * For a shared component that may be rendered in an app which never mounts aunboard at all.
 */
export function useAunboardOptional(): AunboardValue | null {
  return useContext(AunboardContext);
}

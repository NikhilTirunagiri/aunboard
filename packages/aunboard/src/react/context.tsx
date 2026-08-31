import { createContext, useContext } from "react";
import type { Tours } from "../tour/types";

export type AunboardMode = "off" | "explore" | "walkthrough" | "record";

export interface AunboardValue {
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

/** Read/drive aunboard from anywhere under the provider. */
export function useAunboard(): AunboardValue {
  const ctx = useContext(AunboardContext);
  if (!ctx) throw new Error("aunboard: useAunboard must be used inside <AunboardProvider>.");
  return ctx;
}

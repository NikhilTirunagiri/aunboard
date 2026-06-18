import { createContext, useContext } from "react";
import type { Tours } from "../tour/types";

export type LabelMode = "off" | "explore" | "walkthrough" | "record";

export interface LabelModeValue {
  mode: LabelMode;
  /**
   * Value-only facade. The provider's internal useState setter (which is what's passed to
   * installModeShortcut) also accepts the updater form; this narrowed type is not interchangeable
   * with that setter.
   */
  setMode: (mode: LabelMode) => void;
  tours: Tours;
  activeTourId: string | null;
  setActiveTourId: (id: string | null) => void;
}

export const LabelModeContext = createContext<LabelModeValue | null>(null);

/** Read/drive Label Mode from anywhere under the provider. */
export function useLabelMode(): LabelModeValue {
  const ctx = useContext(LabelModeContext);
  if (!ctx) throw new Error("aunboard: useLabelMode must be used inside <LabelModeProvider>.");
  return ctx;
}

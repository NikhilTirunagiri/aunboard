export { AunboardProvider } from "./react/provider";
export type { AunboardProviderProps, RecordConfig } from "./react/provider";
export { useAunboard, useAunboardOptional } from "./react/context";
export type { AunboardValue, AunboardMode } from "./react/context";
export { LegendPanel } from "./react/legend";
export { useTour } from "./tour/controller";
export type { UseTourResult, UseTourOptions } from "./tour/controller";
export type { Tour, TourStep, Tours } from "./tour/types";
export type { NavigateFn } from "./tour/navigation";
export type { ElementLocator, ResolveResult } from "./locator";
export { buildLocator, resolveLocator } from "./locator";
export { scoreLocator, isStamped, SIGNAL_SCORE } from "./locator";
export type { SignalKind } from "./locator";
export { isAunboardEnabled } from "./env";

// ── Deprecated aliases ────────────────────────────────────────────────────────
// The package is `aunboard`; the API used to be named after the old "label mode" working
// title. These keep existing integrations compiling and will be removed in 1.0.
export { AunboardProvider as LabelModeProvider } from "./react/provider";
export { useAunboard as useLabelMode } from "./react/context";
export type { AunboardMode as LabelMode } from "./react/context";
export type { AunboardValue as LabelModeValue } from "./react/context";
export type { AunboardProviderProps as LabelModeProviderProps } from "./react/provider";

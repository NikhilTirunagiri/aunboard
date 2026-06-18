import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Tour, TourStep } from "./types";
import { tourReducer, type TourState, type TourStatus } from "./machine";
import { resolveNavigate, needsNavigation, currentPath, type NavigateFn } from "./navigation";
import { resolveLocatorWhenReady } from "../locator/wait";
import { resolveLocator, activateElement } from "../locator";
import { loadProgress, saveProgress, type TourProgress } from "./persistence";

export interface UseTourOptions {
  navigate?: NavigateFn;
  /** Persist + resume progress in localStorage. Default true. */
  persist?: boolean;
  /** Per-step wait-for-element timeout (ms). Default 8000. */
  waitTimeout?: number;
}

export interface UseTourResult {
  status: TourStatus;
  index: number;
  total: number;
  step: TourStep | null;
  element: HTMLElement | null;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
}

const INITIAL: TourState = { status: "idle", index: 0, token: 0 };

export function useTour(tour: Tour | null, options: UseTourOptions = {}): UseTourResult {
  const total = tour?.steps.length ?? 0;
  const [state, dispatch] = useReducer(
    (s: TourState, a: Parameters<typeof tourReducer>[1]) => tourReducer(s, a, total),
    INITIAL,
  );
  const [element, setElement] = useState<HTMLElement | null>(null);
  const persist = options.persist ?? true;

  // Keep latest navigate/tour/index without retriggering the token-keyed resolve effect.
  const navigateRef = useRef<NavigateFn>(resolveNavigate(options.navigate));
  navigateRef.current = resolveNavigate(options.navigate);
  const tourRef = useRef<Tour | null>(tour);
  tourRef.current = tour;
  const indexRef = useRef(state.index);
  indexRef.current = state.index;
  const waitTimeoutRef = useRef(options.waitTimeout);
  waitTimeoutRef.current = options.waitTimeout;

  const start = useCallback(() => {
    if (!tour) return;
    const saved = persist ? loadProgress(tour.id) : null;
    const from = saved && !saved.completed ? saved.stepIndex : 0;
    dispatch({ type: "START", index: from });
  }, [tour, persist]);

  const stop = useCallback(() => {
    setElement(null);
    dispatch({ type: "STOP" });
  }, []);
  const next = useCallback(() => dispatch({ type: "NEXT" }), []);
  const prev = useCallback(() => dispatch({ type: "PREV" }), []);
  const goTo = useCallback((index: number) => dispatch({ type: "GOTO", index }), []);

  // One resolve per navigation command (keyed on token): navigate if needed, wait, then running.
  useEffect(() => {
    const t = tourRef.current;
    if (!t || state.status !== "navigating") return;
    let cancelled = false;
    const step = t.steps[indexRef.current];
    setElement(null);
    if (needsNavigation(step.route, currentPath())) {
      navigateRef.current(step.route as string);
    }
    dispatch({ type: "WAITING" });
    const timeout = waitTimeoutRef.current;

    (async () => {
      // Reveal pass: open the tab/accordion the target lives in (a control that doesn't change
      // the URL) by resolving and clicking each reveal in order. Skipped when the target is
      // already *visible*, so an open disclosure isn't toggled shut — but a present-but-hidden
      // target (a tab panel kept in the DOM with display:none) still triggers the reveal.
      const present = resolveLocator(step.locator).element;
      const alreadyVisible =
        !!present && (typeof present.checkVisibility === "function" ? present.checkVisibility() : true);
      if (step.reveal?.length && !alreadyVisible) {
        for (const revealLocator of step.reveal) {
          if (cancelled) return;
          const opener = await resolveLocatorWhenReady(revealLocator, { timeout });
          if (cancelled) return;
          if (opener) activateElement(opener);
        }
      }
      const el = await resolveLocatorWhenReady(step.locator, { timeout });
      if (cancelled) return;
      if (el === null) {
        dispatch({ type: "NOT_FOUND" }); // graceful fallback: reveal missing or didn't surface the target
        return;
      }
      setElement(el);
      dispatch({ type: "ARRIVED" });
    })();

    return () => {
      cancelled = true;
    };
    // Keyed on token so WAITING/ARRIVED status changes don't retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.token]);

  // Persist when the user is actually viewing a step or has finished.
  useEffect(() => {
    if (!tour || !persist) return;
    if (state.status !== "running" && state.status !== "done") return;
    const progress: TourProgress = { stepIndex: state.index, completed: state.status === "done" };
    saveProgress(tour.id, progress);
  }, [tour, persist, state.status, state.index]);

  return {
    status: state.status,
    index: state.index,
    total,
    step: tour ? tour.steps[state.index] ?? null : null,
    element,
    start,
    stop,
    next,
    prev,
    goTo,
  };
}

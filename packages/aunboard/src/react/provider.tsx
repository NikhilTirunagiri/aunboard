import { useEffect, useMemo, useRef, useState } from "react";
import { AunboardContext, DISABLED_VALUE, type AunboardMode } from "./context";
import { Overlay } from "./overlay";
import { Walkthrough } from "./walkthrough";
import { ModeSwitch } from "./mode-switch";
import { installModeShortcut } from "./toggle";
import { validateTours } from "../tour/validate";
import { isAunboardEnabled } from "../env";
import { loadRecording } from "../record/storage";
import type { Tours, Tour } from "../tour/types";
import type { NavigateFn } from "../tour/navigation";

export interface RecordConfig {
  tour: { id: string; name: string };
}

export interface AunboardProviderProps {
  /** Optional tour collection for Explore/Walkthrough modes. */
  tours?: Tours;
  children: React.ReactNode;
  /** Override the env gate. Defaults to isAunboardEnabled(NODE_ENV, undefined). */
  enabled?: boolean;
  /** Mode on first mount. Default "off". */
  defaultMode?: AunboardMode;
  /** Tour selected by default in Walkthrough mode. Defaults to the first tour. */
  defaultTourId?: string;
  /** Consumer navigation (e.g. Next's useRouter().push). Falls back to History API. */
  navigate?: NavigateFn;
  /** Persist tour progress to localStorage. Default true. */
  persistProgress?: boolean;
  /** Per-step wait-for-element timeout (ms) for walkthroughs. Default 8000. */
  waitTimeout?: number;
  /** Optional record mode config: which tour to record. Dev-only. */
  record?: RecordConfig;
  /**
   * Render the built-in bottom-left mode switcher. Default true.
   *
   * Set false when aunboard ships in a product build and the tour is started from your own
   * UI — otherwise the pill sits on screen permanently. With it off, drive the overlay via
   * `useAunboard().setMode("walkthrough")`.
   */
  showModeSwitch?: boolean;
}

function firstTour(tours: Tours): Tour | null {
  const first = Object.values(tours)[0];
  return first ?? null;
}

export function AunboardProvider({
  tours = {},
  children,
  enabled,
  defaultMode = "off",
  defaultTourId,
  navigate,
  persistProgress = true,
  waitTimeout,
  record,
  showModeSwitch = true,
}: AunboardProviderProps) {
  const active = enabled ?? isAunboardEnabled(process.env.NODE_ENV, undefined);
  const [mode, setMode] = useState<AunboardMode>(defaultMode);
  const [activeTourId, setActiveTourId] = useState<string | null>(
    () => defaultTourId ?? Object.keys(tours)[0] ?? null,
  );

  // Validate tours at startup.
  const safeTours = useMemo(
    () => (active ? validateTours(tours) : tours),
    [active, tours],
  );

  // Merge committed tours with any live localStorage recordings so record→replay
  // works without a manual export step. localStorage MUST be read after mount, not
  // during render: reading it in render makes the first client render differ from
  // the server (which has no localStorage), causing a hydration mismatch. So we keep
  // recordings in state, populated by an effect, and the first render matches SSR.
  //
  // Recordings are an AUTHORING convenience, not a delivery mechanism. They are merged only
  // while authoring — `record` configured AND not a production build. Outside that, the
  // committed `tours` prop is the single source of truth. This matters because the docs
  // recommend `enabled` for staging/demo builds: without this gate, any visitor holding a
  // stale recording in their own localStorage would silently see THEIR version of the tour
  // instead of the committed one, with nothing to indicate the substitution.
  const authoring = !!record && process.env.NODE_ENV !== "production";
  const [recordings, setRecordings] = useState<Tours>({});
  useEffect(() => {
    if (!active || !authoring) {
      setRecordings((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    const ids = new Set<string>(Object.keys(safeTours));
    if (record) ids.add(record.tour.id);
    const found: Tours = {};
    for (const id of ids) {
      const rec = loadRecording(id);
      if (rec && rec.steps.length) found[id] = rec;
    }
    setRecordings(found);
    // Re-read when leaving record mode so the freshly recorded steps appear.
  }, [active, authoring, safeTours, record, mode]);

  // Recordings win over the static tours prop so the latest recording is replayed.
  const liveTours = useMemo<Tours>(() => ({ ...safeTours, ...recordings }), [safeTours, recordings]);

  // Once tours/recordings resolve, adopt the first as active if none is selected,
  // so Walkthrough and the tour picker work (Explore already falls back to the first).
  useEffect(() => {
    if (activeTourId === null) {
      const firstId = Object.keys(liveTours)[0];
      if (firstId) setActiveTourId(firstId);
    }
  }, [liveTours, activeTourId]);

  // Read the latest tours at keypress time without reinstalling the listener every render.
  const liveToursRef = useRef(liveTours);
  liveToursRef.current = liveTours;

  useEffect(() => {
    if (!active) return;
    return installModeShortcut(setMode, () => Object.keys(liveToursRef.current).length > 0);
  }, [active]);
  // A missing defaultTourId used to throw. That is wrong for the common case: a `tours` map
  // built from an async query is `{}` for the first render or two, so a constant
  // defaultTourId would white-screen the app before the data arrived. Warn once in dev and
  // fall back to no selection — the effect above adopts the first tour when they load.
  const warnedRef = useRef(false);
  useEffect(() => {
    if (!active || !defaultTourId || warnedRef.current) return;
    if (Object.keys(liveTours).length === 0) return; // still loading — not an error yet
    if (liveTours[defaultTourId]) return;
    warnedRef.current = true;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `aunboard: defaultTourId "${defaultTourId}" is not in tours (have: ${Object.keys(liveTours).join(", ") || "none"}). Falling back to the first tour.`,
      );
    }
  }, [active, defaultTourId, liveTours]);

  // Dev-only dynamic import of RecordController.
  const [RC, setRC] = useState<React.ComponentType<{ tour: { id: string; name: string } }> | null>(null);
  useEffect(() => {
    if (!active) return;
    if (mode !== "record" || !record || process.env.NODE_ENV === "production") return;
    let cancelled = false;
    import("../record/index.js").then((mod) => {
      if (!cancelled) setRC(() => mod.RecordController);
    });
    return () => { cancelled = true; };
  }, [active, mode, record]);

  // Still provide context when switched off. Returning bare children made useAunboard()
  // throw for every consumer, so a tour trigger could not live in a shared component
  // without knowing whether aunboard was enabled for this build.
  if (!active) {
    return <AunboardContext.Provider value={DISABLED_VALUE}>{children}</AunboardContext.Provider>;
  }

  const activeTour = activeTourId
    ? (liveTours[activeTourId] ?? null)
    : firstTour(liveTours);

  return (
    <AunboardContext.Provider
      value={{ enabled: true, mode, setMode, tours: liveTours, activeTourId, setActiveTourId }}
    >
      {children}
      {showModeSwitch && <ModeSwitch />}
      {mode === "explore" && <Overlay tour={activeTour} />}
      {mode === "walkthrough" && (
        <Walkthrough navigate={navigate} persist={persistProgress} waitTimeout={waitTimeout} />
      )}
      {mode === "record" && RC && record && <RC tour={record.tour} />}
    </AunboardContext.Provider>
  );
}

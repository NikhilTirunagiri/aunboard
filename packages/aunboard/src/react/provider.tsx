import { useEffect, useMemo, useRef, useState } from "react";
import { AunboardContext, type AunboardMode } from "./context";
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

  // defaultTourId, if supplied, must exist — fail loudly.
  if (active && defaultTourId && !safeTours[defaultTourId]) {
    throw new Error(`aunboard: defaultTourId "${defaultTourId}" is not present in tours.`);
  }

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

  if (!active) return <>{children}</>;

  const activeTour = activeTourId
    ? (liveTours[activeTourId] ?? null)
    : firstTour(liveTours);

  return (
    <AunboardContext.Provider
      value={{ mode, setMode, tours: liveTours, activeTourId, setActiveTourId }}
    >
      {children}
      <ModeSwitch />
      {mode === "explore" && <Overlay tour={activeTour} />}
      {mode === "walkthrough" && (
        <Walkthrough navigate={navigate} persist={persistProgress} waitTimeout={waitTimeout} />
      )}
      {mode === "record" && RC && record && <RC tour={record.tour} />}
    </AunboardContext.Provider>
  );
}

import { useReducer, useEffect, useState, useRef } from "react";
import { captureClick, type Capture } from "./capture.js";
import { meaningfulTarget } from "./highlight.js";
import { locatorDurability } from "./durability.js";
import { emptySession, sessionReducer } from "./session.js";
import { saveRecording, loadRecording, downloadTour } from "./storage.js";
import { OverlayCard } from "./overlay-card.js";
import { StepList } from "./step-list.js";
import { buildLocator, type ElementLocator } from "../locator";
import type { TourStep } from "../tour/types";

export interface RecordControllerProps {
  tour: { id: string; name: string };
  /** Returns the current route to stamp on a new step. Default: window.location.pathname. */
  currentRoute?: () => string;
}

export function RecordController({ tour, currentRoute }: RecordControllerProps) {
  const [session, dispatch] = useReducer(
    sessionReducer, undefined,
    () => loadRecording(tour.id) ?? emptySession(tour.id, tour.name),
  );
  const [pending, setPending] = useState<Capture | null>(null);
  const pendingRef = useRef<Capture | null>(null);
  pendingRef.current = pending;

  // Reveal capture: as you navigate to reach the next element you click tabs/accordions
  // (pass-through clicks). We remember those *same-page* clicks and offer them as the next
  // step's `reveal` so replay can re-open them. The trail resets when the route changes.
  const [reveal, setReveal] = useState<ElementLocator[]>([]);
  const trailRef = useRef<ElementLocator[]>([]);
  const trailPathRef = useRef<string | undefined>(undefined);
  const routeRef = useRef(currentRoute);
  routeRef.current = currentRoute;

  // Persist on every change so a reload resumes the recording.
  useEffect(() => { saveRecording(session); }, [session]);

  // ── Pick mode (armed) ──────────────────────────────────────────────────────
  // Picking is a MODE (like DevTools Cmd+Shift+C), NOT always-on — otherwise you
  // could never navigate the host app to reach the next screen. We intercept a
  // click only when picking is armed OR the user Alt/Option-clicks (no-toggle
  // power path). After a successful pick we auto-disarm, dropping you straight
  // back into normal app use so you can navigate to the next page and re-arm.
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(armed);
  armedRef.current = armed;

  // Inspect-Element-style capture: when picking, intercept the WHOLE pointer
  // cluster in the capture phase (document → target), before the app's React
  // handlers run, so a host <button>/<a>/<form> never fires. Suppressing only
  // "click" is not enough — many controls act on mousedown first (DevTools/rrweb).
  useEffect(() => {
    const picking = (e: { altKey?: boolean }) => armedRef.current || e.altKey === true;
    const SWALLOW = ["pointerdown", "mousedown", "mouseup", "pointerup", "dblclick"] as const;
    const swallow = (e: Event) => {
      if (pendingRef.current) return;                 // card open — let it interact
      if (!picking(e as MouseEvent)) return;          // not picking — app works normally
      // Only decide *whether* to swallow here — don't build the locator. swallow fires on
      // every pointer event of the gesture (pointerdown/mousedown/mouseup/...); building a
      // locator each time is wasted work. The real capture happens once, in `pick`.
      if (!meaningfulTarget(e.target as Element | null)) return; // own-UI / empty — pass through
      e.preventDefault();
      e.stopImmediatePropagation();                   // app's own handler never runs
    };
    const routeNow = () => (routeRef.current ?? (() => window.location.pathname))();
    // Remember a same-page pass-through click on a meaningful element as a candidate reveal.
    const rememberReveal = (target: Element | null) => {
      const el = meaningfulTarget(target);
      if (!el) return;                                // own-UI / empty — ignore
      const path = routeNow();
      if (path !== trailPathRef.current) { trailRef.current = []; trailPathRef.current = path; }
      const loc = buildLocator(el);
      const last = trailRef.current[trailRef.current.length - 1];
      if (last && JSON.stringify(last) === JSON.stringify(loc)) return; // dedupe repeats
      trailRef.current = [...trailRef.current, loc].slice(-4);          // cap trail length
    };
    // Open the narration card for a capture, attaching same-page reveals captured en route.
    const commitPick = (cap: Capture) => {
      setPending(cap);
      setReveal(routeNow() === trailPathRef.current ? trailRef.current : []);
      trailRef.current = [];
      setArmed(false);                                // auto-disarm: back to normal use
    };
    const pick = (e: MouseEvent) => {
      if (pendingRef.current) return;
      if (!picking(e)) { rememberReveal(e.target as Element | null); return; }
      const cap = captureClick(e.target as Element | null);
      if (!cap) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      commitPick(cap);
    };
    // Esc cancels pick-mode; Enter/Space on a focused control while armed picks it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setArmed(false); return; }
      if (pendingRef.current || !armedRef.current) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      const cap = captureClick(e.target as Element | null);
      if (!cap) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      commitPick(cap);
    };
    SWALLOW.forEach((t) => document.addEventListener(t, swallow, true));
    document.addEventListener("click", pick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      SWALLOW.forEach((t) => document.removeEventListener(t, swallow, true));
      document.removeEventListener("click", pick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);

  const save = (label: string, description: string) => {
    const route = (currentRoute ?? (() => window.location.pathname))();
    const step: TourStep = { locator: pending!.locator, label, description, route };
    if (reveal.length) step.reveal = reveal;
    dispatch({ type: "ADD", step });
    setPending(null);
    setReveal([]);
  };

  const cancel = () => { setPending(null); setReveal([]); };

  return (
    <div data-lm-ui>
      {/* Crosshair cursor + a thin outline could be layered here while `armed`. */}
      {pending && (
        <OverlayCard
          anchor={pending.element}
          onSave={save}
          onCancel={cancel}
          durability={locatorDurability(pending.locator)}
          reveal={reveal}
          onRemoveReveal={(i) => setReveal((r) => r.filter((_, j) => j !== i))}
        />
      )}
      <StepList
        session={session}
        armed={armed}
        onToggleArm={() => setArmed((a) => !a)}
        onRemove={(i) => dispatch({ type: "REMOVE", index: i })}
        onMove={(from, to) => dispatch({ type: "MOVE", from, to })}
        onExport={() => downloadTour(session)}
      />
    </div>
  );
}

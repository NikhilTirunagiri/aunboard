import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLabelMode } from "./context";
import { useTour } from "../tour/controller";
import { isLastStep } from "../tour/machine";
import { Spotlight } from "./spotlight";
import type { NavigateFn } from "../tour/navigation";

const TOP_Z = 2147483647;

export function Walkthrough({ navigate, persist, waitTimeout }: { navigate?: NavigateFn; persist: boolean; waitTimeout?: number }) {
  const { tours, activeTourId, setMode } = useLabelMode();
  const tour = activeTourId ? tours[activeTourId] ?? null : null;
  const t = useTour(tour, { navigate, persist, waitTimeout });
  const [, setTick] = useState(0);

  // Auto-start when the active tour changes; stop on unmount.
  useEffect(() => {
    if (!tour) return;
    t.start();
    return () => t.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour?.id]);

  // Bring the spotlighted element into view (guard scrollIntoView for SSR / jsdom safety).
  useEffect(() => {
    if (t.status === "running" && t.element?.scrollIntoView) {
      t.element.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [t.status, t.element]);

  // Recompute the spotlight rect on scroll/resize while running.
  useEffect(() => {
    if (t.status !== "running") return;
    const reflow = () => setTick((n) => n + 1);
    window.addEventListener("scroll", reflow, true);
    window.addEventListener("resize", reflow);
    return () => {
      window.removeEventListener("scroll", reflow, true);
      window.removeEventListener("resize", reflow);
    };
  }, [t.status]);

  if (!tour) return null;

  const close = () => {
    t.stop();
    setMode("off");
  };

  if (t.status === "navigating" || t.status === "waiting") {
    return createPortal(<Banner text="Loading the next step…" onClose={close} />, document.body);
  }
  if (t.status === "done") {
    return createPortal(<DoneCard tourName={tour.name} onClose={close} />, document.body);
  }
  if (t.status === "not-found") {
    const missingTitle = t.step ? t.step.label : "this step";
    return createPortal(
      <NotFoundCard
        title={missingTitle}
        isLast={isLastStep(t.index, t.total)}
        onSkip={t.next}
        onClose={close}
      />,
      document.body,
    );
  }
  if (t.status !== "running" || !t.element || !t.step) return null;

  const title = t.step.label;
  const narration = t.step.description;
  const r = t.element.getBoundingClientRect();

  return createPortal(
    <Spotlight
      rect={{ top: r.top, left: r.left, width: r.width, height: r.height }}
      title={title}
      narration={narration}
      index={t.index}
      total={t.total}
      isLast={isLastStep(t.index, t.total)}
      canPrev={t.index > 0}
      onPrev={t.prev}
      onNext={t.next}
      onClose={close}
    />,
    document.body,
  );
}

function Banner({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        top: 16,
        transform: "translateX(-50%)",
        zIndex: TOP_Z,
        background: "#1f2430",
        color: "#fff",
        padding: "8px 14px",
        borderRadius: 999,
        fontSize: 13,
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      {text}
      <button
        aria-label="Close walkthrough"
        onClick={onClose}
        style={{ border: "none", background: "transparent", color: "#fff", cursor: "pointer" }}
      >
        ✕
      </button>
    </div>
  );
}

function DoneCard({ tourName, onClose }: { tourName: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label={`${tourName} complete`}
      style={{
        position: "fixed",
        left: "50%",
        top: "40%",
        transform: "translate(-50%,-50%)",
        zIndex: TOP_Z,
        background: "#fff",
        color: "#1f2430",
        padding: 24,
        borderRadius: 14,
        boxShadow: "0 12px 40px rgba(0,0,0,.35)",
        textAlign: "center",
      }}
    >
      <strong style={{ fontSize: 18 }}>You're all set 🎉</strong>
      <p style={{ margin: "8px 0 16px" }}>You finished "{tourName}".</p>
      <button
        onClick={onClose}
        style={{
          border: "none",
          background: "#1f2430",
          color: "#fff",
          padding: "8px 16px",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        Done
      </button>
    </div>
  );
}

function NotFoundCard({
  title,
  isLast,
  onSkip,
  onClose,
}: {
  title: string;
  isLast: boolean;
  onSkip: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Step not found"
      style={{
        position: "fixed",
        left: "50%",
        top: "40%",
        transform: "translate(-50%,-50%)",
        zIndex: TOP_Z,
        background: "#fff",
        color: "#1f2430",
        padding: 24,
        borderRadius: 14,
        boxShadow: "0 12px 40px rgba(0,0,0,.35)",
        textAlign: "center",
        maxWidth: 360,
      }}
    >
      <strong style={{ fontSize: 16 }}>Couldn't find "{title}" on this screen</strong>
      <p style={{ margin: "8px 0 16px", opacity: 0.8 }}>It may not be available here yet.</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        <button
          onClick={onClose}
          style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}
        >
          Close
        </button>
        <button
          onClick={onSkip}
          style={{ border: "none", background: "#1f2430", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
        >
          {isLast ? "Finish" : "Skip"}
        </button>
      </div>
    </div>
  );
}

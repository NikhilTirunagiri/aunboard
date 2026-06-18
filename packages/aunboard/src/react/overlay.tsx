import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { resolveLocator } from "../locator";
import { computeBadgeRect } from "../dom/position";
import { Badge } from "./badge";
import { LegendPanel } from "./legend";
import type { Tour, TourStep } from "../tour/types";

const BADGE_SIZE = 18;

interface ResolvedStep {
  step: TourStep;
  element: HTMLElement;
  index: number;
}

function resolveSteps(tour: Tour): ResolvedStep[] {
  return tour.steps.reduce<ResolvedStep[]>((acc, step, i) => {
    const result = resolveLocator(step.locator);
    if (result.element) {
      acc.push({ step, element: result.element, index: i });
    }
    return acc;
  }, []);
}

export function Overlay({ tour }: { tour?: Tour | null }) {
  const [tick, setTick] = useState(0); // bump to recompute rects on scroll/resize

  useEffect(() => {
    if (!tour || tour.steps.length === 0) return;
    // Coalesce bursts of scroll/resize/observer events into a single recompute per frame.
    // Without this, every scroll event re-resolves *every* locator (a full querySelectorAll
    // sweep per step) — janky on a busy page with many badges.
    const raf =
      typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number;
    const caf = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : (clearTimeout as (id: number) => void);
    let pending = 0;
    const reflow = () => {
      if (pending) return;
      pending = raf(() => {
        pending = 0;
        setTick((t) => t + 1);
      });
    };
    window.addEventListener("scroll", reflow, true); // capture: catch scroll in any container
    window.addEventListener("resize", reflow);
    const ro = new ResizeObserver(reflow);
    ro.observe(document.body);
    return () => {
      if (pending) caf(pending);
      window.removeEventListener("scroll", reflow, true);
      window.removeEventListener("resize", reflow);
      ro.disconnect();
    };
  }, [tour]);

  if (!tour || tour.steps.length === 0) return null;

  const resolved = resolveSteps(tour);

  const badges = resolved.map(({ step, element }, i) => {
    const rect = computeBadgeRect(element.getBoundingClientRect(), BADGE_SIZE);
    return (
      <Badge
        key={`${step.label}-${i}`}
        index={i + 1}
        element={element}
        label={step.label}
        description={step.description}
        rect={rect}
      />
    );
  });

  // `tick` is used to trigger re-renders for position recomputation on scroll/resize.
  // The badges themselves re-render (not remount) because the key is now stable.
  void tick;

  return createPortal(
    <div data-label-mode-overlay style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto" }}>
        {badges}
        <LegendPanel steps={resolved.map((r) => r.step)} />
      </div>
    </div>,
    document.body,
  );
}

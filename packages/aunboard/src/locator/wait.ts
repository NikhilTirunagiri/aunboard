import { resolveLocator } from "./resolve";
import type { ElementLocator } from "./types";

export interface WaitOptions {
  /** Give up after this many ms (resolve null). Default 8000. */
  timeout?: number;
  /** Subtree to watch. Default document.body. */
  root?: Element;
}

/**
 * Resolve the locator as soon as the matching element exists in the DOM,
 * or null on timeout. Uses a MutationObserver so async-mounted elements
 * (after navigation or a slow fetch) are caught without polling.
 * SSR-safe: returns null immediately outside a browser context.
 */
export function resolveLocatorWhenReady(
  locator: ElementLocator,
  options: WaitOptions = {},
): Promise<HTMLElement | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  const root = options.root ?? document.body;
  const immediate = resolveLocator(locator, root).element;
  if (immediate) return Promise.resolve(immediate);

  const raf =
    typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number;
  const caf = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : (clearTimeout as (id: number) => void);

  return new Promise((resolve) => {
    let settled = false;
    let scheduled = 0;
    const finish = (el: HTMLElement | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      if (scheduled) caf(scheduled);
      resolve(el);
    };
    const check = () => {
      scheduled = 0;
      if (settled) return;
      const el = resolveLocator(locator, root).element;
      if (el) finish(el);
    };
    // A chatty page (animations, frequent re-renders) can fire mutations many times per
    // frame; coalesce them so we run at most one resolve per frame instead of one per mutation.
    const observer = new MutationObserver(() => {
      if (settled || scheduled) return;
      scheduled = raf(check);
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    const timer = setTimeout(() => finish(null), options.timeout ?? 8000);
  });
}

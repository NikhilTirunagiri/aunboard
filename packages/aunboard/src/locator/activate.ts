/**
 * Fire a realistic activation gesture on an element so both click-driven and mousedown/
 * pointerdown-driven controls (tabs, accordions, menus) respond. Used by the walkthrough to
 * open a `reveal` element before resolving the step's target. Each step is defensive so the
 * critical `.click()` still runs even if an environment rejects synthetic mouse/pointer events.
 */
export function activateElement(el: HTMLElement): void {
  try {
    el.scrollIntoView?.({ block: "nearest" });
  } catch {
    /* jsdom / unsupported — ignore */
  }
  try {
    el.focus?.();
  } catch {
    /* not focusable — ignore */
  }

  const PE = typeof PointerEvent === "function" ? PointerEvent : null;
  const fire = (Ctor: { new (type: string, init: object): Event } | null, type: string) => {
    if (!Ctor) return;
    try {
      el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true }));
    } catch {
      /* environment rejected this synthetic event — ignore */
    }
  };

  fire(PE, "pointerdown");
  fire(MouseEvent, "mousedown");
  fire(PE, "pointerup");
  fire(MouseEvent, "mouseup");
  try {
    el.click();
  } catch {
    /* ignore */
  }
}

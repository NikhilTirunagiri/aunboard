import { buildLocator, type ElementLocator } from "../locator";
import { meaningfulTarget } from "./highlight";

export interface Capture {
  element: Element;
  locator: ElementLocator;
}

/** Given the raw click target, climb to the meaningful element and build its locator. */
export function captureClick(target: Element | null): Capture | null {
  const element = meaningfulTarget(target);
  if (!element) return null;
  return { element, locator: buildLocator(element) };
}

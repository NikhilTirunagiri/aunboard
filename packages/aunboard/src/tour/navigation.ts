export type NavigateFn = (path: string) => void;

/** Current route path. */
export function currentPath(): string {
  return typeof window !== "undefined" ? window.location.pathname : "/";
}

/** Fallback navigation when the consumer doesn't supply one: History API + popstate. */
export function defaultNavigate(path: string): void {
  if (typeof window === "undefined") return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Use the consumer's navigate if provided, else the History API fallback. */
export function resolveNavigate(navigate?: NavigateFn): NavigateFn {
  return navigate ?? defaultNavigate;
}

/** True if `route` is set and differs from the current path. */
export function needsNavigation(route: string | undefined, current = currentPath()): boolean {
  return typeof route === "string" && route.length > 0 && route !== current;
}

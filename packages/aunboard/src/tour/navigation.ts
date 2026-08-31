export type NavigateFn = (path: string) => void;

/**
 * Normalize a route path for comparison.
 *
 * Static hosts (GitHub Pages, S3, nginx with a directory index, `http-server`) redirect
 * `/projects` to `/projects/`. A tour authored against `/projects` would otherwise never
 * consider itself "already there", so every step on that route would re-navigate — on a
 * redirecting host, repeatedly. Trailing slashes are not route identity; strip them.
 */
export function normalizePath(path: string): string {
  if (!path) return "/";
  const withoutTrailing = path.replace(/\/+$/, "");
  return withoutTrailing === "" ? "/" : withoutTrailing;
}

/** Current route path, normalized. */
export function currentPath(): string {
  return typeof window !== "undefined" ? normalizePath(window.location.pathname) : "/";
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

/** True if `route` is set and names a different page than the current path. */
export function needsNavigation(route: string | undefined, current = currentPath()): boolean {
  if (typeof route !== "string" || route.length === 0) return false;
  return normalizePath(route) !== normalizePath(current);
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
} from "react";

/**
 * A ~40-line History-API router. The point of interest for aunboard is `navigate`:
 * it is handed to <AunboardProvider navigate={...}> so a Walkthrough can carry a viewer
 * across pages. Any router works — react-router's `navigate`, Next's `router.push`, this.
 */
interface RouterValue {
  path: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

/**
 * Static hosts (GitHub Pages, S3, nginx, `http-server`) redirect `/projects` to `/projects/`.
 * Matching on the raw pathname would render "Not found" on every deployed build — which is
 * exactly what CI caught. aunboard normalizes the same way in `needsNavigation`.
 */
function normalize(path: string): string {
  const stripped = path.replace(/\/+$/, "");
  return stripped === "" ? "/" : stripped;
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState(() => normalize(window.location.pathname));

  useEffect(() => {
    const onPop = () => setPath(normalize(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    const next = normalize(to);
    if (next !== normalize(window.location.pathname)) window.history.pushState(null, "", next);
    setPath(next);
  }, []);

  const value = useMemo<RouterValue>(() => ({ path, navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error("useRouter must be used inside <RouterProvider>.");
  return value;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

/** A real <a href> (so it keeps its link role and accessible name) that routes client-side. */
export function Link({ to, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        navigate(to);
      }}
      {...rest}
    />
  );
}

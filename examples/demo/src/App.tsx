import { Link, useRouter } from "./router";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/NotFound";

const NAV = [
  { to: "/", label: "Dashboard", glyph: "◧" },
  { to: "/projects", label: "Projects", glyph: "▤" },
  { to: "/settings", label: "Settings", glyph: "⚙" },
];

function renderRoute(path: string) {
  switch (path) {
    case "/":
      return <Dashboard />;
    case "/projects":
      return <Projects />;
    case "/settings":
      return <Settings />;
    default:
      return <NotFound path={path} />;
  }
}

export function App() {
  const { path } = useRouter();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <span className="brand-name">Northwind</span>
        </div>

        {/* aria-label names the landmark, so a tour step can point at the whole sidebar. */}
        <nav className="nav" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-item${path === item.to ? " nav-item-active" : ""}`}
              aria-current={path === item.to ? "page" : undefined}
            >
              <span className="nav-glyph" aria-hidden="true">
                {item.glyph}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          <p className="kbd-hint">
            Press <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>/</kbd> to cycle aunboard modes.
          </p>
        </div>
      </aside>

      <main className="main">{renderRoute(path)}</main>
    </div>
  );
}

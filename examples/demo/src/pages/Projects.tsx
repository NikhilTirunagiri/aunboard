import { useMemo, useState } from "react";

interface Project {
  name: string;
  owner: string;
  status: "Active" | "Paused" | "Shipped";
  updated: string;
}

const PROJECTS: Project[] = [
  { name: "Billing webhooks", owner: "Ada Okonjo", status: "Active", updated: "12m ago" },
  { name: "Onboarding v2", owner: "Dana Reyes", status: "Active", updated: "2h ago" },
  { name: "Q3 pricing experiment", owner: "Ben Marchetti", status: "Paused", updated: "1d ago" },
  { name: "API gateway", owner: "Chidi Balogun", status: "Active", updated: "3h ago" },
  { name: "Design tokens", owner: "Ada Okonjo", status: "Shipped", updated: "6d ago" },
];

export function Projects() {
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return PROJECTS;
    return PROJECTS.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.owner.toLowerCase().includes(needle),
    );
  }, [filter]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="page-sub">Everything in flight across the workspace.</p>
        </div>
        <button className="btn btn-primary">New project</button>
      </header>

      <div className="toolbar">
        {/* A real <label for> means the input has an accessible name — which is what makes
            a tour step pointing at it survive redesigns of the surrounding markup. */}
        <label className="field-label" htmlFor="project-filter">
          Filter projects
        </label>
        <input
          id="project-filter"
          className="input"
          type="search"
          placeholder="Search by name or owner…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <span className="toolbar-count">
          {rows.length} of {PROJECTS.length}
        </span>
      </div>

      {/* aria-label="Projects" names the table. Without a name, a locator for a table would
          fall back to visible text or a positional index — both break the moment the data
          changes. This is the durable-locator guidance in practice. */}
      <div className="table-wrap">
        <table className="table" aria-label="Projects">
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col">Owner</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((project) => (
              <tr key={project.name}>
                <td className="cell-strong">{project.name}</td>
                <td>{project.owner}</td>
                <td>
                  <span className={`pill pill-${project.status.toLowerCase()}`}>{project.status}</span>
                </td>
                <td className="cell-muted">{project.updated}</td>
                <td className="cell-actions">
                  {/* Icon-only buttons need aria-label; the glyph is hidden from a11y. */}
                  <button className="btn-icon" aria-label={`Open ${project.name}`}>
                    <span aria-hidden="true">↗</span>
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="cell-empty">
                  No projects match “{filter}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

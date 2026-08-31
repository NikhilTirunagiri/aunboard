import { useState } from "react";

const STATS = [
  { label: "Active projects", value: "12", delta: "+2 this week" },
  { label: "Open tasks", value: "148", delta: "-9 vs. last week" },
  { label: "Deploys today", value: "7", delta: "all green" },
  { label: "Team members", value: "24", delta: "+1 this month" },
];

const ACTIVITY = [
  { who: "Ada Okonjo", what: "merged Rewrite billing webhooks", when: "12m ago" },
  { who: "Ben Marchetti", what: "opened Q3 pricing experiment", when: "1h ago" },
  { who: "Chidi Balogun", what: "deployed api-gateway to staging", when: "3h ago" },
  { who: "Dana Reyes", what: "closed 6 tasks in Onboarding v2", when: "yesterday" },
];

export function Dashboard() {
  const [created, setCreated] = useState(0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">Everything your team shipped, at a glance.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreated((n) => n + 1)}>
          Create project
        </button>
      </header>

      {created > 0 && (
        <p className="notice" role="status">
          {created === 1 ? "1 project" : `${created} projects`} created in this session. (Demo only —
          nothing is saved.)
        </p>
      )}

      {/* aria-label gives this row a stable accessible name, so a tour step can point at the
          whole region without depending on the numbers inside it. */}
      <section className="stats" aria-label="Key metrics">
        {STATS.map((stat) => (
          <article className="stat" key={stat.label}>
            <p className="stat-label">{stat.label}</p>
            <p className="stat-value">{stat.value}</p>
            <p className="stat-delta">{stat.delta}</p>
          </article>
        ))}
      </section>

      <section className="panel" aria-label="Recent activity">
        <h2>Recent activity</h2>
        <ul className="activity">
          {ACTIVITY.map((item) => (
            <li key={item.what}>
              <span className="avatar" aria-hidden="true">
                {item.who.charAt(0)}
              </span>
              <span className="activity-text">
                <strong>{item.who}</strong> {item.what}
              </span>
              <span className="activity-when">{item.when}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

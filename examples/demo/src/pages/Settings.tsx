import { useState } from "react";

export function Settings() {
  const [saved, setSaved] = useState(false);
  const [digest, setDigest] = useState(true);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="page-sub">Workspace preferences and notifications.</p>
        </div>
      </header>

      <form
        className="panel form"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
        }}
      >
        <h2>Workspace</h2>

        <div className="field">
          <label className="field-label" htmlFor="workspace-name">
            Workspace name
          </label>
          <input id="workspace-name" className="input" type="text" defaultValue="Northwind" />
          <p className="field-hint">Shown in the sidebar and on shared links.</p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="contact-email">
            Contact email
          </label>
          <input
            id="contact-email"
            className="input"
            type="email"
            defaultValue="ops@northwind.example"
          />
          <p className="field-hint">Where billing and incident notices go.</p>
        </div>

        <div className="field field-row">
          <div>
            <p className="field-label" id="digest-label">
              Weekly digest email
            </p>
            <p className="field-hint">A Monday summary of activity across every project.</p>
          </div>
          {/* role="switch" + aria-label: a toggle that is a real control, with a real name. */}
          <button
            type="button"
            role="switch"
            aria-checked={digest}
            aria-label="Weekly digest email"
            className={`switch${digest ? " switch-on" : ""}`}
            onClick={() => setDigest((on) => !on)}
          >
            <span className="switch-knob" aria-hidden="true" />
          </button>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit">
            Save changes
          </button>
          {saved && (
            <span className="notice notice-inline" role="status">
              Saved. (Demo only — nothing leaves the browser.)
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

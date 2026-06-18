# Integration prompt — add `aunboard` to a host app

A reusable, app-agnostic prompt for integrating aunboard with an AI coding agent.

**How to use:** open Claude Code (or your agent) in your host web app's repo and paste the entire
**Prompt** block below. The agent detects your framework/router/package manager, asks you the few
things it can't infer, then wires aunboard in, sets up recording, and verifies. It leans on the
canonical docs (`integration.md`, `authoring-tour-friendly-ui.md`) for detail.

---

## Prompt

```text
You are integrating the package aunboard into THIS web app. Work in this repo.

WHAT AUNBOARD IS
aunboard is a dev/staging React overlay that turns an app into a self-documenting one. It adds two
modes: "Explore" (floating badges with a label + description on recorded elements) and
"Walkthrough" (a spotlight tour that steps through them, navigating between pages). Authors create
tours by CLICKING elements in the running app — each click captures a durable DOM locator, so there
are NO source edits and NO data-explain attributes. A tour exports to a portable JSON that gets
committed to the repo and wired back in as the `tours` prop.

GROUND RULES
- Make minimal, idiomatic changes that match this repo's existing conventions; don't touch unrelated code.
- Detect what you can from the repo; ask me ONLY for what you genuinely can't infer (STEP 0).
- Keep the app building after each change. Run the repo's typecheck/build/lint at the end.
- Do not invent tour content or fake recordings — recording is something I do in the browser (STEP 4).

STEP 0 — detect & confirm (do this BEFORE editing)
Detect: framework (Next.js App Router / Next Pages / Vite+React / CRA / Remix / other), the router
library, the package manager (pnpm/npm/yarn/bun), TypeScript vs JS, and the single root layout/entry
where a provider should mount. Then ask me only for:
  a) Install source: (a) the public npm package `aunboard` (the default — `npm i aunboard`), or
     (b) a local path to a clone (file:...) if I'm developing aunboard alongside this app.
  b) Should aunboard run only in dev (default), or also in a staging/demo build?
Wait for my answers before making changes.

STEP 1 — install
Add aunboard as a dependency from the source in 0(a):
  - npm (default): `npm i aunboard` (or the repo's package manager — `pnpm add aunboard` /
    `yarn add aunboard`). Nothing else to configure.
  - local path: "aunboard": "file:<path-to-clone>/packages/aunboard" — its dist/ is gitignored,
    so build it first in the clone: `pnpm install && pnpm -r build`.
Install in THIS repo with its package manager. `react`/`react-dom` are PEER deps — do not add a
second copy.

STEP 2 — guarantee ONE React copy (or you'll hit "Invalid hook call")
  - Next.js: add "aunboard" to `transpilePackages` in next.config.*.
  - Vite: add `resolve.dedupe: ["react","react-dom"]`.
  - Other: ensure a single react/react-dom resolves (check with the PM's `why react`).

STEP 3 — mount the provider (a CLIENT component, once, near the root)
Create a small client component (e.g. AunboardMount) that wraps the app's children in
<LabelModeProvider> and mount it in the root layout/entry. Wire these props:
  - navigate: the app's client-side router push — Next App Router: (p) => useRouter().push(p) from
    next/navigation; Next Pages: next/router; React Router: useNavigate(); no router: omit it
    (aunboard falls back to the History API).
  - tours: import the committed tours object (start with {}).
  - record: { tour: { id, name } } — the tour you'll record into (dev-only).
Also add a DEV-ONLY "● Record / ■ Stop" toggle button that calls the provider's setMode and returns
null when process.env.NODE_ENV === "production". Use the exact provider/prop shape from the aunboard
docs (see REFERENCES).

STEP 4 — tell me how to record (don't do it yourself)
Once the app runs, explain to me:
  - Enter Record mode; ALT/Option-click an element to capture it; type a label (+ optional
    description); Save. Plain clicks still drive the app, so I can navigate between pages first.
  - The record panel flags any step with no stable name (⚠ "may break") — I should give that element
    a real accessible name and re-pick (see STEP 6).
  - For an element behind a TAB / ACCORDION / dropdown / anything that does NOT change the URL: reach
    it by PLAIN-clicking that control (let the click pass through — do NOT Alt-click/pick it), then
    Alt-click the target. aunboard captures the control as the step's `reveal` (an "Opens first:" chip)
    and re-opens it automatically at replay. Don't record the tab as its own step for this.
  - Click "Download JSON" to export <id>.tour.json.

STEP 5 — commit & wire the artifact
Put the exported JSON in the repo (e.g. src/tours/<id>.tour.json) and create a aunboard.tours module:
  import type { Tours } from "aunboard";
  import demo from "./src/tours/<id>.tour.json";
  export const tours: Tours = { <id>: demo };   // the map key MUST equal the tour's id
Pass `tours` into <LabelModeProvider>. (Until exported + committed, a recording lives only in my
browser's localStorage and is invisible to teammates.)

STEP 6 — make tours durable (important, do this proactively)
Tours re-find elements by locator; steps that fall back to visible text or sibling position drift and
silently disappear as the app changes. Nudge the app toward durable locators — these are ordinary
accessibility improvements, not aunboard-specific:
  - label every form input (<label for> / wrapping <label> / aria-label);
  - give icon-only buttons an aria-label;
  - give tables/sections/nav/regions an aria-label (or a <caption>/<legend>);
  - keep dynamic data (counts, money, dates) OUT of an element's accessible name.
Read the authoring guide (REFERENCES). If this repo has an agent rules file
(CLAUDE.md / .cursor/rules / AGENTS.md), append the drop-in rules block from that guide so future UI
stays tour-friendly.

STEP 7 — staging/prod gating (from 0(b))
aunboard is off in production by default (NODE_ENV === "production"). If I want it in staging, set
enabled={true} on the provider, gated behind an env flag (e.g. process.env.NEXT_PUBLIC_AUNBOARD === "on")
so it never reaches real production.

STEP 8 — verify & report
Run the repo's typecheck + build. Start the dev server and confirm: the bottom-left mode pill shows,
Cmd/Ctrl + / cycles Off → Explore → Walkthrough, Record mode opens the card on Alt-click, and — once a
tour is wired — Walkthrough resolves steps, including ones behind tabs via `reveal`. Summarize every
file you changed and list any follow-ups (e.g. elements that still lack an accessible name).

REFERENCES (read these from the aunboard package/repo if you can reach them — they are authoritative)
- docs/integration.md — full setup, provider props table, navigation wiring, SSR notes, troubleshooting.
- docs/authoring-tour-friendly-ui.md — writing components so tours stay durable + a drop-in rules block.
This prompt is the orchestration; those docs are the detail. Prefer them over assumptions.
```

---

For the underlying reference material the prompt points at, see
[integration.md](./integration.md) and [authoring-tour-friendly-ui.md](./authoring-tour-friendly-ui.md).

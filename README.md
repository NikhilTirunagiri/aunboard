# `aunboard`

[![npm](https://img.shields.io/npm/v/aunboard?color=cb3837&logo=npm)](https://www.npmjs.com/package/aunboard)
[![ci](https://github.com/NikhilTirunagiri/aunboard/actions/workflows/ci.yml/badge.svg)](https://github.com/NikhilTirunagiri/aunboard/actions/workflows/ci.yml)
[![provenance](https://img.shields.io/badge/provenance-attested-2ea44f?logo=github)](https://www.npmjs.com/package/aunboard#provenance)
[![license](https://img.shields.io/npm/l/aunboard?color=blue)](LICENSE)
[![bundle](https://img.shields.io/badge/runtime-7.6%20kB%20gzip-blue)](docs/production.md#2-what-ships-and-what-doesnt)

A React overlay that turns any app into a self-documenting one — in dev, in staging, and in production. It adds two modes:

- **Explore** — every recorded element gets a floating badge with a label + description.
- **Walkthrough** — a spotlight tour that steps through recorded elements one-by-one, navigating between pages automatically.

You author both by **clicking elements in your running app**. Each click captures a durable DOM **locator** — no source edits, no sidecar, no hand-written selectors. Tours export to a portable JSON file you **commit to your repo**, and CI replays them on every PR so a tour can't silently break.

Unlike hosted tour tools, your demos live in version control next to the code they describe. When a PR changes the UI, the PR that broke the tour is the PR that fails.

## Packages

| Package | Version | What it does |
|---|---|---|
| [`aunboard`](https://www.npmjs.com/package/aunboard) | [![npm](https://img.shields.io/npm/v/aunboard?label=)](https://www.npmjs.com/package/aunboard) | The runtime + the click-to-record studio |
| [`@aunboard/vite`](https://www.npmjs.com/package/@aunboard/vite) | [![npm](https://img.shields.io/npm/v/@aunboard/vite?label=)](https://www.npmjs.com/package/@aunboard/vite) | Stamps durable ids at build time (Vite) |
| [`@aunboard/next`](https://www.npmjs.com/package/@aunboard/next) | [![npm](https://img.shields.io/npm/v/@aunboard/next?label=)](https://www.npmjs.com/package/@aunboard/next) | Same, for Next.js (App + Pages router) |
| [`@aunboard/cli`](https://www.npmjs.com/package/@aunboard/cli) | [![npm](https://img.shields.io/npm/v/@aunboard/cli?label=)](https://www.npmjs.com/package/@aunboard/cli) | `aunboard verify` — replays tours in CI |
| [`@aunboard/plugin-core`](https://www.npmjs.com/package/@aunboard/plugin-core) | [![npm](https://img.shields.io/npm/v/@aunboard/plugin-core?label=)](https://www.npmjs.com/package/@aunboard/plugin-core) | Shared transform + id map (used by the adapters) |

Every package is published from CI with a [SLSA provenance attestation](https://slsa.dev/provenance/v1).

---

## Guides

- **[Integration prompt](docs/integration-prompt.md)** — paste-into-your-agent prompt to integrate aunboard into any app, hands-free.
- **[Integration guide](docs/integration.md)** — full host-app setup: install, mount, navigation, record, commit, staging.
- **[Example app](examples/demo)** — a runnable three-route app with a committed, CI-verified tour.
- **[Running in production](docs/production.md)** — shipping the overlay to real users: enabling it, the build plugin, CI verification, failure behaviour.
- **[Authoring tour-friendly UI](docs/authoring-tour-friendly-ui.md)** — write components so tours stay durable (and a drop-in rules block for your repo's `CLAUDE.md`).

The quick version follows below.

---

## Install

```bash
npm i aunboard      # or: pnpm add aunboard / yarn add aunboard
```

> **React must resolve to one copy** or you'll get "Invalid hook call" (`react`/`react-dom` are peer deps).
> **Next:** add `transpilePackages: ["aunboard"]` to `next.config.ts`. **Vite:** `resolve.dedupe: ["react", "react-dom"]`.

---

## Mount the provider

```tsx
// your-app/src/app/Aunboard.tsx
"use client";
import { useRouter } from "next/navigation";
import { AunboardProvider, useAunboard } from "aunboard";
import { tours } from "../../aunboard.tours"; // {} to start; import your exported tour later

export function Aunboard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <AunboardProvider
      tours={tours}
      navigate={(path) => router.push(path)}
      record={{ tour: { id: "demo", name: "Product Demo" } }}
    >
      {children}
      <RecordButton />
    </AunboardProvider>
  );
}

// A dev-only entry into Record mode (it's intentionally not in the keyboard cycle).
function RecordButton() {
  const { mode, setMode } = useAunboard();
  if (process.env.NODE_ENV === "production") return null;
  return (
    <button onClick={() => setMode(mode === "record" ? "off" : "record")}
            style={{ position: "fixed", bottom: 12, right: 12, zIndex: 99999 }}>
      {mode === "record" ? "■ Stop" : "● Record"}
    </button>
  );
}
```

Render `<Aunboard>` around your app in `layout.tsx`. That's the whole integration.

| prop | default | purpose |
|---|---|---|
| `tours?` | `{}` | imported tour collection for Explore/Walkthrough |
| `navigate?` | History API | `(path) => void` — wire your router for multi-page tours |
| `record?` | — | `{ tour: { id, name } }` — which tour to record into (dev-only) |
| `enabled?` | `NODE_ENV !== "production"` | force the overlay on/off (set `true` for staging demos) |
| `defaultMode?` | `"off"` | `"off" \| "explore" \| "walkthrough" \| "record"` |
| `persistProgress?` | `true` | resume Walkthrough position in localStorage |

---

## Record

1. Click **● Record**.
2. **Alt/Option-click** any element to pick it (plain clicks still navigate the app, so you can reach the next page first). Or use the **◎ Pick element** toggle in the step panel.
3. Type a **label** + **description** in the card → **Save step**. The host element never fires while picking.
4. Repeat across pages — each step remembers its route. Steps autosave to `localStorage`, so a reload resumes where you left off.
5. Click **Download JSON** to export the recording.

## Replay

Stop recording (■). Press **Cmd/Ctrl + /** to cycle **Off → Explore → Walkthrough → Off** (or use the bottom-left control). Recordings replay live from `localStorage` immediately — no export needed to preview.

---

## The exported JSON — your portable walkthrough

The downloaded JSON is the **portable, committable artifact** of a recording — a self-contained walkthrough you can save, share, and version-control.

**What's in it:** a single `Tour` object — the tour's `id` + `name`, and an ordered list of `steps`. Each step holds:
- a **locator** (the durable multi-signal way to re-find that element: role + accessible name, text, scope, nth),
- a **label** + **description** (what you typed),
- the **route** (which page the element is on).

It's wrapped in a small version envelope (`{ version: 1, tour: {...} }`).

**What you do with it:**
1. **Commit it to your repo.** Without exporting, a recording lives only in your browser's `localStorage` — it's gone if you clear storage and invisible to teammates. The JSON makes it permanent and shareable.
2. **Import it as the `tours` prop** on `AunboardProvider`. Then anyone who clones the repo gets the exact same Explore badges and Walkthrough tour — **no re-recording, no sidecar, no setup**.
3. **Replay it anywhere**, including staging/demo builds, because re-finding elements from locators needs no source edits or dev server.

In short: it's how a recording made by clicking around in your browser becomes a real, durable onboarding asset that travels with your codebase and works for everyone else.

```ts
// aunboard.tours.ts — wire the committed artifact in
import type { Tours } from "aunboard";
import demoTour from "./demo.tour.json";
export const tours: Tours = { demo: demoTour };
```

---

## How tours stay durable

Re-finding an element after the UI changed is the whole problem. aunboard resolves each step
through a ladder of signals, strongest first, and **refuses to guess** rather than highlight the
wrong element.

| # | Signal | Durability | Survives |
|---|---|---|---|
| 1 | `data-aun` — build-stamped from your committed tours | ~100% | copy edits, restyling, reordering, data changes |
| 2 | An existing hook (`data-explain`, `data-testid`, stable `id`) | ~100% | everything except deleting the attribute |
| 3 | ARIA role + accessible name | ~95% | restyling, reordering, data changes, **tag changes**, **shadow DOM** |
| 4 | Visible text, scoped ancestor, positional index | 60–80% | little — reported as not-found when it drifts |
| 5 | **Nothing matched → the step reports not-found** | — | — |

Tiers 1–3 also survive two things that break most tour tools: an element **changing tag**
(`<button>` → `<a role="button">` — the tag was only ever a fast prefilter, a named role is the
real identity) and living inside an **open shadow root** (Lit, Shoelace, Ionic). Both are
searched only after the direct match misses, so the common path stays fast. Neither widening
loosens the match itself — a named role must still match exactly, and ambiguity still fails.

Tier 5 is a feature. A missing step is a recoverable event a viewer understands; a confidently
**wrong** highlight is a lie that discredits every other step in the tour. aunboard captures a
structural CSS path but deliberately never falls back to it, and only trusts a positional index
when the candidate count is unchanged since recording.

Tiers 3–5 need nothing from your app. **Tier 1 is what takes you to 99.9%**, and it costs one
line in your build config.

### Tier 1: stamp stable IDs at build time

```ts
// vite.config.ts — Vite
import { aunboard } from "@aunboard/vite";

export default defineConfig({
  plugins: [react(), aunboard()],
});
```

```js
// next.config.mjs — Next.js (App or Pages router)
import { withAunboard } from "@aunboard/next";

export default withAunboard({ /* your next config */ });
```

> **Turbopack** (`next dev --turbo`) doesn't run webpack loaders, so stamping is skipped there
> with a warning — tours fall back to semantic locators and still work. Production builds are
> unaffected.

The plugin reads your **committed tours** and stamps `data-aun` onto only the elements those
tours actually reference — so a production build carries a handful of extra attributes, not
thousands. IDs are component-scoped (`PricingCard.b1`) and tracked in a committed
`aunboard.ids.json`, which re-matches them across file moves, component renames and reordering.

Your source files are never edited. The committed demo becomes the build contract.

### Verify tours in CI

```bash
pnpm aunboard verify --url http://localhost:4173 --reporter github
```

Replays every committed tour against a real build and exits non-zero when a step can no longer
resolve, annotating the PR with the tour, step and reason. Wire it up with the
[`verify-tours.yml`](.github/workflows/verify-tours.yml) workflow.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Invalid hook call" | Duplicate React — add `transpilePackages` (Next) / `resolve.dedupe` (Vite). |
| Nothing mounts in production | Expected by default. Set `enabled={true}` (or gate on an env flag) to ship the overlay. |
| A tour looks different for one teammate | They have a stale local recording. Recordings only override committed tours while authoring (`record` set, non-production build) — outside that, the committed tour always wins. |
| A step broke and CI didn't catch it | The tour isn't in the `verify` glob, or `verify-tours.yml` isn't wired to a real build of the app. |
| Badge/step missing at replay | The element's text or role changed since recording — Alt+click it again and re-save. |
| Step on a table/list/dynamic element keeps disappearing | Locators for elements with no stable name fall back to **visible text** or a **positional index** — both move when data changes, so the step reports not-found (by design, never a wrong-element guess). Fix: give the element a real accessible name (`aria-label` on a table/region, a `<label>` on an input) — aunboard reads those and the step becomes durable. See [Authoring tour-friendly UI](docs/authoring-tour-friendly-ui.md). |
| Walkthrough step times out | `navigate` not wired, or the step's `route` is wrong for that element. |

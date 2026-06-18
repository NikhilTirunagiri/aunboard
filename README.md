# `aunboard`

A dev/staging overlay that turns any React app into a self-documenting one. It adds two modes:

- **Explore** — every recorded element gets a floating badge with a label + description.
- **Walkthrough** — a spotlight tour that steps through recorded elements one-by-one, navigating between pages automatically.

You author both by **clicking elements in your running app**. Each click captures a durable DOM **locator** — no source edits, no sidecar, no `data-explain` attributes. Recordings live in `localStorage` and export to a portable JSON file you commit to your repo.

---

## Guides

- **[Integration prompt](docs/integration-prompt.md)** — paste-into-your-agent prompt to integrate aunboard into any app, hands-free.
- **[Integration guide](docs/integration.md)** — full host-app setup: install, mount, navigation, record, commit, staging.
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
// your-app/src/app/LabelMode.tsx
"use client";
import { useRouter } from "next/navigation";
import { LabelModeProvider, useLabelMode } from "aunboard";
import { tours } from "../../aunboard.tours"; // {} to start; import your exported tour later

export function LabelMode({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <LabelModeProvider
      tours={tours}
      navigate={(path) => router.push(path)}
      record={{ tour: { id: "demo", name: "Product Demo" } }}
    >
      {children}
      <RecordButton />
    </LabelModeProvider>
  );
}

// A dev-only entry into Record mode (it's intentionally not in the keyboard cycle).
function RecordButton() {
  const { mode, setMode } = useLabelMode();
  if (process.env.NODE_ENV === "production") return null;
  return (
    <button onClick={() => setMode(mode === "record" ? "off" : "record")}
            style={{ position: "fixed", bottom: 12, right: 12, zIndex: 99999 }}>
      {mode === "record" ? "■ Stop" : "● Record"}
    </button>
  );
}
```

Render `<LabelMode>` around your app in `layout.tsx`. That's the whole integration.

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
2. **Import it as the `tours` prop** on `LabelModeProvider`. Then anyone who clones the repo gets the exact same Explore badges and Walkthrough tour — **no re-recording, no sidecar, no setup**.
3. **Replay it anywhere**, including staging/demo builds, because re-finding elements from locators needs no source edits or dev server.

In short: it's how a recording made by clicking around in your browser becomes a real, durable onboarding asset that travels with your codebase and works for everyone else.

```ts
// aunboard.tours.ts — wire the committed artifact in
import type { Tours } from "aunboard";
import demoTour from "./demo.tour.json";
export const tours: Tours = { demo: demoTour };
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Invalid hook call" | Duplicate React — add `transpilePackages` (Next) / `resolve.dedupe` (Vite). |
| Nothing mounts in production | Expected. Set `enabled={true}` (or gate on an env flag) for staging demos. |
| Badge/step missing at replay | The element's text or role changed since recording — Alt+click it again and re-save. |
| Step on a table/list/dynamic element keeps disappearing | Locators for elements with no stable name fall back to **visible text** or a **positional index** — both move when data changes, so the step reports not-found (by design, never a wrong-element guess). Fix: give the element a real accessible name (`aria-label` on a table/region, a `<label>` on an input) — aunboard reads those and the step becomes durable. See [Authoring tour-friendly UI](docs/authoring-tour-friendly-ui.md). |
| Walkthrough step times out | `navigate` not wired, or the step's `route` is wrong for that element. |

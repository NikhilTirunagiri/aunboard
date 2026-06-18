# Integrating `aunboard` into a host app

End-to-end guide for wiring aunboard into a real React app — install, mount, record a
walkthrough, commit it, and ship it to staging/production. For *writing components* so tours
stay durable, see [Authoring tour-friendly UI](./authoring-tour-friendly-ui.md). To have an AI
agent do the integration for you, hand it the [integration prompt](./integration-prompt.md).

---

## 1. Prerequisites

- **React 18 or 19.** `react` / `react-dom` are peer deps.
- **One copy of React.** Duplicate React causes "Invalid hook call". See §3.
- A dev or staging build. By default the overlay is **off in production** (`NODE_ENV === "production"`).

---

## 2. Install

aunboard is published to the public **npm** registry:

```bash
npm i aunboard      # or: pnpm add aunboard / yarn add aunboard
```

`react` / `react-dom` are peer deps — do not add a second copy (see §3).

> **Contributing / working from a clone?** Point at the package folder directly and build it:
> ```jsonc
> // your-app/package.json
> "dependencies": { "aunboard": "file:<path-to-clone>/packages/aunboard" }
> ```
> ```bash
> cd <aunboard-clone> && pnpm install && pnpm -r build   # consumers import built dist/, not source
> cd your-app         && pnpm install
> ```

---

## 3. Bundler config (dedupe React)

**Next.js** (`next.config.ts`):
```ts
const nextConfig = { transpilePackages: ["aunboard"] };
export default nextConfig;
```

**Vite** (`vite.config.ts`):
```ts
export default defineConfig({ resolve: { dedupe: ["react", "react-dom"] } });
```

If you still hit "Invalid hook call", confirm a single React with
`npm ls react` / `pnpm why react`.

---

## 4. Mount the provider

aunboard's components use hooks, so the provider must live in a **client component**. Wrap your
app once, near the root.

```tsx
// your-app/src/app/AunboardMount.tsx
"use client";
import { useRouter } from "next/navigation";
import { LabelModeProvider, useLabelMode } from "aunboard";
import { tours } from "../../aunboard.tours"; // {} to start; wire your exported tour later

export function AunboardMount({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <LabelModeProvider
      tours={tours}
      navigate={(path) => router.push(path)}     // see §5
      record={{ tour: { id: "demo", name: "Product Demo" } }} // dev-only record target
    >
      {children}
      <RecordButton />
    </LabelModeProvider>
  );
}

// Dev-only entry into Record mode (intentionally NOT in the keyboard cycle).
function RecordButton() {
  const { mode, setMode } = useLabelMode();
  if (process.env.NODE_ENV === "production") return null;
  return (
    <button
      onClick={() => setMode(mode === "record" ? "off" : "record")}
      style={{ position: "fixed", bottom: 12, right: 12, zIndex: 99999 }}
    >
      {mode === "record" ? "■ Stop" : "● Record"}
    </button>
  );
}
```

```tsx
// your-app/src/app/layout.tsx
import { AunboardMount } from "./AunboardMount";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><AunboardMount>{children}</AunboardMount></body>
    </html>
  );
}
```

That's the whole integration. The bottom-left mode pill and the `Cmd/Ctrl + /` shortcut appear
automatically whenever aunboard is active.

### Provider props

| prop | default | purpose |
|---|---|---|
| `tours?` | `{}` | committed tour collection for Explore/Walkthrough |
| `navigate?` | History API | `(path) => void` — wire your router for multi-page tours |
| `record?` | — | `{ tour: { id, name } }` — which tour Record mode writes into (dev-only) |
| `enabled?` | `NODE_ENV !== "production"` | force the overlay on/off (set `true` for staging demos) |
| `defaultMode?` | `"off"` | `"off" \| "explore" \| "walkthrough" \| "record"` |
| `defaultTourId?` | first tour | which tour Walkthrough selects initially (must exist in `tours`) |
| `persistProgress?` | `true` | resume Walkthrough position from localStorage |
| `waitTimeout?` | `8000` | per-step wait-for-element timeout (ms) |

---

## 5. Wiring navigation (multi-page tours)

A step's `route` tells aunboard which page the element lives on; when a step's route differs from
the current path, aunboard calls your `navigate` before waiting for the element. Wire it to your
router so client-side nav (not a full reload) is used:

```tsx
// Next App Router
const router = useRouter();           // next/navigation
<LabelModeProvider navigate={(p) => router.push(p)} … />

// Next Pages Router
const router = useRouter();           // next/router
<LabelModeProvider navigate={(p) => router.push(p)} … />

// React Router
const navigate = useNavigate();
<LabelModeProvider navigate={(p) => navigate(p)} … />

// No router / plain app: omit `navigate` — aunboard falls back to History API + popstate.
```

If `navigate` isn't wired, single-page tours still work; multi-page steps will time out trying
to find an element that's on another route.

---

## 6. Record a walkthrough

1. Run the app in dev. Click **● Record**.
2. **Alt/Option-click** any element to pick it (plain clicks still drive the app, so you can
   navigate to the next screen first). Or toggle **◎ Pick element** in the step panel.
3. Type a **label** (required) + **description** (optional) → **Save step**. The host element
   never fires while picking.
   - If the step panel / card shows a **⚠ warning**, the captured locator is fragile (it relies
     on position or volatile text). Fix the element per the
     [authoring guide](./authoring-tour-friendly-ui.md) and re-pick — this is the moment to do it.
4. Repeat across pages; each step remembers its `route`. Steps autosave to `localStorage`
   (`lm:recording:<id>`), so a reload resumes.
   - **Behind a tab/accordion?** Just click the tab (a normal pass-through click) on your way
     to the element, then pick it. aunboard captures that click as the step's **reveal** (an
     "Opens first: …" chip on the card — removable) and re-opens it automatically at replay.
     See [Authoring tour-friendly UI](./authoring-tour-friendly-ui.md#elements-inside-tabs-accordions-or-modals).
5. Click **Download JSON** → `<id>.tour.json`.

Preview without exporting: stop recording, then `Cmd/Ctrl + /` cycles
**Off → Explore → Walkthrough → Off**. Recordings replay live from `localStorage`.

---

## 7. Commit the artifact and wire it as `tours`

The exported JSON is the portable, committable walkthrough. Until exported, a recording lives
only in your browser. Commit it into the **host app** repo:

```
your-app/
  aunboard.tours.ts
  src/tours/demo.tour.json   ← the exported artifact
```

```ts
// your-app/aunboard.tours.ts
import type { Tours } from "aunboard";
import demoTour from "./src/tours/demo.tour.json";

export const tours: Tours = { demo: demoTour };  // map key MUST equal demoTour.id
```

Now anyone who clones the repo gets the same Explore badges + Walkthrough — no re-recording.
Tours are validated at startup; an authoring mistake (mismatched id, missing label, empty
tour) throws loudly rather than failing silently.

> **Importing at runtime instead of build time?** `import { parseImportedFile } from
> "aunboard/record"` parses a user-selected `.tour.json` `File` into a validated `Tour`.

---

## 8. Show it in staging / production

The overlay is off in production by default. To run it in a **staging/demo** build:

```tsx
<LabelModeProvider enabled={true} defaultMode="explore" tours={tours} … />
```

Gate it on your own env flag so it never leaks into real prod:

```tsx
const showAunboard = process.env.NEXT_PUBLIC_AUNBOARD === "on";
<LabelModeProvider enabled={showAunboard} tours={tours} … />
```

When `enabled` is `false`, the provider renders children only — zero overlay, zero listeners,
and Record mode's code is never even imported (it's a dev-only dynamic import).

---

## 9. SSR / hydration notes

- The provider reads `localStorage` recordings **after mount** (in an effect), so the first
  client render matches the server — no hydration mismatch.
- Keep the provider in a `"use client"` component (it uses hooks and the History API).
- Walkthrough/Explore overlays render through `createPortal` into `document.body`, so they sit
  above your app regardless of stacking context.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| "Invalid hook call" | Duplicate React — add `transpilePackages` (Next) / `resolve.dedupe` (Vite). |
| Nothing mounts in production | Expected. Set `enabled={true}` (or an env flag) for staging. |
| A step shows ⚠ / disappears at replay | The element has no stable name; aunboard fell back to text/position. Give it an `aria-label` / `<label>` / `<caption>` per the [authoring guide](./authoring-tour-friendly-ui.md), then re-record that step. |
| Step behind a tab/accordion can't be found | The container doesn't change the URL, so route nav can't reach it. Re-record by clicking the tab on your way to the element (aunboard captures it as a `reveal`), or add the tab's locator to the step's `reveal` by hand. |
| Walkthrough step times out | `navigate` not wired, or the step's `route` is wrong for that element. |
| Tour throws at startup | Validation caught a bad artifact: the map key must equal `tour.id`, every step needs a non-empty `label`, and the tour needs ≥1 step. |

---

## 11. Uninstall

Remove `<AunboardMount>` and the dependency. To clear stored state, remove the
`lm:recording:*` and `label-mode:tour:*` keys from `localStorage` (a one-liner in the console:
`Object.keys(localStorage).filter(k => k.startsWith("lm:") || k.startsWith("label-mode:")).forEach(k => localStorage.removeItem(k))`).

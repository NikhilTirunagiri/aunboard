# aunboard example — Northwind

A small three-page React app (Vite + React 19 + TypeScript) that demonstrates
[`aunboard`](../../packages/aunboard) and doubles as the fixture CI replays committed tours
against.

It is deliberately plain: no UI framework, a ~40-line History-API router, and one CSS file.
The only thing it is opinionated about is **accessible names** — every button, input, toggle
and the projects table has a real one, which is what makes the committed tour durable.

---

## Run it

From the repo root:

```bash
pnpm install
pnpm -r build          # builds packages/aunboard first, which this example links to
pnpm --filter @aunboard/example-demo dev
```

Then open http://localhost:5173.

| script | what it does |
|---|---|
| `pnpm dev` | Vite dev server (Record mode available) |
| `pnpm build` | production build into `dist/`, plus `dist/projects/`, `dist/settings/` so a plain static host can serve the routes directly |
| `pnpm preview` | serve the production build — the overlay still works, because the provider sets `enabled` |
| `pnpm test` | replays every committed tour step against the rendered app (see below) |
| `pnpm typecheck` | `tsc --noEmit` |

---

## What to try

1. **Cycle the modes** — press **Cmd/Ctrl + /** (or use the pill in the bottom-left) to go
   **Off → Explore → Walkthrough → Off**.
   - **Explore** drops a labelled badge on every element in the tour that is on the current
     page. Change pages and the badges follow.
   - **Walkthrough** spotlights the six steps in order and **navigates between pages by
     itself** — that is `navigate` being wired into the provider in
     [`src/Aunboard.tsx`](src/Aunboard.tsx).
2. **Record your own tour** — click **● Record** (bottom-right, dev only), then
   **Alt/Option-click** any element to pick it, type a label + description, and **Save step**.
   Plain clicks still drive the app, so you can walk to another page and keep recording.
   Steps autosave to `localStorage` and replay immediately — no export needed to preview.
3. **Commit it** — **Download JSON** and drop the file in [`tours/`](tours). It is picked up by
   [`src/aunboard.tours.ts`](src/aunboard.tours.ts) and becomes what everyone else sees.

---

## The integration, in full

[`src/Aunboard.tsx`](src/Aunboard.tsx) is the entire wiring:

```tsx
<AunboardProvider
  tours={tours}                                        // committed tours/demo.tour.json
  navigate={(path) => navigate(path)}                  // this app's router
  record={{ tour: { id: "demo", name: "Product Demo" } }}
  enabled                                              // forced on so the prod build demos too
>
  {children}
  <RecordButton />
</AunboardProvider>
```

Two things worth copying:

- **`resolve.dedupe: ["react", "react-dom"]`** in [`vite.config.ts`](vite.config.ts). `aunboard`
  takes React as a peer dependency; two copies of React means "Invalid hook call".
- **`enabled`** is set here only because this app *is* the demo. In a real product, leave it
  unset (dev-only) or gate it on a staging env flag.

---

## Authoring tour-friendly UI

Locators are captured from what the browser can already see: a role plus an accessible name.
Give an element a real name and its step never moves. Examples in this app:

| element | what makes it durable |
|---|---|
| the projects table | `aria-label="Projects"` — without it, a locator falls back to visible text or a row index, both of which change with the data |
| the filter box | `<label for="project-filter">Filter projects</label>` |
| the settings toggle | `role="switch"` + `aria-label="Weekly digest email"` |
| the stats row | `<section aria-label="Key metrics">` — names the whole region, independent of the numbers inside |
| the row action buttons | `aria-label="Open <project>"` on the icon-only button |

Full guidance: [docs/authoring-tour-friendly-ui.md](../../docs/authoring-tour-friendly-ui.md).

---

## How the committed tour is verified

[`tours/demo.tour.json`](tours/demo.tour.json) is a normal exported recording — the
`{ "version": 1, "tour": { ... } }` envelope the recorder produces. Its six steps span all
three routes and every locator is a hand-written **role + accessible name** match (no `nth`,
no text-only matching).

It is checked twice:

1. **`pnpm test`** (this package) renders the real app into jsdom, one route at a time, and
   resolves every step with aunboard's own `resolveLocator`, asserting each finds **exactly
   one** element. It also fails the build if a step ever creeps in without a role + name, or
   with a positional `nth`. This runs as part of `pnpm -r test` at the repo root.
2. **`aunboard verify`** ([`.github/workflows/verify-tours.yml`](../../.github/workflows/verify-tours.yml))
   replays the same file in headless Chromium against the **production build**, navigating to
   each step's route for real:

   ```bash
   pnpm --filter @aunboard/example-demo build
   npx http-server ./examples/demo/dist -p 4173 --silent &
   pnpm exec aunboard verify --url http://127.0.0.1:4173 --tours "examples/demo/tours/*.tour.json"
   ```

   ```
   demo — Product Demo  (examples/demo/tours/demo.tour.json)
     OK        1. Key metrics  /
     OK        2. Create a project  /
     OK        3. Filter projects  /projects
     OK        4. The projects table  /projects
     OK        5. Workspace name  /settings
     OK        6. Save changes  /settings

   1 tour, 6 steps: 6 passed, 0 failed
   ```

A step that can no longer find its element fails the pull request — which is the whole point:
a tour that rots is caught at review time instead of in front of a new hire.

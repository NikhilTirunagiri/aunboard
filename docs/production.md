# Running aunboard in production

aunboard was originally a dev-only overlay. As of 0.3 it is built to ship. This guide covers
what changes when real users see it, and how to reach the reliability that makes that sensible.

---

## 1. Turn it on deliberately

The overlay is off in production by default. That default is correct — it means an accidental
deploy never surprises your users. Opt in explicitly:

```tsx
<AunboardProvider
  tours={tours}
  navigate={(path) => router.push(path)}
  enabled={process.env.NEXT_PUBLIC_AUNBOARD === "1"}
>
```

Gating on an env var rather than hardcoding `true` lets you enable it per environment —
staging on, production off — without a code change.

**Do not pass `record` in a production build.** `record` marks a session as *authoring*, which
is what allows a local recording to override the committed tour. In a delivery build you want
the committed tour to win, always. aunboard enforces this (the merge is gated on
`NODE_ENV !== "production"` too), but leaving `record` out makes the intent obvious.

---

## 2. What ships, and what doesn't

| Import | Ships to users | Size (gzip) | Purpose |
|---|---|---|---|
| `aunboard` | yes | **7.6 kB** entry + 4.0 kB shared chunk, zero runtime deps | Explore + Walkthrough replay |
| `aunboard/studio` | no — lazy chunk, never fetched in production | 5.0 kB | the recorder |

Measured from the published tarball. The recorder's code (`OverlayCard`, `StepList`, the
session reducer) does not appear in the main entry at all — the provider reaches it through a
dynamic `import("./record/index.js")`, so your bundler emits it as a separate chunk that a
production build never requests.

The recorder is never in your production bundle. The provider imports it lazily and only when
record mode is entered outside production, so bundlers drop it from the production graph.

---

## 3. Get to tier 1 with the build plugin

Locators built from role, name and text resolve correctly the overwhelming majority of the
time, but they are describing *rendered output* — so a copy change or a data change can move
them. For production tours, stamp build-time IDs instead:

```ts
// vite.config.ts
import { aunboard } from "@aunboard/vite";

export default defineConfig({
  plugins: [react(), aunboard()],
});
```

What this does:

1. Reads your committed tours (`./tours/*.tour.json` by default).
2. Works out which elements those tours reference.
3. Stamps `data-aun="Component.b1"` onto **only those elements**, at build time.
4. Maintains `aunboard.ids.json`, which re-matches IDs across file moves, component renames and
   reordering — so ordinary refactoring does not break a tour.

Your source files are not modified. In dev the plugin stamps everything (so you can record
against any element); in a production build it stamps only what the committed tours use.

**Commit `aunboard.ids.json`.** It is the mapping that makes IDs survive refactors; without it
in version control, IDs are only stable within a single machine's build.

---

## 4. Verify on every PR

This is the part that actually delivers the reliability promise. Locator cleverness has a
ceiling; catching breakage at review time does not.

```bash
aunboard verify --url http://127.0.0.1:4173 --reporter github
```

It launches headless Chromium, walks every step of every committed tour — navigating routes and
running `reveal` clicks exactly as the runtime does — and exits non-zero if any step cannot
resolve. `--reporter github` annotates the PR inline with the tour, step label and reason.

Copy [`.github/workflows/verify-tours.yml`](../.github/workflows/verify-tours.yml) into your app
and point it at a real build.

---

## 5. Failure behaviour with real users

- A step that cannot resolve shows a "couldn't find this on this screen" card with **Skip** and
  **Close**. The tour continues; it never dead-ends.
- aunboard never highlights a best-guess element. If it is not confident, it says so.
- Nothing is sent anywhere. Tours are static JSON in your bundle; progress is `localStorage` on
  the viewer's own device. There is no network call, no third-party script, and no cookie — so
  there is nothing to disclose in a consent banner.

---

## 6. Verifying an app behind a login

`aunboard verify` drives a real browser, so an authenticated app needs a session. Two ways:

```bash
# Cookies + localStorage from a logged-in session
aunboard verify --url $URL --storage-state .auth/state.json

# Or a token, if your app authenticates by header
aunboard verify --url $URL --header "Authorization: Bearer $CI_TOKEN"
```

Produce the storage state once with a small Playwright script that logs in and calls
`context.storageState({ path: ".auth/state.json" })`. Generate it in CI against a seeded test
account — don't commit it, it's a live session.

### Routes with runtime ids

A tour authored against one workspace can't hardcode that workspace's id. Put a token in the
route and supply it at verify time:

```json
{ "route": "/workspace/:ws/project/:proj/pipeline", "label": "…" }
```

```bash
aunboard verify --url $URL --var ws=$SEED_WS --var proj=$SEED_PROJ
```

Both `:name` and `{name}` work. An unsupplied token is left in the URL rather than blanked, so
the resulting 404 names the variable you forgot instead of silently checking the wrong page.

---

## 7. Touring a permissioned app

If steps point at features some viewers can't access, **filter the step list before handing it to
aunboard** — use your app's own capability checks:

```tsx
const steps = allSteps.filter((s) => can(user, s.capability));
<AunboardProvider tours={{ demo: { ...tour, steps } }} … />
```

Without this, a viewer who lacks a permission hits an element that will never appear. Each such
step burns the full `waitTimeout` (8s by default) and then shows the "couldn't find it" card —
so three gated steps in a row means 24 seconds of nothing before the tour becomes useful.

aunboard can't do this filtering for you: it has no model of your permissions, and guessing
would mean hiding steps that are merely slow to load. Lowering `waitTimeout` reduces the sting
but doesn't fix it — the step still shouldn't be there.

A filtered tour is also why one committed JSON may not be right for every viewer. Commit the
**full** tour (so `verify` checks every step against a fully-privileged seed account), and filter
at runtime for the viewer in front of you.

---

## 8. Checklist

- [ ] `enabled` gated on an env var
- [ ] no `record` prop in the production build
- [ ] tours committed under `tours/`
- [ ] `@aunboard/vite` in the build config
- [ ] `aunboard.ids.json` committed
- [ ] `verify-tours.yml` running on PRs against a real build
- [ ] authenticated app? `--storage-state` or `--header` wired in CI
- [ ] routes with runtime ids? tokens in the route, `--var` in CI
- [ ] permissioned app? steps filtered by capability at runtime
- [ ] every tour step rated **stable** at record time (fix the weak ones before shipping)

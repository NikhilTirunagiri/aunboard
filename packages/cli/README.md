# @aunboard/cli

CI guard for [aunboard](https://github.com/NikhilTirunagiri/aunboard) tours.

Tours are recorded by clicking around your running app, and every step stores a durable DOM
**locator** — a hook attribute, an ARIA role plus accessible name, normalized visible text,
an optional ancestor scope, an `nth` disambiguator. That's what makes a tour survive a
refactor. But when the UI changes enough, a step's element stops resolving and the tour
breaks *silently*: nobody finds out until a new hire runs the walkthrough and it dead-ends.

`aunboard verify` catches that in CI. It loads your committed `*.tour.json` files, opens the
app in headless Chromium, and replays each step's locator — same navigation, same `reveal`
clicks, same resolution algorithm as the runtime. If a step no longer resolves, the command
exits `1` and tells you exactly which signal it was looking for and how many elements matched.

**The resolution code is not reimplemented here.** The browser bundle this CLI injects is
built from the runtime's own `resolveLocator` / `matchElements` / `resolveLocatorWhenReady` /
`activateElement` source. CI and replay cannot disagree.

## Install

```bash
npm i -D @aunboard/cli playwright
npx playwright install chromium
```

Playwright is an **optional peer dependency** — you install it, so the CLI itself stays
light. If it's missing, the command fails immediately with the two lines above.

Requires Node >= 18.

## Usage

```bash
# Start your app first (dev server, preview build, staging URL — anything reachable).
npx aunboard verify --url http://localhost:3000
```

### Flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `--url <url>` | *(required)* | Base URL of the running app. Must be `http:` or `https:`. Each step is checked at `url + step.route`. |
| `--tours <glob>` | `./tours/*.tour.json` | Tour files to verify. Repeatable. Supports `*`, `**`, `?`, or a plain file path. `node_modules`, `.git`, `dist`, `build`, `coverage` are never searched. |
| `--timeout <ms>` | `8000` | How long to wait for each element (and each `reveal` element) to appear — same default as the runtime's own wait. Navigation gets at least 30s. |
| `--reporter <name>` | `pretty` | `pretty`, `json`, or `github`. |
| `--json` | | Shorthand for `--reporter json`. Wins if both are given. |
| `-h`, `--help` | | Show help. |
| `-v`, `--version` | | Show the version. |

Quote globs so your shell doesn't expand them:

```bash
npx aunboard verify --url http://localhost:3000 --tours "src/**/*.tour.json"
```

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Every step of every tour resolved. |
| `1` | At least one step failed to resolve, a tour file was unparseable, no tour files matched, the arguments were invalid, or Playwright is missing. |

### What each step check does

For every step, in order, mirroring the runtime tour controller exactly:

1. **Navigate** to `url + step.route`, but only if `route` is set and differs from the page's
   current path.
2. **Reveal** — if the target isn't already visible, resolve and activate each `step.reveal`
   locator in order (the tab or accordion that holds the target without changing the URL).
3. **Resolve** `step.locator`, waiting up to `--timeout` for async-mounted elements.

Each step comes back as one of:

| Status | Meaning |
| --- | --- |
| `OK` | Exactly one element resolved. |
| `NOT FOUND` | Zero candidates, a `reveal` that couldn't be resolved, or an `nth` whose candidate count changed (the engine refuses to trust a stale index). |
| `AMBIGUOUS` | More than one element matched and the locator has no `nth` to disambiguate — the engine will not guess. |
| `ERROR` | The check couldn't run: navigation failed, or the tour file couldn't be parsed. |

Tour files are validated with the recorder's own rules: the envelope must be
`{ "version": 1, "tour": { ... } }`, every step needs a `label`, a `description` and a
structurally valid `locator` (recursively, including `scope` and every `reveal`).

## Example output

### Success

```text
$ npx aunboard verify --url http://localhost:3000
aunboard verify — http://localhost:3000

new-engineer — New Engineer Onboarding  (tours/new-engineer.tour.json)
  OK        1. Refresh  /dashboard
  OK        2. Save profile  /settings

1 tour, 2 steps: 2 passed, 0 failed
All tour steps resolved.
```

Exit code `0`.

### Failure

```text
$ npx aunboard verify --url http://localhost:3000
aunboard verify — http://localhost:3000

new-engineer — New Engineer Onboarding  (tours/new-engineer.tour.json)
  NOT FOUND 1. Missing hook  /dashboard
             expected hook [data-tour-id="gone-forever"]; found 0 candidates
             candidates found: 0
  AMBIGUOUS 2. Row action  /settings
             expected text "Duplicate" but 2 elements matched and the locator has no "nth" to disambiguate
             candidates found: 2
  NOT FOUND 3. Save profile  /settings
             reveal 0 (role "button" named "Advanced") could not be resolved, so the target was never revealed; expected role "button" named "Save profile"
             candidates found: 1

1 tour, 3 steps: 0 passed, 3 failed
Some tour steps no longer resolve.
```

Exit code `1`.

### `--reporter github`

Emits GitHub Actions workflow commands, so each broken step is annotated on the file in the PR:

```text
::error file=tours/new-engineer.tour.json,title=aunboard tour "new-engineer" step 1::NOT FOUND: tour "new-engineer" step 1 ("Missing hook") on route /dashboard — expected hook [data-tour-id="gone-forever"]; found 0 candidates [candidates: 0]
::error::aunboard verify: 3 of 3 tour steps failed to resolve.
```

### `--json`

```json
{
  "ok": false,
  "tours": [
    {
      "id": "new-engineer",
      "name": "New Engineer Onboarding",
      "file": "tours/new-engineer.tour.json",
      "steps": [
        {
          "index": 0,
          "label": "Missing hook",
          "route": "/dashboard",
          "status": "not-found",
          "reason": "expected hook [data-tour-id=\"gone-forever\"]; found 0 candidates",
          "candidateCount": 0,
          "expected": "hook [data-tour-id=\"gone-forever\"]"
        }
      ]
    }
  ],
  "summary": { "total": 1, "passed": 0, "failed": 1 }
}
```

`status` is one of `ok`, `not-found`, `ambiguous`, `error`. A tour whose file failed to parse
appears with an `error` field and no steps, and counts as one failure in `summary`.

## CI

```yaml
name: tours

on: [pull_request]

jobs:
  verify-tours:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: npm ci
      - run: npx playwright install --with-deps chromium

      - run: npm run build
      - run: npx serve -l 3000 dist &
      - run: npx wait-on http://localhost:3000

      # Annotations land inline on the changed files in the PR.
      - run: npx aunboard verify --url http://localhost:3000 --reporter github
```

Point `--url` at whatever you already run in CI — a dev server, a preview build, or a
deployed staging environment.

## Development

```bash
pnpm build      # emits dist/cli.js (Node ESM + shebang) and dist/inject.global.js (browser IIFE)
pnpm test       # vitest, no browser required — the page driver is mocked
pnpm typecheck  # tsc --noEmit
```

`dist/inject.global.js` is the browser-injectable locator engine. It must exist for
`verify` to run; the CLI fails with an actionable message if it's missing.

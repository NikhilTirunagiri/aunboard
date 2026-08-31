# Changelog

All notable changes to `aunboard` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [0.3.0] — 2026-08-31

The production-readiness release. aunboard moves from "dev overlay" to something you can ship,
version-control, and verify in CI.

### Added
- **Build-stamped locators.** `data-aun` is now the highest-priority locator signal, above
  `data-explain`/`data-testid`. It is written at build time by `@aunboard/vite` from your
  committed tours, so it survives copy edits, restyling, reordering and data changes.
- **Numeric durability scoring** (`locator/score.ts`), adapted from Playwright's
  `selectorGenerator`. Every locator gets a score (lower is better) that drives the record-time
  durability warning and lets CI rank the weakest steps in a tour.
- **`@aunboard/cli`** — `aunboard verify` replays committed tours headlessly and fails CI when a
  step can no longer find its element.
- **`@aunboard/vite` / `@aunboard/next` / `@aunboard/plugin-core`** — build-time ID stamping and
  the `aunboard.ids.json` map, which re-matches IDs across file moves, component renames and
  reordering. The Next adapter is a `withAunboard()` config wrapper backed by a webpack loader;
  Turbopack is detected and warns rather than failing.
- **`examples/demo`** — a runnable three-route example app with a committed, CI-verified tour.
- **`ci.yml`** — typecheck, test and build now run on every push and PR, not only on release tags.
- `./studio` export alias for the recorder (`./record` still works).

### Changed
- **BREAKING (pre-1.0): the public API is named after the package.** `LabelModeProvider` →
  `AunboardProvider`, `useLabelMode` → `useAunboard`, `LabelMode` → `AunboardMode`,
  `isLabelModeEnabled` → `isAunboardEnabled`. The old names remain exported as deprecated
  aliases and will be removed in 1.0.
- The recording `localStorage` key moved from `lm:recording:` to `aun:recording:`. The legacy
  key is still read (never written) so a recording in flight is not lost.

### Fixed
- **Locators are no longer coupled to the recorded tag.** A step recorded on a `<button>` that
  becomes an `<a role="button">` (or a styled `<div>`) now still resolves: the tag is a fast
  prefilter, and a role *with an accessible name* is the real identity. Widening is deliberately
  refused for a bare role or for text-only locators, which match far too broadly.
- **Elements inside open shadow roots resolve.** `querySelectorAll` does not cross shadow
  boundaries, so any web-component library (Lit, Shoelace, Ionic) was previously invisible.
  Walked only as a last resort. Closed roots remain unreachable and correctly report not-found.
- **Tour artifacts have a version migration path.** `parseTour` previously threw on any version
  but 1, so a future format change would have broken every committed tour. Older artifacts now
  migrate forward; a *newer* artifact is refused with an actionable message rather than being
  partially understood.
- A malformed locator selector returns no matches instead of throwing mid-resolve.
- **localStorage recordings no longer override committed tours outside an authoring session.**
  Previously a recording in a visitor's own browser silently replaced the committed tour in any
  build with the overlay enabled — including the staging/demo builds the docs recommend. The
  merge is now gated on `record` being configured in a non-production build.

## [0.2.0]
- Initial public release: Explore badges, Walkthrough tours, click-to-record authoring, durable
  multi-signal locators, portable tour JSON.

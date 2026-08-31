# Contributing to aunboard

## Setup

```bash
pnpm install
pnpm -r build
pnpm -r test
```

Node >= 18, pnpm (the version is pinned via `packageManager`).

## Layout

| Path | What it is |
|---|---|
| `packages/aunboard` | The runtime + studio (recorder). Ships to npm as `aunboard`. |
| `packages/plugin-core` | Bundler-agnostic JSX transform + the `aunboard.ids.json` map. |
| `packages/vite` | Vite adapter over `plugin-core`. |
| `packages/cli` | `aunboard verify` — headless tour replay for CI. |
| `examples/demo` | Runnable example app + a committed, CI-verified tour. |

## The one rule that matters

**Never resolve a locator to an element you are not confident about.** A step that reports
"not found" is a recoverable UX event the user understands. A step that confidently highlights
the *wrong* element is a lie, and it destroys trust in every other step in the tour.

This is why `resolveLocator` deliberately refuses to fall back to the structural CSS path it
captured, and why `nth` is only trusted when the candidate count is unchanged since recording.
If you are adding a resolution strategy, it must fail closed.

## Tests

Every change needs tests. `pnpm -r test` must pass, and so must `pnpm -r typecheck`.

Locator changes specifically need a test showing the locator still resolves after the kind of
change it claims to survive — a copy edit, a reorder, a restyle, a data change.

## Releasing

See [RELEASING.md](RELEASING.md). Bump the version, tag `vX.Y.Z`, push — CI publishes to npm
with provenance.

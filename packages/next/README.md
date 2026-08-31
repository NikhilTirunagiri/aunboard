# @aunboard/next

Next.js config wrapper that stamps stable `data-aun` ids onto exactly the JSX
elements your committed [aunboard](../aunboard) tours reference — at build time,
with no source edits in your app.

```sh
npm install --save-dev @aunboard/next
```

```js
// next.config.mjs
import { withAunboard } from "@aunboard/next";

export default withAunboard({
  reactStrictMode: true,
});
```

That's the whole integration. Node >= 18, Next >= 13 (a peer dependency), App
Router and Pages Router alike.

> **Turbopack:** `next dev --turbopack` and `next build --turbopack` do not run
> webpack loaders, so stamping is skipped there. See
> [Turbopack](#turbopack) below — this is the one limitation worth reading
> before you adopt this package.

## What problem this solves

An aunboard tour step stores an `ElementLocator` — a multi-signal description of
a DOM element: an explicit hook, an ARIA role plus accessible name, visible text,
a scoping ancestor, a positional index. At replay time the locator has to find
that element again in a UI that has moved on.

Every signal except the first is a guess about a UI that keeps changing.
"Buy now" becomes "Get started". The third button becomes the fourth. A wrapper
`<div>` appears and the scoping ancestor shifts. Each of those quietly breaks a
tour, or — worse — quietly points it at the *wrong* element, which is a tour that
confidently walks a new hire into the wrong button.

`data-aun` is the one signal that can't rot, because the build put it there on
purpose, and it's aunboard's highest-priority hook. Stamped elements resolve on
the first, most robust signal every time.

## Why only tour-referenced elements

Stamping every DOM node in production would be real bytes on a page that has no
use for almost any of them, and it publishes your component tree to anyone who
opens devtools. So the wrapper runs two ways:

- **`next dev`** — `stampAll` defaults to `true`. Every host element carries an
  id, because the recorder needs you to be able to click anything.
- **`next build`** — `stampAll` defaults to `false`. It reads your committed tour
  files and stamps only the ids those tours actually reference: usually a few
  dozen attributes, not tens of thousands.

Both the App Router and the Pages Router are covered: this is a file transform,
not a routing integration, so it does not care which directory your components
live in. Server Components, Client Components and `pages/` files all go through
the same loader.

## Durability across refactors

Ids are `<ComponentName>.<tagInitial><ordinal>` — `PricingCard.b1` is the first
`<button>` in `PricingCard`. That's a *default name*, not the identity. The
identity is a **fuzzy signature**: tag + sorted attribute names + the element's
own static text, hashed. No line numbers, no columns, no attribute values, no
whitespace.

Once per compilation the wrapper re-locates each known id in the current source:

| what you did | what happens |
| --- | --- |
| reformatted the file, added imports above | id kept |
| moved the component to another file | id kept, `file` updated |
| renamed the component | id kept, `component` updated |
| reordered the buttons | id kept — it follows the signature, not the position |
| deleted the element | **build fails**, loudly, naming the tour and step |

That last row is the point. When a committed tour references an id that can't be
matched to any element in the source, the build fails:

```
[aunboard] 1 tour reference(s) point at an element that no longer exists:
  - "PricingCard.b1" referenced by tour "New Engineer Onboarding" (new-engineer), step "Start here"
    in /app/tours/new-engineer.tour.json

Ids in aunboard.ids.json that no longer match any element: PricingCard.b1

The element was deleted or changed enough that its signature no longer matches.
Re-record the step, or restore the element. aunboard will not guess a
replacement: pointing a tour at the wrong element is worse than failing the
build.
```

It never guesses a replacement, and never silently drops the id. During
`next dev` this is logged as an error rather than thrown, so a broken tour
doesn't take your dev server down — nothing is shipping from a dev server anyway.

## Usage

### App Router

```js
// next.config.mjs
import { withAunboard } from "@aunboard/next";

export default withAunboard({
  experimental: { typedRoutes: true },
});
```

Default source globs already cover `app/`, `src/`, `pages/` and `components/`, so
`app/`-at-the-root and `src/app/` layouts both work untouched.

### Pages Router

Identical — there is nothing router-specific to configure:

```js
// next.config.js
const { withAunboard } = require("@aunboard/next");

module.exports = withAunboard({ reactStrictMode: true });
```

### A config that is already a function

Next's `(phase, { defaultConfig }) => config` form is wrapped in place, and your
function still receives the phase and context Next passes:

```js
// next.config.mjs
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { withAunboard } from "@aunboard/next";

export default withAunboard((phase) => ({
  reactStrictMode: phase === PHASE_DEVELOPMENT_SERVER,
}));
```

### A config that already has a `webpack` function

Yours is kept. aunboard registers its loader first, then calls your function with
that config and returns whatever you return — you have the last word:

```js
export default withAunboard({
  webpack(config, context) {
    config.resolve.alias["@"] = "./src";
    return config; // aunboard's rule is already in here
  },
});
```

### TypeScript config

```ts
// next.config.ts
import type { NextConfig } from "next";
import { withAunboard } from "@aunboard/next";

const config: NextConfig = { reactStrictMode: true };

export default withAunboard(config);
```

`withAunboard` returns the same type it was given, so the export stays a
`NextConfig`.

## Options

```ts
withAunboard(nextConfig, {
  tours: "./tours/*.tour.json",                   // glob(s) for committed tour files
  idMap: "./aunboard.ids.json",                   // the committed id map
  src: "{app,pages,src,components}/**/*.{jsx,tsx}", // glob(s) of source to scan
  stampAll: undefined,                            // default: true in dev, false in build
  include: /\.[jt]sx$/,                           // modules to transform
  exclude: /node_modules/,                        // modules to skip
  attr: "data-aun",                               // attribute to stamp
  write: true,                                    // write back aunboard.ids.json when it changed
  failOnMissing: undefined,                       // default: true in build, false in dev
  logger: console,                                // where diagnostics go
});
```

| option | default | notes |
| --- | --- | --- |
| `tours` | `"./tours/*.tour.json"` | string or array of globs, relative to the project root |
| `idMap` | `"./aunboard.ids.json"` | relative to the project root; created on first run |
| `src` | `"{app,pages,src,components}/**/*.{jsx,tsx}"` | what the once-per-compilation pass scans to discover elements — and what scopes the webpack rule |
| `stampAll` | `dev` | stamp every host element instead of only tour-referenced ones |
| `include` / `exclude` | `.jsx`/`.tsx`, not `node_modules` | RegExp or glob string, or an array of either |
| `attr` | `"data-aun"` | change only if you've also changed aunboard's hook attribute |
| `write` | `true` | set `false` in CI if you want the id map treated as read-only |
| `failOnMissing` | `!dev` | set `true` to fail the dev server too |
| `logger` | `console` | anything with `info` / `warn` / `error` |

Unlike `@aunboard/vite`, `src` defaults to four directories rather than `src/`:
Next has no single conventional source root, and an App Router project usually
keeps `app/` at the repository root.

## How it works

Next compiles with SWC and has no per-file JavaScript transform hook, so this
package integrates the way every other Next plugin does — through the webpack
config:

1. `withAunboard` returns a copy of your config with a `webpack` function that
   registers two things and then defers to yours.
2. A **webpack plugin** tapped into `beforeCompile` does the `buildStart` work
   **once per compilation**: glob the tours, glob and parse the source, re-match
   every known id, write `aunboard.ids.json`, log a one-line summary, and throw
   when a production build's tours point at elements that are gone. Next's
   client, server and edge compilers share one instance, so a build round does
   this once, not three times.
3. A **`pre` loader** on `.jsx`/`.tsx` under `src` reads the result and stamps
   each module. `pre` means it runs before Next's SWC pass, so it sees your
   original JSX rather than compiled `_jsx()` calls. Edits are surgical
   insertions (magic-string), and the loader always hands webpack a sourcemap, so
   stack traces and breakpoints still land on your real source.

The loader declares your tour files as build dependencies, so editing a tour
invalidates webpack's cache for the modules it affects rather than serving a
stale stamp.

If you build your own webpack config elsewhere and want only the rule, the
loader's absolute path is exported (and published as the `@aunboard/next/loader`
subpath), so you can register it yourself:

```js
import { LOADER_PATH, StampRunner, AunboardWebpackPlugin } from "@aunboard/next";
```

## Turbopack

`next dev --turbopack` and `next build --turbopack` run Turbopack, which does not
execute webpack loaders. There is no supported way to run a JavaScript transform
in Turbopack today — it would need a Rust/WASM SWC plugin, which this package
does not ship.

So under Turbopack the wrapper prints one warning and gets out of the way:

```
[aunboard] Turbopack is active, so build-time stamping is skipped: Turbopack does not
run webpack loaders, and a Rust/WASM SWC plugin is not part of this package yet. Your
app still works and tours still replay — but without data-aun stamps they fall back to
their semantic locators (role + accessible name, text, scope, index), which are the
signals that rot when the UI changes. Run `next dev` and `next build` without
--turbopack to get stamped tours.
```

Nothing crashes and nothing is silently wrong: tours keep replaying on locator
tiers 2–5 (role + accessible name, visible text, scoping ancestor, positional
index). You simply lose the one signal that survives refactors, and with it the
build-time failure when a tour goes stale.

The practical recommendation: **run `next build` on webpack** (the default), so
production ships stamps and CI still fails on a broken tour. Using Turbopack for
`next dev` costs you only the recorder's ability to pick any element by hook.

## `aunboard.ids.json`

Written to your project root and **committed**. It is the record that keeps ids
attached to the right elements over time.

```json
{
  "version": 1,
  "ids": {
    "PricingCard.b1": {
      "file": "app/pricing/Card.tsx",
      "component": "PricingCard",
      "tag": "button",
      "sig": "a3f1c8"
    }
  }
}
```

| field | meaning |
| --- | --- |
| `file` | where the element was last seen, root-relative, posix separators |
| `component` | the component it was last seen in |
| `tag` | the lowercase host tag |
| `sig` | short hash of the fuzzy signature — the element's real identity |

Keys are sorted and the file is only rewritten when its bytes would change, so
it stays a quiet, reviewable diff. When a build reports `moved` or `renamed`, the
changed line in this file is the audit trail.

Each compilation logs a one-line summary:

```
[aunboard] 412 elements in 63 files: 409 kept, 2 moved, 1 renamed, 0 reordered, 0 added, 0 missing | 7 tour reference(s) in 2 tour file(s) | stamping 7 id(s)
```

If two files declare components with the same name, both claim the same default
id and the wrapper warns — rename one so tours can target it unambiguously.

## What to commit

- ✅ `aunboard.ids.json`
- ✅ your tour files (`tours/*.tour.json`)
- ❌ nothing else — the stamps exist only in build output, never in your source

## Writing an adapter for another bundler

All the logic lives in [`@aunboard/plugin-core`](../plugin-core), which is
bundler-agnostic. This package is a thin adapter: glob, `rematchIds`, write the
map, then call `transform` per module. See that package's README for the API, and
[`@aunboard/vite`](../vite) for the same adapter in about a hundred lines.

## License

MIT

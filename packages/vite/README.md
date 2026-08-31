# @aunboard/vite

Vite plugin that stamps stable `data-aun` ids onto exactly the JSX elements your
committed [aunboard](../aunboard) tours reference — at build time, with no source
edits in your app.

```sh
npm install --save-dev @aunboard/vite
```

```js
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { aunboard } from "@aunboard/vite";

export default defineConfig({
  plugins: [aunboard(), react()],
});
```

That's the whole integration. Node >= 18, Vite >= 4 (a peer dependency).

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
opens devtools. So the plugin runs two ways:

- **dev (`serve`)** — `stampAll` defaults to `true`. Every host element carries
  an id, because the recorder needs you to be able to click anything.
- **production (`build`)** — `stampAll` defaults to `false`. The plugin reads
  your committed tour files and stamps only the ids those tours actually
  reference: usually a few dozen attributes, not tens of thousands.

## Durability across refactors

Ids are `<ComponentName>.<tagInitial><ordinal>` — `PricingCard.b1` is the first
`<button>` in `PricingCard`. That's a *default name*, not the identity. The
identity is a **fuzzy signature**: tag + sorted attribute names + the element's
own static text, hashed. No line numbers, no columns, no attribute values, no
whitespace.

On every `buildStart` the plugin re-locates each known id in the current source:

| what you did | what happens |
| --- | --- |
| reformatted the file, added imports above | id kept |
| moved the component to another file | id kept, `file` updated |
| renamed the component | id kept, `component` updated |
| reordered the buttons | id kept — it follows the signature, not the position |
| deleted the element | **build fails**, loudly, naming the tour and step |

That last row is the point. When a committed tour references an id that can't be
matched to any element in the source, the plugin throws:

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

It never guesses a replacement, and never silently drops the id. During `serve`
this is logged as an error rather than thrown, so a broken tour doesn't take your
dev server down — nothing is shipping from a dev server anyway.

## Options

```ts
aunboard({
  tours: "./tours/*.tour.json",     // glob(s) for committed tour files
  idMap: "./aunboard.ids.json",     // the committed id map
  src: "src/**/*.{jsx,tsx}",        // glob(s) of source to scan
  stampAll: undefined,              // default: true in serve, false in build
  include: /\.[jt]sx$/,             // modules to transform
  exclude: /node_modules/,          // modules to skip
  attr: "data-aun",                 // attribute to stamp
  write: true,                      // write back aunboard.ids.json when it changed
  failOnMissing: undefined,         // default: true in build, false in serve
});
```

| option | default | notes |
| --- | --- | --- |
| `tours` | `"./tours/*.tour.json"` | string or array of globs, relative to the Vite root |
| `idMap` | `"./aunboard.ids.json"` | relative to the Vite root; created on first run |
| `src` | `"src/**/*.{jsx,tsx}"` | what `buildStart` scans to discover elements |
| `stampAll` | `command === "serve"` | stamp every host element instead of only tour-referenced ones |
| `include` / `exclude` | `.jsx`/`.tsx`, not `node_modules` | standard Vite `createFilter` patterns |
| `attr` | `"data-aun"` | change only if you've also changed aunboard's hook attribute |
| `write` | `true` | set `false` in CI if you want the id map treated as read-only |
| `failOnMissing` | `command === "build"` | set `true` to fail the dev server too |

The plugin is registered with `enforce: "pre"`, so it stamps your original JSX
before `@vitejs/plugin-react` (or any other JSX transform) rewrites it. Order it
before your React plugin in the array for clarity; `enforce: "pre"` makes it
correct either way.

## `aunboard.ids.json`

Written to your project root and **committed**. It is the record that keeps ids
attached to the right elements over time.

```json
{
  "version": 1,
  "ids": {
    "PricingCard.b1": {
      "file": "src/Pricing.tsx",
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

Each build logs a one-line summary:

```
[aunboard] 412 elements in 63 files: 409 kept, 2 moved, 1 renamed, 0 reordered, 0 added, 0 missing | 7 tour reference(s) in 2 tour file(s) | stamping 7 id(s)
```

If two files declare components with the same name, both claim the same default
id and the plugin warns — rename one so tours can target it unambiguously.

## What to commit

- ✅ `aunboard.ids.json`
- ✅ your tour files (`tours/*.tour.json`)
- ❌ nothing else — the stamps exist only in build output, never in your source

## Writing an adapter for another bundler

All the logic lives in [`@aunboard/plugin-core`](../plugin-core), which is
bundler-agnostic. This package is a thin adapter: glob, `rematchIds`, write the
map, then call `transform` per module. See that package's README for the API.

## License

MIT

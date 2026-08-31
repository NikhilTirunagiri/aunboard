# @aunboard/plugin-core

Bundler-agnostic core for aunboard's build-time stamping. It finds the JSX host
elements in your source, gives each one a stable id, keeps those ids attached to
the right element across refactors, and rewrites source to add
`data-aun="<id>"` attributes.

You normally don't install this directly — you install a bundler adapter such as
[`@aunboard/vite`](../vite). Reach for this package when you're writing an
adapter for another bundler (webpack, Rspack, Rollup, esbuild, Next.js).

## Why stamp at all, and why only some elements

An aunboard tour step stores an `ElementLocator`: a multi-signal description of
a DOM element (an explicit hook, an ARIA role + accessible name, visible text, a
scoping ancestor, a positional index). At replay time the locator has to find
the element again.

Every signal except the first is a guess about a UI that keeps changing.
"Buy now" becomes "Get started". The third button becomes the fourth. The
accessible name moves onto a wrapper. Each of those quietly breaks a tour, or —
much worse — quietly points it at the *wrong* element.

A `data-aun` attribute is the one signal that doesn't rot, because the build put
it there deliberately. `data-aun` is aunboard's highest-priority hook, so a
stamped element resolves on the first, most robust signal every time.

**And why not just stamp everything in production?** Because shipping an id on
every DOM node is real bytes on a page that has no use for almost all of them,
and it leaks your component names to anyone who opens devtools. So:

- in **dev** the plugin stamps everything, because the recorder needs to be able
  to point at any element you click;
- in **production** it stamps only the ids that a *committed* tour actually
  references — usually a few dozen attributes, not tens of thousands.

That split is why `collectStampIds` exists: it reads your committed tour files
and answers "which elements does this app actually need stamped?"

## Install

```sh
npm install --save-dev @aunboard/plugin-core
```

Node >= 18. ESM and CJS builds ship in the package. This is a build-time-only
package: it depends on `@babel/parser`, `@babel/traverse` and `magic-string`,
and never reaches the browser bundle.

## The id scheme

An element's id is `<ComponentName>.<tagInitial><ordinal>`:

```jsx
export function PricingCard() {
  return (
    <section className="card">   {/* PricingCard.s1 */}
      <button onClick={buy}>Buy now</button>     {/* PricingCard.b1 */}
      <button onClick={cancel}>Cancel</button>   {/* PricingCard.b2 */}
    </section>
  );
}
```

- **Component name** is the nearest enclosing named function, class, or arrow
  assigned to a variable. Anonymous callbacks are looked through, so an element
  inside `items.map(item => …)` still belongs to the component that renders the
  list. `memo(...)` / `forwardRef(...)` wrappers are looked through too, when the
  variable they're assigned to is capitalized. A file with no named enclosing
  function falls back to a PascalCase form of the file name (or the directory
  name, for `index.*`).
- **Ordinals** are 1-based, in JSX source order, and restart in each component.
  They're counted per *tag initial* rather than strictly per tag, so a component
  containing both `<button>` and `<br>` can't produce two elements both called
  `.b1`.
- Only lowercase **host** elements get ids. Fragments, capitalized component
  elements, and member/namespaced names (`<Menu.Item />`) are not DOM nodes and
  can't carry an attribute.

Ids are file-local, so two files that both export a `Card` component will both
claim `Card.b1`. `findIdCollisions()` reports that; adapters should surface it as
a warning, since a tour pointing at a colliding id is ambiguous.

## The id map: `aunboard.ids.json`

Commit this file. It's what makes ids durable.

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
| `file` | where the element was last seen, relative to the project root, posix separators |
| `component` | the enclosing component it was last seen in |
| `tag` | the lowercase host tag |
| `sig` | short stable hash of the element's *fuzzy source signature* |

Keys are sorted and the file ends with a newline, so diffs stay readable.

### The signature

`sig` hashes **tag name + sorted static attribute names + the element's own
static text**. Deliberately *not* included:

- **line and column** — those change on any edit above the element, which would
  make every id in a file "move" the moment you add an import;
- **attribute values and order** — so reordering props or tweaking a class name
  doesn't invalidate the id;
- **whitespace** — text is collapsed, so reformatting is a no-op;
- **the existing `data-aun`** — so stamping an element doesn't change its own
  signature, which is what makes the whole pipeline idempotent;
- **the file and the enclosing component** — those are stored as their own
  fields on the entry instead.

That last one matters more than it looks. If the component name were folded into
the hash, renaming `PricingCard` to `PlanCard` would change every signature in
it, and a renamed component would be indistinguishable from a deleted one. By
keeping `file`, `component` and `sig` as three independent fields, re-matching
can vary exactly one dimension at a time.

Text is taken from the element's own children only, not its whole subtree, so
editing a deeply nested label doesn't invalidate every ancestor.

## Re-matching

```ts
const { map, report, assignments } = rematchIds(previousMap, discoveredElements);
```

`rematchIds` is pure. It takes the committed map plus everything discovered in
this build, and runs five passes, in order, so that a perfect match always claims
its element before a weaker match can steal it:

| pass | matches on | result |
| --- | --- | --- |
| exact | file + component + tag + sig, same default name | `kept` |
| reordered | file + component + tag + sig, different ordinal | `reordered` — id keeps its name, the ordinal was only ever the default |
| moved | component + tag + sig, different file | `moved` — `file` updated |
| renamed | file + tag + sig, different component | `renamed` — `component` updated |
| — | nothing | `missing` |

Two invariants hold throughout:

1. **A discovered element is claimed by at most one id.** Two ids can't both
   resolve to the same button.
2. **An id with no match is never reassigned.** It is reported as `missing` and
   kept in the map byte-for-byte. Silently repointing a tour at a different
   element is the failure mode this whole design exists to prevent — a tour that
   confidently highlights the wrong thing is worse than one that fails loudly.

Anything left unclaimed is new: it's reported under `added` and gets an entry.
If its positional name is already taken (because some id was reordered onto
another element), it's disambiguated with its signature rather than producing a
duplicate stamp.

`assignments` is the piece the transform needs: `file -> elementKey -> id`. An
element that moved or was reordered keeps its *original* id, which no longer
matches the id its position would produce, so the transform has to be told.

Pass `{ addNew: false }` to keep the map to exactly the ids it already contains.

## The transform

```ts
import { transform } from "@aunboard/plugin-core";

const result = transform(code, "src/Pricing.tsx", {
  stampIds: ["PricingCard.b1"],   // from collectStampIds()
  idOverrides: assignments["src/Pricing.tsx"],
});
// -> { code, map } | null
```

Returns `null` when nothing changed, so callers can leave the module alone.

- Parses with `@babel/parser` (JSX + TypeScript), edits with `magic-string`, so
  edits are surgical insertions and the sourcemap stays accurate.
- Only stamps ids present in `stampIds`. With `stampIds` omitted it stamps
  **nothing**; pass `stampAll: true` for dev.
- Never overwrites an existing `data-aun`, static or dynamic. That makes the
  transform idempotent and lets a hand-written stamp win.
- Inserts the attribute *after* the last existing attribute, so a `{...spread}`
  can't clobber it, and no existing attribute is moved or reformatted. Running
  the transform and then stripping `data-aun` gives you back the original bytes.

## API

| export | purpose |
| --- | --- |
| `transform(code, id, options)` | stamp a single module; `null` if unchanged |
| `discoverElements(code, file, options?)` | every stampable element in one file, with ids, sigs and positions |
| `computeSig({ tag, attrNames, text })` | the fuzzy signature hash |
| `fallbackComponentName(file)` | component name used for anonymous default exports |
| `findIdCollisions(elements)` | ids claimed by more than one file |
| `rematchIds(map, discovered, options?)` | `{ map, report, assignments }` |
| `summarizeReport(report)` / `isCleanReport(report)` | build-log helpers |
| `collectStampIds(tourFiles)` | the set of `data-aun` ids committed tours reference |
| `collectStampRefs(tourFiles)` | the same, with tour/step context for error messages |
| `collectTourRefs(tour)` / `toursFromJson(data)` | the pure, fs-free versions |
| `readIdMap` / `writeIdMapIfChanged` / `serializeIdMap` / `normalizeIdMap` | id-map file IO |
| `scanFiles(files, { root })` | discover elements across a file list, root-relative |
| `toMapPath(file, root)` | root-relative posix path, as stored in the map |
| `elementKey(el)` | the key used in `assignments` |

### Tour scanning

`collectStampIds` reads committed tour JSON and returns every `data-aun` value
any step references. It walks the step's own locator, the whole `scope` chain
hanging off it, and every `reveal[]` locator (and *their* scope chains) — a
reveal step that clicks a tab to expose the target matters just as much as the
target itself.

It accepts the committed envelope `{ "version": 1, "tour": { … } }`, plus a bare
tour, a `{ "tours": { id: tour } }` map, and arrays of any of those. Unreadable
files are skipped unless you pass `{ strict: true }`.

## What to commit

- ✅ `aunboard.ids.json` — this is the durability record
- ✅ your tour files (`tours/*.tour.json`)
- ❌ nothing else; the stamps live only in build output

## License

MIT

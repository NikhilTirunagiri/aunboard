# Authoring tour-friendly UI for `aunboard`

A reference for writing (or generating) host-app components so that aunboard tours and
Explore badges keep resolving as the app changes. **Hand this file to Claude/Cursor when
you build UI**, or paste the rules block at the bottom into your host repo's `CLAUDE.md`.

> TL;DR — aunboard re-finds elements by a **durable locator**, not by source position. An
> element stays findable when it has a stable **name** or **id**. The fix is *almost never*
> "add a aunboard attribute" — it's "make the element properly accessible," which you want
> anyway. Reserve `data-explain` for elements that genuinely cannot carry a real name.

---

## How aunboard finds an element (the signal ladder)

At record time `buildLocator` walks this ladder top-to-bottom and keeps the strongest signal
that makes the element **unique**. At replay `resolveLocator` re-runs the same signals and
returns the element **only if it's unambiguous** — it never guesses.

1. **Hook** (most durable): `data-explain` → `data-testid` → `data-test` → a **stable `id`**
   (one without `:` — React `useId()` values are treated as unstable and ignored).
2. **Role + accessible name** — e.g. `button "Save deal"`, `table "LP returns"`.
   Accessible name precedence: `aria-label` → `aria-labelledby` → (for inputs) `<label for>` /
   wrapping `<label>` / `placeholder` → (for images) `alt` → visible text.
3. **Visible text** (normalized, capped at 80 chars).
4. **Scope** — a labeled ancestor (e.g. "inside the *Project Info* region") to disambiguate.
5. **Positional `nth`** (last resort) — index among identical matches, guarded by `nthOf`
   (the match count at capture). If the count changes, the step reports **not-found** rather
   than risk the wrong element.

**Steps that drift are the ones that land on 3–5.** The goal of this doc is to keep your
tour-worthy elements on rungs **1–2**, using real semantics.

---

## The one rule

> **Any element you might document or tour should be identifiable by a stable name or id —
> not by its text content or its position among siblings.**

Apply it via the recipes below. Prefer the *accessibility* option; use `data-explain` only
when there's no natural name.

---

## Recipes by element type

### Buttons & links
Usually fine — the visible label *is* the accessible name. Just make sure the label is
**stable copy**, not interpolated data.

```tsx
// ✅ stable name
<button>Create deal</button>
// ⚠️ name = "Create deal (3 pending)" — drifts when the count changes
<button>Create deal ({pending} pending)</button>
// ✅ fix: keep the dynamic part out of the name
<button aria-label="Create deal">Create deal <Badge>{pending}</Badge></button>
```

Icon-only controls have **no** accessible name — always give them one:
```tsx
<button aria-label="Open filters"><FilterIcon /></button>   // ✅
```

### Form inputs (the #1 source of `nth` drift)
An unlabeled input has an empty accessible name, so aunboard falls back to "the Nth input on the
page" — which breaks the moment a field is added or removed. **Label every input.**

```tsx
// ✅ explicit association — resolves by role "spinbutton" + name "Total budget"
<label htmlFor="total-budget">Total budget ($)</label>
<input id="total-budget" type="number" />

// ✅ also works: wrapping label, or aria-label
<label>Total budget ($)<input type="number" /></label>
<input type="number" aria-label="Total budget" />
```

### Tables, lists, sections, regions
Their visible text is *all their content*, so a content-derived name drifts on every data
change. **Name the container** and aunboard ignores the volatile inner text.

```tsx
<table aria-label="LP returns by ticket"> … </table>          // ✅
<section aria-label="Project info"> … </section>              // ✅
<nav aria-label="Primary"> … </nav>                           // ✅
```
*(A `<caption>` / `<legend>` is the more semantic choice and a planned engine enhancement,
but today aunboard reads `aria-label` — prefer it for now if you want this to work immediately.)*

### A specific row / item in a dynamic list
This is inherently positional — avoid touring it directly. Instead:
- Tour the **list container** ("This is your deals list"), or
- Tour a **stable control inside** the item that has its own name, or
- If you must target one item, give that item a stable `data-explain` (see below).

### Headings you explain
Heading text is usually stable enough. If the heading is generated from data, add an
`aria-label` with the stable concept ("Returns summary").

### Elements inside tabs, accordions, or modals
If the target lives behind an in-page control that **doesn't change the URL** (a tab, an
accordion, a "show more" disclosure), route navigation alone can't reach it — when the tour
lands on that step the panel may be unmounted, and you'd get "Couldn't find…".

aunboard handles this with a step **`reveal`**: a list of locators it clicks (in order) to open
the container before resolving the target. While recording you just *click the tab* to reach
the element, then pick it — aunboard captures that click as the step's reveal automatically (shown
as an "Opens first: …" chip you can remove). At replay it re-opens the tab for the viewer.

For this to be reliable, the **reveal control itself** must be durably locatable — so the same
rule applies: the tab/disclosure should have a stable name (its visible label is usually
enough) or a hook. Reveal is idempotent (skipped if the target is already visible) and falls
back to the normal not-found card if the control can't be found.

```jsonc
// a step whose target is behind the "Cash Flow" tab
{
  "reveal": [{ "tag": "button", "role": { "role": "tab", "name": "Cash Flow" } }],
  "locator": { "tag": "img", "role": { "role": "img", "name": "Year-by-Year Cash Flow" } },
  "label": "Year-by-year cash flow", "route": "/returns/<id>"
}
```

> If your tabs *do* reflect in the URL (a path segment like `/returns/<id>/cash-flow`), prefer
> that — set the step's `route` to it and skip `reveal` entirely. That's the most robust path
> because it reuses ordinary navigation. (Pure `?query` tabs aren't matched today — aunboard
> compares the path only.)

---

## When to use `data-explain` (the escape hatch)

Only when an element has **no natural name and no stable id** — e.g. a chart canvas, a
drag handle, a decorative wrapper you nonetheless want to spotlight.

```tsx
<div data-explain="returns.waterfall-chart"><Chart … /></div>
```

Key naming scheme:
- **Stable + semantic**, namespaced by area: `area.thing` → `deals.new-button`, `returns.lp-table`.
- **No volatile data** in the key — no ids, dates, amounts, indexes.
- Unique within a route.

`data-explain` is also the only rung that's immune to *every* DOM change, so it's the right
call for the handful of elements that anchor a critical tour and live in churny UI.

---

## Anti-patterns (these cause silent step loss)

- ❌ Relying on an element's text when that text includes data (counts, money, dates, names).
- ❌ Unlabeled inputs / icon-only buttons (empty accessible name → positional fallback).
- ❌ Using an `id` that contains `:` (React `useId`) as your stable hook — aunboard ignores it.
- ❌ Touring "the 3rd card" in a list whose length changes.
- ❌ Naming a container after its contents (`aria-label={firstRow.title}`).

---

## How to verify a step is durable

Open the exported `*.tour.json` and look at each step's `locator`. **Durable** steps look
like one of these:

```jsonc
{ "tag": "button", "hook": { "attr": "data-explain", "value": "deals.new-button" } } // rung 1
{ "tag": "input",  "role": { "role": "spinbutton", "name": "Total budget" } }          // rung 2
```

**Fragile** steps have **no `hook`, no `role.name`**, and rely on `text` or `nth`:

```jsonc
{ "tag": "input", "nth": 0, "nthOf": 37 }   // ⚠️ add a label
{ "tag": "table", "text": "Metric$300,000$500,000…" }   // ⚠️ add aria-label
```

If you see `nth`/`nthOf` or a `text`-only locator on a step you care about, fix the element
per the recipes above and re-record that step.

---

## Drop-in rules for your host repo

Paste into your host app's `CLAUDE.md`, `.cursor/rules`, or `AGENTS.md`:

```md
## UI must stay locatable for aunboard tours
When creating or editing UI, make interactive and tour-worthy elements identifiable by a
stable NAME or ID — never by text content or sibling position:
- Label every form input (<label for>, wrapping <label>, or aria-label).
- Give icon-only buttons an aria-label.
- Give tables / sections / nav / regions an aria-label (don't let their name be their content).
- Keep dynamic data (counts, money, dates) OUT of an element's accessible name; use aria-label
  for the stable concept if the visible text includes data.
- Don't rely on a React useId() value (contains ":") as a stable id.
- Only as a last resort, for elements with no natural name, add data-explain="area.thing"
  (stable, semantic, no volatile data).
Goal: every important element resolves by role+name or a hook, not by nth/text.
```

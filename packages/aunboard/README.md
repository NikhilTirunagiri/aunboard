# `aunboard`

A dev/staging overlay that turns any React app into a self-documenting one — an **Explore**
mode that badges recorded elements and a **Walkthrough** spotlight tour. You author both by
**clicking elements in your running app**; each click captures a durable DOM locator (no source
edits, no `data-explain` attributes). Recordings export to a portable JSON you commit to your repo.

> MIT licensed. Published to the public npm registry.

## Install

```bash
npm i aunboard      # or: pnpm add aunboard / yarn add aunboard
```

`react` / `react-dom` are peer deps and **must resolve to one copy** (Next: add
`transpilePackages: ["aunboard"]`; Vite: `resolve.dedupe: ["react","react-dom"]`).

## Quick start

```tsx
"use client";
import { LabelModeProvider } from "aunboard";
import { tours } from "./aunboard.tours"; // {} to start; your exported tour later

export function AunboardMount({ children }: { children: React.ReactNode }) {
  return (
    <LabelModeProvider tours={tours} record={{ tour: { id: "demo", name: "Product Demo" } }}>
      {children}
    </LabelModeProvider>
  );
}
```

## Docs

- **Integration prompt** (hand to your AI agent): `docs/integration-prompt.md`
- **Integration guide**: `docs/integration.md`
- **Authoring tour-friendly UI**: `docs/authoring-tour-friendly-ui.md`
- **Releasing**: `RELEASING.md`

(Full docs live in the [repository](https://github.com/NikhilTirunagiri/aunboard).)

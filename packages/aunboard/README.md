# `aunboard`

[![npm](https://img.shields.io/npm/v/aunboard?color=cb3837&logo=npm)](https://www.npmjs.com/package/aunboard)
[![ci](https://github.com/NikhilTirunagiri/aunboard/actions/workflows/ci.yml/badge.svg)](https://github.com/NikhilTirunagiri/aunboard/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/aunboard?color=blue)](https://github.com/NikhilTirunagiri/aunboard/blob/main/LICENSE)

> **Repository:** https://github.com/NikhilTirunagiri/aunboard

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
import { AunboardProvider } from "aunboard";
import { tours } from "./aunboard.tours"; // {} to start; your exported tour later

export function AunboardMount({ children }: { children: React.ReactNode }) {
  return (
    <AunboardProvider tours={tours} record={{ tour: { id: "demo", name: "Product Demo" } }}>
      {children}
    </AunboardProvider>
  );
}
```

## Docs

- **Integration prompt** (hand to your AI agent): `docs/integration-prompt.md`
- **Integration guide**: `docs/integration.md`
- **Authoring tour-friendly UI**: `docs/authoring-tour-friendly-ui.md`
- **Releasing**: `RELEASING.md`

(Full docs live in the [repository](https://github.com/NikhilTirunagiri/aunboard).)

---

## Related packages

| Package | What it does |
|---|---|
| [`@aunboard/vite`](https://www.npmjs.com/package/@aunboard/vite) | Stamps durable ids at build time (Vite) |
| [`@aunboard/next`](https://www.npmjs.com/package/@aunboard/next) | Same, for Next.js (App + Pages router) |
| [`@aunboard/cli`](https://www.npmjs.com/package/@aunboard/cli) | `aunboard verify` — replays committed tours in CI |

Full documentation: **https://github.com/NikhilTirunagiri/aunboard**

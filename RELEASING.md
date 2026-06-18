# Releasing `aunboard`

Published to the public **npm** registry on every `v*` tag, with the tarball also attached to the
GitHub Release.

## One-time setup

- An npm account that can publish `aunboard`.
- An npm **automation token** (npmjs.com → *Access Tokens* → Generate → *Automation*), stored as the
  GitHub repo secret **`NPM_TOKEN`** (Settings → Secrets and variables → Actions).

## Cut a release

1. Bump the version in `packages/aunboard/package.json` (semver).
2. Commit it: `git commit -am "release: aunboard vX.Y.Z"`.
3. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin main --tags
   ```
4. The **release** workflow (`.github/workflows/release.yml`) runs on the tag: typecheck → test →
   build → `npm publish --provenance --access public`, then attaches `aunboard-X.Y.Z.tgz` to a
   GitHub Release.

npm rejects republishing an existing version — always bump.

## Install in a host app

```bash
npm i aunboard      # or: pnpm add aunboard / yarn add aunboard
```

React must resolve to **one copy** — Next.js: `transpilePackages: ["aunboard"]`; Vite:
`resolve.dedupe: ["react","react-dom"]`. See [docs/integration.md](docs/integration.md).

## Build a tarball locally (no CI)

```bash
cd packages/aunboard && pnpm pack:tgz   # builds dist + npm pack → aunboard-X.Y.Z.tgz
```

## Notes

- `dist/` is gitignored; the published artifact is built at pack/publish time via the package's
  `prepack` script, so it's always freshly built.
- Provenance (`publishConfig.provenance` + `id-token: write` in the workflow) attaches a signed
  build-provenance attestation, shown on the npm package page.
- Developing from a clone alongside a host app? Use the workspace path:
  `"aunboard": "file:<path-to-clone>/packages/aunboard"`.

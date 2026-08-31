# Releasing aunboard

All packages are published to the public **npm** registry on every `v*` tag, with tarballs
attached to the GitHub Release.

| Package | What it is |
|---|---|
| `aunboard` | the runtime + studio |
| `@aunboard/plugin-core` | shared JSX transform + id map |
| `@aunboard/vite` | Vite adapter |
| `@aunboard/next` | Next.js adapter |
| `@aunboard/cli` | `aunboard verify` for CI |

They share one version number — bump them together.

> **Publishing uses `pnpm publish`, never `npm publish`.** The adapters depend on
> `@aunboard/plugin-core` via `workspace:*`; pnpm rewrites that to a real version range at pack
> time and npm does not, so an npm publish would ship a manifest nobody can install. The
> workflow also publishes in dependency order for the same reason.

## How authentication works — there is no token

Releases publish via **trusted publishing (OIDC)**. GitHub mints a short-lived identity for the
release workflow, and npm accepts it because each package names this repository and workflow as
a trusted publisher. Nothing long-lived exists to leak, and no 2FA prompt can block CI.

This replaced a long-lived automation token deliberately. npm is
[removing direct publishing from 2FA-bypass tokens around January 2027](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/),
so a token-based release pipeline has an expiry date.

### One-time setup

```bash
./scripts/trust-publishers.sh
```

Registers this repo's `release.yml` as a trusted publisher for all five packages via
`npm trust`. Run it in a real terminal — npm requires 2FA and opens a browser for your
security key.

Or, in the web UI, per package at `https://www.npmjs.com/package/<name>/access` — the
Settings tab lives on that page, not on the package's main page:

| Field | Value |
|---|---|
| Organization or user | `NikhilTirunagiri` |
| Repository | `aunboard` |
| Workflow filename | `release.yml` |
| Allowed actions | `npm publish` |

Check it with `npm trust list <package>`.

### Publishing a package for the very first time

npm will not let you configure a trusted publisher for a package it has never seen, so a
brand-new package cannot be published by CI. Bootstrap it by hand, once:

```bash
npm login                      # interactive, with your authenticator
./scripts/first-publish.sh     # publishes in dependency order, prompts for one OTP
```

Then add the trusted publisher as above, and every later release is tokenless.

> A hand publish cannot attach a provenance attestation — those require a CI OIDC identity.
> Releases published by the workflow are attested.

## Cut a release

1. Bump the version in every `packages/*/package.json` (semver, all the same).
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

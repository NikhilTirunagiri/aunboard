#!/usr/bin/env bash
# First publish of the aunboard packages, run from a developer machine.
#
# WHY THIS EXISTS
#   npm will not configure a trusted publisher (OIDC) for a package it has never seen, so the
#   very first publish of a new package cannot come from CI without a long-lived 2FA-bypass
#   token — and those lose publish rights around January 2027. So we bootstrap by hand, once.
#   Every release after this one is tokenless: see RELEASING.md.
#
# USAGE
#   npm login                       # once, interactive
#   ./scripts/first-publish.sh      # prompts for a fresh OTP before each package
#
#   OTP=123456 ./scripts/first-publish.sh    # or supply one up front
#
set -euo pipefail
cd "$(dirname "$0")/.."

# Dependency order: the adapters depend on plugin-core, so it must exist first.
PACKAGES=(aunboard plugin-core cli vite next)

who=$(npm whoami 2>/dev/null) || {
  echo "Not logged in to npm. Run: npm login" >&2
  exit 1
}
echo "Publishing as: $who"
echo "Packages, in dependency order: ${PACKAGES[*]}"

echo
echo "Building everything first — a failed build halfway through a publish is a bad time."
pnpm -r build >/dev/null
echo "Build OK."

TARBALLS=$(mktemp -d)
trap 'rm -rf "$TARBALLS"' EXIT

published=()
for pkg in "${PACKAGES[@]}"; do
  dir="packages/$pkg"
  [ -f "$dir/package.json" ] || { echo "skip $pkg (not present)"; continue; }
  name=$(node -p "require('./$dir/package.json').name")
  version=$(node -p "require('./$dir/package.json').version")

  echo
  echo "──── $name@$version ────"

  # Pack with pnpm so `workspace:*` becomes a real version range.
  ( cd "$dir" && pnpm pack --pack-destination "$TARBALLS" >/dev/null )
  tgz=$(ls -t "$TARBALLS"/*.tgz | head -1)
  [ -f "$tgz" ] || { echo "✗ pack produced no tarball for $name" >&2; exit 1; }

  # Publish with npm so a security key / passkey can authenticate. npm prints a URL to open.
  # No --provenance: attestations need a CI OIDC identity and cannot be made locally.
  if npm publish "$tgz" --access public; then
    echo "✓ $name@$version"
    published+=("$name")
    rm -f "$tgz"
  else
    echo
    echo "✗ $name@$version failed." >&2
    if [ ${#published[@]} -gt 0 ]; then
      echo "  Already published this run: ${published[*]}" >&2
      echo "  Rerun the script — npm rejects duplicate versions, so those are skipped." >&2
    fi
    exit 1
  fi
done

echo
echo "All ${#published[@]} packages published."
cat <<'NEXT'

NEXT — make future releases tokenless:
  On npmjs.com, for EACH package → Settings → Trusted Publisher:
      Organization or user: NikhilTirunagiri
      Repository:           aunboard
      Workflow filename:    release.yml
  Then delete the NPM_TOKEN secret from the GitHub repo — nothing uses it any more.
NEXT

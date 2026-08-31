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
#   ./scripts/first-publish.sh      # pnpm prompts for a one-time password only if npm asks
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

# An OTP is NOT collected up front. npm one-time passwords expire in about 30 seconds, which
# five sequential publishes can easily outrun — and depending on your 2FA mode, publishing may
# not require one at all. pnpm prompts if and when npm actually demands it.
[ -n "${OTP:-}" ] && echo "Using the OTP supplied via \$OTP."

# Deliberately not an array. macOS ships bash 3.2, where expanding an EMPTY array under
# `set -u` aborts with "unbound variable" — so the no-OTP path (the common one) would die.
publish_pkg() {
  if [ -n "${OTP:-}" ]; then
    pnpm --filter "./$1" publish --access public --no-git-checks --otp "$OTP"
  else
    pnpm --filter "./$1" publish --access public --no-git-checks
  fi
}

echo
echo "Building everything first — a failed build halfway through a publish is a bad time."
pnpm -r build >/dev/null
echo "Build OK."

published=()
for pkg in "${PACKAGES[@]}"; do
  dir="packages/$pkg"
  [ -f "$dir/package.json" ] || { echo "skip $pkg (not present)"; continue; }
  name=$(node -p "require('./$dir/package.json').name")
  version=$(node -p "require('./$dir/package.json').version")

  echo
  echo "──── $name@$version ────"
  # No --provenance: attestations require a CI OIDC identity and cannot be produced from a
  # laptop. Releases after this one publish from CI and are attested.
  if publish_pkg "$dir"; then
    echo "✓ $name@$version"
    published+=("$name")
  else
    echo
    echo "✗ $name@$version failed." >&2
    if [ ${#published[@]} -gt 0 ]; then
      echo "  Already published this run: ${published[*]}" >&2
      echo "  Rerun the script — npm rejects duplicate versions, so completed packages are skipped." >&2
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

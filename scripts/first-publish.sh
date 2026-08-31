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

# npm rejects a publish from a 2FA account with a plain 403 rather than the EOTP challenge
# code that makes pnpm prompt for a one-time password — so pnpm never asks, and the publish
# just fails. The OTP has to be passed explicitly with --otp.
#
# It is read fresh before EACH package: npm one-time passwords expire in roughly 30 seconds,
# and five sequential publishes (each preceded by a build) comfortably outrun a single code.
# Set $OTP to reuse one code for everything instead, for non-interactive runs.
#
# Read from /dev/tty, not stdin: stdin may be redirected or already consumed, and a `read`
# that silently returns empty looks exactly like a user who typed nothing.
# Sets OTP_CODE. Deliberately NOT a command substitution: `exit` inside $(...) only leaves
# the subshell, so a failure to reach the terminal would be swallowed and the publish would
# proceed with an empty --otp.
OTP_CODE=""
require_tty() {
  if ! { : > /dev/tty; } 2>/dev/null; then
    echo "Cannot reach a terminal to ask for the OTP." >&2
    echo "Run this script directly in a terminal, or pass one: OTP=123456 $0" >&2
    exit 1
  fi
}
prompt_otp() {
  require_tty
  OTP_CODE=""
  while [ -z "$OTP_CODE" ]; do
    printf '  6-digit code from your authenticator (npm needs a fresh one): ' > /dev/tty
    if ! read -r OTP_CODE < /dev/tty; then
      echo >&2
      echo "Could not read the OTP (end of input)." >&2
      exit 1
    fi
  done
}

# Deliberately not an array. macOS ships bash 3.2, where expanding an EMPTY array under
# `set -u` aborts with "unbound variable".
publish_pkg() {
  if [ -n "${OTP:-}" ]; then
    OTP_CODE="$OTP"
  else
    prompt_otp
  fi
  if [ -z "$OTP_CODE" ]; then
    echo "Refusing to publish with an empty one-time password." >&2
    exit 1
  fi
  pnpm --filter "./$1" publish --access public --no-git-checks --otp "$OTP_CODE"
}

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

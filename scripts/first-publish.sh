#!/usr/bin/env bash
# First publish of the aunboard packages, run from a developer machine.
#
# WHY THIS EXISTS
#   npm will not let you configure a trusted publisher (OIDC) for a package that does not
#   exist yet, so the very first publish of a new package cannot come from CI without a
#   long-lived 2FA-bypass token — and those lose publish rights around January 2027.
#   So we bootstrap by hand, once, with real 2FA. Every release after this one is tokenless:
#   see RELEASING.md.
#
# USAGE
#   npm login          # once, interactive, with your authenticator
#   ./scripts/first-publish.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

# Dependency order: the adapters depend on plugin-core, so it must exist first.
PACKAGES=(aunboard plugin-core cli vite next)

echo "Publishing as: $(npm whoami)"
echo "Packages, in dependency order: ${PACKAGES[*]}"
echo

read -rp "One-time password from your authenticator app: " OTP
[ -n "$OTP" ] || { echo "An OTP is required." >&2; exit 1; }

echo
echo "Building everything first — a failed build halfway through a publish is a bad time."
pnpm -r build

for pkg in "${PACKAGES[@]}"; do
  dir="packages/$pkg"
  [ -f "$dir/package.json" ] || { echo "skip $pkg (not present)"; continue; }
  name=$(node -p "require('./$dir/package.json').name")
  version=$(node -p "require('./$dir/package.json').version")

  echo
  echo "──── $name@$version ────"
  # No --provenance: provenance attestations require a CI OIDC identity and cannot be
  # produced from a laptop. Releases after this one publish from CI and are attested.
  if pnpm --filter "./$dir" publish --access public --no-git-checks --otp "$OTP"; then
    echo "✓ $name@$version published"
  else
    echo
    echo "✗ $name failed." >&2
    echo "  If this said the OTP expired, rerun the script — already-published packages" >&2
    echo "  will be skipped by npm as duplicates, so it is safe to run again." >&2
    exit 1
  fi
done

echo
echo "All packages published."
echo
echo "NEXT — make future releases tokenless:"
echo "  For each package on npmjs.com → Settings → Trusted Publisher, add:"
echo "    Organization/User: NikhilTirunagiri"
echo "    Repository:        aunboard"
echo "    Workflow filename: release.yml"
echo "  Then delete the NPM_TOKEN secret from the GitHub repo."

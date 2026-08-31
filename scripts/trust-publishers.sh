#!/usr/bin/env bash
# Register this repo's release workflow as a trusted publisher for every aunboard package.
#
# After this runs, releases publish with NO npm token and NO security-key touch: GitHub mints
# a short-lived OIDC identity for release.yml and npm trusts it. Delete the NPM_TOKEN secret
# afterwards — nothing uses it.
#
# Must run in a real terminal: npm requires 2FA, and it opens a browser for your security key.
# The first package prompts; the rest usually reuse the cached session.
#
# USAGE
#   ./scripts/trust-publishers.sh
#
set -euo pipefail

REPO="NikhilTirunagiri/aunboard"
WORKFLOW="release.yml"
PACKAGES=(aunboard @aunboard/plugin-core @aunboard/cli @aunboard/vite @aunboard/next)

npm whoami >/dev/null 2>&1 || { echo "Not logged in to npm. Run: npm login" >&2; exit 1; }
echo "Configuring trusted publishing as $(npm whoami)"
echo "  repo:     $REPO"
echo "  workflow: $WORKFLOW"

failed=()
for pkg in "${PACKAGES[@]}"; do
  echo
  echo "──── $pkg ────"
  if npm trust github "$pkg" --file "$WORKFLOW" --repo "$REPO" --allow-publish -y; then
    echo "✓ $pkg"
  else
    echo "✗ $pkg" >&2
    failed+=("$pkg")
  fi
done

echo
if [ ${#failed[@]} -gt 0 ]; then
  echo "Failed: ${failed[*]}" >&2
  echo "Rerun to retry — configuring an already-trusted package is harmless." >&2
  exit 1
fi

echo "All packages trust $REPO / $WORKFLOW."
echo
echo "Verify:  npm trust list aunboard"
echo "Finally: delete the NPM_TOKEN secret from the GitHub repo — nothing uses it now."

#!/bin/bash
# Vercel Ignored Build Step
# Exit 0 → skip build (only data files changed)
# Exit 1 → proceed with build
#
# Skips deploy when ONLY these files changed:
#   - share_link
#   - data/places.json
#   - data/places.overrides.json (manual overrides don't need frontend rebuild)
#
# Always proceeds for code changes (lib/, app/, components/, etc.)

CHANGED=$(git diff --name-only HEAD^ HEAD 2>/dev/null || echo "")

if [ -z "$CHANGED" ]; then
  echo "No changes detected, proceeding"
  exit 1
fi

DATA_ONLY_PATTERN="^(share_link|data/places\.json|data/places\.overrides\.json)$"
NON_DATA=$(echo "$CHANGED" | grep -v -E "$DATA_ONLY_PATTERN" || true)

if [ -z "$NON_DATA" ]; then
  echo "Only data files changed (share_link / places.json / overrides), skipping build"
  exit 0
else
  echo "Code changes detected, proceeding with build"
  exit 1
fi

#!/bin/bash
# Check if ADR curation is due (>24h since last run) and draft ADRs exist
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
LAST_FILE="$REPO_ROOT/decisions/.last-curated"
MANIFEST="$REPO_ROOT/decisions/manifest.json"

# Check if manifest exists
if [ ! -f "$MANIFEST" ]; then
  exit 0
fi

# Count draft ADRs
DRAFT_COUNT=$(node -e "
  const m = require('$MANIFEST');
  const drafts = (m.decisions || []).filter(d => d.status === 'draft');
  console.log(drafts.length);
" 2>/dev/null || echo "0")

# No drafts, nothing to do
if [ "$DRAFT_COUNT" = "0" ]; then
  exit 0
fi

# Check timestamp
NEEDS_CURATION=false
if [ ! -f "$LAST_FILE" ]; then
  NEEDS_CURATION=true
else
  LAST_TS=$(cat "$LAST_FILE" 2>/dev/null || echo "")
  if [ -z "$LAST_TS" ]; then
    NEEDS_CURATION=true
  else
    # Compare timestamps (macOS compatible)
    LAST_EPOCH=$(date -jf "%Y-%m-%dT%H:%M:%SZ" "$LAST_TS" +%s 2>/dev/null || echo "0")
    NOW_EPOCH=$(date +%s)
    DIFF=$(( NOW_EPOCH - LAST_EPOCH ))
    if [ "$DIFF" -gt 86400 ]; then
      NEEDS_CURATION=true
    fi
  fi
fi

if [ "$NEEDS_CURATION" = "true" ]; then
  echo "[ADR Curation Due] $DRAFT_COUNT draft ADR(s) pending review — run /adr:curate"
fi

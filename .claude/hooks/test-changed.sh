#!/usr/bin/env bash
# Runs tests related to changed files
# Detects which app/package the file is in for the Turborepo monorepo

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.tool_input?.file_path || '')")

# Skip if not a TypeScript/JavaScript file
if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

# Skip if file is a test file itself
if [[ "$FILE_PATH" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
  exit 0
fi

# Detect which workspace package the file belongs to so we can run vitest
# from the correct package directory where it is installed.
RELATIVE="${FILE_PATH#$REPO_ROOT/}"
PKG_DIR=""

if [[ "$RELATIVE" =~ ^apps/([^/]+)/ ]]; then
  PKG_DIR="$REPO_ROOT/apps/${BASH_REMATCH[1]}"
elif [[ "$RELATIVE" =~ ^packages/([^/]+)/ ]]; then
  PKG_DIR="$REPO_ROOT/packages/${BASH_REMATCH[1]}"
fi

# Require a resolved package directory with a local vitest binary
VITEST_BIN=""
if [ -n "$PKG_DIR" ] && [ -x "$PKG_DIR/node_modules/.bin/vitest" ]; then
  VITEST_BIN="$PKG_DIR/node_modules/.bin/vitest"
fi

if [ -z "$VITEST_BIN" ]; then
  exit 0  # No vitest found for this package — skip silently
fi

echo "🧪 Running tests related to $FILE_PATH..." >&2

if ! (cd "$PKG_DIR" && "$VITEST_BIN" related "$FILE_PATH" --run --passWithNoTests 2>&1); then
  echo "❌ Tests failed" >&2
  exit 2
fi

echo "✅ Tests passed!" >&2
exit 0

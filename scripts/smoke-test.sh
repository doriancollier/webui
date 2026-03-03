#!/usr/bin/env bash
# DorkOS Integration Smoke Test
# Starts the server, waits for health, and validates API + client endpoints.
# Usage: smoke-test [--port PORT] [--timeout SECONDS]
set -euo pipefail

PORT="${DORKOS_PORT:-4242}"
TIMEOUT="${SMOKE_TIMEOUT:-30}"

# Parse CLI args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)    PORT="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    *)         echo "Unknown arg: $1"; exit 1 ;;
  esac
done

BASE="http://localhost:${PORT}"

# Start server in background
dorkos --port "$PORT" &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true" EXIT

# Wait for health endpoint
echo "Waiting for server on port $PORT..."
elapsed=0
until curl -sf "$BASE/api/health" >/dev/null 2>&1; do
  sleep 1
  elapsed=$((elapsed + 1))
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo "FAIL: Server did not start within ${TIMEOUT}s"
    exit 1
  fi
done
echo "Server ready (${elapsed}s)"

# Test runner
PASS=0
FAIL=0

check() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "=== API Tests ==="
check "GET /api/health returns 200"    curl -sf "$BASE/api/health"
check "Health response has status:ok"  curl -sf "$BASE/api/health" | grep -q '"status":"ok"'
check "GET /api/health has version"    curl -sf "$BASE/api/health" | grep -q '"version"'
check "GET /api/sessions returns 200"  curl -sf "$BASE/api/sessions"
check "GET /api/config returns 200"    curl -sf "$BASE/api/config"
check "GET /api/models returns 200"    curl -sf "$BASE/api/models"

echo ""
echo "=== Client Tests ==="
check "GET / returns HTML"             curl -sf "$BASE/" | grep -q '</html>'
check "GET / contains app root"        curl -sf "$BASE/" | grep -qi 'dorkos\|app\|root'

echo ""
echo "=== Results ==="
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "All integration tests passed." || exit 1

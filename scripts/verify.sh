#!/bin/bash
# Pre-push verification script for deepseek-router
# Runs all local checks before allowing push.
# Usage: bash scripts/verify.sh [--strict]

set -euo pipefail

# Navigate to project root regardless of where script is called from
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
  local name="$1"
  shift
  echo -n "  [$name] "
  if "$@" > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}FAIL${NC}"
    FAIL=$((FAIL + 1))
  fi
}

echo "=========================================="
echo " deepseek-router Pre-Push Verification"
echo "=========================================="
echo ""

# ── TypeScript ──
echo "[TypeScript]"
check "typecheck"        pnpm run typecheck
check "build"            pnpm run build
echo ""

# ── Code Quality ──
echo "[Code Quality]"
check "format:check"     pnpm run format:check
check "lint"             pnpm run lint
echo ""

# ── Tests ──
echo "[Tests]"
check "test"             pnpm run test
echo ""

# ── Lockfile ──
echo "[Dependencies]"
check "lockfile-sync"    pnpm install --frozen-lockfile
echo ""

# ── Summary ──
echo "=========================================="
TOTAL=$((PASS + FAIL + WARN))
echo " Results: $PASS passed, $FAIL failed, $WARN warnings ($TOTAL total)"
echo "=========================================="

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}VERIFICATION FAILED — fix errors before push${NC}"
  exit 1
else
  echo -e "${GREEN}ALL CHECKS PASSED — safe to push${NC}"
  exit 0
fi

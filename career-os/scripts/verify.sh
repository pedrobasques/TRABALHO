#!/usr/bin/env bash
# Quality gates for Career OS and the vendored career-ops. Exit != 0 on any failure.
# Usage: career-os/scripts/verify.sh [--skip-upstream]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CO="$ROOT/upstream/career-ops"

echo "== Career OS: typecheck + core tests + dashboard build"
( cd "$ROOT" && npm run check )

if [ "${1:-}" != "--skip-upstream" ]; then
  echo "== career-ops: syntax, web, full suite"
  cd "$CO"
  node scripts/check-syntax.mjs
  ( cd web && npm run typecheck && npm test && npm run build )
  # Known environment-only failure in the cloud container: one test resolves example.com via DNS.
  node test-all.mjs
fi

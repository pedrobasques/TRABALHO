#!/usr/bin/env bash
# Runs the quality gates of the vendored career-ops. Exit != 0 on any failure.
set -euo pipefail
CO="$(cd "$(dirname "$0")/.." && pwd)/upstream/career-ops"
cd "$CO"
node scripts/check-syntax.mjs
( cd web && npm run typecheck && npm test && npm run build )
node test-all.mjs

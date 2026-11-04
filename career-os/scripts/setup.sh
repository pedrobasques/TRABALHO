#!/usr/bin/env bash
# Reproducible setup of the vendored career-ops (core CLI + web UI).
# Usage: career-os/scripts/setup.sh [--skip-web] [--skip-browser]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CO="$ROOT/upstream/career-ops"
SKIP_WEB=0; SKIP_BROWSER=0
for a in "$@"; do case "$a" in --skip-web) SKIP_WEB=1;; --skip-browser) SKIP_BROWSER=1;; esac; done

node -e 'const [M,m]=process.versions.node.split(".").map(Number);if(!(M>23||(M===23&&m>=4)||(M===22&&m>=13))){console.error("Node ^22.13 or >=23.4 required, found "+process.version);process.exit(1)}'

cd "$CO"
# Upstream ships no root lockfile -> npm install (web/ has one -> npm ci).
if [ "$SKIP_BROWSER" = 1 ] || [ -n "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]; then
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi
if [ "$SKIP_WEB" = 0 ]; then
  npm --prefix web ci --no-audit --no-fund
  npm --prefix web run build
fi
node doctor.mjs || true   # doctor exits non-zero until personal files (cv.md, profile.yml...) exist
echo "Setup done. Personal files are created via onboarding: see career-os/docs/SETUP.md"

#!/usr/bin/env bash
# Small, public-sources-only collection pilot (Sprint 4).
# Uses an ISOLATED career-ops data root (private/pilot-root) so it never touches your real files.
#   npm run pilot            # scan + ingest (local file outputs)
#   npm run pilot -- --db    # also mirror to Postgres/Supabase (DATABASE_URL + CAREER_OS_OWNER_ID)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRIV="${CAREER_OS_PRIVATE_DIR:-$ROOT/private}"
PILOT="$PRIV/pilot-root"
mkdir -p "$PILOT/data"
PORTALS="${CAREER_OS_PORTALS:-$ROOT/config/pilot-portals.yml}"
cp "$PORTALS" "$PILOT/portals.yml"
echo "== scan (career-ops scan.mjs, public ATS APIs only) — data root: $PILOT"
( cd "$ROOT/upstream/career-ops" && CAREER_OPS_TRUST_PROXY_EGRESS="${CAREER_OPS_TRUST_PROXY_EGRESS:-$([ -n "${HTTPS_PROXY:-}" ] && echo 1)}" CAREER_OPS_ROOT="$PILOT" node scan.mjs --json | tail -1 > "$PILOT/last-scan-receipt.json" )
cat "$PILOT/last-scan-receipt.json"; echo
echo "== portal health"; tail -n +2 "$PILOT/data/portal-health.tsv" 2>/dev/null | tail -n 10
echo "== ingest"
node "$ROOT/scripts/radar-ingest.ts" --career-ops "$PILOT" --out "$PRIV" "$@"

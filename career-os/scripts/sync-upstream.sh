#!/usr/bin/env bash
# Replace the vendored career-ops snapshot with an upstream ref (tag/branch/commit).
# Usage: career-os/scripts/sync-upstream.sh <ref>     (e.g. v1.39.0 or main)
# Run on a dedicated branch; review `git diff --stat` before committing.
set -euo pipefail
REF="${1:?usage: sync-upstream.sh <ref>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/upstream/career-ops"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

git -C "$ROOT" diff --quiet -- "$DEST" || { echo "Uncommitted changes in $DEST; aborting."; exit 1; }
git clone --quiet --filter=blob:none https://github.com/career-ops-hq/career-ops.git "$TMP/co"
git -C "$TMP/co" checkout --quiet "$REF"
SHA="$(git -C "$TMP/co" rev-parse HEAD)"; DATE="$(git -C "$TMP/co" log -1 --format=%ci)"
VER="$(sed 's/ .*//' "$TMP/co/VERSION")"

# Remove only tracked (system) files, so gitignored personal data and node_modules survive.
git -C "$ROOT" ls-files -z -- "$DEST" | (cd "$(git -C "$ROOT" rev-parse --show-toplevel)" && xargs -0 rm -f)
(cd "$TMP/co" && tar --exclude=.git -cf - .) | tar -xf - -C "$DEST" --skip-old-files 2>/dev/null || true
# --skip-old-files keeps existing (personal, untracked) files; system files were deleted above so they are re-created.

sed -i -E "s/^\| Version \|.*/| Version | $VER (\`VERSION\`) |/; s/^\| Commit \|.*/| Commit | \`$SHA\` |/; s/^\| Commit date \|.*/| Commit date | $DATE |/; s/^\| Imported on \|.*/| Imported on | $(date +%F) |/" "$ROOT/upstream/UPSTREAM.md"
echo "Synced career-ops $VER ($SHA). Next: scripts/setup.sh && scripts/verify.sh, then commit."

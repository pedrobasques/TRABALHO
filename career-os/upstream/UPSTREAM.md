# Upstream: career-ops (vendored snapshot)

| Field | Value |
|---|---|
| Repository | https://github.com/career-ops-hq/career-ops |
| Version | 1.38.0 (`VERSION`), web UI 0.16.0 |
| Commit | `35b7c5315837478ae35316429669a954923ccd6b` |
| Commit date | 2026-11-04 23:27:23 +0100 |
| Imported on | 2026-11-04 |
| License | MIT — © 2026 Santiago Fernández de Valderrama (see `career-ops/LICENSE`) |
| Trademark | See `career-ops/TRADEMARK.md`. "Career OS" is a distinct personal product name; we describe it as "based on career-ops", never "powered by"/"official". |

## Rules

1. `career-os/upstream/career-ops/` is a **pristine copy** of the upstream commit above (minus `.git`).
   Do not edit files there. Career OS code lives in `career-os/apps/` and `career-os/packages/`.
   If a patch is unavoidable, record it in `PATCHES.md` (this folder) and prefer contributing upstream.
2. User data (cv.md, config/profile.yml, portals.yml, data/, reports/, …) is gitignored by the
   upstream `.gitignore` and must never be committed. See `career-os/docs/SECURITY.md`.
3. Updating: `career-os/scripts/sync-upstream.sh <ref>` (see `career-os/docs/UPSTREAM_STRATEGY.md`).
   Do **not** use upstream's own `update-system.mjs apply` here: it runs `git checkout` of upstream paths and expects the
   career-ops checkout to be its own git repository (not validated in this monorepo layout).

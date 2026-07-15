---
phase: 06-toolchain-audit-modernization
plan: 06
subsystem: infra
tags: [pnpm, engines, ci, github-actions, makefile, tsup, node]

# Dependency graph
requires:
  - phase: 06-toolchain-audit-modernization (plans 01-05)
    provides: Node engines/engine-strict enforcement, bumped tsup/vite/vitest/Biome, cz-git adapter, verify-outputs Makefile target
provides:
  - "Corrected engines.node floor (`^22.12.0 || >=24.0.0`) across all 5 package.json, internally consistent with vite@8.1.4 and vitest@4.1.10's pinned engine ranges"
  - "CI matrix leg pinned to the exact `22.12.0` floor patch instead of a bare `22` that resolves to latest"
  - "verify-outputs wired as a hard prerequisite of `release`, `publish`, and a dedicated CI step"
affects: [07-typescript-6-migration, ci-pipeline, release-process]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - package.json
    - plugins/auth/package.json
    - plugins/wallet/package.json
    - plugins/theme/package.json
    - plugins/settings/package.json
    - .github/workflows/ci.yml
    - Makefile

key-decisions:
  - "Tightened engines.node to the exact intersection of vite@8.1.4 (^20.19.0 || >=22.12.0) and vitest@4.1.10 (^20.0.0 || ^22.0.0 || >=24.0.0) rather than picking a rounder number — `^22.12.0 || >=24.0.0` is the only range where no admitted Node version is rejected by either sub-dependency under engine-strict."
  - "This is a documented deviation from the literal ROADMAP/D-05 `>=22` string; the deviation note in 06-06-PLAN.md records that the intent (an enforced Node 22 LTS floor) is preserved, only the literal string is corrected."

patterns-established: []

requirements-completed: [TOOL-01, TOOL-02, TOOL-05]

coverage:
  - id: D1
    description: "engines.node tightened to ^22.12.0 || >=24.0.0 across all 5 package.json, byte-identical, closing CR-01"
    requirement: "TOOL-01"
    verification:
      - kind: unit
        ref: "grep -Fc '^22.12.0 || >=24.0.0' package.json plugins/{auth,wallet,theme,settings}/package.json == 5"
        status: pass
      - kind: integration
        ref: "pnpm install --frozen-lockfile && git diff --exit-code pnpm-lock.yaml (no lockfile churn on Node 22.22.1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CI matrix pins exact-floor 22.12.0 leg alongside 24, so the declared Node floor is a tested contract"
    requirement: "TOOL-02"
    verification:
      - kind: unit
        ref: "grep -Fq \"22.12.0\" .github/workflows/ci.yml; step-order check pnpm/action-setup@v4 < actions/setup-node@v4"
        status: pass
    human_judgment: false
  - id: D3
    description: "verify-outputs wired as a prerequisite of release and publish, and as its own CI step between build and test"
    requirement: "TOOL-05"
    verification:
      - kind: unit
        ref: "grep -Fq 'release: build verify-outputs test' Makefile; grep -Fq 'publish: build verify-outputs test' Makefile"
        status: pass
      - kind: manual_procedural
        ref: "Spot-check: deleted dist/index.global.js after a fresh build, `make verify-outputs` exited 2 with MISSING: dist/index.global.js (root package); rebuild restored exit 0"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-15
status: complete
---

# Phase 06 Plan 06: Toolchain Gap Closure (CR-01, WR-02, WR-01) Summary

**Tightened Node engines to the toolchain's real floor (`^22.12.0 || >=24.0.0`), pinned an exact-floor CI matrix leg, and wired `verify-outputs` into release/publish/CI**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-15T14:03:00-05:00 (approx, first task commit)
- **Completed:** 2026-07-15T14:04:20-05:00
- **Tasks:** 3 completed
- **Files modified:** 7 (5 package.json + ci.yml + Makefile)

## Accomplishments
- Closed CR-01 (blocker): all five package.json now declare the identical, toolchain-consistent `engines.node: "^22.12.0 || >=24.0.0"` — the exact intersection of vite@8.1.4's and vitest@4.1.10's own pinned engine ranges, so no Node version the project admits can be rejected by a sub-dependency under `engine-strict=true`. Committed as `fix(engines)!:` with a `BREAKING CHANGE:` footer per D-10.
- Closed WR-02: CI matrix now exercises the exact `22.12.0` floor patch (`['22.12.0', 24]`) instead of a bare `22` that `actions/setup-node` silently resolves to the latest 22.x — the declared floor is now a tested contract, not masked drift.
- Closed WR-01: `verify-outputs` (all 15 build outputs, 3 formats × 5 packages) is now a hard prerequisite of both `release` and `publish` Makefile targets, and runs as its own CI step between `make build` and `make test` — a dropped build output now fails all three automated paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tighten engines.node to the toolchain's real floor across all 5 package.json** - `13f7766` (fix!)
2. **Task 2: Pin an exact-floor CI matrix leg so the declared floor is a tested contract** - `00e586e` (ci)
3. **Task 3: Wire verify-outputs into release, publish, and CI** - `aaac2c7` (chore)

**Plan metadata:** (this commit, pending)

_Note: no TDD tasks in this plan — build/CI configuration only._

## Files Created/Modified
- `package.json` - `engines.node`: `>=22` → `^22.12.0 || >=24.0.0`
- `plugins/auth/package.json` - same engines tightening (lockstep, D-05)
- `plugins/wallet/package.json` - same engines tightening (lockstep, D-05)
- `plugins/theme/package.json` - same engines tightening (lockstep, D-05)
- `plugins/settings/package.json` - same engines tightening (lockstep, D-05)
- `.github/workflows/ci.yml` - matrix `[22, 24]` → `['22.12.0', 24]`; added `- run: make verify-outputs` step between `make build` and `make test`
- `Makefile` - `release: build test` → `release: build verify-outputs test`; `publish: build test` → `publish: build verify-outputs test`

## Decisions Made

- Chose `^22.12.0 || >=24.0.0` as the exact intersection of vite@8.1.4's `^20.19.0 || >=22.12.0` and vitest@4.1.10's `^20.0.0 || ^22.0.0 || >=24.0.0` rather than a rounder value — this is the only range where every admitted Node version is accepted by both pinned sub-dependencies under `engine-strict=true`. Node 23.x is intentionally excluded because vitest rejects it.
- Followed CLAUDE.md's breaking-change convention: the Task 1 commit uses `fix(engines)!:` with a `BREAKING CHANGE:` footer, since narrowing the previously-declared `>=22` support surface is a breaking change even though it's a correctness fix.

## Deviations from Plan

None - plan executed exactly as written. (The plan itself documents an intentional, pre-approved deviation from the literal `>=22` string in ROADMAP Success Criterion 1 and 06-CONTEXT D-05 — see the plan's "Deviation note"; this SUMMARY carries that note forward for the docs pass.)

## Issues Encountered

None. All automated verification commands in each task's `<verify>` block passed on the first attempt:
- Task 1: 5/5 grep matches, no `">=22"` remnants, `pnpm install --frozen-lockfile` clean with zero lockfile diff, `BREAKING CHANGE:` footer present.
- Task 2: `22.12.0` present in matrix, `cache: pnpm` preserved, `pnpm/action-setup@v4` precedes `actions/setup-node@v4`.
- Task 3: both Makefile dependency edges present; CI step ordering `make build` < `make verify-outputs` < `make test` confirmed; behavioral spot-check (delete `dist/index.global.js`, run `make verify-outputs`, confirm non-zero exit + `MISSING:` line, then rebuild and confirm exit 0) passed exactly as specified.

`make test` (Biome + all 321 vitest specs) remained green after all three tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-01, WR-02, and WR-01 from 06-VERIFICATION.md are now closed. Phase 06's remaining open items are the two `human_verification` entries carried forward from this plan's frontmatter (negative `pnpm install` on Node 18/20; full interactive `npx cz` on a TTY) — neither is executable in this autonomous sandbox and both are intentionally out of scope for this plan (see plan's Non-goals section).
- WR-03 (`@types/node@25` vs. Node 22 floor) remains explicitly out of scope (informational only, non-blocking).
- Downstream docs and ROADMAP references to the `>=22` floor still need updating to the corrected `^22.12.0 || >=24.0.0` string by the docs pass (`/gsd-docs-update`) — flagged in the plan's Deviation note.
- Phase 07 (TypeScript 6 Migration & Standalone Typecheck) can proceed once this phase closes out; no blockers introduced by this gap-closure plan.

---
*Phase: 06-toolchain-audit-modernization*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 7 modified files present on disk (5 package.json, ci.yml, Makefile) plus SUMMARY.md itself. All 3 task commits (`13f7766`, `00e586e`, `aaac2c7`) confirmed present in `git log --oneline --all`.

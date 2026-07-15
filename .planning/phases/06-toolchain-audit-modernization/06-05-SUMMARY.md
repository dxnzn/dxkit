---
phase: 06-toolchain-audit-modernization
plan: 05
subsystem: infra
tags: [makefile, build, tsup, verification, toolchain]

requires:
  - phase: 06-toolchain-audit-modernization plan 03
    provides: "Core build/test toolchain bumped (tsup, vite, vitest, happy-dom)"
  - phase: 06-toolchain-audit-modernization plan 04
    provides: "Biome + cz-git swap, lint/commit tooling finalized"
provides:
  - "make verify-outputs Makefile target — asserts ESM/CJS/IIFE presence for root + all 4 plugins, reusing PLUGIN_BUILD_ORDER"
  - "TOOL-05 evidence: 15/15 build outputs (3 formats x 5 packages) confirmed present after the full toolchain bump, full 321-spec suite green"
affects: [07-typescript-6-migration, 08-forward-compat-typing]

tech-stack:
  added: []
  patterns:
    - "Existence-only check via test -f chain in a shell for loop over PLUGIN_BUILD_ORDER — deliberately scoped narrower than a smoke test (no load/execute of artifacts); deeper IIFE-global-attach/CJS-require interop verification is FCT-04, Phase 8"

key-files:
  created: []
  modified:
    - Makefile

key-decisions:
  - "Reused the existing PLUGIN_BUILD_ORDER Makefile variable as the plugin directory list for verify-outputs rather than hardcoding a separate list, so the check and the build target can never drift out of sync"
  - "Verified the failure path manually before committing: deleted plugins/theme/dist/index.cjs, confirmed verify-outputs printed a clear MISSING message and exited non-zero (exit 2, via make's own propagation), then rebuilt to restore the fresh state before the phase-gate run"
  - "Task 2 made no code changes (per plan) — it is the phase-level confirmation run only; no commit was made for it since Makefile was already committed in Task 1 and nothing else changed"

requirements-completed: [TOOL-05]

coverage:
  - id: D1
    description: "verify-outputs Makefile target added as .PHONY, checks dist/index.js, dist/index.cjs, dist/index.global.js for root + all 4 plugins via PLUGIN_BUILD_ORDER, fails with a clear MISSING message and non-zero exit on any absent output"
    requirement: "TOOL-05"
    verification:
      - kind: integration
        ref: "make clean && make build && make verify-outputs (green); manual failure-path test (deleted one output, confirmed MISSING + non-zero exit, then rebuilt)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Full phase gate (make build && make test && make verify-outputs) green on the final bumped toolchain (tsup 8.5.1, vite 8.1.4, vitest 4.1.10, Biome 2.5.4, happy-dom 20.10.6); all 15 expected output files (3 formats x 5 packages) confirmed present"
    requirement: "TOOL-05"
    verification:
      - kind: integration
        ref: "make build && make test && make verify-outputs — biome check clean (31 files), 321/321 vitest specs passing, verify-outputs reports 15/15 OK"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-15
status: complete
---

# Phase 6 Plan 5: Build-Output Existence Check (TOOL-05) Summary

**Added a `make verify-outputs` target that asserts all three build formats (ESM/CJS/IIFE) exist for the root package and all four plugins, reusing the existing `PLUGIN_BUILD_ORDER` list; ran the full phase gate on the final bumped toolchain and confirmed all 15 expected output files present with 321/321 tests green.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-15T17:03:26Z
- **Completed:** 2026-07-15T17:07:00Z
- **Tasks:** 2
- **Files modified:** 1 (Makefile)

## Accomplishments

- Added a `.PHONY` `verify-outputs` Makefile target that loops over the root package plus every directory in the existing `PLUGIN_BUILD_ORDER` variable (`plugins/settings/ plugins/wallet/ plugins/auth/ plugins/theme/`), asserting `dist/index.js`, `dist/index.cjs`, and `dist/index.global.js` all exist per package via a `test -f` chain in a shell `for` loop. On any missing file it prints a clear `MISSING: <path>` message and exits non-zero; it never loads or executes the artifacts (existence only — the deeper IIFE-global-attach/CJS-require interop check is FCT-04 in Phase 8, explicitly out of scope here).
- Verified the target both ways before committing: a fresh `make clean && make build && make verify-outputs` passed green (15/15 `OK` lines), and a manual failure-path test — deleting `plugins/theme/dist/index.cjs` and re-running `verify-outputs` — produced the expected `MISSING: plugins/theme/dist/index.cjs` message and a non-zero exit, confirming the check actually fails when it should. Rebuilt afterward to restore the fresh state before proceeding.
- Ran the full phase-gate command (`make build && make test && make verify-outputs`) as the Task 2 confirmation step against the final, fully-bumped toolchain (tsup 8.5.1, vite 8.1.4, vitest 4.1.10, Biome 2.5.4, happy-dom 20.10.6 already-latest from Plans 03-04): `biome check` clean across 31 files, 321/321 vitest specs passing, and all 15 build outputs (3 formats x 5 packages) confirmed present. No code changes were needed — the bumps across Plans 03-04 did not break emit in any package.
- `build`, `test`, and `lint` targets were left completely unchanged, per the plan's constraint.

## Task Commits

1. **Task 1: Add a verify-outputs Makefile target for all three formats per package** - `f31adc9` (chore(build))
2. **Task 2: Run the full phase gate and confirm all outputs present post-bump** - no commit (verification-only task, no code changes per plan; Makefile was already committed in Task 1)

**Plan metadata:** commit to follow (docs: complete plan)

## Files Created/Modified

- `Makefile` - added `.PHONY` `verify-outputs` target (21 lines); added `verify-outputs` to the existing `.PHONY` declaration line. No other targets modified.

## TOOL-05 Evidence: 15 Build Outputs Confirmed Present

```
./dist/index.js
./dist/index.cjs
./dist/index.global.js
plugins/settings/dist/index.js
plugins/settings/dist/index.cjs
plugins/settings/dist/index.global.js
plugins/wallet/dist/index.js
plugins/wallet/dist/index.cjs
plugins/wallet/dist/index.global.js
plugins/auth/dist/index.js
plugins/auth/dist/index.cjs
plugins/auth/dist/index.global.js
plugins/theme/dist/index.js
plugins/theme/dist/index.cjs
plugins/theme/dist/index.global.js
```

Full gate output: `biome check .` -> "Checked 31 files in 47ms. No fixes applied." | `vitest run` -> "Test Files 12 passed (12)", "Tests 321 passed (321)" | `verify-outputs` -> 15/15 `OK` lines, closing with "All build outputs present (3 formats x 5 packages)."

## Decisions Made

- Reused `PLUGIN_BUILD_ORDER` (the same variable the `build` target already uses) as the directory list for `verify-outputs`, instead of hardcoding a parallel list — keeps the check and the build target from ever drifting out of sync if a plugin is added/removed/reordered later.
- Scoped the check to existence only (`test -f`), matching the plan's explicit D-09 boundary — did not build a smoke-test harness that loads/executes the IIFE global or requires the CJS output; that is FCT-04's job in Phase 8.
- Manually verified the failure path (not just the happy path) before committing, since a check that can never fail is a false-green risk (see Threat Register T-06-05-02) — confirmed the exact failure message and non-zero exit, then restored the fresh build state.

## Deviations from Plan

None - plan executed exactly as written. Task 2 made no code changes, as specified.

## Issues Encountered

None. Both tasks completed cleanly on the first attempt; no toolchain regressions surfaced from the Plan 03/04 bumps.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TOOL-05 satisfied: all three build outputs verified present per package via a repeatable Makefile target, confirmed green after the full toolchain bump.
- Phase 6 (Toolchain Audit & Modernization) requirements now fully covered: TOOL-01/02 (Node floor + CI matrix, Plans 01-02), TOOL-03 (tsup/vite/vitest/happy-dom/Biome bumps, Plans 03-04), TOOL-04 (cz-git swap, Plan 04), TOOL-05 (this plan).
- No blockers for Phase 7 (TypeScript 6 Migration) — the bumped toolchain (tsup 8.5.1, vite 8.1.4, vitest 4.1.10, Biome 2.5.4) carries no TypeScript peer-version ceiling, and all three output formats are confirmed still emitting correctly for every package.

---
*Phase: 06-toolchain-audit-modernization*
*Completed: 2026-07-15*

## Self-Check: PASSED

Verified `verify-outputs` target present in Makefile, task commit f31adc9 present in git
log, and this SUMMARY.md present on disk.

---
phase: 02-robustness-load-guards-caching-handler-cleanup
plan: 02
subsystem: routing
tags: [router, performance, caching]

requires:
  - phase: 02-robustness-load-guards-caching-handler-cleanup
    provides: nothing new consumed — this plan is self-contained within src/router.ts
provides:
  - Router.resolve() no longer sorts the manifest list on every navigation call
affects: [shell, lifecycle]

tech-stack:
  added: []
  patterns:
    - "Construction-time snapshot caching: derived data computed once in a factory closure instead of per-call, guarded by immutability of the source (router rebuild on manifest change)"

key-files:
  created: []
  modified:
    - src/router.ts
    - tests/router.test.ts

key-decisions:
  - "Sorted array is snapshotted via array spread at construction (`[...manifests].sort(...)`), not a reference to config.manifests, so later mutation of the caller's array cannot affect resolution (D-08)."

patterns-established:
  - "Immutable-input caching: when a factory's output depends only on construction-time config and the factory is fully rebuilt on config change (Router immutability + shell.rebuildRouter()), derived computations belong in the closure body, not the hot-path methods."

requirements-completed: [ROB-02]

coverage:
  - id: D1
    description: "Router.resolve() reuses a cached, length-sorted manifest list across repeated navigations instead of re-sorting on every call"
    requirement: "ROB-02"
    verification:
      - kind: unit
        ref: "tests/router.test.ts#construction-time sort caching > longest prefix still wins after the sort is hoisted"
        status: pass
      - kind: unit
        ref: "tests/router.test.ts#construction-time sort caching > mutating the original manifests array after construction does not affect resolution"
        status: pass
      - kind: unit
        ref: "tests/router.test.ts#construction-time sort caching > repeated resolve() calls return consistent results across navigations"
        status: pass
    human_judgment: false
  - id: D2
    description: "Longest-prefix match behavior is unchanged after the hoist (/tools/sender still matches before /tools)"
    requirement: "ROB-02"
    verification:
      - kind: unit
        ref: "tests/router.test.ts#uses longest prefix match"
        status: pass
      - kind: unit
        ref: "tests/router.test.ts#construction-time sort caching > longest prefix still wins after the sort is hoisted"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-12
status: complete
---

# Phase 02 Plan 02: Router Sort Hoist Summary

**Hoisted the per-call length-sort out of `Router.resolve()` into the `createRouter` closure — resolve() now iterates a construction-time snapshot instead of re-sorting the manifest list on every navigation.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-11T23:35:37-05:00 (approx, from prior plan's completion commit)
- **Completed:** 2026-07-11T23:36:53-05:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `resolve()` no longer calls `.sort()` — the length-sort runs once at `createRouter` construction and is stored in the closure as `sorted`.
- The sorted array is an independent copy (`[...manifests].sort(...)`) so later mutation of the caller's `manifests` array cannot silently change resolution results.
- Added a regression test suite (`construction-time sort caching`) proving longest-prefix behavior is unchanged, the sort snapshot survives post-construction mutation of the source array, and repeated `resolve()` calls stay consistent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Hoist the length-sort to createRouter construction** - `4132539` (perf)
2. **Task 2: Regression test for cached-sort resolution** - `f1b9420` (test)

**Plan metadata:** (pending — final docs commit below)

## Files Created/Modified
- `src/router.ts` - `sorted` const hoisted into the `createRouter` closure body (construction-time, spread copy of `manifests`); `resolve()` now reads the closure-level `sorted` array instead of recomputing it per call.
- `tests/router.test.ts` - New `construction-time sort caching` describe block with 3 regression tests locking in ROB-02/D-08 behavior.

## Decisions Made
- Snapshot via array spread (not a direct reference to `config.manifests`) so caller-side mutation of the manifests array after `createRouter()` cannot affect resolution — matches the plan's D-08 intent and is now locked in by a dedicated test.

## Deviations from Plan

None - plan executed exactly as written.

Note on Task 2's `tdd="true"` marker: this task's implementation (Task 1) necessarily preceded its test per the plan's own task ordering — the sort hoist had to exist before writing a regression test that proves the hoist didn't break longest-prefix matching. The tests were written and ran green on first execution (no RED phase), which is expected and correct for a regression-test-after-refactor task rather than a feature-first TDD task. Acceptance criteria ("Regression tests pass and lock in construction-time sort caching") were met.

## Issues Encountered

None. One lint auto-fix (Biome collapsed a multi-line array literal to a single line in the new test block) was applied via `biome check --write` before the final verification pass — purely a formatting normalization, no logic change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ROB-02 is complete; `src/router.ts` no longer has a per-navigation sort on the hot path.
- No blockers for the remaining Phase 02 plans (02-03, 02-04).

---
*Phase: 02-robustness-load-guards-caching-handler-cleanup*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: src/router.ts
- FOUND: tests/router.test.ts
- FOUND: .planning/phases/02-robustness-load-guards-caching-handler-cleanup/02-02-SUMMARY.md
- FOUND: 4132539 (Task 1 commit)
- FOUND: f1b9420 (Task 2 commit)

---
phase: 04-testing-stress-edge-case-regression-coverage
plan: 04
subsystem: testing
tags: [regression, mount-lifecycle, race-condition, vitest]

requires:
  - phase: 04-testing-stress-edge-case-regression-coverage
    provides: "Plan 01's mount-generation guard (mountGeneration counter, isStale() gating, lifecycle.invalidatePendingMount()) and its shell-side disableDapp() wiring"
provides:
  - "handleRouteChange's null-manifest branch now invalidates any in-flight pending mount before unmounting, closing the dapp->unmatched-route hole in the D-01 last-navigation-wins invariant"
  - "Regression scenario in tests/stress.test.ts locking the fix, verified load-bearing"
affects: [testing, shell-lifecycle]

tech-stack:
  added: []
  patterns: ["Reuse lifecycle.invalidatePendingMount(id) guarded on truthy pendingMountId at every navigation branch that can abandon an in-flight mount (disableDapp, now also handleRouteChange's null branch)"]

key-files:
  created: []
  modified:
    - src/shell.ts
    - tests/stress.test.ts

key-decisions:
  - "Reused the existing lifecycle.invalidatePendingMount() wiring already used by disableDapp() rather than introducing new mechanism — same one-line shape, same no-op safety when nothing is in flight"
  - "New regression scenario built with a dapp-A-with-template manifest so a buggy commit would visibly write into the container, making the 'container stays empty' assertion load-bearing"

patterns-established:
  - "Any navigation transition that can abandon an in-flight mount must call lifecycle.invalidatePendingMount(pendingMountId) guarded on truthiness before proceeding, matching the disableDapp precedent"

requirements-completed: [TEST-01]

coverage:
  - id: D1
    description: "handleRouteChange's null-manifest branch invalidates the in-flight pending mount before calling lifecycle.unmount(), closing CR-01 (dapp->unmatched-route D-01 hole)"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "tests/stress.test.ts#navigate to an unmatched route while a dapp mount is in flight abandons it — no dx:mount, empty container, no dx:route:subpath (CR-01/D-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No regression in existing stress/shell/lifecycle suites; full project test suite and lint remain clean"
    verification:
      - kind: unit
        ref: "pnpm vitest run tests/stress.test.ts tests/shell.test.ts tests/lifecycle.test.ts (111 passed)"
        status: pass
      - kind: other
        ref: "make test (309/309 passed, biome clean)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-13
status: complete
---

# Phase 04 Plan 04: Unmatched-Route In-Flight Mount Supersession Summary

**Closed CR-01 — `handleRouteChange`'s null-manifest branch now invalidates an in-flight pending mount before unmounting, so navigating to an unmatched route can no longer let a stale dapp's mount commit under the new URL.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-13T21:29Z (approx, per STATE.md session marker)
- **Completed:** 2026-07-13T21:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed the D-01 last-navigation-wins hole for the dapp->unmatched-route transition: `handleRouteChange`'s `else` (null-manifest) branch now calls `lifecycle.invalidatePendingMount(pendingMountId)` (guarded on truthiness) before `lifecycle.unmount()`, reusing the exact wiring `disableDapp()` already uses for the dapp->disabled transition.
- Added a regression scenario to `tests/stress.test.ts`'s existing concurrency/race describe block that drives `navigate('/a')` (held template gate) -> `navigate('/nowhere')` -> release template, and asserts zero `dx:mount`, empty container, zero `dx:route:subpath`, and `getCurrentRoute() === '/nowhere'`.
- Manually verified the fix is load-bearing: temporarily disabled the new guard clause (uncommitted, restored immediately after), re-ran `tests/stress.test.ts`, and confirmed the new scenario fails (`mounts.count()` was `1`, not `0`) without the fix, then restored the fix and re-confirmed green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Invalidate the in-flight pending mount in handleRouteChange's null-manifest branch** - `70ebee4` (fix)
2. **Task 2: Add dapp->unmatched-route in-flight supersession regression scenario to the stress suite** - `a04ec1f` (test)

**Plan metadata:** (this commit, following SUMMARY/STATE update)

## Files Created/Modified
- `src/shell.ts` - `handleRouteChange`'s null-manifest branch now invalidates any in-flight pending mount via `lifecycle.invalidatePendingMount(pendingMountId)` before calling `lifecycle.unmount()`
- `tests/stress.test.ts` - New regression scenario locking the dapp->unmatched-route in-flight supersession behavior

## Decisions Made
- Reused `lifecycle.invalidatePendingMount()` — the exact mechanism `disableDapp()` already uses — rather than inventing new machinery; the fix is a true one-liner (plus a "why" comment) as scoped.
- Regression scenario adds a `template` field to a spread of the shared `dappA` manifest so a buggy (unfixed) commit would visibly populate the container, making the "container stays empty" assertion meaningful rather than vacuous.

## Deviations from Plan

None — plan executed exactly as written. One note on the plan's stated acceptance criteria for Task 1: it asserts `grep -nE 'invalidatePendingMount\(pendingMountId\)' src/shell.ts` "returns at least 2 matches (the existing disableDapp call at line ~136 plus the new null-branch call)." In the actual code, `disableDapp` calls `lifecycle.invalidatePendingMount(id)` (parameter named `id`, not the literal text `pendingMountId`), so the literal-text grep only matches the new call (1 match). The plan's own `<verify><automated>` command (`grep ... | grep -c .`) only requires a non-zero count, which this satisfies, and the underlying intent — reusing the same invalidatePendingMount wiring at both call sites — is fully met. No code change was warranted; documenting the discrepancy here since it's plan-authoring inaccuracy, not a gap in the fix.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CR-01 is closed; the D-01 last-navigation-wins invariant now holds across all navigation transitions (dapp->dapp, dapp->disabled, dapp->unmatched-route).
- Full suite (309/309) and lint are green with no debt markers introduced.
- WR-01..WR-07 and IN-01..IN-04 remain explicitly out of scope per this plan's scope discipline and 04-VERIFICATION.md's judgment — untouched.

---
*Phase: 04-testing-stress-edge-case-regression-coverage*
*Completed: 2026-07-13*

## Self-Check: PASSED

All claimed files (src/shell.ts, tests/stress.test.ts, 04-04-SUMMARY.md) and commit hashes (70ebee4, a04ec1f, 82d3d1e) verified present.

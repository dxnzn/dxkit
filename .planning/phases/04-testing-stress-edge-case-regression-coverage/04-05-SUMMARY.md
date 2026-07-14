---
phase: 04-testing-stress-edge-case-regression-coverage
plan: 05
subsystem: testing
tags: [vitest, happy-dom, concurrency, mount-races, regression]

# Dependency graph
requires:
  - phase: 04-testing-stress-edge-case-regression-coverage
    provides: 04-04's dapp->unmatched-route regression fix and the pendingMountId/mountGeneration guard machinery this plan hardens
provides:
  - "invalidateAnyPendingMount() on LifecycleManager — abandons whatever mount is in flight, keyed on the lifecycle's own inFlightMountId"
  - "Guarded mountDapp finally (src/shell.ts) that can no longer clobber a newer mount's pendingMountId slot"
  - "handleRouteChange's null-manifest branch decoupled from the corruptible shell-level pendingMountId"
  - "A committed, green stress regression locking the A->B-overlap-then-unmatched-route interleaving"
affects: [phase-05-docs-truth-pass]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lifecycle-truth invalidation: callers that must supersede any in-flight mount read the lifecycle's own inFlightMountId (invalidateAnyPendingMount) rather than trusting shell-level bookkeeping that can be corrupted by an interleaved stale settle."
    - "Guarded finally clear: only release ownership of a shared mutable slot (pendingMountId) when the settling call still owns it (pendingMountId === manifest.id), preventing cross-call state corruption."

key-files:
  created: []
  modified:
    - src/lifecycle.ts
    - src/shell.ts
    - tests/stress.test.ts

key-decisions:
  - "invalidateAnyPendingMount() bumps mountGeneration only when inFlightMountId !== null (no-op otherwise) — a spurious bump is harmless since the next mount() call re-captures ++mountGeneration regardless"
  - "mountDapp's finally only clears pendingMountId when pendingMountId === manifest.id — the existing same-id early return already excludes concurrent same-id calls, so this guard is safe against the one remaining stale-cross-dapp-settle case"
  - "invalidatePendingMount(id) left unchanged and still wired from disableDapp() — invalidateAnyPendingMount() is additive, not a replacement, for the id-scoped use case"
  - "New regression scenario uses entry-only dappA/dappB (no template) to stay inside this plan's scope boundary and avoid touching WR-01's out-of-scope container-residue path"

patterns-established: []

requirements-completed: [TEST-01]

coverage:
  - id: D1
    description: "invalidateAnyPendingMount() added to LifecycleManager, abandoning any in-flight mount independent of shell-level pendingMountId"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts (full suite, no regressions)"
        status: pass
      - kind: unit
        ref: "tests/stress.test.ts#A->B overlap where stale A settles first, then an unmatched-route navigation abandons the still-in-flight B (CR-01 reopened/D-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "mountDapp's finally guarded so a stale settling call cannot clobber a newer mount's pendingMountId slot"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts (full suite, no regressions)"
        status: pass
      - kind: unit
        ref: "tests/stress.test.ts#A->B overlap where stale A settles first, then an unmatched-route navigation abandons the still-in-flight B (CR-01 reopened/D-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Regression scenario locking the A->B-overlap-then-unmatched-route interleaving, verified load-bearing by temporarily reverting the fix"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "tests/stress.test.ts (full file, 7 scenarios, all pass)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-14
status: complete
---

# Phase 04 Plan 05: Guard the finally, decouple invalidation from shell bookkeeping Summary

**Closed the reopened D-01 gap (CR-01) by guarding mountDapp's finally and adding a lifecycle-truth invalidateAnyPendingMount() entry point that handleRouteChange's null branch now calls, so an A->B overlapping mount can no longer commit a stale B under an unmatched route.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-14T01:42:00Z
- **Completed:** 2026-07-14T01:44:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Root-caused and fixed the pendingMountId clobber: `mountDapp`'s `finally` now only clears the shell-level slot when it still belongs to the settling call (`pendingMountId === manifest.id`), so a stale A settling after being superseded by B can no longer erase B's in-flight marker.
- Added `invalidateAnyPendingMount()` to `LifecycleManager` — abandons whatever mount is currently in flight by reading the lifecycle's own `inFlightMountId`, independent of any shell-level bookkeeping. `handleRouteChange`'s null-manifest branch now calls it unconditionally, replacing the old `pendingMountId`-keyed `invalidatePendingMount(pendingMountId)` call that the clobber could silently defeat.
- Added a committed, green stress regression (`tests/stress.test.ts`) driving navigate('/a') → navigate('/b') → release stale A → navigate('/nowhere') → release B, asserting zero `dx:mount`/`dx:dapp:mounted` for either dapp and `getCurrentRoute() === '/nowhere'`. Verified the scenario is load-bearing by temporarily reverting the Task 1 fix and confirming the new test fails (B commits with count 1) before restoring the fix unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Guard the finally and add a shell-independent invalidateAnyPendingMount entry point** - `fd587db` (fix)
2. **Task 2: Add the A->B-overlap-then-unmatched-route regression scenario to the stress suite** - `87448f5` (test)

**Plan metadata:** pending (docs: complete plan — committed after this SUMMARY)

## Files Created/Modified
- `src/lifecycle.ts` - Added `invalidateAnyPendingMount(): void` to the `LifecycleManager` interface and implementation; bumps `mountGeneration` when `inFlightMountId !== null`, added to the returned object literal alongside `invalidatePendingMount`.
- `src/shell.ts` - `mountDapp`'s `finally` now guards the `pendingMountId = null` clear behind `pendingMountId === manifest.id`; `handleRouteChange`'s null-manifest branch now calls `lifecycle.invalidateAnyPendingMount()` unconditionally in place of the old `pendingMountId`-keyed call.
- `tests/stress.test.ts` - Added the A->B-overlap-then-unmatched-route regression scenario inside the existing `describe('stress: concurrency & mount races (TEST-01, D-01/D-02/D-03)')` block (7 scenarios total, up from 6).

## Decisions Made
- `invalidateAnyPendingMount()` bumps `mountGeneration` only when `inFlightMountId !== null` (no-op otherwise) — a spurious bump would be harmless anyway since the next `mount()` call re-captures `++mountGeneration`, but the guard keeps the function's contract explicit.
- The finally guard (`pendingMountId === manifest.id`) is safe against concurrent same-id calls because the existing early return at the top of `mountDapp` (`if (pendingMountId === manifest.id) return;`) already excludes them — only one call per dapp id ever reaches the `try`/`finally`.
- `invalidatePendingMount(id)` was left completely unchanged and still wired from `disableDapp()` — `invalidateAnyPendingMount()` is additive, addressing the distinct case (unmatched-route navigation) where the caller has no reliable id to key off.
- The new regression scenario deliberately uses the existing entry-only `dappA`/`dappB` manifests (no `template`) to keep the test inside this plan's scope boundary — templated manifests would exercise WR-01's out-of-scope post-injection container-residue path.

## Deviations from Plan

None - plan executed exactly as written. Both edits in Task 1 (lifecycle.ts interface/implementation, shell.ts finally guard + handleRouteChange call) and the Task 2 regression scenario matched the plan's specified shape precisely.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04's D-01 last-navigation-wins invariant is now closed across all known interleavings (04-04's single dapp->unmatched-route case, and this plan's A->B-overlap variant); `make test` reports 310/310 passing with lint clean.
- `invalidatePendingMount(id)` and `invalidateAnyPendingMount()` now coexist on `LifecycleManager` with clearly distinct contracts (id-scoped vs. lifecycle-truth) — future plans needing to abandon an in-flight mount should default to `invalidateAnyPendingMount()` unless they specifically need to target one known id without affecting an unrelated in-flight mount.
- No blockers for Phase 05 (docs truth pass). WR-01 (post-injection container residue) and the remaining WR-*/IN-* findings from 04-VERIFICATION.md remain explicitly out of scope and untouched, as directed.

---
*Phase: 04-testing-stress-edge-case-regression-coverage*
*Completed: 2026-07-14*

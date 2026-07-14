---
phase: 04-testing-stress-edge-case-regression-coverage
plan: 06
subsystem: testing
tags: [vitest, happy-dom, concurrency, mount-races, regression, dedupe]

# Dependency graph
requires:
  - phase: 04-testing-stress-edge-case-regression-coverage
    provides: 04-04's dapp->unmatched-route fix, 04-05's guarded-finally + invalidateAnyPendingMount() machinery this plan closes the remaining hole in
provides:
  - "Call-scoped pendingMountToken (src/shell.ts) making mountDapp's finally slot-ownership liveness-aware instead of id-keyed"
  - "releasePendingMount() helper wired into both invalidation call sites (handleRouteChange's null branch, disableDapp) — frees the shell dedupe slot on invalidation"
  - "Two committed, green stress regressions locking A->unmatched->A (WR-11) and disableDapp->enableDapp->re-navigate re-mounting fresh"
affects: [phase-05-docs-truth-pass]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Call-scoped slot ownership: a shared mutable dedupe slot (pendingMountId) is now paired with a monotonic token captured per call; only the call whose token still matches may release the slot, so an invalidated call's finally can never clear a newer attempt's ownership or leave the slot permanently stuck on a dead id."
    - "Explicit release on invalidation: any call site that invalidates an in-flight mount (unmatched-route navigation, disableDapp) must also free the corresponding shell-level dedupe slot — bumping the lifecycle's mountGeneration alone is not sufficient, since the shell tracks its own separate pendingMountId bookkeeping."

key-files:
  created: []
  modified:
    - src/shell.ts
    - tests/stress.test.ts

key-decisions:
  - "pendingMountToken is a plain incrementing counter (starts at 0), bumped both when mountDapp takes the slot and when releasePendingMount() frees it — token equality in the finally is the sole ownership check, replacing the id-equality guard from 04-05"
  - "The same-id dedupe check at mountDapp's top (pendingMountId === manifest.id) is left completely unchanged — only the finally's release condition changed; the legitimate concurrent-duplicate dedupe (two genuinely-concurrent mountDapp calls for the same id, no intervening invalidation) still works because both would observe the still-set pendingMountId"
  - "disableDapp's releasePendingMount() call is guarded by pendingMountId === id — the slot is only freed if it currently belongs to the disabled dapp, avoiding an unrelated in-flight mount's slot being cleared by an unrelated disableDapp call"
  - "New regression scenarios hold the template gate (not the entry-script gate) so only the winning mount ever injects into the container, keeping both tests orthogonal to WR-02's out-of-scope post-injection container-residue path"

patterns-established: []

requirements-completed: [TEST-01]

coverage:
  - id: D1
    description: "mountDapp's finally guard changed from id-equality to token-equality (pendingMountToken === myToken), making slot release call-scoped"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts (full suite, no regressions)"
        status: pass
      - kind: unit
        ref: "tests/stress.test.ts#sub-path navigation into A while A is still mounting commits with the freshest path (D-03 scenario 3) — same-dapp dedupe still works unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "releasePendingMount() frees the shell dedupe slot at both invalidation call sites (handleRouteChange null branch, disableDapp), closing the drop window for re-navigation to an invalidated dapp"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "tests/stress.test.ts#A -> unmatched -> A: re-navigation to an invalidated dapp mounts fresh, not dropped by the dedupe (CR-01/WR-11/D-01)"
        status: pass
      - kind: unit
        ref: "tests/stress.test.ts#disableDapp -> enableDapp -> re-navigate: re-navigation to a mid-mount-disabled dapp mounts fresh (dedupe-liveness twin)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both new regression scenarios verified load-bearing by temporarily reverting the Task 1 fix and confirming each drops to mount count 0"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "tests/stress.test.ts (full file, 9 scenarios, all pass); manual revert-and-restore against commit 06c3a93 confirmed both new scenarios fail without the fix"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-14
status: complete
---

# Phase 04 Plan 06: Close the third D-01 dedupe-liveness hole (CR-01) Summary

**Made the shell's mount dedupe slot call-scoped (pendingMountToken) and liveness-aware (releasePendingMount() at both invalidation sites), so a re-navigation to a dapp whose in-flight mount was invalidated by an unmatched route or disableDapp() mounts fresh instead of being silently dropped for up to the 30s loader timeout.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-14T02:51:00Z
- **Completed:** 2026-07-14T02:59:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Root-caused and fixed CR-01, the third distinct instance of the D-01 last-navigation-wins invariant being violated: `mountDapp`'s same-id dedupe at `src/shell.ts:392` checked only `pendingMountId === manifest.id`, never whether the in-flight call it was deduping against had already been invalidated. An unmatched-route navigation or `disableDapp()` bumped the lifecycle's `mountGeneration` but left the shell-level `pendingMountId` parked on the invalidated dapp's id — silently dropping any re-navigation to it until the stale mount's loader settled, with no `dx:mount`, no error, and `getCurrentRoute()` pointing at a route nothing was mounted under.
- Added a call-scoped `pendingMountToken` counter and a `releasePendingMount()` helper. `mountDapp` now captures `const myToken = ++pendingMountToken` when it takes the slot; its `finally` clears `pendingMountId` only when `pendingMountToken === myToken`, so a stale/invalidated call can never clobber a newer attempt's slot. `releasePendingMount()` is called from `handleRouteChange`'s null branch (after `invalidateAnyPendingMount()`) and from `disableDapp` (after `invalidatePendingMount(id)`, guarded by `pendingMountId === id`), freeing the slot so the next re-navigation to that dapp is not dropped by the dedupe.
- Added two committed, green stress regressions to `tests/stress.test.ts`: A->unmatched->A (WR-11) and disableDapp->enableDapp->re-navigate (the dedupe-liveness twin), each asserting exactly one `dx:mount`/`dx:dapp:mounted` for the re-navigated dapp and a populated container. Verified both are load-bearing by temporarily checking out the pre-fix `src/shell.ts` from commit `06c3a93`, confirming both scenarios fail (mount count 0), then restoring the fix.
- Confirmed no regressions: the legitimate same-dapp dedupe (sub-path-into-mounting-A scenario), 04-04's dapp->unmatched scenario, and 04-05's A->B-overlap-then-unmatched scenario all still pass unchanged. `lifecycle.ts` is byte-for-byte untouched (`git diff --stat` shows no changes). Full suite: `make test` reports 312/312 passing (prior 310 + 2 new), lint clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make the shell dedupe slot call-scoped and liveness-aware (pendingMountToken + releasePendingMount)** - `79732f9` (fix)
2. **Task 2: Add the A->unmatched->A (WR-11) and disableDapp->enableDapp->re-navigate regression scenarios** - `fa92c45` (test)

**Plan metadata:** pending (docs: complete plan — committed after this SUMMARY)

## Files Created/Modified
- `src/shell.ts` - Added `pendingMountToken` closure counter and `releasePendingMount()` helper; `mountDapp` captures `myToken` when taking the slot and its `finally` now guards the clear on `pendingMountToken === myToken` (was `pendingMountId === manifest.id`); `handleRouteChange`'s null branch and `disableDapp` (guarded on `pendingMountId === id`) now call `releasePendingMount()` after their respective lifecycle invalidation calls. The same-id dedupe check at `mountDapp`'s top is unchanged.
- `tests/stress.test.ts` - Added two `it(...)` scenarios inside the existing `describe('stress: concurrency & mount races (TEST-01, D-01/D-02/D-03)')` block (9 scenarios total, up from 7): A->unmatched->A re-navigation (WR-11) and disableDapp->enableDapp->re-navigate (dedupe-liveness twin). Both use templated manifests holding the template gate to stay orthogonal to WR-02's out-of-scope container-residue path.

## Decisions Made
- `pendingMountToken` is a plain incrementing counter bumped both when `mountDapp` takes the slot (`++pendingMountToken`) and when `releasePendingMount()` frees it — token equality in the `finally` is the sole ownership check, fully replacing the id-equality guard 04-05 introduced (which this plan's acceptance criteria confirm via `grep -cE 'pendingMountId === manifest\.id' src/shell.ts` dropping from 2 to 1).
- The legitimate same-dapp dedupe (two genuinely-concurrent `mountDapp` calls for the same id with no intervening invalidation) is preserved by leaving the top-of-function id-equality check untouched — only the release condition in the `finally` changed.
- `disableDapp`'s `releasePendingMount()` call is guarded by `pendingMountId === id` so an unrelated in-flight mount's slot is never cleared by an unrelated dapp's `disableDapp()` call.
- New regression scenarios hold the template gate rather than the entry-script gate — this ensures only the winning mount ever injects into the container, keeping the tests strictly inside this plan's CR-01 scope and orthogonal to WR-02 (container residue, out of scope).

## Deviations from Plan

None - plan executed exactly as written. Both Task 1's four `src/shell.ts` edits (token declaration, `releasePendingMount()` helper, `mountDapp` token capture, `handleRouteChange`/`disableDapp` release calls) and Task 2's two regression scenarios matched the plan's specified shape precisely, including the load-bearing revert-and-restore verification.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04's D-01 last-navigation-wins invariant is now closed across all three known interleavings (04-04's dapp->unmatched-route case, 04-05's A->B-overlap-then-unmatched case, and this plan's re-navigation-after-invalidation case for both the unmatched-route and disableDapp paths). `make test` reports 312/312 passing with lint clean.
- WR-01 is closed as an inherent side effect of the call-scoped `finally` (a stale call can no longer clobber a newer attempt's slot via id equality) — no separate WR-01 work or test was added, per plan scope.
- No blockers for Phase 05 (docs truth pass). Out-of-scope findings from 04-VERIFICATION.md — WR-02 (container residue), WR-03..WR-06, WR-07's stranded-URL recovery half, WR-08..WR-10, IN-01..IN-06 — remain untouched, as directed.

---
*Phase: 04-testing-stress-edge-case-regression-coverage*
*Completed: 2026-07-14*

## Self-Check: PASSED

- FOUND: src/shell.ts
- FOUND: tests/stress.test.ts
- FOUND: .planning/phases/04-testing-stress-edge-case-regression-coverage/04-06-SUMMARY.md
- FOUND commit: 79732f9
- FOUND commit: fa92c45

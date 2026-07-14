---
phase: quick-260714-1lz
plan: 01
subsystem: routing
tags: [lifecycle, shell, mount, race-conditions, dx-route-subpath]

requires:
  - phase: 04-testing-stress-edge-case-regression-coverage
    provides: mount-generation guard (isStale()), pendingMountToken dedupe, invalidateAnyPendingMount/invalidatePendingMount
provides:
  - lifecycle.mount() returns Promise<boolean> reporting whether THIS call committed
  - shell.mountDapp epilogue gated entirely on the commit flag (no more getCurrentDapp()===id ambiguity)
  - normalizeRoute trims whitespace before normalization
affects: [phase-05-documentation-truth-pass]

tech-stack:
  added: []
  patterns:
    - "Mount commit-flag contract: async orchestration functions that can be superseded mid-flight return a boolean reporting whether THIS call reached its commit point, so callers gate entire continuations on that flag instead of re-deriving ownership from shared state."

key-files:
  created: []
  modified:
    - src/lifecycle.ts
    - src/shell.ts
    - tests/stress.test.ts
    - tests/shell.test.ts

key-decisions:
  - "lifecycle.mount() return type changed from Promise<void> to Promise<boolean> — true only at the commit block, false on every early return (missing plugin, load failure, or any isStale() gate) — since getCurrentDapp()===manifest.id cannot distinguish two same-id mount calls racing."
  - "shell.mountDapp epilogue (fresh-path catch-up dx:route:subpath emit + currentPath write) is now wrapped in `if (committed)`, dropping the redundant getCurrentDapp() sub-clause entirely."
  - "normalizeRoute trims via route.trim() before the leading-slash prepend and trailing-slash strip, so ' /a' and '/a ' both normalize to a reachable '/a' instead of a silently-unreachable route (D-06)."

patterns-established:
  - "Regression test verified against pre-fix code: temporarily restored the pre-fix src/lifecycle.ts and src/shell.ts from HEAD~1 and confirmed the new stress test fails (2 subpath events instead of 1) before restoring the fix, per plan verification requirement."

requirements-completed: [PR4-CR-stale-mountDapp-epilogue, PR4-CR-normalizeRoute-trim]

coverage:
  - id: D1
    description: "A stale/superseded mount call's mountDapp epilogue is fully inert — never overwrites currentPath, never emits a spurious/duplicate dx:route:subpath"
    requirement: "PR4-CR-stale-mountDapp-epilogue"
    verification:
      - kind: unit
        ref: "tests/stress.test.ts#a stale same-id mount epilogue is inert — no swallowed/duplicate dx:route:subpath after invalidate-then-renavigate (CR-01 gap closure)"
        status: pass
    human_judgment: false
  - id: D2
    description: "normalizeRoute trims leading/trailing whitespace before normalizing, so whitespace-padded manifest routes are reachable instead of silently dropped"
    requirement: "PR4-CR-normalizeRoute-trim"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#normalizes a route with leading whitespace so it becomes reachable"
        status: pass
      - kind: unit
        ref: "tests/shell.test.ts#normalizes a route with trailing whitespace so it becomes reachable"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-07-14
status: complete
---

# Quick Task 260714-1lz: Fix Stale mountDapp Epilogue + normalizeRoute Trim Summary

**lifecycle.mount() now returns a commit boolean so shell.mountDapp gates its entire epilogue on it (closing a third D-01 interleaving hole), and normalizeRoute trims whitespace before normalizing (D-06).**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-14T01:20:00Z
- **Completed:** 2026-07-14T01:38:00Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- `lifecycle.mount()` (and the `LifecycleManager` interface) now return `Promise<boolean>` — true only when THIS call reaches the commit point, false on every early return — replacing the ambiguous `getCurrentDapp() === manifest.id` check that couldn't distinguish two same-id mount calls racing.
- `shell.mountDapp`'s epilogue (fresh-path catch-up `dx:route:subpath` emit + `currentPath` write) is now wrapped entirely in `if (committed)`, so a stale/superseded call's continuation can neither pre-write `currentPath` (swallowing a later same-dapp sub-path nav) nor emit a spurious/duplicate `dx:route:subpath`.
- `normalizeRoute` trims whitespace (`route.trim()`) before the leading-slash prepend and trailing-slash strip, so `' /a'` and `'/a '` both normalize to a reachable `'/a'` instead of silently becoming `'/ /a'` or an unreachable trailing-space route (D-06).
- Added a deterministic regression test (`tests/stress.test.ts`) with a new `handleGate` per-call queue-gate helper, proving the stale epilogue is inert through a full invalidate-then-renavigate flow — confirmed to fail against pre-fix code (2 `dx:route:subpath` events instead of 1) before verifying the fix resolves it.
- Added two `normalizeRoute` unit tests (`tests/shell.test.ts`) proving leading- and trailing-whitespace routes are both reachable.

## Task Commits

Each task was committed atomically:

1. **Task 1: mount() commit-flag + epilogue gating + normalizeRoute trim** - `17e863d` (fix)
2. **Task 2: Regression tests — stale epilogue (stress) + normalizeRoute trim (unit)** - `c3cf2ed` (test)

_Note: docs/plan-metadata commit is created separately by the orchestrator, not by this executor._

## Files Created/Modified
- `src/lifecycle.ts` - `mount()` return type changed `Promise<void>` → `Promise<boolean>`; every early `return;` became `return false;`; the commit block now `return true;` after emitting `dx:mount`/`dx:dapp:mounted`; `LifecycleManager` interface updated to match, with a doc comment explaining the commit-flag contract.
- `src/shell.ts` - `mountDapp` captures `const committed = await lifecycle.mount(...)` and wraps the entire epilogue (fresh-path re-read, catch-up `dx:route:subpath` emit, `currentPath` write) in `if (committed)`, dropping the redundant `lifecycle.getCurrentDapp() === manifest.id` sub-clause; `normalizeRoute` now trims via `route.trim()` before normalizing.
- `tests/stress.test.ts` - Added `handleGate<T>()` per-call queue-gate helper (releases one waiter at a time by call-order index, unlike `keyedGate`'s resolve-all-by-key) and a new `it(...)` proving a stale same-id mount's epilogue is inert after an invalidate-then-renavigate flow.
- `tests/shell.test.ts` - Added two `it(...)` cases in the `describe('manifest & route validation (D-06/D-07/D-08)')` block proving `' /a'` and `'/a '` both normalize to a reachable `'/a'`.

## Decisions Made
- `lifecycle.mount()`'s boolean return is the single source of truth for "did THIS call commit" — no attempt to reconcile it with `getCurrentDapp()` at the shell layer; the sub-clause was dropped entirely rather than kept as a redundant belt-and-suspenders check, per the plan's explicit instruction (minimal, non-restructuring fix).
- The new `handleGate` test helper was added alongside `keyedGate` rather than modifying `keyedGate`'s all-waiters-resolve-together semantics, preserving existing tests that depend on that behavior.

## Deviations from Plan

None - plan executed exactly as written. Both fixes, both regression tests, and the verification of the stress test's pre-fix failure all matched the plan's task specifications precisely.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both PR #4 code-review defects (stale mountDapp epilogue, normalizeRoute whitespace) are closed with regression coverage. `make test` is fully green at 315/315 tests, lint clean.
- Phase 04 (testing-stress-edge-case-regression-coverage) remains shipped; this quick task closes a gap surfaced by a subsequent re-review. No new blockers for Phase 5 (Documentation — Truth Pass).

---
*Quick Task: 260714-1lz*
*Completed: 2026-07-14*

## Self-Check: PASSED

All referenced files (src/lifecycle.ts, src/shell.ts, tests/stress.test.ts, tests/shell.test.ts, SUMMARY.md) and both task commit hashes (17e863d, c3cf2ed) verified present.

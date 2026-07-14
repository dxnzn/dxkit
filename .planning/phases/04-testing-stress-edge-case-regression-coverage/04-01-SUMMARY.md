---
phase: 04-testing-stress-edge-case-regression-coverage
plan: 01
subsystem: testing
tags: [concurrency, race-condition, vitest, mount-lifecycle, generation-guard, fake-timers]

requires:
  - phase: 02-robustness-load-guards-caching-handler-cleanup
    provides: per-fetch load timeout guard (withTimeout) that the timeout-race scenario exercises
  - phase: 03-security-sanitization-storage-isolation
    provides: sanitizeTemplate mount step and nested ShellConfig.lifecycle shape stress fixtures construct against
provides:
  - Mount-generation guard (mountGeneration counter + isStale() gating) in src/lifecycle.ts closing the last-finisher-wins race
  - invalidatePendingMount(id) LifecycleManager hook, wired from shell.disableDapp(), closing the disable-mid-flight gap
  - Fresh-path commit fix in shell.mountDapp() for sub-path navigation dropped during a pending mount
  - tests/stress.test.ts — dedicated concurrency/race regression suite covering the full D-03 matrix
affects: [testing, lifecycle, shell, router]

tech-stack:
  added: []
  patterns:
    - "Closure-scoped monotonic generation counter (mountGeneration) checked via isStale() immediately before every container mutation/state commit — generalizes the existing pendingMountId same-dapp dedupe idiom to cross-dapp supersession"
    - "keyedGate<T>() test fixture — deferred promises collected per src/url key, release(key) resolves every concurrent waiter for that key, for fully timing-independent race interleaving control in tests"

key-files:
  created:
    - tests/stress.test.ts
  modified:
    - src/lifecycle.ts
    - src/shell.ts
    - tests/lifecycle.test.ts

key-decisions:
  - "mountGeneration/inFlightMountId live inside createLifecycleManager()'s closure, not module scope — multiple shells in one process must not share a counter"
  - "A stale mount's own load failure is never reported via dx:error and never clears the container — only the newer mount's outcome is worth reporting, per RESEARCH's isStale()-gated error/clear discipline"
  - "invalidatePendingMount(id) bumps mountGeneration only when inFlightMountId === id — a no-op for any other id, so it can't cancel an unrelated in-flight mount"
  - "Sub-path fresh-path fix re-reads router.getCurrentPath() after lifecycle.mount() resolves and emits a dx:route:subpath catch-up if it moved, rather than threading a mutable path into the in-flight mount call"
  - "Stress suite drives every scenario through createShell()+shell.navigate() in mode: 'history', never createLifecycleManager() directly (Pitfall 4) and never hash mode (Pitfall 3 — real async hashchange isn't fake-timer-controllable)"

patterns-established:
  - "Generation-guard staleness gating: capture a monotonic counter at the top of an async operation, re-check immediately before every side-effecting commit point, never just at the end"

requirements-completed: [TEST-01]

coverage:
  - id: D1
    description: "Mount-generation guard (mountGeneration + isStale()) in src/lifecycle.ts — a superseded mount never writes the container, never sets currentDappId, and never emits dx:mount/dx:dapp:mounted"
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#mount generation guard (D-01/D-03 last-navigation-wins) > a second mount() supersedes the first"
        status: pass
      - kind: integration
        ref: "tests/stress.test.ts#rapid A -> B -> A: last-navigation-wins, no double-mount, strict alternation, DOM matches the winner"
        status: pass
    human_judgment: false
  - id: D2
    description: "invalidatePendingMount(id) on LifecycleManager, wired from shell.disableDapp(), abandons an in-flight mount for a dapp that was just disabled"
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#mount generation guard (D-01/D-03 last-navigation-wins) > invalidatePendingMount(id) abandons an in-flight mount for that id"
        status: pass
      - kind: integration
        ref: "tests/stress.test.ts#disableDapp() while that dapp is mid-mount abandons it"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fresh-path commit fix in shell.mountDapp() — a sub-path navigation dropped by the pendingMountId dedupe no longer leaves the committed path/dx:route:subpath stale"
    requirement: TEST-01
    verification:
      - kind: integration
        ref: "tests/stress.test.ts#sub-path navigation into A while A is still mounting commits with the freshest path"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dedicated stress suite (tests/stress.test.ts) proving the full D-03 race matrix (rapid A->B->A, disable-mid-flight, timeout-after-navigate-away, sub-path-during-pending, init racing navigation) ships green"
    requirement: TEST-01
    verification:
      - kind: integration
        ref: "pnpm vitest run tests/stress.test.ts"
        status: pass
      - kind: integration
        ref: "make test"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-07-13
status: complete
---

# Phase 4 Plan 1: Mount-Race Fix + Stress Suite Summary

**Closure-scoped mount-generation guard fixes last-navigation-wins in lifecycle.mount(), plus a dedicated tests/stress.test.ts proving the full D-03 concurrency matrix — suite ships green.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-07-13T19:03:00Z
- **Completed:** 2026-07-13T19:29:28Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Fixed the mount race: `src/lifecycle.ts` now carries a closure-scoped `mountGeneration` counter, captured per `mount()` call and re-checked via `isStale()` immediately after `loadTemplate`, after `sanitizeTemplate`, inside the dependency loop, and before the final `currentDappId` commit — a superseded mount abandons at its next gate without touching the container, `currentDappId`, or emitting `dx:mount`/`dx:dapp:mounted`, and without reporting its own now-irrelevant load failure.
- Added `invalidatePendingMount(id)` to `LifecycleManager`, wired from `shell.disableDapp()`, closing the one gap a pure generation-bump can't reach on its own: a dapp disabled while its mount is still in flight (not yet reflected in `getCurrentDapp()`).
- Fixed the sub-path stale-path bug in `shell.mountDapp()` — a sub-path navigation arriving while the same dapp is still mounting was silently dropped by the `pendingMountId` dedupe, so the eventually-committed mount used the path captured when it started. `mountDapp()` now re-reads `router.getCurrentPath()` after the mount resolves and emits a `dx:route:subpath` catch-up if it moved.
- Added generation-guard unit tests to `tests/lifecycle.test.ts` driving `createLifecycleManager()` directly (supersession, `invalidatePendingMount` targeted/no-op behavior).
- Added `tests/stress.test.ts` (D-11) — a dedicated suite driving all five D-03 scenarios through `createShell()` + `shell.navigate()`: rapid A→B→A, `disableDapp()` racing an in-flight mount, a load timeout firing after navigate-away, sub-path navigation into a still-mounting dapp, and `shell.init()`'s initial mount racing an immediate first navigation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount-generation guard (last-navigation-wins) + invalidate-on-disable hook** - `94f81a9` (fix)
2. **Task 2: Concurrency stress suite — full D-03 race matrix (tests/stress.test.ts)** - `b6f16e7` (test)

_TDD not used — this plan is a straight bug fix + regression suite; verification was run per-task via targeted `pnpm vitest run` and confirmed green before each commit._

## Files Created/Modified

- `src/lifecycle.ts` - Adds `mountGeneration`/`inFlightMountId` closure state, `isStale()` gating at every commit point in `mount()`, and `invalidatePendingMount(id)`
- `src/shell.ts` - Wires `disableDapp()` to `lifecycle.invalidatePendingMount(id)`; fixes `mountDapp()`'s fresh-path commit for sub-path races
- `tests/lifecycle.test.ts` - New `describe('mount generation guard (D-01/D-03 last-navigation-wins)')` block with 3 unit tests
- `tests/stress.test.ts` - New dedicated concurrency/race stress suite (5 scenarios, `keyedGate<T>()` fixture, `recordAlternation()` helper)

## Decisions Made

- `mountGeneration`/`inFlightMountId` live inside `createLifecycleManager()`'s closure, never module scope — required so multiple shells in one process don't corrupt each other's generation count.
- A stale mount's own failure (template/sanitize/dependency/entry) is never reported via `dx:error` and never clears the container — only the currently-current generation's outcome is worth surfacing.
- `invalidatePendingMount(id)` is a targeted no-op unless `id` matches the currently in-flight mount, so it can never cancel an unrelated dapp's in-flight mount.
- The sub-path fresh-path fix re-reads `router.getCurrentPath()` after `lifecycle.mount()` resolves and emits a `dx:route:subpath` catch-up if it moved, rather than threading a mutable target path into the in-flight `mount()` call itself — simpler, and the committed path (`currentPath`) and the catch-up event both end up reflecting the freshest browser path.
- Stress suite fixtures (`keyedGate<T>()`) collect ALL concurrent waiters per src/url key so a single `release(key)` resolves every caller requesting that same resource concurrently — avoids any dependency on microtask-resolution-order timing (Pitfall 2) and made every scenario deterministic on the first run.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<action>` and `<acceptance_criteria>` were implemented and verified as specified; no Rule 1/2/3 auto-fixes were needed, and no Rule 4 architectural questions arose.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST-01 (last-navigation-wins under all D-03 interleavings) is fully satisfied and locked by `tests/stress.test.ts`; the underlying race in `src/lifecycle.ts`/`src/shell.ts` is fixed with no `BREAKING CHANGE:` footer (straight bug fix).
- `make test` is green (296 tests, 11 files) — ready for Plan 02 (TEST-02 manifest-validation edge cases) and Plan 03 (TEST-03 settings-cleanup integration regression) in this phase.
- No blockers.

---
*Phase: 04-testing-stress-edge-case-regression-coverage*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: src/lifecycle.ts
- FOUND: src/shell.ts
- FOUND: tests/lifecycle.test.ts
- FOUND: tests/stress.test.ts
- FOUND commit: 94f81a9
- FOUND commit: b6f16e7
- `pnpm vitest run tests/lifecycle.test.ts tests/shell.test.ts` — 98 passed
- `pnpm vitest run tests/stress.test.ts` — 5 passed
- `make test` — 296 passed (11 files), lint clean

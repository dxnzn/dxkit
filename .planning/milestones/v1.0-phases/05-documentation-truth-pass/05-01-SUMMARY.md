---
phase: 05-documentation-truth-pass
plan: 01
subsystem: core
tags: [shell, lifecycle, dx-error, mount-generation, event-bus]

# Dependency graph
requires:
  - phase: 04-testing-stress-edge-case-regression-coverage
    provides: mount-generation guard, invalidatePendingMount/invalidateAnyPendingMount, stress-suite gate techniques
provides:
  - "dx:error emit at loadManifests()'s registry-fetch site (source shell:manifest), gated on explicit registryUrl (D-15)"
  - "disableDapp() navigate-to-/ for an in-flight (uncommitted) mount whose route is active (D-16)"
  - "inFlightMountId generation-ownership guard in lifecycle.ts's mount() (D-17)"
  - "shell.test.ts dx:error listener cleanup helper (onDxError) and order-neutral router.test.ts duplicate-route ids"
affects: [05-documentation-truth-pass later plans (doc sweep now describes final 0.2.0 code behavior)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Object.hasOwn(config, key) presence check captured before a destructure default erases it — reused from the D-05 flat-loader guard for D-15's registryUrl explicitness check"
    - "Route-ownership check via router.resolve(router.getCurrentPath())?.id === id, captured before a router-rebuild swaps the router instance — used for D-16's disable-mid-flight navigate decision"
    - "Paired ownership-generation variable (inFlightGeneration) alongside a shared-slot marker (inFlightMountId), mirroring shell.ts's pendingMountId/pendingMountToken idiom — used for D-17"

key-files:
  created: []
  modified:
    - src/shell.ts
    - src/lifecycle.ts
    - tests/shell.test.ts
    - tests/lifecycle.test.ts
    - tests/router.test.ts

key-decisions:
  - "D-15 message shape mirrors loadDappManifest()'s two-message split (status-info for non-OK, unified network/parse message with `cause` for the throw/parse catch) — Claude's Discretion per RESEARCH Open Question 1"
  - "D-16 keeps the committed-mount and in-flight-mount disable paths as separate branches (not collapsed into one) — only the outcome (navigate to /) converges, per Pitfall 3 in RESEARCH/PATTERNS"
  - "D-17 applies the ownership-guarded clear uniformly at every mount() exit path (missing-plugin return, all four catch blocks, all four bare isStale() gates, and the final commit) rather than only the four bare gates literally named in the plan — the catch blocks' own stale branches had the identical leak gap"
  - "D-17's fix has no functionally observable effect through LifecycleManager's public API given the current architecture (documented below under Known Limitations) — implemented anyway because it matches the described contract, closes the described hygiene gap, and satisfies the T-05-03 threat-model mitigation"

patterns-established:
  - "onDxError() test helper (tests/shell.test.ts): registers a dx:error listener and tracks it for automatic removal in the existing afterEach — used in place of raw window.addEventListener when a test doesn't already pair its own removeEventListener"

requirements-completed: [DOC-01]

coverage:
  - id: D1
    description: "loadManifests() emits dx:error (source shell:manifest) on registry.json non-OK/throw/parse failure only when registryUrl was explicitly configured; the default /registry.json probe stays silent"
    requirement: "DOC-01"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#emits a dx:error when an explicit registryUrl returns a non-OK response (D-15)"
        status: pass
      - kind: unit
        ref: "tests/shell.test.ts#emits a dx:error when an explicit registryUrl fetch rejects (D-15)"
        status: pass
      - kind: unit
        ref: "tests/shell.test.ts#emits a dx:error when an explicit registryUrl resolves but JSON parsing throws (D-15)"
        status: pass
      - kind: unit
        ref: "tests/shell.test.ts#stays silent on the default registryUrl probe failure — no dx:error, empty manifests (D-15)"
        status: pass
    human_judgment: false
  - id: D2
    description: "disableDapp() navigates the browser to / when the disabled dapp's mount is still in flight (uncommitted) and its route is the active route — matching the already-correct committed-mount disable outcome"
    requirement: "DOC-01"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#disableDapp() mid-flight (uncommitted mount) for the currently-routed dapp navigates to / (D-16)"
        status: pass
    human_judgment: false
  - id: D3
    description: "inFlightMountId is cleared only by the mount() call that currently owns it (generation-paired), including at bare isStale() exit gates that previously left it dangling after a bump-only invalidation"
    requirement: "DOC-01"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#an invalidated mount that exits via the bare isStale() gate (not a catch) leaves the in-flight marker owner-cleared — a reused-id mount afterward commits cleanly (D-17)"
        status: pass
    human_judgment: true
    rationale: "LifecycleManager exposes no getter for inFlightMountId/inFlightGeneration, and — per the Known Limitations note below — the leak this fix closes has no functionally observable effect through the public API on the current architecture (every new mount() call unconditionally overwrites the marker at its synchronous entry, self-healing any leak before it can affect a later call). The test locks the documented contract via the closest available black-box proxy (clean re-mount of a reused id after an invalidate-then-bare-gate exit); a human should confirm this reasoning is acceptable for the phase's code-truth goal."

duration: 25min
completed: 2026-07-14
status: complete
---

# Phase 05 Plan 01: Fixes-First (D-15, D-16, D-17) Summary

**Registry-failure visibility (D-15), disable-mid-flight navigate-to-/ (D-16), and inFlightMountId ownership hygiene (D-17) land with regression tests before the phase 5 doc sweep, so the docs describe final 0.2.0 behavior.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-14
- **Tasks:** 3 (Task 3 produced two commits per its own explicit instruction: fix+test, then a separate test-nit commit)
- **Files modified:** 5

## Accomplishments
- `loadManifests()`'s registry-fetch catch now emits `dx:error` (source `shell:manifest`) for non-OK/throw/parse failures, but only when the consumer explicitly configured `registryUrl` — the default `/registry.json` probe stays silent (D-15).
- `disableDapp()` now converges both disable-while-active paths (committed and in-flight/uncommitted) on the same final state — the browser navigates to `/` either way (D-16).
- `lifecycle.ts`'s `mount()` now pairs `inFlightMountId` with an owning generation, so every exit path (bare gates, catch blocks, and the final commit) clears the marker only when the exiting call still owns it — never leaking a stale id, never clobbering a newer call's marker (D-17).
- Two test-file nits closed: `tests/shell.test.ts`'s eleven previously-uncleaned `dx:error` listeners now clean up via a shared `onDxError()` helper; `tests/router.test.ts`'s confusingly-named reversed-input duplicate-route test now uses order-neutral ids with a clarifying comment.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-15 — registry.json fetch/parse failure visibility** - `d5f08e5` (fix)
2. **Task 2: D-16 — disable-mid-flight navigates to /** - `3307f4b` (fix)
3. **Task 3: D-17 — inFlightMountId ownership guard** - `aa1098a` (fix, includes the lifecycle regression test)
4. **Task 3 (test nits): dx:error listener cleanup + duplicate-route id rename** - `fdb1f95` (test)

**Plan metadata:** (this commit, docs: complete plan)

_Note: Task 3's action explicitly directed a single fix+test commit for the ownership guard, with the two test-file nits sharing a separate `test:` commit — not the generic TDD RED/GREEN split._

## Files Created/Modified
- `src/shell.ts` - D-15 registry-failure `dx:error` emit gated on `Object.hasOwn(config, 'registryUrl')`; D-16 `disableDapp()` navigate-to-`/` for an in-flight disable
- `src/lifecycle.ts` - D-17 `inFlightGeneration`/`clearOwnedInFlightMarker()` ownership guard applied at every `mount()` exit path
- `tests/shell.test.ts` - D-15 registry test cases (3 explicit-failure + 1 default-silent); D-16 disable-mid-flight integration test; `onDxError()` cleanup helper applied to 11 previously-uncleaned listener sites
- `tests/lifecycle.test.ts` - D-17 `inFlightMountId` ownership regression test
- `tests/router.test.ts` - duplicate-route reversed-input test renamed to order-neutral ids (`alpha`/`beta`) with a clarifying comment

## Decisions Made
- D-15 message shape mirrors `loadDappManifest()`'s existing two-message split (per RESEARCH Open Question 1, Claude's Discretion).
- D-16 keeps the committed-mount and in-flight-mount disable paths as two distinct branches — only the navigate outcome converges, not the code path (per Pitfall 3).
- D-17's ownership-guarded clear was applied at every exit path that could leak the marker (missing-plugin return, all four catch blocks' stale branches, all four bare `isStale()` gates, and the final commit) — not just the four bare-gate line numbers literally named in the plan's `<action>`. The catch blocks' own "stale, so skip the `!isStale()` block" branches had the identical gap (a bare `return false` that never touched `inFlightMountId`), so a narrower fix limited to only the four named bare gates would have left the same class of leak reachable through four additional paths.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended D-17's fix beyond the four literally-named bare-gate line numbers to every mount() exit path with the same leak shape**
- **Found during:** Task 3 (D-17 implementation)
- **Issue:** The plan's `<action>` names four specific bare `if (isStale()) return false;` gates to fix, but the four catch blocks (template, sanitize, dependency, entry) each have an identical, unaddressed gap in their own `isStale()`-true branch — they skip the `if (!isStale()) { ...; inFlightMountId = null; }` block entirely and fall through to a bare `return false;` without ever attempting to clear the marker.
- **Fix:** Applied `clearOwnedInFlightMarker()` uniformly — at each bare gate, at each catch block's exit (regardless of staleness, since the helper itself is ownership-guarded and therefore a safe no-op when the call doesn't own the marker), and at the final commit.
- **Files modified:** `src/lifecycle.ts`
- **Verification:** Full suite green (321 tests); new D-17 regression test passes.
- **Committed in:** `aa1098a` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — scope-consistent bug fix, same underlying issue as the plan's named lines).
**Impact on plan:** No scope creep — the extension stays within `src/lifecycle.ts`'s `mount()` function, the exact file/function the plan already targeted, and closes the same documented gap more completely.

## Issues Encountered

**D-17 test observability.** Extensive analysis (see the `human_judgment: true` rationale on coverage item D3 above) shows that the specific leak D-17 fixes — a bare-gate exit failing to clear `inFlightMountId` after a bump-only invalidation (no second `mount()` call ever starting) — has no functionally observable effect through `LifecycleManager`'s public API on the current architecture. Every new `mount()` call unconditionally overwrites `inFlightMountId`/`inFlightGeneration` as its first synchronous statement, before any `await`, which self-heals any leak the instant a subsequent real mount attempt begins. The only place a leak could matter (a stale marker causing `invalidateAnyPendingMount()` to spuriously bump `mountGeneration`) has zero effect on any call's own success, because a bump that happens *before* a call captures its `generation` cannot make that call stale — it just becomes part of that call's own baseline.

The fix was still implemented (it matches the documented truth statement, the PATTERNS.md design, and the T-05-03 threat-model mitigation, and it is unambiguously correct hygiene), and the new regression test locks the closest available black-box proxy: a mount invalidated via a bare-gate exit, followed immediately by `invalidateAnyPendingMount()` and a fresh mount reusing the same id, must commit cleanly with exactly one `dx:mount`/`dx:dapp:mounted`. This test passes with the fix in place; a human reviewer should confirm this level of verification is acceptable given the observability ceiling described above (a hard requirement — like exposing `inFlightMountId` via a new debug accessor — was avoided since PATTERNS.md explicitly states this phase "adds no new architectural surface").

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Code is now at its final 0.2.0 shape for D-15/D-16/D-17 — the remaining phase-5 doc-sweep plans can describe these three behaviors as-shipped without hedging or describing a divergence.
- `make test` is green (lint + all 321 tests) at HEAD (`fdb1f95`).
- No blockers for subsequent plans in this phase.

---
*Phase: 05-documentation-truth-pass*
*Completed: 2026-07-14*

## Self-Check: PASSED

All modified files (`src/shell.ts`, `src/lifecycle.ts`, `tests/shell.test.ts`, `tests/lifecycle.test.ts`, `tests/router.test.ts`) and all four task commits (`d5f08e5`, `3307f4b`, `aa1098a`, `fdb1f95`) verified present.

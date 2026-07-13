---
phase: 04-testing-stress-edge-case-regression-coverage
verified: 2026-07-13T22:05:00Z
status: gaps_found
score: 3/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "CR-01 (original instance): navigating to an unmatched route while a SINGLE dapp's mount is in flight now correctly abandons that mount — handleRouteChange's null-manifest branch calls lifecycle.invalidatePendingMount(pendingMountId) before lifecycle.unmount() (src/shell.ts:364, commit 70ebee4), locked by a passing regression test in tests/stress.test.ts (commit a04ec1f, independently re-run and confirmed load-bearing by reverting the fix and observing the new test fail)."
  gaps_remaining:
    - "The general D-01 last-navigation-wins invariant is still violated by a distinct, realistic interleaving the phase's stress suite does not cover: an A->B overlapping-mount sequence where the stale A call settles first, clobbers the shell-level pendingMountId (mountDapp's finally at src/shell.ts:412-414 sets pendingMountId = null unconditionally, even for a stale/superseded call), and a subsequent navigation to an unmatched route then finds pendingMountId already null and skips invalidatePendingMount entirely — so dapp B's mount (still generation-current) commits dx:mount/dx:dapp:mounted while the browser's route is the unmatched one. Independently reproduced against the current codebase (see Anti-Patterns / Gaps Summary) — not narrative-only."
  regressions: []
gaps:
  - truth: "The D-01 last-navigation-wins invariant (CONTEXT.md line 25 — 'Under concurrent mounts, the final DOM and lifecycle.getCurrentDapp() MUST match the most recent navigation') holds for ALL navigation transitions and ALL concurrency interleavings this phase's mount-generation guard was built to fix, not only the single-mount dapp->unmatched-route case closed by gap-closure plan 04-04"
    status: failed
    reason: >-
      Independently reproduced (throwaway test added to tests/stress.test.ts, run, then reverted —
      not committed) against the current codebase, matching code-review finding CR-01 in the fresh
      04-REVIEW.md (reviewed 2026-07-13T21:44:12Z, after gap-closure plan 04-04): mountDapp's
      `finally { pendingMountId = null; }` (src/shell.ts:412-414) runs unconditionally, including
      for a call whose pendingMountId slot has already been overwritten by a newer, still-in-flight
      mount for a DIFFERENT dapp. Sequence verified live: navigate('/a') suspends at the entry-script
      gate (pendingMountId='a') -> navigate('/b') supersedes A and sets pendingMountId='b' -> A's
      held loader releases; A's own mount() call is stale internally (isStale() aborts it before any
      commit) but mountDapp's surrounding try/finally still runs to completion and unconditionally
      sets pendingMountId=null, clobbering B's in-flight marker -> navigate('/nowhere') drives
      handleRouteChange(null), whose `if (pendingMountId) lifecycle.invalidatePendingMount(...)` guard
      (src/shell.ts:364, the exact fix landed by gap-closure plan 04-04) now finds pendingMountId
      already null and skips invalidation entirely -> B's held loader releases; B's mount generation
      was never bumped, so every isStale() gate in lifecycle.mount passes and B commits fully.
      Reproduction result: dx:mount fired for 'b' (mounts.count()===1) while shell.getCurrentRoute()
      reported '/nowhere' — the exact D-01 violation the phase's Plan 01 and gap-closure Plan 04 were
      built to eliminate, just via a different interleaving than either fix's test covers. The current
      6-scenario tests/stress.test.ts matrix has no case combining an A->B overlap with a subsequent
      unmatched-route navigation, so nothing catches this.
    artifacts:
      - path: "src/shell.ts"
        issue: "mountDapp's finally block (lines 412-414) unconditionally clears the shared pendingMountId even when the settling call is stale/superseded, corrupting the guard handleRouteChange's null branch relies on"
    missing:
      - "In mountDapp's finally block, only clear pendingMountId when it still refers to this call: `if (pendingMountId === manifest.id) pendingMountId = null;` (safe — the same-id early-return at line 389 already excludes concurrent same-id calls, so pendingMountId !== manifest.id in finally can only mean a newer mount now owns the slot)"
      - "Alternatively/additionally, stop keying handleRouteChange's null-branch invalidation off the corruptible shell-level pendingMountId at all — add a lifecycle-level unconditional invalidation entry point (e.g. invalidateAnyPendingMount()) that bumps mountGeneration whenever inFlightMountId is non-null, independent of the shell's own bookkeeping"
      - "A regression test in tests/stress.test.ts covering the A->B overlap -> stale-A-settles-first -> unmatched-route navigation -> B-settles interleaving, asserting zero dx:mount for 'b' and shell.getCurrentRoute() === the unmatched path"
---

# Phase 4: Testing — Stress, Edge-Case & Regression Coverage Verification Report

**Phase Goal:** The test suite covers the concurrency, validation-edge-case, and cleanup scenarios the concerns audit called out as missing.
**Verified:** 2026-07-13T22:05:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (plan 04-04 closed the original CR-01 instance; this pass independently reproduces a new instance of the same invariant violation, surfaced by the fresh code review)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A stress-test suite drives rapid A→B→A navigation with slow loaders and asserts no double-mount and no lost-unmount occurs (ROADMAP SC1 / TEST-01) | ✓ VERIFIED | `tests/stress.test.ts` scenario "rapid A -> B -> A" drives the exact interleaving through `createShell()` + `shell.navigate()`, asserts `getCurrentRoute()==='/a'`, exactly one `dx:mount` for `a`, zero for `b`, strict mount/unmount alternation, and container DOM content. Independently re-ran: `pnpm vitest run tests/stress.test.ts` — 6/6 pass (5 original + the CR-01-closure scenario). |
| 2 | Manifest-validation tests cover invalid route formats, deep-merge override behavior, and multi-match routes, each asserting the correct accept/reject/merge outcome (ROADMAP SC2 / TEST-02) | ✓ VERIFIED | `src/shell.ts` `normalizeAndValidateManifests()`/`normalizeRoute()` implement normalize/reject/tier-validate/dedupe (grep-confirmed, unchanged since prior verification); `tests/shell.test.ts`, `tests/router.test.ts`, `tests/utils.test.ts` cases all present. Independently re-ran: `pnpm vitest run tests/shell.test.ts tests/router.test.ts tests/utils.test.ts` — all pass, no regression from the 04-04 gap-closure change (which touched only `handleRouteChange`'s null branch, an unrelated code path). |
| 3 | A regression test verifies settings handlers registered by a dapp do not fire after that dapp is disabled via `disableDapp()` (ROADMAP SC3 / TEST-03) | ✓ VERIFIED | `plugins/settings/tests/integration.test.ts` drives the real `createShell` → `createSettings` → `shell.disableDapp('hello')` and asserts `helloHandler` is not called after disable while `worldHandler` still fires. Independently re-ran: 1/1 pass, unaffected by the 04-04 change. |
| 4 | The D-01 last-navigation-wins invariant (the general property Plan 01's mount-generation guard, and gap-closure Plan 04, were built to enforce, per CONTEXT.md D-01) holds for ALL navigation transitions and concurrency interleavings, not only the single-mount dapp->unmatched-route case the last verification pass closed | ✗ FAILED | Independently reproduced with a throwaway test (added, run, reverted — not committed): navigate `/a` (entry held) → navigate `/b` (supersedes A, entry held) → release A's entry (stale, but its `finally` unconditionally clears the shared `pendingMountId`, clobbering B's marker) → navigate `/nowhere` (unmatched — `if (pendingMountId)` guard now finds `null` and skips `invalidatePendingMount`) → release B's entry ⇒ `dx:mount` fires for `b` (`mounts.count()===1`) while `shell.getCurrentRoute()==='/nowhere'`. This is the same D-01 violation the phase's Plan 01 and gap-closure Plan 04 were built to eliminate, reached via an interleaving neither fix's test covers. |

**Score:** 3/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lifecycle.ts` | mountGeneration counter + isStale() gating + invalidatePendingMount() | ✓ VERIFIED | Confirmed via grep: `mountGeneration`, `inFlightMountId`, `isStale` gates at every documented anchor, `invalidatePendingMount` exported — unchanged since prior pass |
| `src/shell.ts` | disableDapp wiring to invalidatePendingMount + fresh-path commit + (new) null-branch invalidation | ✓ VERIFIED | `lifecycle.invalidatePendingMount(id)` in `disableDapp()` (line 136); `lifecycle.invalidatePendingMount(pendingMountId)` in `handleRouteChange`'s null branch (line 364, gap-closure plan 04-04); fresh-path re-read in `mountDapp()` (lines 407-411) |
| `tests/stress.test.ts` | dedicated concurrency/race stress suite (D-11), now including the CR-01-closure scenario | ✓ VERIFIED | 6 scenarios present, substantive, all pass; but see Truth #4 — the matrix still omits the A->B-overlap-then-unmatched-route interleaving that defeats the same invariant via `pendingMountId` corruption |
| `tests/lifecycle.test.ts` | generation-guard unit tests | ✓ VERIFIED | Unchanged since prior pass, still passing |
| `src/shell.ts` (Plan 02) | normalizeAndValidateManifests choke point + WR-01 emits | ✓ VERIFIED | Unchanged since prior pass |
| `tests/shell.test.ts`, `tests/router.test.ts` (Plan 02) | normalization/reject/tier-parity/duplicate/WR-01 + multi-match/duplicate resolution tests | ✓ VERIFIED | Unchanged since prior pass |
| `plugins/settings/tests/integration.test.ts` | full-shell settings-cleanup regression | ✓ VERIFIED | Unchanged since prior pass |
| `tests/utils.test.ts`, `src/utils.ts` (Plan 03) | deepMerge documented-semantics assertions + JSDoc reconcile | ✓ VERIFIED | Unchanged since prior pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `shell.disableDapp()` | `lifecycle.invalidatePendingMount(id)` | direct call, line 136 | ✓ WIRED | Confirmed; exercised by `tests/stress.test.ts` scenario 2 and `tests/lifecycle.test.ts` |
| `lifecycle.mount()` | `isStale()` re-check | before every container mutation/state commit | ✓ WIRED | Confirmed at all documented gate points |
| `handleRouteChange(null)` | `lifecycle.invalidatePendingMount(pendingMountId)` | line 364 | ⚠️ PARTIALLY WIRED | The link exists and closes the original single-mount CR-01 case, but its guard condition (`if (pendingMountId)`) reads a shell-level variable that a DIFFERENT dapp's stale `mountDapp` call can clobber to `null` before this branch runs (see `mountDapp`'s `finally`, lines 412-414) — so the link is a no-op exactly when it is most needed (an overlapping A->B race followed by an unmatched-route nav). This is the mechanism behind Truth #4's failure. |
| `mountDapp()`'s `finally` | `pendingMountId = null` | line 413 | ✗ NOT GUARDED | Clears the shared slot unconditionally, including when the settling call is stale and a newer mount for a different dapp now owns the slot — the root cause of the Truth #4 gap |
| `init()` | `normalizeAndValidateManifests(loadManifests())` | line ~315 | ✓ WIRED | Confirmed via grep; exercised across all three manifest tiers |
| `createShell(...).disableDapp(id)` | `dx:dapp:disabled` → settings `cleanup(dappId)` | real event bus, not mocked | ✓ WIRED | Confirmed in `plugins/settings/tests/integration.test.ts`, passing |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green (single run, not per-truth) | `make test` | 309/309 tests pass, 12 files, lint clean | ✓ PASS |
| CR-01 (original instance) fix is load-bearing | Temporarily reverted `src/shell.ts:364`, re-ran `pnpm vitest run tests/stress.test.ts`, restored | New CR-01/D-01 regression scenario fails without the fix (`mounts.count()` was `1`, not `0`); passes with the fix restored | ✓ PASS |
| CR-01 reopened (new instance) reproduction | Throwaway scenario added to `tests/stress.test.ts` (A->B overlap, stale-A-settles-first clobbers `pendingMountId`, unmatched nav, B settles), run, then reverted (not committed) | `dx:mount` fired for the superseded-route dapp `b` (`mounts.count()===1`) while `shell.getCurrentRoute()==='/nowhere'` | ✗ FAIL (confirms the new-instance gap is real, not narrative-only) |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase-touched files | grep across `src/shell.ts`, `src/lifecycle.ts`, `src/utils.ts`, all stress/lifecycle/shell/router/utils/settings-integration test files | 0 hits | ✓ PASS |
| Targeted regression re-run of unaffected areas (TEST-02/TEST-03) | `pnpm vitest run tests/shell.test.ts tests/router.test.ts tests/utils.test.ts plugins/settings/tests/integration.test.ts tests/lifecycle.test.ts` | 140/140 pass | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TEST-01 | 04-01, 04-04 | Stress tests cover concurrent navigation and mount races (rapid A→B→A with slow loaders) without double-mount or lost-unmount | ⚠ SATISFIED FOR STATED SCOPE, BUT UNDERLYING FIX STILL INCOMPLETE | The literal A→B→A stress requirement and the single-mount unmatched-route case are both met and passing. However, the general mount-race fix this requirement is built on has a second, independently-reproduced hole (see Truth #4) outside the tested matrix. Flagged as a gap, not a full pass. |
| TEST-02 | 04-02, 04-03 | Manifest-validation edge cases are tested (invalid route formats, deep-merge overrides, multi-match routes) | ✓ SATISFIED | Unchanged since prior pass — all cases implemented and locked by tests |
| TEST-03 | 04-03 | Tests verify settings-handler cleanup on `disableDapp()` (handlers do not fire after disable) | ✓ SATISFIED | Unchanged since prior pass — full-shell integration regression proves real wiring |

No orphaned requirements — REQUIREMENTS.md maps TEST-01/02/03 to Phase 4, and all three are claimed and covered across the three original plans plus the gap-closure plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/shell.ts` | 412-414 | `mountDapp`'s `finally` unconditionally clears the shared `pendingMountId`, corrupting the guard `handleRouteChange`'s null branch depends on | 🛑 Blocker (fresh 04-REVIEW.md CR-01 "reopened", independently reproduced during this verification) | A stale call's cleanup silently erases a newer, unrelated mount's in-flight marker; the very fix landed for the original CR-01 (line 364's `if (pendingMountId)` guard) is defeated because the variable it reads is corruptible by exactly the kind of overlapping-mount interleaving this phase's own stress suite creates |
| `src/shell.ts` | 362-365 | Unmatched-route abandonment does not clear the container even when a stale mount already injected its template before being superseded | ⚠️ Warning (fresh review WR-01) | Not independently reproduced during this verification pass (narrative from 04-REVIEW.md only); would leave stale dapp HTML visible under an unmatched route if abandonment happens post-injection; distinct gate from Truth #4's failure |
| `src/shell.ts` | 440-462, `src/lifecycle.ts` 428-430 | `shell.destroy()` does not bump `mountGeneration`, so an in-flight mount can still commit `dx:mount` after the shell (and its plugins) are torn down | ⚠️ Warning (fresh review WR-08, new finding) | Not independently reproduced here; noted for awareness — does not map to a stated phase must-have |
| `src/shell.ts` | 358-371 | Overlapping navigations can emit `dx:route:changed` pairing a stale manifest with the newer path | ⚠️ Warning (fresh review WR-09, new finding) | Not independently reproduced here; does not map to a stated phase must-have |
| `src/shell.ts` | 418-422 | `getMountContainer()` caches the DOM node forever; a host re-render leaves mounts writing into a detached element silently | ⚠️ Warning (fresh review WR-10, new finding) | Not independently reproduced here; contradicts the milestone's no-silent-failures charter but is outside this phase's stated must-haves |
| `src/shell.ts` | 246-254, 231-241/315, 407-410, 126-140, 389/400-414 | WR-02 through WR-07 (route-whitespace, registry.json non-array crash, hash-mode misattribution, disable-mid-flight URL-parking, disable→enable drop) | ⚠️ Warning (carried forward, unaddressed by design — scoped out of gap-closure plan 04-04) | Real but explicitly out-of-scope per 04-04's stated scope discipline and the prior verification's judgment; not re-litigated here |
| `src/lifecycle.ts` | 310-323 | Missing staleness gate after the styles-load success path — a superseded mount can still initiate (and for template-less manifests, execute) the next load stage | ⚠️ Warning (carried forward, refined in fresh review) | Not scored as a gap — no stated must-have covers resource-waste-only behavior with no DOM/event leak |
| `src/lifecycle.ts`, `src/shell.ts` | various | IN-01 through IN-06 (cause-wrapping inconsistency, dangling `inFlightMountId`, empty-string id/entry acceptance, test-hygiene listener leaks, unverified "nothing mounts" assertion, `init()` re-entrancy) | ℹ️ Info (carried forward + 2 new) | Style/hygiene only; no stated must-have affected |

### Gaps Summary

Three of the four established must-have truths remain fully verified with passing, substantive, independently-re-run tests: the A→B→A stress suite (TEST-01's literal stated scope, now 6 scenarios including the closed original CR-01 case), the full manifest/route validation matrix (TEST-02), and the settings-cleanup integration regression (TEST-03). The gap-closure plan (04-04) did exactly what it set out to do: `handleRouteChange`'s null-manifest branch now calls `lifecycle.invalidatePendingMount(pendingMountId)` before `lifecycle.unmount()`, and reverting that one line makes the new regression test fail — confirmed by direct experiment during this verification pass.

However, the fresh code review (04-REVIEW.md, reviewed after the gap-closure commit) found — and this verification independently reproduced against the live codebase — a second, distinct hole in the exact same D-01 invariant. `mountDapp`'s `finally` block (`src/shell.ts:412-414`) unconditionally clears the shared `pendingMountId` closure variable, even when the settling call is stale (superseded by a newer mount for a *different* dapp). This means the very guard that closes the original CR-01 (`handleRouteChange`'s `if (pendingMountId) lifecycle.invalidatePendingMount(...)`) can find `pendingMountId` already `null` — not because nothing is in flight, but because a stale call's cleanup already stomped on a still-active mount's marker. In that state, navigating to an unmatched route skips invalidation entirely, and the still-in-flight (and still generation-current) mount for the other dapp commits fully: `dx:mount`/`dx:dapp:mounted` fire and the container is written while the browser's route is the unmatched one.

I independently reproduced this: a throwaway test driving `navigate('/a')` → `navigate('/b')` (overlapping, both held at the entry-script gate) → release A's entry (stale A settles, clobbers `pendingMountId`) → `navigate('/nowhere')` → release B's entry, resulted in `dx:mount` firing for `b` with `shell.getCurrentRoute()==='/nowhere'`. The test was added, run, observed to fail the expected invariant, then reverted (not committed) — matching the same evidentiary standard the prior verification pass applied to the original CR-01.

This is judged in-scope for the phase (not deferred) using the same reasoning the prior verification pass applied to the original CR-01: (1) it directly concerns the D-01 invariant Plan 01 and gap-closure Plan 04 were both built to enforce; (2) the defect lives in the exact function (`mountDapp`) and file (`src/shell.ts`) both plans modified; (3) it was proven with an executed, reproducible test, not a hypothetical; (4) the stress suite's matrix (now 6 scenarios) still has no case combining an A→B overlap with a subsequent unmatched-route navigation, so nothing catches this in CI today.

The remaining review findings (WR-01 through WR-10, IN-01 through IN-06) are real but do not map to any stated phase must-have truth — they are noted in the Anti-Patterns table for visibility but are not scored as gaps against this phase's goal, consistent with the prior verification pass's scoping judgment.

---

_Verified: 2026-07-13T22:05:00Z_
_Verifier: Claude (gsd-verifier)_

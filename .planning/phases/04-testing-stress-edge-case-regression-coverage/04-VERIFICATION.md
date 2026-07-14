---
phase: 04-testing-stress-edge-case-regression-coverage
verified: 2026-07-13T21:15:00Z
status: gaps_found
score: 3/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "The A->B-overlap-then-unmatched-route interleaving (second CR-01 instance): mountDapp's finally now only clears the shared pendingMountId when it still belongs to the settling call (pendingMountId === manifest.id), and handleRouteChange's null branch now invalidates via lifecycle.invalidateAnyPendingMount() — reading the lifecycle's own inFlightMountId instead of the corruptible shell-level pendingMountId. Landed in gap-closure plan 04-05 (commits fd587db, 87448f5), locked by tests/stress.test.ts:244-286, independently confirmed unchanged and passing."
  gaps_remaining:
    - "A THIRD, distinct instance of the D-01 last-navigation-wins invariant violation, surfaced by the fresh 04-REVIEW.md (reviewed after 04-05 landed) and independently reproduced during this verification pass: A -> unmatched-route -> A silently drops the re-navigation to A. See gaps below."
  regressions: []
gaps:
  - truth: "The D-01 last-navigation-wins invariant (CONTEXT.md D-01 — 'Under concurrent mounts, the final DOM and lifecycle.getCurrentDapp() MUST match the most recent navigation') holds for ALL navigation transitions and ALL concurrency interleavings this phase's mount-generation guard was built to fix, not only the two interleavings closed by gap-closure plans 04-04 and 04-05"
    status: failed
    reason: >-
      Independently reproduced with a throwaway test file (tests/tmp-cr01-repro.test.ts — created,
      run, then deleted; not committed), matching code-review finding CR-01 in the fresh
      04-REVIEW.md (reviewed 2026-07-14T01:59:26Z, after gap-closure plan 04-05 landed at fd587db/87448f5).
      Sequence: navigate('/a') suspends at the held entry-script gate (pendingMountId='a',
      lifecycle in-flight for 'a') -> navigate('/nowhere') drives handleRouteChange(null), which
      calls lifecycle.invalidateAnyPendingMount() (bumps mountGeneration so A's suspended mount()
      call will fail its next isStale() gate) but does NOT touch the shell-level pendingMountId,
      which is still 'a' -> navigate('/a') again -> mountDapp('a') hits the same-id dedupe at
      src/shell.ts:392 (`if (pendingMountId === manifest.id) return;`) because pendingMountId is
      still 'a' from the FIRST (now-invalidated) call -> the second navigation to A is silently
      dropped, no new mount() call is even started -> the original A entry-script gate is released
      -> the first mount() call resumes, hits isStale(), returns without committing -> its finally
      (guarded by pendingMountId === manifest.id, both 'a') clears pendingMountId to null.
      Final state observed in the reproduction: shell.getCurrentRoute() === '/a' (correct) but
      countMounts('a') === 0 — dx:mount never fired, nothing is in the container, and
      lifecycle.getCurrentDapp() is null. The user's most recent, unambiguous navigation (back to
      A) is completely lost with no error emitted. The window during which any re-navigation to A
      is dropped lasts as long as the invalidated mount's slowest loader takes to settle (up to the
      default 30s timeout).
      This is the third distinct instance of the same D-01 invariant this phase's standing policy
      commits to enforcing (CONTEXT.md: "correctness bugs surfaced by the new tests are fixed
      in-phase with their tests — the suite lands green") and lives in the exact function
      (mountDapp/handleRouteChange, src/shell.ts) both prior gap-closure plans (04-04, 04-05)
      modified. Unlike the two previously-closed instances (where the WRONG dapp won), this
      instance means NO dapp mounts at all despite an explicit, later user navigation — arguably a
      more severe last-navigation-wins violation. The 7-scenario tests/stress.test.ts matrix has no
      case that re-navigates to an invalidated dapp (04-REVIEW.md's WR-11 finding — the exact
      regression test that would have caught this is the one missing from the suite).
    artifacts:
      - path: "src/shell.ts"
        issue: "mountDapp's same-dapp dedupe (line 392, `if (pendingMountId === manifest.id) return;`) is unaware that the in-flight mount it is deduping against was already invalidated by lifecycle.invalidateAnyPendingMount()/invalidatePendingMount() — it only checks id equality, not liveness, so it silently drops a legitimate re-navigation to the same dapp while the invalidated call's finally has not yet run. The comment above it ('the in-flight call sets currentDappId/currentPath when it finishes') is false for an invalidated call, matching 04-REVIEW.md's WR-01 finding."
    missing:
      - "Make the dedupe slot call-scoped (a monotonic token, not a reusable id string) so a re-navigation to the same dapp id can start a fresh mount attempt even while a stale/invalidated call for that same id is still unwinding. 04-REVIEW.md's CR-01 fix sketch: `let pendingMountToken = 0`, capture `const myToken = ++pendingMountToken` at mount start, guard the finally's clear on `pendingMountToken === myToken` (not `pendingMountId === manifest.id`), and bump `pendingMountToken` in both invalidation call sites (handleRouteChange's null branch, disableDapp) so the invalidated call's eventual finally can never suppress a new attempt."
      - "A regression test in tests/stress.test.ts driving: navigate('/a') (held loader) -> navigate('/nowhere') -> navigate('/a') again -> release the original loader -> assert dx:mount fires exactly once for 'a', the container holds A's content, and getCurrentRoute() === '/a' (04-REVIEW.md WR-11). Add the disableDapp()->enableDapp()->re-navigate twin for the same root cause (04-REVIEW.md's folded WR-07)."
---

# Phase 4: Testing — Stress, Edge-Case & Regression Coverage Verification Report

**Phase Goal:** The test suite covers the concurrency, validation-edge-case, and cleanup scenarios the concerns audit called out as missing.
**Verified:** 2026-07-13T21:15:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure plan 04-05 (which closed the second CR-01 instance); this pass independently reproduces a third, distinct instance of the same D-01 invariant, surfaced by the fresh 04-REVIEW.md

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A stress-test suite drives rapid A→B→A navigation with slow loaders and asserts no double-mount and no lost-unmount occurs (ROADMAP SC1 / TEST-01) | ✓ VERIFIED | `tests/stress.test.ts` scenario "rapid A -> B -> A" (line 132) drives the exact interleaving through `createShell()` + `shell.navigate()`, asserts `getCurrentRoute()==='/a'`, exactly one `dx:mount` for `a`, zero for `b`, strict mount/unmount alternation, and container DOM content. Independently re-ran: `pnpm vitest run tests/stress.test.ts` — 7/7 pass. |
| 2 | Manifest-validation tests cover invalid route formats, deep-merge override behavior, and multi-match routes, each asserting the correct accept/reject/merge outcome (ROADMAP SC2 / TEST-02) | ✓ VERIFIED | `src/shell.ts` `normalizeAndValidateManifests()`/`normalizeRoute()` implement normalize/reject/tier-validate/dedupe (grep-confirmed, unchanged since 04-05); `tests/shell.test.ts`, `tests/router.test.ts`, `tests/utils.test.ts` cases all present. Independently re-ran: `pnpm vitest run tests/shell.test.ts tests/router.test.ts tests/utils.test.ts` — all pass; 04-05 touched only `mountDapp`/`handleRouteChange`/`invalidateAnyPendingMount`, an unrelated code path. |
| 3 | A regression test verifies settings handlers registered by a dapp do not fire after that dapp is disabled via `disableDapp()` (ROADMAP SC3 / TEST-03) | ✓ VERIFIED | `plugins/settings/tests/integration.test.ts` drives the real `createShell` → `createSettings` → `shell.disableDapp('hello')` and asserts `helloHandler` is not called after disable while `worldHandler` still fires. Independently re-ran: 1/1 pass, unaffected by 04-05. |
| 4 | The D-01 last-navigation-wins invariant (the general property Plan 01's mount-generation guard, and gap-closure plans 04-04/04-05, were built to enforce, per CONTEXT.md D-01) holds for ALL navigation transitions and concurrency interleavings, not only the two interleavings closed so far | ✗ FAILED | Independently reproduced with a throwaway test file (created, run, deleted — not committed): navigate `/a` (entry held, pendingMountId='a') → navigate `/nowhere` (invalidates the lifecycle-level in-flight mount via `invalidateAnyPendingMount()`, but leaves shell-level `pendingMountId` at `'a'`) → navigate `/a` again (dropped silently by the same-id dedupe at `src/shell.ts:392`, since `pendingMountId` still reads `'a'`) → release A's entry gate ⇒ `dx:mount` never fires for `a` (`mounts.count()===0`), nothing is in the container, `shell.getCurrentRoute()==='/a'` but nothing is actually mounted. Matches 04-REVIEW.md's fresh CR-01 finding exactly (line-level trace at `src/shell.ts:392`). |

**Score:** 3/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lifecycle.ts` | mountGeneration counter + isStale() gating + invalidatePendingMount() + invalidateAnyPendingMount() (new, 04-05) | ✓ VERIFIED | Confirmed via grep: `mountGeneration`, `inFlightMountId`, `isStale` gates at every documented anchor, both `invalidatePendingMount` and `invalidateAnyPendingMount` exported (lines 16, 22, 446, 455, 471-472) |
| `src/shell.ts` | disableDapp wiring + null-branch invalidation via `invalidateAnyPendingMount()` + guarded `mountDapp` finally (04-05) | ✓ VERIFIED | `lifecycle.invalidatePendingMount(id)` in `disableDapp()` (line 136); `lifecycle.invalidateAnyPendingMount()` in `handleRouteChange`'s null branch (line 367); `mountDapp`'s finally now guards `pendingMountId = null` behind `pendingMountId === manifest.id` (line 419) — closes the cross-dapp clobber, but see Truth #4: the same-id dedupe at line 392 has no liveness check against invalidation, which is the new gap |
| `tests/stress.test.ts` | dedicated concurrency/race stress suite (D-11), now 7 scenarios | ✓ VERIFIED (with a coverage hole) | 7 scenarios present, substantive, all pass; but see Truth #4 — the matrix still has no scenario that re-navigates to an invalidated dapp (the exact case that fails) |
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
| `handleRouteChange(null)` | `lifecycle.invalidateAnyPendingMount()` | line 367 | ✓ WIRED | Confirmed; reads the lifecycle's own `inFlightMountId`, immune to shell-level `pendingMountId` corruption — closes both prior CR-01 instances |
| `mountDapp()`'s `finally` | `pendingMountId = null` (guarded) | line 419 | ✓ WIRED | Only clears when `pendingMountId === manifest.id` — prevents a stale call from clobbering a newer, DIFFERENT dapp's slot (closes the second CR-01 instance) |
| `mountDapp()`'s same-id dedupe | liveness of the in-flight call it is deduping against | line 392, `if (pendingMountId === manifest.id) return;` | ✗ NOT GUARDED | Checks only id equality, never whether the in-flight call it refers to was already invalidated — so a re-navigation to the SAME dapp id after an invalidation is dropped even though nothing is actually still trying to mount it. This is the root cause of Truth #4's failure. |
| `init()` | `normalizeAndValidateManifests(loadManifests())` | line ~315 | ✓ WIRED | Confirmed via grep; exercised across all three manifest tiers |
| `createShell(...).disableDapp(id)` | `dx:dapp:disabled` → settings `cleanup(dappId)` | real event bus, not mocked | ✓ WIRED | Confirmed in `plugins/settings/tests/integration.test.ts`, passing |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green (single run, not per-truth) | `make test` | 310/310 tests pass, 12 files, lint clean | ✓ PASS |
| Second CR-01 instance (04-05's fix) remains load-bearing | Re-ran `pnpm vitest run tests/stress.test.ts` unmodified — scenario at line 244 (A->B overlap -> stale-A-settles -> unmatched -> B settles) still asserts zero mounts for both dapps | 7/7 scenarios pass | ✓ PASS |
| Third CR-01 instance (new) reproduction | Throwaway test file `tests/tmp-cr01-repro.test.ts` (navigate /a held -> navigate /nowhere -> navigate /a again -> release) — created, run, deleted (not committed) | `mountsA.count()===0` after re-navigating to A; `dx:mount` never fires | ✗ FAIL (confirms the gap is real, not narrative-only) |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase-touched files | grep across `src/shell.ts`, `src/lifecycle.ts`, `src/utils.ts`, all stress/lifecycle/shell/router/utils/settings-integration test files | 0 hits | ✓ PASS |
| Targeted regression re-run of unaffected areas (TEST-02/TEST-03) | `pnpm vitest run tests/shell.test.ts tests/router.test.ts tests/utils.test.ts plugins/settings/tests/integration.test.ts tests/lifecycle.test.ts` | all pass | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TEST-01 | 04-01, 04-04, 04-05 | Stress tests cover concurrent navigation and mount races (rapid A→B→A with slow loaders) without double-mount or lost-unmount | ⚠ SATISFIED FOR STATED SCOPE, BUT UNDERLYING FIX STILL INCOMPLETE | The literal A→B→A stress requirement, the single-mount unmatched-route case, and the A→B-overlap-then-unmatched-route case are all met and passing. However, the general mount-race fix this requirement is built on has a THIRD, independently-reproduced hole (see Truth #4) outside the tested matrix. Flagged as a gap, not a full pass, for the third consecutive verification cycle. |
| TEST-02 | 04-02, 04-03 | Manifest-validation edge cases are tested (invalid route formats, deep-merge overrides, multi-match routes) | ✓ SATISFIED | Unchanged since prior pass — all cases implemented and locked by tests |
| TEST-03 | 04-03 | Tests verify settings-handler cleanup on `disableDapp()` (handlers do not fire after disable) | ✓ SATISFIED | Unchanged since prior pass — full-shell integration regression proves real wiring |

No orphaned requirements — REQUIREMENTS.md maps TEST-01/02/03 to Phase 4, and all three are claimed and covered across the three original plans plus the two gap-closure plans (04-04, 04-05).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/shell.ts` | 392 | `mountDapp`'s same-id dedupe checks only id equality, never whether the in-flight call it refers to was already invalidated | 🛑 Blocker (fresh 04-REVIEW.md CR-01, independently reproduced during this verification) | A legitimate re-navigation to a dapp whose prior mount attempt was just invalidated is silently dropped — no error, no mount, nothing in the container — for as long as the invalidated call's slowest loader takes to settle |
| `src/shell.ts` | 389-391 | Comment above the same-id dedupe ("the in-flight call sets currentDappId/currentPath when it finishes") is false for an invalidated call | ⚠️ Warning (04-REVIEW.md WR-01, tied to the CR-01 root cause) | Documentation-correctness issue riding on the same code; will be naturally resolved alongside the CR-01 fix |
| `src/shell.ts` | 358-369 | Unmatched-route abandonment does not clear the container if a stale mount already injected its template before being superseded | ⚠️ Warning (04-REVIEW.md WR-02, carried forward, unaddressed by design) | Not independently reproduced this pass (narrative from 04-REVIEW.md only); explicitly scoped out by both gap-closure plans; distinct from Truth #4's failure |
| `src/shell.ts` | 246-254 | `normalizeRoute` never trims whitespace — routes with stray spaces become silently unreachable | ⚠️ Warning (04-REVIEW.md WR-03, carried forward, unaddressed) | Real but explicitly out-of-scope per both gap-closure plans' stated scope discipline and prior verification judgment; not re-litigated here |
| `src/lifecycle.ts` | 316-332 | Missing staleness gate after the styles-load success path — a superseded mount can still initiate (and for template-less manifests, execute) the next load stage | ⚠️ Warning (04-REVIEW.md WR-04, carried forward, unaddressed) | Not scored as a gap — no stated must-have covers resource-waste-only behavior with no DOM/event leak |
| `src/shell.ts` | 231-240, 262, 315 | registry.json tier: non-array JSON crashes `init()`; fetch/parse failures silently swallowed | ⚠️ Warning (04-REVIEW.md WR-05, carried forward, unaddressed) | Real but out-of-scope per prior verification judgment |
| `src/shell.ts` | 410-413 | Hash mode can emit a misattributed `dx:route:subpath` naming another dapp's route | ⚠️ Warning (04-REVIEW.md WR-06, carried forward, unaddressed) | Out-of-scope per prior verification judgment; history-mode-only stress suite cannot catch this by design |
| `src/shell.ts` | 107-140 | Disabling a dapp mid-mount strands the URL on the disabled dapp's dead route | ⚠️ Warning (04-REVIEW.md WR-07, carried forward — same root cause as Truth #4's dedupe-liveness gap) | Out-of-scope per prior verification judgment; will likely be closed alongside the CR-01 fix given the shared root cause |
| `src/shell.ts` | 448-470, `src/lifecycle.ts` 434-436 | `shell.destroy()` does not bump `mountGeneration`, so an in-flight mount can still commit after the shell is destroyed | ⚠️ Warning (04-REVIEW.md WR-08, carried forward, unaddressed) | Not independently reproduced here; noted for awareness — does not map to a stated phase must-have |
| `src/shell.ts` | 358-374 | Overlapping navigations can emit `dx:route:changed` pairing a stale manifest with the newer path | ⚠️ Warning (04-REVIEW.md WR-09, carried forward, unaddressed) | Not independently reproduced here; does not map to a stated phase must-have |
| `src/shell.ts` | 426-430 | `getMountContainer()` caches the DOM node forever; a host re-render leaves mounts writing into a detached element silently | ⚠️ Warning (04-REVIEW.md WR-10, carried forward, unaddressed) | Not independently reproduced here; contradicts the milestone's no-silent-failures charter but is outside this phase's stated must-haves |
| `tests/stress.test.ts` | whole file | Stress suite never re-navigates to an invalidated dapp — the regression test that would catch the new CR-01 is missing | ⚠️ Warning (04-REVIEW.md WR-11) | Directly actionable — this is the missing artifact listed under this verification's `gaps` |
| `src/lifecycle.ts`, `src/shell.ts` | various | IN-01 through IN-06 (cause-wrapping inconsistency, dangling `inFlightMountId`, empty-string id/entry acceptance, test-hygiene listener leaks, unverified "nothing mounts" assertion, `init()` re-entrancy) | ℹ️ Info (carried forward) | Style/hygiene only; no stated must-have affected |

### Gaps Summary

Three of the four established must-have truths remain fully verified with passing, substantive, independently-re-run tests: the A→B→A stress suite (TEST-01's literal stated scope, now 7 scenarios), the full manifest/route validation matrix (TEST-02), and the settings-cleanup integration regression (TEST-03). Gap-closure plan 04-05 did exactly what it set out to do: `mountDapp`'s `finally` no longer clobbers a newer mount's `pendingMountId` slot, and `handleRouteChange`'s null branch now reads the lifecycle's own `inFlightMountId` via `invalidateAnyPendingMount()` instead of the corruptible shell-level variable. Reverting either edit makes the 04-05 regression scenario fail — this remains true and was re-confirmed passing this pass.

However, the fresh code review (04-REVIEW.md, reviewed after 04-05 landed) found — and this verification independently reproduced against the live codebase — a THIRD, distinct hole in the same D-01 invariant. The root cause this time is different from the first two: `mountDapp`'s same-dapp dedupe (`src/shell.ts:392`) checks only `pendingMountId === manifest.id`, with no way to tell whether the in-flight call that id refers to was already invalidated by `invalidateAnyPendingMount()`/`invalidatePendingMount()`. Both prior fixes correctly stop an invalidated mount from *committing*, but neither one clears (or otherwise invalidates) the dedupe slot itself — so a user who navigates away and then immediately back to the same dapp finds their second, unambiguous navigation silently swallowed by the guard that exists specifically to prevent duplicate mounts. Nothing ever mounts; no error fires; `getCurrentRoute()` correctly reports `/a` while the DOM and `lifecycle.getCurrentDapp()` disagree.

I independently reproduced this with a throwaway, uncommitted test file (`tests/tmp-cr01-repro.test.ts` — created, run to a failing assertion, then deleted): navigate `/a` (held) → navigate `/nowhere` → navigate `/a` again → release the original loader. Result: `dx:mount` never fires for `a` (count 0), matching the review's trace exactly.

This is judged in-scope for the phase (not deferred), for the same reasons the prior two rounds applied: (1) it directly concerns the D-01 invariant this phase's Plan 01, and gap-closure plans 04-04/04-05, were built to enforce, per CONTEXT.md's explicit standing policy that correctness bugs surfaced by the new tests are fixed in-phase; (2) it lives in the exact function (`mountDapp`) and file (`src/shell.ts`) all three prior fix rounds modified; (3) it was proven with an executed, reproducible test, not a hypothetical; (4) the stress suite still has no scenario that re-navigates to an invalidated dapp — the review's WR-11 finding names the exact missing regression test. Arguably this instance is more severe than the first two: those let the *wrong* dapp win; this one lets *no* dapp mount despite an explicit, later user navigation.

The remaining review findings (WR-02 through WR-10, IN-01 through IN-06) are real but do not map to any stated phase must-have truth beyond what is already captured in Truth #4 — they are noted in the Anti-Patterns table for visibility but are not separately scored as gaps, consistent with both prior verification passes' scoping judgment. WR-01 and WR-07 share Truth #4's root cause and will likely resolve as a side effect of whatever fix closes it.

No override is suggested for Truth #4: this is not an intentional deviation or an alternative implementation achieving the same intent — it is an incomplete fix for a bug this phase's own standing policy commits to closing in-phase. If the team judges the third gap-closure round to have diminishing returns relative to the milestone's timeline, that is a call for the developer to make explicitly (e.g. via an accepted override with a stated reason and follow-up tracking), not one this verification should make silently by passing the phase.

---

_Verified: 2026-07-13T21:15:00Z_
_Verifier: Claude (gsd-verifier)_

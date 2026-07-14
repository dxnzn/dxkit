---
phase: 04-testing-stress-edge-case-regression-coverage
verified: 2026-07-13T22:15:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "The THIRD, distinct instance of the D-01 last-navigation-wins invariant violation (re-navigation to a dapp whose in-flight mount was invalidated by an unmatched-route navigation or disableDapp() was silently dropped by the id-keyed same-dapp dedupe at src/shell.ts:392, up to the 30s loader timeout). Closed by gap-closure plan 04-06 (commits 79732f9, fa92c45): a call-scoped pendingMountToken makes mountDapp's finally slot-release liveness-aware (pendingMountToken === myToken instead of pendingMountId === manifest.id), and a new releasePendingMount() helper frees the shell-level pendingMountId dedupe slot at both invalidation call sites (handleRouteChange's null branch, disableDapp). Independently re-traced the fix against the live code (src/shell.ts:58-61, 129-146, 364-441) and independently re-ran the two new regression scenarios plus the full suite — both pass, and a manual trace of the exact interleaving that failed in the prior verification round (A held -> /nowhere invalidates -> A again) now confirms a fresh mount commits (token 3 supersedes the stale call's token 1; the stale call's finally is guarded off by the token mismatch)."
  gaps_remaining: []
  regressions: []
---

# Phase 4: Testing — Stress, Edge-Case & Regression Coverage Verification Report

**Phase Goal:** The test suite covers the concurrency, validation-edge-case, and cleanup scenarios the concerns audit called out as missing.
**Verified:** 2026-07-13T22:15:00Z
**Status:** passed
**Re-verification:** Yes — after gap-closure plan 04-06, which closed the third and final D-01 dedupe-liveness hole (CR-01) identified across three consecutive verification/review rounds.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A stress-test suite drives rapid A→B→A navigation with slow loaders and asserts no double-mount and no lost-unmount occurs (ROADMAP SC1 / TEST-01) | ✓ VERIFIED | `tests/stress.test.ts` scenario "rapid A -> B -> A" (line 132) drives the exact interleaving through `createShell()` + `shell.navigate()`, asserts `getCurrentRoute()==='/a'`, exactly one `dx:mount` for `a`, zero for `b`, strict mount/unmount alternation, and container DOM content. Independently re-ran: `pnpm vitest run tests/stress.test.ts` — 9/9 pass (7 prior + 2 new from 04-06). |
| 2 | Manifest-validation tests cover invalid route formats, deep-merge override behavior, and multi-match routes, each asserting the correct accept/reject/merge outcome (ROADMAP SC2 / TEST-02) | ✓ VERIFIED | `src/shell.ts` `normalizeAndValidateManifests()`/`normalizeRoute()` implement normalize/reject/tier-validate/dedupe (grep-confirmed, unchanged since 04-05/04-06 — both plans touched only `mountDapp`/`handleRouteChange`/`disableDapp`, an unrelated code path). `tests/shell.test.ts`, `tests/router.test.ts`, `tests/utils.test.ts` cases all present. Independently re-ran: `pnpm vitest run tests/shell.test.ts tests/router.test.ts tests/utils.test.ts` — all pass. |
| 3 | A regression test verifies settings handlers registered by a dapp do not fire after that dapp is disabled via `disableDapp()` (ROADMAP SC3 / TEST-03) | ✓ VERIFIED | `plugins/settings/tests/integration.test.ts` drives the real `createShell` → `createSettings` → `shell.disableDapp('hello')` and asserts `helloHandler` is not called after disable while `worldHandler` still fires. Independently re-ran: 1/1 pass. 04-06's `disableDapp` edit (adding a `releasePendingMount()` call, guarded by `pendingMountId === id`) is additive and does not touch the `enabledState`/event-unsubscribe path this test exercises. |
| 4 | The D-01 last-navigation-wins invariant holds for the two remaining interleavings identified by the fresh 04-REVIEW.md's CR-01 finding: re-navigation to a dapp whose in-flight mount was invalidated by (a) an unmatched-route navigation, and (b) `disableDapp()` | ✓ VERIFIED | Independently re-traced the fix in `src/shell.ts` against the exact failure sequence reproduced in the prior verification round: `navigate('/a')` (suspends, `pendingMountId='a'`, `myToken=1`) → `navigate('/nowhere')` → `handleRouteChange`'s null branch calls `lifecycle.invalidateAnyPendingMount()` (line 373, unchanged) then the new `releasePendingMount()` (line 376: `pendingMountToken++` → 2, `pendingMountId = null`) → `navigate('/a')` again → the same-id dedupe at line 409 (`if (pendingMountId === manifest.id) return;`) no longer fires because `pendingMountId` is `null`, not `'a'` → a fresh mount takes the slot (`myToken = ++pendingMountToken` = 3) → on release, the stale call (token 1) fails `isStale()` in `lifecycle.ts` and returns without committing, its `finally` guard (`pendingMountToken === myToken` → `3 === 1` → false) does NOT clear the slot; the fresh call (token 3) commits and its `finally` (`3 === 3` → true) clears the slot. Net: exactly one `dx:mount` for `a`. Independently re-ran the two new committed regression scenarios that lock this exact sequence: `tests/stress.test.ts:362` (A→unmatched→A) and `tests/stress.test.ts:404` (disableDapp→enableDapp→re-navigate) — both pass (`mountsA.count()===1`/`mountsOpt.count()===1`, `dx:dapp:mounted` fired exactly once, container populated, `getCurrentRoute()`/`isDappEnabled()` correct). Also independently confirmed via a fresh full-suite run (`make test`: 312/312 pass, lint clean) that the two prior gap-closure fixes (04-04's dapp→unmatched scenario at line 207, 04-05's A→B-overlap→unmatched scenario at line 244) and the legitimate same-dapp dedupe (sub-path-into-mounting-A scenario at line 334) are unregressed. The fresh 04-REVIEW.md (reviewed 2026-07-14T03:06:14Z, after 04-06 landed) independently reached the same conclusion via exhaustive interleaving trace and invariant induction: "The CR-01 class is closed" with 0 Critical findings. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shell.ts` | Call-scoped `pendingMountToken` + `releasePendingMount()` helper wired into both invalidation call sites (04-06) | ✓ VERIFIED | Confirmed via grep and manual read: `pendingMountToken` declared line 61, `releasePendingMount()` defined lines 388-391 (bumps token, nulls `pendingMountId`), called from `handleRouteChange`'s null branch (line 376) and `disableDapp` (line 142, guarded by `pendingMountId === id`). `mountDapp`'s `finally` (lines 433-439) now guards the clear on `pendingMountToken === myToken` — `grep -cE 'pendingMountId === manifest\.id' src/shell.ts` returns exactly 1 (only the top-of-function dedupe check remains id-keyed, as designed) |
| `src/lifecycle.ts` | Unchanged by 04-06 (scope discipline) | ✓ VERIFIED | `git diff --stat 06c3a93 HEAD -- src/lifecycle.ts` shows no changes; `mountGeneration`/`isStale()`/`invalidatePendingMount`/`invalidateAnyPendingMount` machinery from 04-04/04-05 confirmed intact and unmodified |
| `tests/stress.test.ts` | Two new committed, green regression scenarios locking the dedupe-liveness fix (04-06) | ✓ VERIFIED | 9 scenarios total (7 prior + 2 new): "A -> unmatched -> A: re-navigation to an invalidated dapp mounts fresh..." (line 362) and "disableDapp -> enableDapp -> re-navigate..." (line 404). Both substantive (assert mount count, event count, DOM content, route/enabled state), both pass |
| `tests/lifecycle.test.ts` | generation-guard unit tests | ✓ VERIFIED | Unchanged since prior pass, still passing |
| `src/shell.ts` (Plan 02) | normalizeAndValidateManifests choke point | ✓ VERIFIED | Unchanged since prior pass |
| `tests/shell.test.ts`, `tests/router.test.ts` (Plan 02) | normalization/reject/tier-parity/duplicate/multi-match tests | ✓ VERIFIED | Unchanged since prior pass |
| `plugins/settings/tests/integration.test.ts` | full-shell settings-cleanup regression | ✓ VERIFIED | Unchanged since prior pass |
| `tests/utils.test.ts`, `src/utils.ts` (Plan 03) | deepMerge documented-semantics assertions | ✓ VERIFIED | Unchanged since prior pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `handleRouteChange(null)` | `releasePendingMount()` | line 376, after `invalidateAnyPendingMount()` at line 373 | ✓ WIRED | Confirmed; exercised by `tests/stress.test.ts:362` scenario — the re-navigation to A is no longer dropped |
| `disableDapp()` | `releasePendingMount()` (guarded) | line 142, `if (pendingMountId === id) releasePendingMount();`, after `lifecycle.invalidatePendingMount(id)` at line 139 | ✓ WIRED | Confirmed; exercised by `tests/stress.test.ts:404` scenario — the re-navigation to a mid-mount-disabled dapp is no longer dropped |
| `mountDapp()`'s `finally` | `pendingMountId = null` (guarded) | line 437, `if (pendingMountToken === myToken)` | ✓ WIRED | Call-scoped — only the call that currently owns the token clears the slot; a stale/invalidated call's finally can no longer clobber a newer attempt's slot regardless of whether it shares the same dapp id |
| `mountDapp()`'s same-id dedupe | liveness of the in-flight call it is deduping against | line 409, `if (pendingMountId === manifest.id) return;` | ✓ WIRED (resolved) | Previously flagged as `NOT GUARDED` — now correctly guarded transitively: `releasePendingMount()` nulls `pendingMountId` at both invalidation sites, so by the time a re-navigation reaches this check, `pendingMountId` is no longer parked on a dead id. The legitimate concurrent-duplicate dedupe (no intervening invalidation) is preserved because this line is intentionally left unchanged (id-keyed) |
| `lifecycle.mount()` | `isStale()` re-check | before every container mutation/state commit | ✓ WIRED | Confirmed at all documented gate points, unchanged |
| `init()` | `normalizeAndValidateManifests(loadManifests())` | line ~321 | ✓ WIRED | Confirmed via grep; exercised across all three manifest tiers |
| `createShell(...).disableDapp(id)` | `dx:dapp:disabled` → settings `cleanup(dappId)` | real event bus, not mocked | ✓ WIRED | Confirmed in `plugins/settings/tests/integration.test.ts`, passing |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green (single run) | `make test` | 312/312 tests pass, 12 files, lint clean | ✓ PASS |
| Targeted 04-06 regression re-run | `pnpm vitest run tests/stress.test.ts tests/shell.test.ts tests/lifecycle.test.ts` | 114/114 pass (independently re-run, matches SUMMARY's claimed 312-total delta) | ✓ PASS |
| Acceptance-criteria grep counts (04-06-PLAN.md) | `grep -c 'pendingMountToken' / 'releasePendingMount' / 'pendingMountToken === myToken' / 'pendingMountId === manifest\.id' src/shell.ts` | 4 / 4 / 1 / 1 | ✓ PASS (matches plan's stated acceptance thresholds exactly) |
| `lifecycle.ts` untouched (scope discipline) | `git diff --stat 06c3a93 HEAD -- src/lifecycle.ts` | no output (no changes) | ✓ PASS |
| No debt markers in phase-touched files | grep TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER across `src/shell.ts`, `src/lifecycle.ts`, `tests/stress.test.ts` | 0 hits | ✓ PASS |
| Fresh code review (independent AI review, not this verifier) confirms CR-01 closed | `.planning/phases/04-testing-stress-edge-case-regression-coverage/04-REVIEW.md` (reviewed 2026-07-14T03:06:14Z, after 04-06 landed) | 0 Critical, 10 Warning (all carried-forward or narrower-scope new findings, none reopening CR-01), 149/149 stress-adjacent tests referenced as green | ✓ PASS (corroborating, not substituted for independent code trace + test re-run above) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TEST-01 | 04-01, 04-04, 04-05, 04-06 | Stress tests cover concurrent navigation and mount races (rapid A→B→A with slow loaders) without double-mount or lost-unmount | ✓ SATISFIED | The literal A→B→A stress requirement, both single-invalidation cases (04-04, 04-05), and both re-navigation-to-invalidated-dapp cases (04-06) are all implemented, wired, and independently re-verified passing. The D-01 invariant has now been closed across all three code-review-identified interleavings (CR-01's three distinct instances) with committed, load-bearing regression tests for each |
| TEST-02 | 04-02, 04-03 | Manifest-validation edge cases are tested (invalid route formats, deep-merge overrides, multi-match routes) | ✓ SATISFIED | Unchanged since prior pass — all cases implemented and locked by tests |
| TEST-03 | 04-03 | Tests verify settings-handler cleanup on `disableDapp()` (handlers do not fire after disable) | ✓ SATISFIED | Unchanged since prior pass — full-shell integration regression proves real wiring |

No orphaned requirements — REQUIREMENTS.md maps TEST-01/02/03 to Phase 4 (all marked Complete), and all three are claimed and covered across the three original plans plus the three gap-closure plans (04-04, 04-05, 04-06).

### Anti-Patterns Found

No blocker anti-patterns in phase-touched files (`src/shell.ts`, `src/lifecycle.ts`, `tests/stress.test.ts`). The remaining findings below are carried forward from the fresh 04-REVIEW.md; none map to a stated phase must-have and none regress the CR-01 fix. Included for visibility per standard practice — not scored as gaps, consistent with this phase's prior two verification rounds' scoping judgment (which the current 04-06-PLAN.md's own scope-discipline section explicitly ratified by name).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/shell.ts` | 427-432 | `currentPath = freshPath` executes in a stale mount's continuation even when the commit is skipped — inside a hash-mode/popstate async-dispatch window, a stale settle can pre-write the path and silently swallow the next `dx:route:subpath` | ⚠️ Warning (04-REVIEW.md WR-01, new/narrower finding this round) | Confined to sub-path bookkeeping only (DOM/`dx:mount`/`currentDappId` invariants unaffected); requires hash mode or a `popstate` back/forward window, both explicitly outside this phase's deliberately history-only stress suite (documented "Pitfall 3," `tests/stress.test.ts:12-14`). Not surfaced by any existing or new test — a code-review-only finding, not an independently-reproduced failure. Does not regress any of TEST-01/02/03 or Truth #4's specific scope (mount/dx:mount count, container content, route state) |
| `src/shell.ts` | 364-378, `src/lifecycle.ts` 392,411 | Unmatched-route abandonment after template injection leaves stale dapp HTML in the container | ⚠️ Warning (04-REVIEW.md WR-02, carried forward, unaddressed) | Out of scope per 04-06-PLAN.md's explicit scope-discipline list |
| `src/shell.ts` | 252-260 | `normalizeRoute` never trims whitespace | ⚠️ Warning (04-REVIEW.md WR-03, carried forward, unaddressed) | Out of scope per prior verification judgment, ratified again by 04-06-PLAN.md |
| `src/lifecycle.ts` | 316-329 | Missing staleness gate after the styles-load success path | ⚠️ Warning (04-REVIEW.md WR-04, carried forward, unaddressed) | Out of scope; no stated must-have covers resource-waste-only behavior |
| `src/shell.ts` | 237-246 | registry.json tier: non-array JSON crashes `init()`; fetch/parse failures silently swallowed | ⚠️ Warning (04-REVIEW.md WR-05, carried forward, unaddressed) | Out of scope per prior verification judgment |
| `src/shell.ts` | 428-431 | Hash mode can emit a misattributed `dx:route:subpath` naming another dapp's route | ⚠️ Warning (04-REVIEW.md WR-06, carried forward, unaddressed) | Out of scope; history-mode-only stress suite cannot catch this by design |
| `src/shell.ts` | 110-146 | Disabling a dapp mid-mount strands the URL on the disabled dapp's dead route | ⚠️ Warning (04-REVIEW.md WR-07, carried forward — 04-06 built the detection needed but explicitly scoped out the recovery half) | Out of scope per 04-06-PLAN.md (explicitly named as deferred: "WR-07's stranded-URL recovery... out of scope") |
| `src/shell.ts` | 466-488, `src/lifecycle.ts` 434-436 | `shell.destroy()` doesn't abandon an in-flight mount; new with 04-06's token, a destroy→init cycle can also drop the first re-navigation via the parked slot | ⚠️ Warning (04-REVIEW.md WR-08, carried forward + extended) | Out of scope per 04-06-PLAN.md's scope discipline; does not affect any of this phase's tested scenarios (no test destroys and re-inits the same shell instance mid-mount) |
| `src/shell.ts` | 364-383 | Overlapping navigations can emit `dx:route:changed` pairing a stale manifest with the newer path | ⚠️ Warning (04-REVIEW.md WR-09, carried forward, unaddressed) | Out of scope; does not map to a stated phase must-have |
| `src/shell.ts` | 444-448 | `getMountContainer()` caches the DOM node forever | ⚠️ Warning (04-REVIEW.md WR-10, carried forward, unaddressed) | Out of scope; does not map to a stated phase must-have |
| `src/lifecycle.ts`, `src/shell.ts` | various | IN-01 through IN-06 (cause-wrapping inconsistency, dangling `inFlightMountId`, empty-string id/entry acceptance, test-hygiene listener leaks, unverified assertion, `init()` re-entrancy) | ℹ️ Info (carried forward) | Style/hygiene only; no stated must-have affected |

### Gaps Summary

None. All four established must-have truths are now fully verified with passing, substantive, independently re-run tests and a manual code trace of the exact failure sequence from the prior verification round. Gap-closure plan 04-06 did exactly what it set out to do: made the shell's `pendingMountId` dedupe slot call-scoped via a monotonic `pendingMountToken`, and freed that slot at both invalidation call sites (`handleRouteChange`'s null branch, `disableDapp`) via a new `releasePendingMount()` helper. Reverting either edit reproduces the exact prior-round failure (`mountsA.count()===0` on re-navigation) — confirmed load-bearing both by the SUMMARY's documented manual revert-and-restore against commit `06c3a93`, and by this verification's independent trace of the token arithmetic through the fix.

This closes the D-01 last-navigation-wins invariant across all three code-review-identified interleavings (the second CR-01 instance closed by 04-05, and this third instance closed by 04-06), with committed, non-`test.fails` regression coverage for each. A fresh, independent code review (04-REVIEW.md, reviewed after 04-06 landed) reached the same conclusion via a different verification method (exhaustive interleaving trace and invariant induction) and reports 0 Critical findings, explicitly stating "The CR-01 class is closed."

One new, narrower-scope finding emerged from that fresh review during this same pass (WR-01: a stale mount's continuation can pre-write `currentPath` inside a hash-mode/popstate async-dispatch window, silently swallowing a `dx:route:subpath` notification). This is judged out of scope for this phase's gap-closure cycle, not deferred silently: it affects only sub-path bookkeeping (not the mount/unmount/DOM invariants TEST-01 and Truth #4 are about), it requires hash mode or a `popstate` window that this phase's stress suite deliberately excludes by design, and — critically — it was not surfaced by an executing test (unlike CR-01's three instances, each of which was independently reproduced with a concrete failing repro before being scored as a gap). It is recorded in the Anti-Patterns table above for visibility and is a reasonable candidate for a future phase or backlog item, but it does not block this phase's goal: "The test suite covers the concurrency, validation-edge-case, and cleanup scenarios the concerns audit called out as missing."

The remaining carried-forward warnings (WR-02 through WR-10, IN-01 through IN-06) are unchanged from the prior verification round's judgment and remain explicitly out of scope per 04-06-PLAN.md's own scope-discipline section, which named each of them individually as deferred.

---

_Verified: 2026-07-13T22:15:00Z_
_Verifier: Claude (gsd-verifier)_

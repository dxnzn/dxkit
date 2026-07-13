---
phase: 04-testing-stress-edge-case-regression-coverage
verified: 2026-07-13T19:56:51Z
status: gaps_found
score: 3/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "The D-01 last-navigation-wins invariant (CONTEXT.md line 25 — 'Under concurrent mounts, the final DOM and lifecycle.getCurrentDapp() MUST match the most recent navigation') holds for ALL navigation transitions this phase's mount-generation guard was built to fix, not only dapp-to-dapp transitions"
    status: failed
    reason: >-
      Code review finding CR-01, independently reproduced during this verification: navigating to a
      route that resolves to NO manifest (an unmatched route) does not abandon an in-flight mount.
      handleRouteChange(null) (src/shell.ts:358-368) only calls lifecycle.unmount() — it never calls
      lifecycle.invalidatePendingMount(pendingMountId) — so the mount-generation guard added by this
      phase's Plan 01 (src/lifecycle.ts) is never bumped for the null-manifest branch. The in-flight
      mount for the dapp the user navigated away FROM is still "current" as far as isStale() is
      concerned, so when its loader settles it commits: dx:mount/dx:dapp:mounted fire, the container
      is populated with the stale dapp's template, and a misattributed dx:route:subpath event names
      the stale dapp with the new (unmatched) path — while shell.getCurrentRoute() correctly reports
      the unmatched route. This is the exact invariant Plan 01 was written to guarantee and the exact
      files (src/shell.ts, src/lifecycle.ts) that plan modified; the D-03 race matrix in tests/stress.test.ts
      covers dapp->dapp and disable-mid-flight interleavings but has no case for dapp->unmatched-route.
    artifacts:
      - path: "src/shell.ts"
        issue: "handleRouteChange's null-manifest branch (lines 358-368) does not invalidate a pending in-flight mount before/instead of calling lifecycle.unmount()"
    missing:
      - "In handleRouteChange, when the resolved manifest is null, invalidate the in-flight pending mount (e.g. lifecycle.invalidatePendingMount(pendingMountId) when pendingMountId is set) before or alongside lifecycle.unmount()"
      - "A regression test in tests/stress.test.ts (or a new scenario in the same describe block): navigate to a dapp with a held loader, navigate to an unmatched route, release the loader, and assert zero dx:mount, an empty/unchanged container, and no dx:route:subpath event"
---

# Phase 4: Testing — Stress, Edge-Case & Regression Coverage Verification Report

**Phase Goal:** The test suite covers the concurrency, validation-edge-case, and cleanup scenarios the concerns audit called out as missing.
**Verified:** 2026-07-13T19:56:51Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A stress-test suite drives rapid A→B→A navigation with slow loaders and asserts no double-mount and no lost-unmount occurs (ROADMAP SC1 / TEST-01) | ✓ VERIFIED | `tests/stress.test.ts` scenario "rapid A -> B -> A" (lines 132-176) drives the exact interleaving through `createShell()` + `shell.navigate()`, asserts `getCurrentRoute()==='/a'`, exactly one `dx:mount` for `a`, zero for `b`, strict mount/unmount alternation, and container DOM content. Independently re-ran: `pnpm vitest run tests/stress.test.ts` — 5/5 pass. |
| 2 | Manifest-validation tests cover invalid route formats, deep-merge override behavior, and multi-match routes, each asserting the correct accept/reject/merge outcome (ROADMAP SC2 / TEST-02) | ✓ VERIFIED | `src/shell.ts` `normalizeAndValidateManifests()`/`normalizeRoute()` (grep-confirmed at lines 246, 259) implement normalize/reject/tier-validate/dedupe; `tests/shell.test.ts` new "manifest & route validation (D-06/D-07/D-08)" block + WR-01 cases; `tests/router.test.ts` "duplicate exact routes" block; `tests/utils.test.ts` deepMerge nested-array + nested-pollution-guard cases. Independently re-ran: all pass. |
| 3 | A regression test verifies settings handlers registered by a dapp do not fire after that dapp is disabled via `disableDapp()` (ROADMAP SC3 / TEST-03) | ✓ VERIFIED | `plugins/settings/tests/integration.test.ts` drives the real `createShell` → real `createSettings` → real `shell.disableDapp('hello')` and asserts `helloHandler` is not called after disable while `worldHandler` (a different, still-enabled dapp) still fires — proves no over-cleanup. Independently re-ran: 1/1 pass. |
| 4 | The D-01 last-navigation-wins invariant (the general property Plan 01's mount-generation guard was built to enforce, per CONTEXT.md D-01) holds for ALL navigation transitions, not only dapp-to-dapp | ✗ FAILED | CR-01 (code review), independently reproduced with a throwaway test during this verification (not committed): navigate `/a` (entry held) → navigate `/nowhere` (unmatched route) → release entry ⇒ `dx:mount` fires for `a`, `container.innerHTML` is populated with A's content, and a `dx:route:subpath {id:'a', path:'/nowhere', previousPath:'/a'}` fires — while `shell.getCurrentRoute()` correctly reports `/nowhere`. Zero mounts/zero DOM writes were expected. |

**Score:** 3/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lifecycle.ts` | mountGeneration counter + isStale() gating + invalidatePendingMount() | ✓ VERIFIED | Confirmed via grep: `mountGeneration` (263), `inFlightMountId` (264), `isStale` gates after every await (316,331,342,353,362,375,386,394,405), `invalidatePendingMount` (440-449), exported (456) |
| `src/shell.ts` | disableDapp wiring to invalidatePendingMount + fresh-path commit | ✓ VERIFIED | `lifecycle.invalidatePendingMount(id)` at line 136 inside `disableDapp()`; fresh-path re-read at lines 404-408 in `mountDapp()` |
| `tests/stress.test.ts` | dedicated concurrency/race stress suite (D-11) | ✓ VERIFIED | 5 scenarios present, substantive, all pass; but see Truth #4 — the matrix omits the dapp→unmatched-route interleaving |
| `tests/lifecycle.test.ts` | generation-guard unit tests | ✓ VERIFIED | New describe block confirmed passing (98 tests in file+shell.test.ts combined run) |
| `src/shell.ts` (Plan 02) | normalizeAndValidateManifests choke point + WR-01 emits | ✓ VERIFIED | `normalizeAndValidateManifests` (259), `normalizeRoute` (246), `shell:route`/`shell:manifest` sources confirmed via grep |
| `tests/shell.test.ts`, `tests/router.test.ts` (Plan 02) | normalization/reject/tier-parity/duplicate/WR-01 + multi-match/duplicate resolution tests | ✓ VERIFIED | New describe blocks confirmed present and passing |
| `plugins/settings/tests/integration.test.ts` | full-shell settings-cleanup regression | ✓ VERIFIED | Real `createShell`+`createSettings`+`disableDapp()` — no mocked context (grep confirms no `mockContext` in file) |
| `tests/utils.test.ts`, `src/utils.ts` (Plan 03) | deepMerge documented-semantics assertions + JSDoc reconcile | ✓ VERIFIED | 2 new gap-fill cases; `git show f00e9fe` confirms comment-only change to JSDoc |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `shell.disableDapp()` | `lifecycle.invalidatePendingMount(id)` | direct call, line 136 | ✓ WIRED | Confirmed in source; exercised by `tests/stress.test.ts` scenario 2 and `tests/lifecycle.test.ts` |
| `lifecycle.mount()` | `isStale()` re-check | before every container mutation/state commit | ✓ WIRED | Confirmed at all documented gate points (template, sanitize, dependency loop, entry, final commit) |
| `init()` | `normalizeAndValidateManifests(loadManifests())` | line 315 | ✓ WIRED | Confirmed via grep; exercised across all three manifest tiers in `tests/shell.test.ts` |
| `createShell(...).disableDapp(id)` | `dx:dapp:disabled` → settings `cleanup(dappId)` | real event bus, not mocked | ✓ WIRED | Confirmed in `plugins/settings/tests/integration.test.ts`, passing |
| `handleRouteChange(null)` | `lifecycle.invalidatePendingMount(pendingMountId)` | — | ✗ NOT WIRED | This link does not exist. The null-manifest branch (src/shell.ts:361-363) only calls `lifecycle.unmount()`. This is the root cause of Truth #4 / CR-01. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green (single run, not per-truth) | `make test` | 308/308 tests pass, 12 files, lint clean | ✓ PASS |
| Targeted new-test files | `pnpm vitest run tests/stress.test.ts tests/lifecycle.test.ts tests/shell.test.ts tests/router.test.ts tests/utils.test.ts plugins/settings/tests/integration.test.ts` | 145/145 pass | ✓ PASS |
| CR-01 reproduction (navigate to unmatched route while mount in-flight) | throwaway test driving `createShell()` (deleted after use, not committed) | `dx:mount` fired for stale dapp `a`, container populated with `a`'s content, `shell.getCurrentRoute()==='/nowhere'`, misattributed `dx:route:subpath` fired | ✗ FAIL (confirms CR-01 is real, not narrative-only) |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase-modified files | grep across `src/lifecycle.ts`, `src/shell.ts`, `src/utils.ts`, all new/modified test files | 0 hits | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TEST-01 | 04-01 | Stress tests cover concurrent navigation and mount races (rapid A→B→A with slow loaders) without double-mount or lost-unmount | ⚠ SATISFIED FOR STATED SCOPE, BUT UNDERLYING FIX INCOMPLETE | The literal A→B→A stress requirement is met and passing. However, the mount-race fix this requirement is built on (src/lifecycle.ts + src/shell.ts) has a proven gap outside the tested matrix — see Truth #4/CR-01. Flagged as a gap, not a full pass. |
| TEST-02 | 04-02, 04-03 | Manifest-validation edge cases are tested (invalid route formats, deep-merge overrides, multi-match routes) | ✓ SATISFIED | Route normalization/reject, tier-parity, duplicate-route, deep-merge (recursive/array/undefined/null/pollution-guard) all implemented and locked by tests |
| TEST-03 | 04-03 | Tests verify settings-handler cleanup on `disableDapp()` (handlers do not fire after disable) | ✓ SATISFIED | Full-shell integration regression proves real wiring, with no-over-cleanup assertion |

No orphaned requirements — REQUIREMENTS.md maps TEST-01/02/03 to Phase 4, and all three are claimed and covered across the three plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/shell.ts` | 358-368 | Incomplete invalidation: null-route branch of `handleRouteChange` does not supersede an in-flight mount | 🛑 Blocker (CR-01) | Stale dapp commits under the wrong URL — violates the exact invariant this phase's Plan 01 was built to guarantee; proven via executed repro |
| `src/shell.ts` | 409-411 | `mountDapp`'s `finally` unconditionally clears shared `pendingMountId`, can clobber a newer concurrent mount's dedupe guard | ⚠️ Warning (review WR-01) | Narrative finding from code review, not independently reproduced during this verification (no executed repro provided); does not map to a stated phase must-have — noted for awareness, not scored as a gap |
| `src/shell.ts` | 246-254 | `normalizeRoute` does not trim whitespace before storing, so `'/blog '` normalizes but remains permanently unreachable | ⚠️ Warning (review WR-02) | Edge case within D-06's spirit but not covered by any must-have truth for this phase; not independently reproduced here |
| `src/lifecycle.ts` | 369-405 | Superseded mounts still execute dependency/entry script loads (isStale() only gates before the DOM write, not before initiating the next load stage) | ⚠️ Warning (review WR-03) | Resource/side-effect waste on abandoned mounts; does not violate any stated must-have (no dx:mount/DOM/currentDappId leak) |
| `src/shell.ts` | 231-241, 262, 315 | registry.json tier: non-array JSON crashes `init()`; fetch/parse failures still silent | ⚠️ Warning (review WR-04) | Contradicts the tier-uniform validation this phase's Plan 02 claims for D-07, but is a distinct code path (registry.json malformed-response handling) not asserted by any Plan 02 must-have truth |
| `src/shell.ts` | 404-407 | Hash mode can emit misattributed `dx:route:subpath` | ⚠️ Warning (review WR-05) | Stress suite is deliberately history-mode-only (documented pitfall), so this hash-mode-specific gap is untested by design; outside this phase's must-haves |
| `src/shell.ts` | 126-140 | `disableDapp()` mid-flight leaves URL parked on the disabled dapp's dead route | ⚠️ Warning (review WR-06) | Related to but distinct from the TEST-01/D-03-scenario-1 must-have (which only asserts no mount/no dx:dapp:mounted — both hold); URL-recovery behavior after disable is not a stated must-have |
| `src/shell.ts` | 386, 397-411 | Disable→enable re-navigation can be silently dropped while an abandoned mount's loader is still pending | ⚠️ Warning (review WR-07) | Not covered by any stated must-have; a real gap but out of this phase's asserted scope |
| `src/lifecycle.ts` | 356 | Inconsistent `cause` wrapping in one catch branch | ℹ️ Info (review IN-01) | Style/consistency only |
| `src/lifecycle.ts` | 342, 362, 386, 405, 440-447 | `inFlightMountId` left dangling after `invalidatePendingMount` | ℹ️ Info (review IN-02) | No live consumer today; harmless per review's own analysis |
| `tests/shell.test.ts` | 60-64, 653-673 | `removeEventListener` called with wrong function reference; leaked `dx:error` listeners | ℹ️ Info (review IN-03) | Test hygiene only; review confirms no assertion is currently affected |
| `src/shell.ts` | 167-176 | `isValidManifest` accepts empty-string `id`/`entry` | ℹ️ Info (review IN-04) | Edge case not covered by any must-have |

### Gaps Summary

Three of the four established must-have truths are fully verified with passing, substantive, independently-re-run tests: the A→B→A stress suite (TEST-01's literal stated scope), the full manifest/route validation matrix (TEST-02), and the settings-cleanup integration regression (TEST-03). All artifacts and key links this phase claims to have produced exist, are wired, and pass `make test` (308/308, lint clean).

However, the code review's Critical finding (CR-01) is real — I independently reproduced it with a throwaway test (not committed) against the current codebase: navigating to an unmatched route while a dapp's mount is in flight does NOT abandon that mount. `handleRouteChange`'s null-manifest branch calls only `lifecycle.unmount()`, never `lifecycle.invalidatePendingMount()`, so the mount-generation guard this phase's Plan 01 built specifically to enforce "last-navigation-wins" (CONTEXT.md D-01, stated as a general invariant, not limited to dapp-to-dapp transitions) has a hole for this ordinary user action (click a dapp link, then quickly navigate to `/` or any non-dapp route). The `dx:mount` fires, the container is populated with the stale dapp's content, and a misattributed `dx:route:subpath` event is emitted — all while the browser's URL correctly shows the unmatched route.

This is judged in-scope for this phase (not deferred/follow-up) because: (1) it directly concerns the D-01 invariant this phase's Plan 01 was built to fix and test; (2) the defect lives in the exact files (`src/shell.ts`, `src/lifecycle.ts`) Plan 01 modified; (3) it was proven with an executed, reproducible test, not a hypothetical; (4) the D-03 race matrix this phase's stress suite implements was intended to be comprehensive but omits this ordinary interleaving. A one-line fix (invalidate the pending mount in the null branch before/alongside `lifecycle.unmount()`) plus one additional stress-test scenario would close this gap.

The remaining review findings (WR-01 through WR-07, IN-01 through IN-04) are real but do not map to any stated phase must-have truth — they are noted in the Anti-Patterns table for visibility but are not scored as gaps against this phase's goal.

---

_Verified: 2026-07-13T19:56:51Z_
_Verifier: Claude (gsd-verifier)_

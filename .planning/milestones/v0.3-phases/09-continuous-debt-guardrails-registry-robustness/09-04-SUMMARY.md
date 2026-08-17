---
phase: 09-continuous-debt-guardrails-registry-robustness
plan: 04
subsystem: infra
tags: [shell, registry, error-handling, array-guard, vitest]

requires:
  - phase: 09-continuous-debt-guardrails-registry-robustness (plan 01/02/03)
    provides: CI deprecation gate (GATE-01) and Renovate dependency-freshness (GATE-03) — independent track, no functional dependency
provides:
  - "loadManifests() Array.isArray() guard on the parsed registry.json 200 body"
  - "Ungated dx:error (source shell:manifest) on a wrong-shape 200 body, even on the default silent /registry.json probe"
  - "Four ROB-05 regression tests in tests/shell.test.ts (explicit / default-probe-ungated / init-exposure / happy-path)"
affects: [shell, registry-loading, error-surfacing]

tech-stack:
  added: []
  patterns:
    - "Array.isArray() top-level shape guard before element-level validation (normalizeAndValidateManifests stays the single choke point for per-manifest validation)"
    - "Deliberate exception to the silent-default-probe convention: shape mismatches are never an expected state, so this one guard is ungated by registryUrlExplicit while sibling non-OK/parse-failure emits stay gated (D-15)"

key-files:
  created: []
  modified:
    - src/shell.ts
    - tests/shell.test.ts

key-decisions:
  - "The array guard emits unconditionally (not wrapped in `if (registryUrlExplicit)`) — D-10/P2, the one deliberate exception to the D-15 silent-absence convention, because a wrong-shape 200 is never an expected/benign state even on the default probe."
  - "Fix lives entirely inside loadManifests() at the res.json() call site; normalizeAndValidateManifests() is untouched — it remains the single choke point for element-level manifest validation, per the plan's explicit prohibition."

patterns-established: []

requirements-completed: [ROB-05]

coverage:
  - id: D1
    description: "A wrong-shape 200 registry body with an explicit registryUrl emits dx:error (source shell:manifest) and does not throw"
    requirement: "ROB-05"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#emits a dx:error and fail-closes to [] when an explicit registryUrl 200 body is not an array (ROB-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same wrong-shape 200 on the default silent /registry.json probe (no explicit registryUrl) still emits dx:error — ungated (D-10)"
    requirement: "ROB-05"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#emits a dx:error on the default registryUrl probe when the 200 body is not an array — ungated (ROB-05, D-10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "shell.init() resolves and window.__DXKIT__ is exposed after a wrong-shape 200 (fail-closed to [])"
    requirement: "ROB-05"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#still exposes window.__DXKIT__ after init() when the registry 200 body is not an array (ROB-05)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A well-formed array 200 still flows unchanged into normalizeAndValidateManifests() (no regression to the happy path)"
    requirement: "ROB-05"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#a well-formed array 200 registry body still flows through unchanged (ROB-05 happy path)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-18
status: complete
---

# Phase 09 Plan 04: ROB-05 Registry Array Guard Summary

**`loadManifests()` now `Array.isArray()`-guards the parsed registry.json 200 body, fail-closing to `[]` with an ungated `dx:error` instead of letting a wrong-shape body throw an uncaught `TypeError` out of `normalizeAndValidateManifests()` before `window.__DXKIT__` is exposed.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-18T06:08:13Z
- **Completed:** 2026-07-18T06:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Reproduced the uncaught `TypeError: list is not iterable` crash site with four RED regression tests before touching source (explicit registryUrl, ungated default-probe, post-init window exposure, happy path).
- Closed the last open Phase-1 WR-01 todo: a malformed/attacker-influenced registry body can no longer prevent `window.__DXKIT__` from being published.
- Confirmed the fix is scoped exactly as the plan's `key_links`/`prohibitions` required — the guard lives at the `res.json()` call site in `loadManifests()`, `normalizeAndValidateManifests()` is untouched, and the emit is deliberately ungated per D-10/P2.

## Task Commits

Each task was committed atomically:

1. **Task 1: ROB-05 regression tests (RED)** - `8ab1284` (test)
2. **Task 2: Array.isArray guard in loadManifests() (GREEN)** - `d6cec36` (fix)

**Plan metadata:** (this commit)

_Note: Task 1 is a tdd="true" RED-phase commit; Task 2 is a plain "auto" GREEN-phase fix, per the plan's task types._

## Files Created/Modified
- `src/shell.ts` - `loadManifests()`: parsed registry body assigned to a const, `Array.isArray()` guard emits an ungated `dx:error` (source `shell:manifest`) and returns `[]` on a wrong shape; array path returns the parsed value unchanged.
- `tests/shell.test.ts` - Four ROB-05 regression tests inserted after the existing D-15 registry test block, mirroring its fetch-mock + `dx:error`-capture style.

## Decisions Made
- The guard emit is unconditional (not wrapped in `registryUrlExplicit`) — D-10/P2, the one deliberate exception to the D-15 silent-default-probe convention, since a shape mismatch is never an expected/benign state.
- No change to `normalizeAndValidateManifests()` — it remains the single choke point for element-level manifest validation; ROB-05 only guards the top-level array shape, exactly as the plan's prohibitions required.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. RED tests failed exactly as predicted (`TypeError: list is not iterable` from `normalizeAndValidateManifests()`'s `for...of`), confirming the crash site before the fix; GREEN made all four pass with zero regressions across the full 68-spec `shell.test.ts` file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ROB-05 / WR-01 is fully closed; no remaining Phase-9 robustness carryover.
- `make typecheck` exits 0 and `npx biome check` is clean on both modified files.
- This was the final plan (4 of 4) in Phase 09 — the phase's GATE-01/02/03 + ROB-05 scope is now complete pending STATE/ROADMAP bookkeeping.

---
*Phase: 09-continuous-debt-guardrails-registry-robustness*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: src/shell.ts
- FOUND: tests/shell.test.ts
- FOUND: .planning/phases/09-continuous-debt-guardrails-registry-robustness/09-04-SUMMARY.md
- FOUND: 8ab1284 (test commit)
- FOUND: d6cec36 (fix commit)

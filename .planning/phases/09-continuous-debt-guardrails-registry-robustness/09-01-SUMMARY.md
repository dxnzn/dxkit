---
phase: 09-continuous-debt-guardrails-registry-robustness
plan: 01
subsystem: infra
tags: [ci, github-actions, tsc, typecheck, vitest]

requires:
  - phase: 07-typescript-6-migration-standalone-typecheck
    provides: "Standalone `make typecheck` target (tsc --noEmit -p tsconfig.typecheck.json) already green baseline, invoked as a `make test` prerequisite"
provides:
  - "Named, distinct CI step (`Typecheck / deprecation gate (GATE-01)`) running `make typecheck` in .github/workflows/ci.yml, between `make smoke` and `make test`"
  - "Durable guard test (`describe('GATE-01 CI deprecation gate wiring')`) locking the named-step wiring into tests/typecheck-config.test.ts"
affects: [ci, testing, dependency-freshness-automation-plan]

tech-stack:
  added: []
  patterns: ["Guard-test-locks-CI-wiring pattern: regex-match a workflow YAML file's step name+run lines from a vitest spec so silent CI drift fails the suite, not just a manual diff read"]

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - tests/typecheck-config.test.ts

key-decisions:
  - "Named the CI step 'Typecheck / deprecation gate (GATE-01)' so the ROADMAP requirement ID is traceable directly in GitHub Checks output"
  - "Left `make test`'s own `typecheck` prerequisite untouched (D-05) — the new CI step is an additional, independent invocation for visibility, not a replacement of the local-dev wiring"
  - "Did not touch tsconfig.typecheck.json include/exclude (D-06) — scope was already correct from Phase 7"

patterns-established:
  - "GATE-01 CI deprecation gate wiring guard block in tests/typecheck-config.test.ts — regex asserts a named step block (`- name: ...GATE-01...` \\n `run: make typecheck`) exists and that `make typecheck` / `make test` remain two distinct `run:` lines"

requirements-completed: [GATE-01]

coverage:
  - id: D1
    description: "CI runs `make typecheck` as its own named step (GATE-01), distinct from `make test`, so a tsc deprecation/type error in project-owned code turns a dedicated GitHub Check red"
    requirement: "GATE-01"
    verification:
      - kind: unit
        ref: "tests/typecheck-config.test.ts#GATE-01 CI deprecation gate wiring > should have a named step running `make typecheck` that references the GATE-01 gate"
        status: pass
      - kind: unit
        ref: "tests/typecheck-config.test.ts#GATE-01 CI deprecation gate wiring > should keep `make typecheck` and `make test` as two distinct run lines (D-05)"
        status: pass
      - kind: other
        ref: "make typecheck (manual run, exits 0 on clean tree)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-18
status: complete
---

# Phase 09 Plan 01: GATE-01 CI Deprecation Gate Summary

**Named `Typecheck / deprecation gate (GATE-01)` CI step running `make typecheck` standalone in ci.yml, locked in by a regex guard test in tests/typecheck-config.test.ts.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-18T06:02:00Z
- **Completed:** 2026-07-18T06:03:14Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `.github/workflows/ci.yml` now has a named, standalone `make typecheck` step (`Typecheck / deprecation gate (GATE-01)`) between `make smoke` and `make test`, so a `tsc` deprecation/type error in `src/`, `tests/`, or `plugins/*/src/` shows up as its own red GitHub Check instead of being buried inside the generic `make test` step.
- Added a durable guard test (`describe('GATE-01 CI deprecation gate wiring')`) that reads `.github/workflows/ci.yml` and fails the suite if the named step is removed, renamed away from the GATE-01/deprecation reference, or folded back into `make test`.
- `tsconfig.typecheck.json` scope (src/tests only, no node_modules) was left untouched (D-06) — the gate can never turn unfixable-red from transitive dependency noise.

## Task Commits

Each task was committed atomically:

1. **Task 1: Guard test for the named GATE-01 CI step (RED)** - `e136e40` (test)
2. **Task 2: Add named typecheck / deprecation gate step to CI (GREEN)** - `9ca85dd` (feat)

_Note: Task 2's commit also carries a one-line regex fix to the Task 1 guard test itself (see Deviations) — both changes shipped in the same GREEN commit since the fix was required to correctly observe the new CI step._

## Files Created/Modified
- `.github/workflows/ci.yml` - New named step `Typecheck / deprecation gate (GATE-01)` running `make typecheck`, inserted between `make smoke` and `make test`
- `tests/typecheck-config.test.ts` - New `describe('GATE-01 CI deprecation gate wiring')` block; two guard tests plus a regex fix (see below)

## Decisions Made
- Step name chosen as `Typecheck / deprecation gate (GATE-01)` to keep the requirement ID directly visible in the GitHub Checks UI without needing to open workflow logs.
- Kept `make test`'s existing `typecheck` prerequisite as-is (per D-05) — this plan adds CI-level visibility, it does not restructure the local `make test` dependency chain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a regex bug in the Task 1 guard test's distinct-run-lines assertion**
- **Found during:** Task 2 (verifying the guard test goes GREEN after the ci.yml edit)
- **Issue:** The `should keep make typecheck and make test as two distinct run lines` assertion used `/^\s*-\s*run:\s*make typecheck\s*$/gm`, which requires the YAML list-item dash (`-`) directly on the `run:` line. That shape only matches a *bare* step (`- run: make foo`). The new named step puts the `-` on the preceding `name:` line and `run:` on its own line with no dash — a valid, equally common GitHub Actions step shape the original regex couldn't match, so the test stayed red even after the correct ci.yml change landed.
- **Fix:** Changed the regex to `/^\s*(-\s*)?run:\s*make (typecheck|test)\s*$/gm`, making the leading dash optional so it matches both a bare step and a named step's `run:` continuation line.
- **Files modified:** tests/typecheck-config.test.ts
- **Verification:** `npx vitest run tests/typecheck-config.test.ts -t "GATE-01"` — both assertions pass; full file suite (58 specs) still green.
- **Committed in:** 9ca85dd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in the guard test itself, not the implementation)
**Impact on plan:** No scope creep — the fix only corrected the test's own regex to recognize a valid YAML shape it hadn't anticipated. The CI step itself matches the plan exactly (name, position, `run:` target).

## Issues Encountered
None beyond the guard-test regex fix documented above.

## Next Phase Readiness
- GATE-01 is fully wired and verified locally (`make typecheck` exits 0 on the clean tree; the guard test locks the CI wiring).
- Plan 09-02 (GATE-02/03, dependency-freshness automation) and 09-0x (ROB-05) can proceed independently — no shared files with this plan.
- The named CI step will only be exercised end-to-end (as an actual red/green GitHub Check) on the next push/PR to `main` — this plan verifies the wiring is correct and `make typecheck` itself is currently green, not a live CI run.

---
*Phase: 09-continuous-debt-guardrails-registry-robustness*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: .github/workflows/ci.yml
- FOUND: tests/typecheck-config.test.ts
- FOUND: .planning/phases/09-continuous-debt-guardrails-registry-robustness/09-01-SUMMARY.md
- FOUND commit: e136e40
- FOUND commit: 9ca85dd

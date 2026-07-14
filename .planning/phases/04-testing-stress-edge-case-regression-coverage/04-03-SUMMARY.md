---
phase: 04-testing-stress-edge-case-regression-coverage
plan: 03
subsystem: testing
tags: [vitest, settings-plugin, deep-merge, prototype-pollution, integration-test]

requires:
  - phase: 02-robustness-load-guards-caching-handler-cleanup
    provides: settings handler cleanup on disableDapp() (ROB-04) driven end-to-end here
provides:
  - Full-shell integration regression proving settings handlers are pruned on real shell.disableDapp()
  - Locked deepMerge documented semantics (nested arrays, nested pollution-guard keys)
  - JSDoc reconciled to code truth for deepMerge's null/undefined handling
affects: [phase-05-docs-truth-pass]

tech-stack:
  added: []
  patterns:
    - "Full-shell integration test contrasted with mocked-context plugin test — real createShell + real disableDapp(), not a simulated dx:dapp:disabled emit"

key-files:
  created:
    - plugins/settings/tests/integration.test.ts
  modified:
    - tests/utils.test.ts
    - src/utils.ts

key-decisions:
  - "TEST-03 regression lives in a new plugins/settings/tests/integration.test.ts file (cross-package integration), not appended to tests/shell.test.ts — keeps the real-wiring contrast with plugins/settings/tests/settings.test.ts's mocked-context suite explicit and co-located with the plugin it drives"
  - "deepMerge JSDoc reconciled toward code truth (null replaces, undefined is skipped) rather than changing runtime behavior — src/shell.ts's loadDappManifest -> deepMerge for manifest overrides depends on null-replaces, and an existing test already pinned it"
  - "Only two new deepMerge test cases added (nested array replace, nested constructor/prototype pollution guard) — all other D-09 semantics were already covered by pre-existing tests; no duplicate cases added"

requirements-completed: [TEST-02, TEST-03]

coverage:
  - id: D1
    description: "Settings handlers registered by a dapp stop firing after that dapp is disabled via the real shell.disableDapp() -> dx:dapp:disabled wiring (TEST-03/D-10)"
    requirement: "TEST-03"
    verification:
      - kind: integration
        ref: "plugins/settings/tests/integration.test.ts#prunes a disabled dapp's onChange handler through the real shell.disableDapp() call, without over-pruning an unrelated dapp's handler"
        status: pass
    human_judgment: false
  - id: D2
    description: "deepMerge documented semantics (recursive merge, wholesale array replace including nested, undefined-skip, null-replace, __proto__/constructor/prototype pollution guard including nested) locked by tests"
    requirement: "TEST-02"
    verification:
      - kind: unit
        ref: "tests/utils.test.ts#replaces nested arrays wholesale, not just top-level ones"
        status: pass
      - kind: unit
        ref: "tests/utils.test.ts#rejects constructor/prototype keys one level deep in nested merges"
        status: pass
      - kind: unit
        ref: "tests/utils.test.ts (full file, 17 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "deepMerge JSDoc null-handling claim reconciled to match actual code behavior (comment-only change)"
    verification:
      - kind: other
        ref: "git diff src/utils.ts — single-line comment change, no control-flow diff"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-13
status: complete
---

# Phase 4 Plan 3: Testing — Settings-Cleanup Integration Regression & deepMerge Semantics Lock Summary

**Full-shell `disableDapp()` → settings-handler-cleanup regression through real wiring, plus deepMerge's nested array/pollution-guard semantics locked and its JSDoc corrected to code truth.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-13T19:22:00Z (approx.)
- **Completed:** 2026-07-13T19:34:21Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- New `plugins/settings/tests/integration.test.ts` drives the REAL `createShell` → real `createSettings` plugin → real `shell.disableDapp('hello')` and asserts the disabled dapp's `onChange` handler does not fire after disable, while an unrelated still-enabled dapp's handler is untouched (no over-cleanup) — this is the integration-layer proof TEST-03/D-10 required beyond Phase 2's mocked-context plugin tests.
- `tests/utils.test.ts` gains the two genuinely missing D-09 assertions (nested-array wholesale replace; nested constructor/prototype pollution rejection one level deep) — all other documented `deepMerge` semantics were already covered, so no duplicate cases were added.
- `src/utils.ts`'s line-1 JSDoc corrected: it previously claimed "Null/undefined values are skipped," but the implementation (and an existing test) show `undefined` is skipped while `null` REPLACES. Comment-only fix — `git diff src/utils.ts` touches only the doc line, no control-flow change.

## Task Commits

Each task was committed atomically:

1. **Task 1: Full-shell settings-cleanup regression (plugins/settings/tests/integration.test.ts)** - `389603a` (test)
2. **Task 2: deepMerge documented-semantics assertions + JSDoc reconcile (tests/utils.test.ts, src/utils.ts)** - `f00e9fe` (test)

**Plan metadata:** (recorded in this commit)

## Files Created/Modified

- `plugins/settings/tests/integration.test.ts` - New: full-shell (real createShell + real createSettings + real disableDapp) settings-cleanup regression, contrasted with the existing mocked-context suite in `plugins/settings/tests/settings.test.ts`
- `tests/utils.test.ts` - Added 2 gap-fill deepMerge assertions (nested array replace, nested constructor/prototype pollution guard)
- `src/utils.ts` - JSDoc comment corrected (null replaces / undefined skips) — no runtime behavior change

## Decisions Made

- Placed the TEST-03 regression in a dedicated new file (`plugins/settings/tests/integration.test.ts`) rather than appending to `tests/shell.test.ts`, so the "real wiring vs. mocked context" contrast with the existing plugin-level suite is structurally explicit and lives alongside the plugin it exercises.
- Reconciled the deepMerge JSDoc toward code truth instead of changing the null-handling runtime behavior — `src/shell.ts`'s `loadDappManifest` → `deepMerge` path for manifest overrides depends on `null` replacing (not being skipped), and the pre-existing `replaces with null` test already pins that behavior. Changing runtime null-handling here would have been an undiscussed architectural/behavioral change outside this plan's scope (deferred per the plan's own instruction to surface, not fix, this divergence for a future docs/behavior decision).
- Added only the two deepMerge test cases that were genuinely missing (verified against the full existing `tests/utils.test.ts` before writing); did not duplicate the pre-existing flat/nested/array/undefined/null/proto/constructor/prototype/no-mutation coverage.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## CONTEXT/JSDoc-vs-Code Divergence Note (for Phase 5 docs pass)

`.planning/phases/04-testing-stress-edge-case-regression-coverage/04-CONTEXT.md` (D-09) states deepMerge's contract as "`null`/`undefined` values are skipped." The actual runtime behavior — locked by the pre-existing `replaces with null` test and now also documented correctly in the JSDoc — is that only `undefined` is skipped; `null` REPLACES the base value. This plan reconciled the JSDoc toward code truth (comment-only) without changing runtime behavior, since manifest overrides depend on the current null-replaces semantics. Phase 5's docs-truth pass should decide whether any user-facing documentation needs the same correction, and whether runtime null-skip is ever desired as a future (out-of-phase) change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST-03 (settings-cleanup integration regression) and the deepMerge portion of TEST-02 (D-09) are both locked and green.
- Full suite green: `make test` — 12 test files, 299 tests, lint clean.
- Ready for the remaining Phase 4 plans (04-02, if still pending) and eventual Phase 5 docs-truth pass, which should incorporate the JSDoc/CONTEXT divergence note above.

---
*Phase: 04-testing-stress-edge-case-regression-coverage*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: plugins/settings/tests/integration.test.ts
- FOUND: tests/utils.test.ts
- FOUND: src/utils.ts
- FOUND: commit 389603a (Task 1)
- FOUND: commit f00e9fe (Task 2)
- Re-ran `pnpm vitest run plugins/settings/tests/integration.test.ts tests/utils.test.ts` — 2 files, 18 tests, all pass
- Re-ran `make test` (lint + full suite) — 12 files, 299 tests, all pass, no lint fixes

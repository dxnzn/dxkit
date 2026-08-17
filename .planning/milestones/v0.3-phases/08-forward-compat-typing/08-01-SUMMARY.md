---
phase: 08-forward-compat-typing
plan: 01
subsystem: infra
tags: [typescript, tsconfig, forward-compat, ts6, ts7-readiness]

requires:
  - phase: 07-typescript-6-migration
    provides: TypeScript 6.0.3 baseline, standalone per-package `tsc --noEmit` typecheck, zero `ignoreDeprecations`
provides:
  - Root tsconfig.json with verbatimModuleSyntax, isolatedDeclarations, and erasableSyntaxOnly all enabled
  - Durable flag-presence regression guard in tests/typecheck-config.test.ts
affects: [08-02-forward-compat-typing, 09-continuous-debt-guardrails]

tech-stack:
  added: []
  patterns:
    - "Config-guard test pattern (readConfigFile + expect(...).toBe(true)) extended for boolean tsconfig flag presence, not just absence checks"

key-files:
  created: []
  modified:
    - tsconfig.json
    - tests/typecheck-config.test.ts

key-decisions:
  - "Landed verbatimModuleSyntax + erasableSyntaxOnly as one bisectable commit (Task 1) since research verified both zero-error and neither required at-source fixes"
  - "isolatedDeclarations landed as its own separate commit (Task 2) per D-06's core-before-plugins-in-effect sequencing, even though it also required zero source changes"
  - "No BREAKING CHANGE footer on the isolatedDeclarations commit — no public type shape changed (D-03 condition not met)"

patterns-established:
  - "Boolean tsconfig flag regression guard: assert compilerOptions.<flag> === true (exactly true, not just truthy/present) so a silent flip to false or deletion fails make test"

requirements-completed: [FCT-01, FCT-02, FCT-03]

coverage:
  - id: D1
    description: "verbatimModuleSyntax enabled in root tsconfig.json; build and tests stay green"
    requirement: "FCT-01"
    verification:
      - kind: unit
        ref: "tests/typecheck-config.test.ts#Forward-compat flag presence (FCT-01/FCT-02/FCT-03 guard) > should have verbatimModuleSyntax: true (FCT-01)"
        status: pass
      - kind: integration
        ref: "make typecheck && make build && make test"
        status: pass
    human_judgment: false
  - id: D2
    description: "isolatedDeclarations enabled; .d.ts emit succeeds for every package (core + 4 plugins)"
    requirement: "FCT-02"
    verification:
      - kind: unit
        ref: "tests/typecheck-config.test.ts#Forward-compat flag presence (FCT-01/FCT-02/FCT-03 guard) > should have isolatedDeclarations: true (FCT-02)"
        status: pass
      - kind: integration
        ref: "make build (test -f dist/index.d.ts + plugins/{settings,wallet,auth,theme}/dist/index.d.ts, all present)"
        status: pass
    human_judgment: false
  - id: D3
    description: "erasableSyntaxOnly enabled; no non-erasable TS syntax remains anywhere in the codebase"
    requirement: "FCT-03"
    verification:
      - kind: unit
        ref: "tests/typecheck-config.test.ts#Forward-compat flag presence (FCT-01/FCT-02/FCT-03 guard) > should have erasableSyntaxOnly: true (FCT-03)"
        status: pass
      - kind: integration
        ref: "make typecheck && make build"
        status: pass
    human_judgment: false
  - id: D4
    description: "Durable regression guard: manually flipping any one flag to false makes the corresponding assertion fail"
    verification:
      - kind: manual_procedural
        ref: "sed-toggled verbatimModuleSyntax to false, ran npx vitest run tests/typecheck-config.test.ts, confirmed FAIL, reverted (mutation not committed)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-17
status: complete
---

# Phase 8 Plan 1: Forward-Compat Flags (verbatimModuleSyntax, isolatedDeclarations, erasableSyntaxOnly) Summary

**All three TS7-forward-compat compiler flags landed in the root tsconfig.json as a pure config flip — zero source-code churn across core + all 4 plugins — plus a durable flag-presence regression guard.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-17T23:59:35Z (session start per STATE.md)
- **Completed:** 2026-07-17T19:02:55-05:00 (last task commit)
- **Tasks:** 3
- **Files modified:** 2 (`tsconfig.json`, `tests/typecheck-config.test.ts`)

## Accomplishments

- `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true` enabled in the single root `tsconfig.json` (D-01) — plugins inherit both via `extends`, no per-plugin edit needed
- `isolatedDeclarations: true` enabled in the same config; `.d.ts` emission verified for all 5 packages (core + settings, wallet, auth, theme) via each package's `tsc --emitDeclarationOnly` `onSuccess` pass
- Zero source-code changes anywhere in `src/` or `plugins/*/src/` — this session's research prediction (empirically zero-error against the real codebase) held exactly: `make typecheck`, `make build`, and `make test` all stayed green with no annotations, no import/export elision fixes, and no non-erasable syntax to remove
- Added a durable flag-presence regression guard (`tests/typecheck-config.test.ts`) asserting all three flags are exactly `true` in the root config, so a future silent flag removal fails `make test` instead of only being caught by a one-time green build

## Task Commits

Each task was committed atomically:

1. **Task 1: Enable verbatimModuleSyntax + erasableSyntaxOnly in root tsconfig.json (FCT-01, FCT-03)** - `acc4ca3` (feat)
2. **Task 2: Enable isolatedDeclarations in root tsconfig.json (FCT-02)** - `345e2cb` (feat)
3. **Task 3: Add flag-presence regression guard to tests/typecheck-config.test.ts** - `bd9e11a` (test)

**Plan metadata:** commit pending (docs: complete plan — see final commit below)

_Note: no TDD RED/GREEN split — these are config-flag tasks per the plan's `type="auto"` designation, not `tdd="true"`._

## Files Created/Modified

- `tsconfig.json` - Added `verbatimModuleSyntax`, `erasableSyntaxOnly`, `isolatedDeclarations` compilerOptions keys (three separate `true` values, landed across two commits per D-06)
- `tests/typecheck-config.test.ts` - New describe block `Forward-compat flag presence (FCT-01/FCT-02/FCT-03 guard)` with three assertions against the root config's `compilerOptions`

## Decisions Made

- Landed `verbatimModuleSyntax` + `erasableSyntaxOnly` together as one bisectable commit (Task 1) since both were research-verified zero-error and neither needed at-source fixes — matches the plan's D-06 "these two near/actual-no-op flags land together" instruction.
- Landed `isolatedDeclarations` as its own separate commit (Task 2), per D-06's core-before-plugins-in-effect sequencing (the base config's effect on core's `.d.ts` emit is the more consequential change, even though the end diff is a config line either way).
- No `BREAKING CHANGE:` footer on the `isolatedDeclarations` commit — verified no public consumer-visible type shape changed (D-03's condition for requiring the footer was not met).
- Did not manufacture any source annotations (D-02 explicit prohibition) — the compiler surfaced zero `isolatedDeclarations` errors, confirming the research session's degenerate-but-valid zero-annotation outcome.

## Deviations from Plan

None - plan executed exactly as written. All three flags surfaced zero compiler errors, exactly matching the research session's empirical verification; no shims, no manufactured annotations, no plugin tsconfig edits.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FCT-01, FCT-02, and FCT-03 are fully validated: flags on, build/typecheck/test green, durable regression guard in place.
- Plan 08-02 (FCT-04) is next: the IIFE global-attach and CJS `require()` interop smoke test on the built `dist/` artifacts — the actual remaining risk surface flagged in STATE.md Blockers/Concerns, since neither `tsc` nor the existing vitest suite exercises the IIFE/CJS build boundary.
- No blockers for Plan 08-02; this plan's build artifacts (with all three flags now baked in) are the exact artifacts Plan 08-02's smoke test will exercise.

---
*Phase: 08-forward-compat-typing*
*Completed: 2026-07-17*

## Self-Check: PASSED

All created/modified files verified present on disk; all three task commit hashes (acc4ca3, 345e2cb, bd9e11a) verified present in git log.

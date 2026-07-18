---
phase: 09-continuous-debt-guardrails-registry-robustness
plan: 02
subsystem: infra
tags: [makefile, ci, github-actions, vitest, supply-chain, zero-deps]

requires:
  - phase: 09-continuous-debt-guardrails-registry-robustness (09-01)
    provides: "ci.yml GATE-01 typecheck step this plan's GATE-02 step is inserted after"
provides:
  - "scripts/check-no-runtime-deps.cjs — pure checkNoRuntimeDeps(pkg) + CLI entry, zero npm deps"
  - "make verify-no-runtime-deps — root-package.json-only Makefile target"
  - "Named CI step 'Zero-runtime-dependency assertion (GATE-02)'"
  - "verify-no-runtime-deps as a release/publish prerequisite"
  - "GATE-02 wiring guard test locking the Makefile/CI shape"
  - "Core-only wording correction in REQUIREMENTS.md and ROADMAP.md"
affects: [ci-pipeline, release-process, requirements-tracking]

tech-stack:
  added: []
  patterns:
    - "Node built-in (fs) JSON field-check script with CLI entry, no npm dependency (P4)"
    - "createRequire(import.meta.url) CJS-interop import in a vitest test to avoid tsc needing to resolve a .cjs module statically (mirrors smoke/dist-exports.smoke.test.ts)"
    - "Region-scoped Makefile target-body regex assertion (guard against silent PLUGIN_BUILD_ORDER creep) mirroring tests/typecheck-config.test.ts's typecheck-target guard"

key-files:
  created:
    - scripts/check-no-runtime-deps.cjs
    - tests/check-no-runtime-deps.test.ts
  modified:
    - Makefile
    - .github/workflows/ci.yml
    - tests/node-builtins.d.ts
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "checkNoRuntimeDeps() is deliberately core-only and unconditional — any entry in dependencies/peerDependencies/optionalDependencies is a violation, no workspace-carveout logic, because the root package.json never declares workspace:* links (revised D-08)."
  - "CJS module loaded via createRequire(import.meta.url) rather than a static import, so tsc never has to resolve/type a .cjs file — reused the exact pattern already established by smoke/dist-exports.smoke.test.ts, requiring only one small tests/node-builtins.d.ts addition (node:module ambient declaration) instead of a new declaration file."
  - "verify-no-runtime-deps added as a release/publish prerequisite alongside verify-outputs, not folded into typecheck or test, keeping GATE-01 (deprecation) and GATE-02 (dep posture) as independently failing, independently named gates."

patterns-established:
  - "Zero-dependency guard scripts live in scripts/*.cjs with a pure exported function + CLI entry guarded by `require.main === module`, testable directly from vitest via createRequire."

requirements-completed: [GATE-02]

coverage:
  - id: D1
    description: "checkNoRuntimeDeps(pkg) correctly flags any entry in dependencies/peerDependencies/optionalDependencies and passes on empty/absent fields, including the real root package.json"
    requirement: "GATE-02"
    verification:
      - kind: unit
        ref: "tests/check-no-runtime-deps.test.ts#checkNoRuntimeDeps (GATE-02 core-only dep-check)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CLI entry (node scripts/check-no-runtime-deps.cjs <path>) exits 0/prints OK on a clean package.json and exits 1/prints FAIL on a fixture declaring an external dep"
    requirement: "GATE-02"
    verification:
      - kind: manual_procedural
        ref: "node scripts/check-no-runtime-deps.cjs package.json (exit 0); node scripts/check-no-runtime-deps.cjs <tmp fixture with dependencies.lodash> (exit 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "make verify-no-runtime-deps target exists, is root-package.json-only (no PLUGIN_BUILD_ORDER loop), is in .PHONY, and is a prerequisite of release/publish"
    requirement: "GATE-02"
    verification:
      - kind: unit
        ref: "tests/check-no-runtime-deps.test.ts#GATE-02 wiring"
        status: pass
      - kind: manual_procedural
        ref: "make verify-no-runtime-deps (exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ci.yml has a named 'Zero-runtime-dependency assertion (GATE-02)' step running make verify-no-runtime-deps, placed after the GATE-01 typecheck step and before make test"
    requirement: "GATE-02"
    verification:
      - kind: unit
        ref: "tests/check-no-runtime-deps.test.ts#GATE-02 wiring > should have a named CI step running \`make verify-no-runtime-deps\` that references GATE-02"
        status: pass
    human_judgment: false
  - id: D5
    description: "REQUIREMENTS.md GATE-02 line and ROADMAP.md Phase 9 success criterion #2 reference the core @dnzn/dxkit package explicitly and no longer say 'any package' / 'into any package'"
    requirement: "GATE-02"
    verification:
      - kind: other
        ref: "grep -q core .planning/REQUIREMENTS.md; grep -c 'into any package' .planning/ROADMAP.md == 0"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-18
status: complete
---

# Phase 09 Plan 02: Core-Only Zero-Runtime-Dependency Gate (GATE-02) Summary

**Machine-enforced core-only zero-runtime-dep gate: a Node-built-in-only field-check script wired into `make verify-no-runtime-deps`, a named CI step, and release/publish prerequisites — scoped to the root `@dnzn/dxkit` package.json only, never the plugins.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-18T06:12:00Z (approx)
- **Completed:** 2026-07-18T06:19:41Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `scripts/check-no-runtime-deps.cjs` exports a pure `checkNoRuntimeDeps(pkg)` function and a CLI entry, using only `node:fs` — zero new npm dependencies (P4).
- `make verify-no-runtime-deps` runs the check against the root `package.json` only (no `PLUGIN_BUILD_ORDER` loop), wired into `.PHONY` and as a `release`/`publish` prerequisite alongside `verify-outputs`.
- CI runs a named `Zero-runtime-dependency assertion (GATE-02)` step after the GATE-01 typecheck step and before `make test`.
- `tests/check-no-runtime-deps.test.ts` covers both the pure function's fixture behavior (RED→GREEN TDD) and a `GATE-02 wiring` guard block that locks the Makefile target shape and CI step against silent drift.
- `REQUIREMENTS.md` and `ROADMAP.md` corrected to state GATE-02's scope is the core `@dnzn/dxkit` package, not "any package".

## Task Commits

Each task was committed atomically:

1. **Task 1: Core-only dep-check script + fixture unit test (RED→GREEN)**
   - `e4192b1` — `test(09-02): add failing test for core-only dep-check (GATE-02)` (RED)
   - `adc5be6` — `feat(09-02): implement core-only zero-runtime-dep check (GATE-02)` (GREEN; also extends `tests/node-builtins.d.ts`)
2. **Task 2: Wire `verify-no-runtime-deps` into Makefile + CI + release/publish (+ wiring guard)** - `979b706` (feat)
3. **Task 3: Correct GATE-02 wording to core-only (REQUIREMENTS.md + ROADMAP.md)** - `40cebd4` (docs)

**Plan metadata:** _pending_ (docs: complete plan — this commit)

_Note: TDD task 1 produced two commits (test → feat), no refactor step needed._

## Files Created/Modified
- `scripts/check-no-runtime-deps.cjs` — `checkNoRuntimeDeps(pkg)` + CLI entry (CommonJS, `node:fs` only)
- `tests/check-no-runtime-deps.test.ts` — fixture unit tests (6 cases) + `GATE-02 wiring` guard block (5 cases)
- `tests/node-builtins.d.ts` — added a `node:module` ambient declaration (`createRequire`) so the new test's CJS-interop import resolves under `tsc --noEmit`
- `Makefile` — `verify-no-runtime-deps` target, `.PHONY` entry, `release`/`publish` prerequisite
- `.github/workflows/ci.yml` — named `Zero-runtime-dependency assertion (GATE-02)` step
- `.planning/REQUIREMENTS.md` — GATE-02 line now names the core `@dnzn/dxkit` package
- `.planning/ROADMAP.md` — Phase 9 success criterion #2 now names the core package and the field-check mechanism, dropping the stale `pnpm why`-style phrasing

## Decisions Made
- Kept `checkNoRuntimeDeps()` unconditional/simple per revised D-08: any entry in `dependencies`/`peerDependencies`/`optionalDependencies` is a violation, no workspace-carveout logic, since the root package.json never declares `workspace:*` links.
- Reused the `createRequire(import.meta.url)` CJS-interop pattern already established by `smoke/dist-exports.smoke.test.ts` rather than inventing a new way to import a `.cjs` file from a `.ts` test — this kept the new ambient-declaration addition to a single 4-line `node:module` block in the existing `tests/node-builtins.d.ts`, instead of a new declaration file or a `@types/node` devDependency.
- Placed `verify-no-runtime-deps` as its own named CI step and release/publish prerequisite (not folded into `typecheck` or `test`), so GATE-01 (deprecation) and GATE-02 (dep posture) fail independently and visibly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a `node:module` ambient declaration to `tests/node-builtins.d.ts`**
- **Found during:** Task 1 (writing `tests/check-no-runtime-deps.test.ts`)
- **Issue:** The plan's `<read_first>` pointed at `tests/typecheck-config.test.ts` for style but the new test needed to import a CommonJS `.cjs` module (`scripts/check-no-runtime-deps.cjs`). A static `import` of a `.cjs` file fails standalone `tsc --noEmit -p tsconfig.typecheck.json` (no `allowJs`, `tests/` is in `include`). `createRequire(import.meta.url)` — the pattern `smoke/dist-exports.smoke.test.ts` already uses for the same reason — needs `node:module` typed, which `tests/node-builtins.d.ts` didn't yet declare (only `node:fs`/`node:path`/`process`).
- **Fix:** Added the same 4-line `node:module` ambient declaration `smoke/node-builtins.d.ts` already carries (`createRequire(path: string): (id: string) => any`) to `tests/node-builtins.d.ts`, and used `createRequire` + `require('../scripts/check-no-runtime-deps.cjs')` in the test instead of a static import.
- **Files modified:** `tests/node-builtins.d.ts`, `tests/check-no-runtime-deps.test.ts`
- **Verification:** `npx tsc --noEmit -p tsconfig.typecheck.json` exits 0; `make test` (404 specs) green.
- **Committed in:** `adc5be6` (part of Task 1's GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the plan's own new test green under the project's standalone typecheck gate (GATE-01); reused an existing pattern verbatim, zero new dependencies, zero scope creep beyond the one ambient-declaration line.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GATE-02 lands alongside GATE-01 (Phase 09-01) and GATE-03 (Phase 09-03) as independently-named, independently-failing CI gates; `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` are now internally consistent on GATE-02's core-only scope.
- No blockers for Phase 9 completion — this was the last incomplete plan (09-02) in the phase; 09-01, 09-03, 09-04 already had SUMMARYs on disk before this run.

## Self-Check: PASSED

- FOUND: scripts/check-no-runtime-deps.cjs
- FOUND: tests/check-no-runtime-deps.test.ts
- FOUND: e4192b1 (test RED commit)
- FOUND: adc5be6 (feat GREEN commit)
- FOUND: 979b706 (Makefile/CI wiring commit)
- FOUND: 40cebd4 (docs commit)

## TDD Gate Compliance

- RED commit present: `e4192b1` (`test(09-02): add failing test for core-only dep-check (GATE-02)`)
- GREEN commit present, after RED: `adc5be6` (`feat(09-02): implement core-only zero-runtime-dep check (GATE-02)`)
- No REFACTOR commit needed — GREEN implementation required no cleanup pass.

---
*Phase: 09-continuous-debt-guardrails-registry-robustness*
*Completed: 2026-07-18*

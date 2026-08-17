---
phase: 08-forward-compat-typing
plan: 02
subsystem: testing
tags: [vitest, tsup, happy-dom, node-vm, iife, cjs, build-artifacts, smoke-test]

requires:
  - phase: 08-01-forward-compat-typing
    provides: Root tsconfig.json with verbatimModuleSyntax, isolatedDeclarations, erasableSyntaxOnly all enabled — the exact dist/ artifacts this plan's smoke test exercises
provides:
  - "make smoke: a self-building (build prerequisite) vitest pass against the real built dist/ artifacts, asserting exhaustive IIFE global-attach (via node:vm) and CJS require() export-key sets for all 5 packages"
  - "A maintained EXPECTED_EXPORTS fixture (smoke/fixtures/expected-exports.ts) that goes red on any dropped/renamed/added public export key"
  - "smoke/ wired into release/publish Makefile chains (after verify-outputs) and CI (after make verify-outputs), never folded into make test"
affects: [09-continuous-debt-guardrails]

tech-stack:
  added: []
  patterns:
    - "vm.runInContext(code, happyDomWindow) to execute a built IIFE bundle's raw source directly at the VM context's top level — the only mechanism verified to correctly attach top-level `var <Global> = ...` globals for this project's tsup-produced bundle shape (happy-dom's own <script>-element path silently drops them)"
    - "createRequire(import.meta.url) for genuine Node require() semantics against dist/*.cjs from an ESM test file"
    - "Separate vitest config (vitest.smoke.config.ts) + its own top-level test directory (smoke/) to keep a build-dependent test suite structurally excluded from make test's 'never builds' glob"

key-files:
  created:
    - vitest.smoke.config.ts
    - smoke/dist-exports.smoke.test.ts
    - smoke/fixtures/expected-exports.ts
    - smoke/node-builtins.d.ts
  modified:
    - Makefile
    - biome.json
    - .github/workflows/ci.yml

key-decisions:
  - "Landed the smoke test infrastructure (Task 1) and the Makefile/biome/CI wiring (Task 2) as two separate bisectable commits, matching D-06's per-concern commit discipline used in 08-01"
  - "Used process.cwd()-relative path resolution for all dist/ reads (mirroring tests/typecheck-config.test.ts's existing readConfigFile convention) rather than __dirname/import.meta.url-derived paths, satisfying T-08-02's 'never an env var or CLI arg' constraint while staying consistent with the codebase's one existing config-guard test"
  - "No cast needed for vm.runInContext's second argument: the ambient node:vm.Context interface is declared as an empty interface, so a happy-dom Window (or any object) is structurally assignable without an `as unknown as` cast"
  - "smoke/node-builtins.d.ts is co-located with the smoke test (not merged into tests/node-builtins.d.ts) to keep smoke/ a fully self-contained top-level directory per Pitfall 2's isolation goal"

patterns-established:
  - "Build-artifact smoke test pattern: separate vitest.*.config.ts + its own top-level directory, wired into a self-building Makefile target placed in release/publish/CI (never make test) — reusable for any future dist/-boundary assertion"

requirements-completed: [FCT-04]

coverage:
  - id: D1
    description: "make smoke builds first then runs vitest.smoke.config.ts against real dist/ artifacts, asserting all 5 IIFE globals (DxKit, DxWallet, DxAuth, DxTheme, DxSettings) attach via vm.runInContext with their exact expected export-key sets, including all 5 loaded sequentially into one shared window with no collisions"
    requirement: "FCT-04"
    verification:
      - kind: unit
        ref: "smoke/dist-exports.smoke.test.ts#IIFE global-attach (vm.runInContext, never happy-dom's <script>-element path — Pitfall 1) — 5 per-package tests + 1 shared-window coexistence test"
        status: pass
      - kind: integration
        ref: "make smoke"
        status: pass
    human_judgment: false
  - id: D2
    description: "CJS require() (via createRequire(import.meta.url)) of each package's dist/index.cjs returns the same exhaustive expected export-key set as the IIFE assertion"
    requirement: "FCT-04"
    verification:
      - kind: unit
        ref: "smoke/dist-exports.smoke.test.ts#CJS require() interop — 5 per-package tests"
        status: pass
      - kind: integration
        ref: "make smoke"
        status: pass
    human_judgment: false
  - id: D3
    description: "make smoke wired into release/publish Makefile chains after verify-outputs, and into CI after make verify-outputs; smoke/ added to biome.json's files.includes; make test and vitest.config.ts remain unchanged (no build prerequisite, no smoke reference)"
    requirement: "FCT-04"
    verification:
      - kind: unit
        ref: "grep -E '^\\.PHONY:.*\\bsmoke\\b' Makefile"
        status: pass
      - kind: integration
        ref: "make smoke && make lint && make test (368 vitest specs total across the two configs, all green)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-17
status: complete
---

# Phase 8 Plan 2: FCT-04 Build-Artifact Smoke Test Summary

**A self-building `make smoke` target asserts exhaustive IIFE global-attach (via node:vm, not happy-dom's broken `<script>`-element path) and CJS `require()` export-key sets against the real built `dist/` artifacts for all 5 packages, wired into release/publish/CI after `verify-outputs`.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-17T19:03:00-05:00 (approx, immediately following 08-01's completion)
- **Completed:** 2026-07-17T19:08:53-05:00 (last task commit)
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- Built the entire `smoke/` test infrastructure from scratch: `vitest.smoke.config.ts` (separate config, happy-dom environment, no `resolve.alias`), `smoke/dist-exports.smoke.test.ts` (the FCT-04 assertions), `smoke/fixtures/expected-exports.ts` (the maintained D-05 fixture), and `smoke/node-builtins.d.ts` (zero-`@types/node` ambient decls for `node:vm`/`node:module`/`node:fs`/`node:path`)
- Verified the research session's `vm.runInContext(code, happyDomWindow)` pattern works exactly as documented against this milestone's real (post-08-01) build output: all 5 IIFE globals attach with their exact expected key sets, including all 5 loaded sequentially into one shared window in dependency order (core, then settings/wallet/auth/theme) with zero collisions
- Verified CJS `require()` interop (via `createRequire(import.meta.url)`) returns the identical export-key sets for all 5 packages — confirmed the fixture's key lists against a fresh `make build` output before writing any assertions
- Wired `make smoke` into `.PHONY`, the `release`/`publish` prerequisite chains (immediately after `verify-outputs`), and `.github/workflows/ci.yml` (immediately after `make verify-outputs`) — never folded into `make test`
- Added `smoke/**/*.ts` to `biome.json`'s `files.includes` allowlist so the new code is actually linted, not silently skipped
- Confirmed `make smoke && make lint && make test` all pass green — 368 total vitest specs across the two separate configs (357 existing + 11 new smoke specs), `make test` unchanged (still `lint typecheck` prerequisites only, no build step)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the smoke/ test infrastructure — vitest config, fixture, ambient decls, and the smoke test spec (FCT-04)** - `9686c70` (feat)
2. **Task 2: Wire the `make smoke` target, .PHONY, release/publish chains, biome includes, and CI step (FCT-04)** - `b524603` (feat)

**Plan metadata:** commit pending (docs: complete plan — see final commit below)

_Note: no TDD RED/GREEN split — these are `type="auto"` infrastructure/wiring tasks, not `tdd="true"`._

## Files Created/Modified

- `vitest.smoke.config.ts` - New, separate vitest config targeting `smoke/**/*.smoke.test.ts` with `environment: 'happy-dom'` and no `resolve.alias` (targets `dist/`, not `src/`)
- `smoke/dist-exports.smoke.test.ts` - The FCT-04 smoke test: per-package CJS `require()` assertions and per-package + shared-window IIFE `vm.runInContext` assertions, all against the sorted `EXPECTED_EXPORTS` fixture
- `smoke/fixtures/expected-exports.ts` - The maintained `EXPECTED_EXPORTS` fixture (5 packages, exhaustive key sets, `createEthereumWallet`'s `@deprecated` export intentionally included)
- `smoke/node-builtins.d.ts` - Ambient decls for `node:vm`, `node:module`, `node:fs`, `node:path` — zero-`@types/node` posture, co-located with the smoke test
- `Makefile` - New `smoke: build` target; `.PHONY` gains `smoke`; `release`/`publish` chains gain `smoke` after `verify-outputs`
- `biome.json` - `files.includes` gains `"smoke/**/*.ts"`
- `.github/workflows/ci.yml` - New `- run: make smoke` step after `- run: make verify-outputs`

## Decisions Made

- Split into two bisectable commits (test infrastructure, then wiring) per D-06's per-concern commit discipline, matching 08-01's precedent.
- Resolved all `dist/` paths via `resolve(process.cwd(), relativePath)`, mirroring `tests/typecheck-config.test.ts`'s existing `readConfigFile` convention, rather than introducing a new `import.meta.url`/`__dirname`-based resolution style — satisfies the threat model's "never an env var or CLI arg" constraint (T-08-02) with a pattern already proven in this codebase.
- Passed the happy-dom `Window` directly to `vm.runInContext` with no cast: the ambient `node:vm` `Context` interface is declared empty (`interface Context {}`), so any object is structurally assignable without `as unknown as vm.Context`.
- Kept `smoke/node-builtins.d.ts` separate from `tests/node-builtins.d.ts` (co-located with the smoke test instead) so `smoke/` remains a fully self-contained top-level directory, per the research's Pitfall 2 isolation goal.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched the plan's action items precisely; the only "new" work was running Biome's auto-fixer (`--write`) on the newly-created smoke files to match project formatting conventions (import order, quote style for a string containing an apostrophe, array line-wrapping) before the first commit — routine style compliance, not a functional deviation, and folded into Task 1's commit since the files hadn't been committed yet.

## Issues Encountered

None. The `vm.runInContext` + `createRequire` patterns worked exactly as verified in the research session on the first attempt, against this plan's actual (post-08-01, post-forward-compat-flags) build output.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FCT-04 is fully validated: `make smoke` green, exhaustive export-key assertions in place for all 5 packages (IIFE + CJS), wired into release/publish/CI as a required gate.
- Phase 8 (Forward-Compat Typing) is now complete: FCT-01, FCT-02, FCT-03 (08-01) and FCT-04 (08-02) all validated. The IIFE/CJS build boundary risk flagged in STATE.md Blockers/Concerns is closed.
- Phase 9 (Continuous Debt Guardrails & Registry Robustness) can proceed — no blockers. The `smoke/` directory and `make smoke` target are stable additions Phase 9's CI deprecation gate work will not need to touch.

---
*Phase: 08-forward-compat-typing*
*Completed: 2026-07-17*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commit hashes (9686c70, b524603) verified present in git log.

---
phase: 07-typescript-6-migration-standalone-typecheck
verified: 2026-07-17T15:50:34Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 7: TypeScript 6 Migration & Standalone Typecheck Verification Report

**Phase Goal:** Core + all four plugins compile clean under TypeScript 6, with a dedicated
per-package `tsc --noEmit` step in place — the typecheck baseline that every later deprecation
gate attaches to.
**Verified:** 2026-07-17T15:50:34Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Roadmap Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | A standalone `tsc --noEmit` typecheck runs per package, independent of tsup's `dts:true` emit, wired into `make test` and CI, existing and passing BEFORE the TS6 bump lands | ✓ VERIFIED | `Makefile` has a standalone `typecheck` target (root + `PLUGIN_BUILD_ORDER` loop, `tsc --noEmit -p tsconfig.typecheck.json`); `test`/`test-watch` prereqs are `lint typecheck`; `.github/workflows/ci.yml` calls `make test` (and `make build`/`make verify-outputs`), so CI inherits typecheck with no workflow edit. Independently ran `make typecheck` — exits 0, all 5 packages checked. Negative check: introduced a bogus type error in `src/utils.ts`, ran `make typecheck`, confirmed non-zero exit (`TS2322`, `make: *** [Makefile:101: typecheck] Error 2`), reverted cleanly (`git status` clean afterward) — proves the gate is not a no-op. Pre-bump ordering (07-01→07-02→07-03 baseline commits landed before the 07-04 bump commit) confirmed via `git log --oneline`. |
| 2 | Core and all 4 plugins compile under TypeScript 6.0.x with zero type errors | ✓ VERIFIED | `npx tsc --version` → `Version 6.0.3`; `package.json` devDependencies `typescript: "^6.0.0"`; `pnpm-lock.yaml` resolves `typescript@6.0.3`. Ran `make typecheck` directly (not trusting SUMMARY) — exits 0 across root + settings + wallet + auth + theme. |
| 3 | No `ignoreDeprecations` shim remains in any tsconfig.json | ✓ VERIFIED | `grep -rn "ignoreDeprecations"` across all 10 tsconfig*.json files (root + 4 plugin build configs + 5 typecheck configs) returns zero matches. Also confirmed zero `baseUrl` anywhere in any tsconfig (the thing that would have forced the shim). |
| 4 | The full vitest suite stays green after the TS6 bump | ✓ VERIFIED | Ran `make test` (lint → typecheck → vitest) from a clean working tree — biome check clean, typecheck exits 0 across 5 packages, vitest: 12 test files / 321 tests, all passing. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `tsconfig.typecheck.json` (root) | `noEmit:true`, `rootDir:"."`, `paths` (5 keys), no `baseUrl`, `include:["src","tests"]` | ✓ VERIFIED | Read file directly — matches exactly. `tsconfig.json` (build config) untouched, no `declaration`/`outDir` conflict. |
| `plugins/{auth,wallet,theme,settings}/tsconfig.typecheck.json` | Same shape, `rootDir:"../.."` | ✓ VERIFIED | All 4 exist; `make typecheck` exercises each one directly (`cd plugins/$d && npx tsc --noEmit -p tsconfig.typecheck.json`) and all pass. |
| `Makefile` `typecheck` target | Standalone target, reuses `PLUGIN_BUILD_ORDER`, no emit flag | ✓ VERIFIED | Read Makefile directly — target loops root then `$(PLUGIN_BUILD_ORDER)` (`plugins/settings/ plugins/wallet/ plugins/auth/ plugins/theme/`), `.PHONY` includes `typecheck`, `test`/`test-watch` prereqs are `lint typecheck`. |
| `package.json` `typescript` devDep | `^6.0.0` | ✓ VERIFIED | Read directly — `"typescript": "^6.0.0"`; lockfile resolves `6.0.3`. |
| `tsup.config.ts` (root + 4 plugins) | dts emission decoupled from `dts:true` (documented deviation) | ✓ VERIFIED | All 5 configs have `dts:true` removed and `onSuccess: 'npx tsc -p tsconfig.json --emitDeclarationOnly'` added, with an explanatory comment referencing the TS5101/tsup rollup-plugin-dts root cause. `dts:true`/`dts: true` no longer appears as active config anywhere (only in comments). |

### Deviation Verification (documented in phase context)

The phase declared a deviation: tsup 8.5.1's bundled `dts:true` injects a `baseUrl` that TS6
deprecates (TS5101), so dts emission was switched to a direct `tsc --emitDeclarationOnly` via
`onSuccess` in every `tsup.config.ts`. Independently verified, not trusted from SUMMARY:

- `make clean && make build` — succeeded across root + all 4 plugins with no errors, under TS 6.0.3.
- `make verify-outputs` — all 3 formats (`index.js`, `index.cjs`, `index.global.js`) present for all 5 packages.
- `.d.ts` declarations independently confirmed present: `dist/index.d.ts` + 6 per-module `.d.ts` files at root (`events`, `lifecycle`, `registry`, `router`, `shell`, `utils`), and `dist/index.d.ts` present in each of the 4 plugin `dist/` directories.
- Zero-runtime-dep / IIFE-standalone posture preserved: ESM/CJS tsup entries mark `@dnzn/dxkit` `external`, IIFE entries mark it `noExternal` (verified by reading each plugin's `tsup.config.ts` directly) — unchanged from the pre-phase pattern; only the dts-emission mechanism changed.
- `make test` after the full clean rebuild — 321/321 vitest tests green.

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `make test` / `make test-watch` | `make typecheck` | Makefile prerequisite (`lint typecheck`) | ✓ WIRED | Confirmed by reading Makefile and by running `make test`, which visibly runs typecheck before vitest. |
| `.github/workflows/ci.yml` | `make typecheck` | transitively via `make test` | ✓ WIRED | CI steps are `pnpm install --frozen-lockfile` → `make build` → `make verify-outputs` → `make test`; no direct `make typecheck` call needed since `make test` already depends on it. |
| `typecheck` target | `PLUGIN_BUILD_ORDER` | Makefile variable reuse | ✓ WIRED | `typecheck` target's plugin loop uses `$(PLUGIN_BUILD_ORDER)` verbatim (same variable as `build`/`verify-outputs`) — no second hardcoded package list, so it cannot silently drift. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| `make typecheck` catches a real type error (not a no-op) | Introduced `const _negCheck: number = 'not a number';` in `src/utils.ts`, ran `make typecheck`, reverted | Non-zero exit, `TS2322` surfaced, `git status` clean after revert | ✓ PASS |
| `make typecheck` exits 0 on the current (unmodified) tree | `make typecheck` | Exit 0, all 5 packages checked | ✓ PASS |
| `make build` produces all outputs under TS6 | `make clean && make build` | ESM/CJS/IIFE built for root + 4 plugins, no errors | ✓ PASS |
| `make verify-outputs` confirms all 15 build artifacts | `make verify-outputs` | "All build outputs present (3 formats x 5 packages)" | ✓ PASS |
| Full vitest suite green | `make test` | 12 files / 321 tests passing | ✓ PASS |
| No `ignoreDeprecations` shim anywhere | `grep -rn ignoreDeprecations` across all 10 tsconfig*.json | Zero matches | ✓ PASS |
| No `baseUrl` in any tsconfig | `grep -rn baseUrl` across all 10 tsconfig*.json | Zero matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TS6-01 | 07-01, 07-02, 07-04 | Core and all four plugins compile under TypeScript 6.0.x with zero type errors | ✓ SATISFIED | `make typecheck` exits 0 under `typescript@6.0.3` across root + 4 plugins (independently re-run, not just SUMMARY-trusted). |
| TS6-02 | 07-04 | Every deprecation TS6 surfaces is resolved at source — no `ignoreDeprecations` shim | ✓ SATISFIED | `grep -rn ignoreDeprecations` across all tsconfigs returns nothing; the one real TS6 break (tsup's dts bundler TS5101) was fixed at source by replacing `dts:true` with a direct `tsc --emitDeclarationOnly` pass, not suppressed. |
| TS6-03 | 07-01, 07-02, 07-03 | A standalone `tsc --noEmit` typecheck runs per package, independent of tsup's `dts:true` emit | ✓ SATISFIED | 5 `tsconfig.typecheck.json` files exist (root + 4 plugins); `make typecheck` target invokes each independently of the `build` target; wired into `make test`/CI. |

No orphaned requirements — REQUIREMENTS.md traceability table maps only TS6-01/02/03 to Phase 7, and all three appear in the plans' `requirements` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/utils.ts` | 2, 13-22 | `DeepPartial<T>`/`deepMerge` have two latent correctness gaps (function-valued fields become non-callable; `Date`/`Map`/`Set`/`RegExp`/class instances get silently corrupted on merge) — flagged by this phase's own code review (07-REVIEW.md, WR-01/WR-02) | ℹ️ Info (not a blocker) | Not reachable through `DappManifest` today (the only current caller — plain JSON-shaped data), so nothing in the current codebase is broken and all 321 tests pass. This is a pre-existing-review finding about future misuse risk of a newly-generalized, exported utility type, unrelated to the TS6-01/02/03 success criteria this phase targets. Recommend tracking as a follow-up fix (07-REVIEW.md already documents the exact patch) rather than blocking this phase. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any file touched by this phase (the one grep hit was a base64 hash substring in `pnpm-lock.yaml`, a false positive).

### Human Verification Required

None. All four roadmap success criteria are independently, programmatically verified: package versions read directly, `tsconfig*.json` contents read directly, Makefile wiring read and exercised, CI workflow read, and every claimed command (`make typecheck`, `make build`, `make verify-outputs`, `make test`, the negative-check) was actually re-run in this session rather than trusted from SUMMARY.md.

### Gaps Summary

No gaps. All four Success Criteria for Phase 7 are met:

1. Standalone `tsc --noEmit` typecheck exists per package (5 `tsconfig.typecheck.json` files), wired into `make test` and (transitively, with no `ci.yml` edit) CI, and the negative check proves it's a real gate.
2. Core + all 4 plugins compile clean under TypeScript 6.0.3 (`make typecheck` exit 0, `npx tsc --version` confirms 6.0.3).
3. Zero `ignoreDeprecations` shims in any tsconfig (grep confirms across all 10 tsconfig files).
4. Full vitest suite (321/321) stays green after the bump, and `make build`/`make verify-outputs` also stay green under TS6 with the documented tsup `dts:true` → `onSuccess: tsc --emitDeclarationOnly` deviation, which was independently verified to preserve all 3 build output formats, `.d.ts` declarations, and the zero-runtime-dep/IIFE-standalone posture.

One informational (non-blocking) code-review finding (`DeepPartial`/`deepMerge` latent gaps for function/Date/Map/Set/class-instance values) is noted for future follow-up but does not affect this phase's goal.

---

_Verified: 2026-07-17T15:50:34Z_
_Verifier: Claude (gsd-verifier)_

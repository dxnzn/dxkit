---
phase: 08-forward-compat-typing
verified: 2026-07-17T19:25:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 8: Forward-Compat Typing Verification Report

**Phase Goal:** The three strict forward-compat flags are enabled across every package with the built artifacts proven intact, making the eventual TS7 jump a config swap rather than a rewrite.
**Verified:** 2026-07-17T19:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `verbatimModuleSyntax` enabled across all packages; build and tests stay green | ✓ VERIFIED | `tsconfig.json:13` has `"verbatimModuleSyntax": true`; all 4 plugin tsconfigs `extends "../../tsconfig.json"` (no overrides); ran `make typecheck` (exit 0, all 5 packages), `make build` (exit 0, all 5 packages × 3 formats), `make test` (exit 0, 368 tests / 13 files) directly — not from SUMMARY claims. |
| 2 | `isolatedDeclarations` enabled across all packages (core before plugins), `.d.ts` emit succeeds for every package | ✓ VERIFIED | `tsconfig.json:15` has `"isolatedDeclarations": true`; ran `make build` and confirmed `dist/index.d.ts` (core) + `plugins/{settings,wallet,auth,theme}/dist/index.d.ts` all exist post-build; `git diff --stat` across the phase's commit range shows zero changes to any `src/` or `plugins/*/src/` file — the "zero at-source annotation churn" claim holds. |
| 3 | `erasableSyntaxOnly` enabled across all packages, no non-erasable TS syntax remains anywhere | ✓ VERIFIED | `tsconfig.json:14` has `"erasableSyntaxOnly": true`; independently grepped `src/` and `plugins/*/src/` for `enum`, `namespace`, `module "..."`, and `constructor(` (parameter-property surface) — zero matches, confirming the flag is a true no-op; `make typecheck`/`make build` both green with the flag on. |
| 4 | Smoke test loads built `dist/` artifacts and confirms each IIFE global attaches with expected top-level keys, and CJS `require()` interop returns expected exports | ✓ VERIFIED | `make smoke` run directly: exit 0, 11/11 tests pass (5 CJS-interop tests + 5 per-package IIFE-attach tests + 1 five-global shared-window coexistence test). Independently re-derived the actual exported keys via a standalone `node -e` script against fresh `dist/*.cjs` output for all 5 packages and confirmed they exactly match `smoke/fixtures/expected-exports.ts`'s `EXPECTED_EXPORTS` (core: 6 keys, wallet: 4, auth/theme/settings: 1 each — including the intentionally-retained `@deprecated createEthereumWallet`). IIFE path uses `vm.runInContext` against a `happy-dom` `Window`, never the broken `<script>`-element path (verified by reading the test source directly). |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tsconfig.json` | 3 new compilerOptions flags | ✓ VERIFIED | Lines 13-15: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `isolatedDeclarations` all `true` |
| `plugins/*/tsconfig.json` (×4) | Unmodified, inherit via `extends` | ✓ VERIFIED | All 4 plugin tsconfigs read; only `outDir`/`rootDir`/`lib` overrides present, no flag overrides |
| `tests/typecheck-config.test.ts` | Flag-presence regression guard | ✓ VERIFIED | Lines 228-250: `describe('Forward-compat flag presence (FCT-01/FCT-02/FCT-03 guard)')` with 3 `expect(...).toBe(true)` assertions |
| `vitest.smoke.config.ts` | Separate config, happy-dom, `smoke/**/*.smoke.test.ts` only, no `resolve.alias` | ✓ VERIFIED | File read directly; matches spec exactly |
| `smoke/dist-exports.smoke.test.ts` | FCT-04 smoke assertions | ✓ VERIFIED | Read directly; CJS + IIFE + shared-window tests present, sorted-key exact-match assertions |
| `smoke/fixtures/expected-exports.ts` | Maintained `EXPECTED_EXPORTS` fixture | ✓ VERIFIED | Read directly; matches independently-derived actual exports |
| `smoke/node-builtins.d.ts` | Zero-`@types/node` ambient decls | ✓ VERIFIED | Present; declares `node:vm`/`node:module`/`node:fs`/`node:path` |
| `Makefile` | `smoke` target, `.PHONY`, release/publish chains | ✓ VERIFIED | `smoke: build` target present; `.PHONY` line includes `smoke`; `release: build verify-outputs smoke test` and `publish: build verify-outputs smoke test` both confirmed |
| `biome.json` | `files.includes` gains `smoke/**/*.ts` | ✓ VERIFIED | Line 40 confirmed; `make lint` exits 0 |
| `.github/workflows/ci.yml` | `make smoke` step after `make verify-outputs` | ✓ VERIFIED | Step order confirmed: `build` → `verify-outputs` → `smoke` → `test` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| root `tsconfig.json` | `plugins/*/tsconfig.json` | `extends "../../tsconfig.json"` | ✓ WIRED | All 4 plugins confirmed inheriting; `make typecheck` exercises all 5 and passes |
| root `tsconfig.json` flags | each package's `tsup.config.ts` `onSuccess` `tsc --emitDeclarationOnly` | `.d.ts` emission | ✓ WIRED | All 5 `dist/index.d.ts` files present after `make build` |
| `Makefile smoke` target | `vitest.smoke.config.ts` | `build` prerequisite + `npx vitest run --config vitest.smoke.config.ts` | ✓ WIRED | `make smoke` ran build fresh then executed the smoke config; exit 0 |
| `.github/workflows/ci.yml` | `make smoke` | CI step after `verify-outputs` | ✓ WIRED | Step present at correct position |
| `release`/`publish` Makefile targets | `smoke` | prerequisite chain | ✓ WIRED | Both confirmed to include `smoke` after `verify-outputs` |
| `vitest.config.ts` (main suite) | `smoke/` directory | isolation (must NOT be wired) | ✓ CONFIRMED ISOLATED | `include: ['tests/**/*.test.ts', 'plugins/*/tests/**/*.test.ts']` — no `smoke/` glob; `make test` target has no `build` prerequisite (`test: lint typecheck`) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Flags present and correct | `grep` on `tsconfig.json` | All 3 flags `true` | ✓ PASS |
| Typecheck green across all packages | `make typecheck` | exit 0, all 5 packages | ✓ PASS |
| Build green, `.d.ts` emitted for all 5 | `make build` | exit 0, 5/5 `dist/index.d.ts` present | ✓ PASS |
| Build outputs complete (3 formats × 5 packages) | `make verify-outputs` | exit 0, 15/15 OK | ✓ PASS |
| Existing test suite green | `make test` | exit 0, 368/368 tests | ✓ PASS |
| Smoke test green | `make smoke` | exit 0, 11/11 tests | ✓ PASS |
| Lint clean (incl. new smoke/ code) | `make lint` | exit 0, 36 files checked | ✓ PASS |
| Regression guard actually fails on flag flip | sed-toggle `verbatimModuleSyntax` to `false`, run named test, revert | Test failed as expected (`true` vs `false`); reverted cleanly, `git status` clean | ✓ PASS |
| Actual export keys match fixture (independent re-derivation) | `node -e` against fresh `dist/*.cjs` for all 5 packages | Exact match to `EXPECTED_EXPORTS` | ✓ PASS |
| Zero non-erasable syntax in source | `grep -rn` for `enum`/`namespace`/`module "..."`/`constructor(` in `src/` + `plugins/*/src/` | Zero matches | ✓ PASS |
| Zero at-source churn (D-02 prohibition) | `git diff --stat` across phase commit range for `src/`/`plugins/*/src/` | No files changed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FCT-01 | 08-01 | `verbatimModuleSyntax` enabled across all packages; build and tests stay green | ✓ SATISFIED | Flag present, `make typecheck`/`build`/`test` all green, durable guard test present and validated |
| FCT-02 | 08-01 | `isolatedDeclarations` enabled across all packages; `.d.ts` emit succeeds for every package | ✓ SATISFIED | Flag present, all 5 `.d.ts` files confirmed post-build, durable guard test present |
| FCT-03 | 08-01 | `erasableSyntaxOnly` enabled across all packages; no non-erasable TS syntax remains | ✓ SATISFIED | Flag present, independently confirmed zero non-erasable syntax exists, durable guard test present |
| FCT-04 | 08-02 | Smoke test proves IIFE global-attach + CJS `require()` interop on built `dist/` artifacts | ✓ SATISFIED | `make smoke` passes; independently re-derived export keys match fixture; wired into Makefile/CI/biome |

No orphaned requirements — REQUIREMENTS.md maps exactly FCT-01/02/03/04 to Phase 8, and all 4 appear in the two plans' `requirements` frontmatter fields.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `smoke/dist-exports.smoke.test.ts`, `smoke/fixtures/expected-exports.ts`, `smoke/node-builtins.d.ts` | n/a | `smoke/` is not included in `tsconfig.typecheck.json`'s `include: ["src", "tests"]` — confirmed still true in the current tree (`smoke` absent from the include array) | ⚠️ Warning | The phase's own code review (08-REVIEW.md, WR-01) flagged this and it remains unresolved: a type error introduced into the smoke test infrastructure would not be caught by `make typecheck` or `make test`, only by a coincidental runtime failure. This does **not** invalidate any of the 4 declared success criteria (none of them require the smoke test's own source to be typechecked — SC #4 is about exercising the built `dist/` artifact path, which it does, correctly), but it is a real, confirmed, unaddressed gap in the phase's "everything typed" spirit and should be tracked (either a follow-up commit adding `smoke` to the typecheck include, or explicit acceptance as scope for Phase 9). |
| `smoke/node-builtins.d.ts` | 9-13 | Unused `isContext` export in ambient `node:vm` declaration (08-REVIEW.md IN-01) | ℹ️ Info | Minor; contradicts the file's own "declare only what's used" convention. Non-blocking. |
| `smoke/node-builtins.d.ts` vs `tests/node-builtins.d.ts` | n/a | Duplicated ambient declarations for `node:fs`/`node:path`/`process` with no shared source of truth (08-REVIEW.md IN-02) | ℹ️ Info | Deliberate isolation trade-off per plan design; low risk, non-blocking. |
| `vitest.smoke.config.ts` | 8 | `environment: 'happy-dom'` unused by the smoke test (constructs its own `new Window()` explicitly) (08-REVIEW.md IN-03) | ℹ️ Info | Cosmetic; no functional impact. |

No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) found in any file modified by this phase.

### Human Verification Required

None. All four success criteria are mechanically verifiable via build/typecheck/test/smoke tooling and direct source inspection, and all were independently re-run and cross-checked against actual codebase state (not SUMMARY claims).

### Gaps Summary

No gaps block phase goal achievement. All 4 roadmap success criteria (FCT-01 through FCT-04) are independently verified against the live codebase:

- All three compiler flags (`verbatimModuleSyntax`, `isolatedDeclarations`, `erasableSyntaxOnly`) are live in the single root `tsconfig.json`, inherited by all 4 plugins via `extends`, with zero source-code churn anywhere in `src/` or `plugins/*/src/` — confirmed both by direct flag inspection and by re-running `make typecheck`, `make build`, and `make test` from a clean state (all exit 0).
- `.d.ts` emission was independently confirmed present for all 5 packages after a fresh build.
- A durable regression guard exists and was spot-checked to genuinely fail when a flag is flipped (not just asserted to exist).
- The FCT-04 smoke test (`make smoke`) independently passes, and its expected-export fixture was cross-verified against actual `require()`'d module exports rather than trusted at face value.
- Makefile/CI/biome wiring for `make smoke` was read directly and confirmed correctly ordered (`build` → `verify-outputs` → `smoke` → `test` in CI; `smoke` after `verify-outputs` in both `release` and `publish` chains) and correctly isolated from `make test` (no build prerequisite, no smoke glob in the main vitest config).

One non-blocking Warning was surfaced (WR-01, carried over from the phase's own code review and confirmed still open): `smoke/`'s own TypeScript is not passed through any `tsc` invocation. This does not fail any of the phase's declared success criteria but is flagged for follow-up tracking (Phase 9 or a small standalone fix).

---

_Verified: 2026-07-17T19:25:00Z_
_Verifier: Claude (gsd-verifier)_

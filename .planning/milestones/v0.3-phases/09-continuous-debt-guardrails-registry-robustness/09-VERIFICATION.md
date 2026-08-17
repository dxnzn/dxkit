---
phase: 09-continuous-debt-guardrails-registry-robustness
verified: 2026-07-18T06:30:05Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 09: Continuous Debt Guardrails & Registry Robustness Verification Report

**Phase Goal:** CI continuously catches type/deprecation regressions and dependency drift scoped to project-owned code, the zero-runtime-dep posture is machine-enforced, and the last known registry crash path is closed.
**Verified:** 2026-07-18T06:30:05Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CI fails the build on `tsc` typecheck/deprecation errors scoped to project-owned paths only (`src/`, `plugins/*/src/`) — never `node_modules/` | ✓ VERIFIED | `.github/workflows/ci.yml:26-27` has a named `Typecheck / deprecation gate (GATE-01)` step running `make typecheck`, distinct from `make test`. `Makefile:103-113` `typecheck` target runs `npx tsc --noEmit -p tsconfig.typecheck.json` for core, then loops `PLUGIN_BUILD_ORDER` for each plugin's own `tsconfig.typecheck.json`. `tsconfig.typecheck.json` scopes `include: ["src", "tests"]` — node_modules is never included. `make typecheck` exits 0 on current tree (ran locally). Guard test `tests/typecheck-config.test.ts -t "GATE-01"` passes (2/2). |
| 2 | CI asserts the zero-runtime-dependency posture of the core `@dnzn/dxkit` package (package.json field check), so an automated bump that pulls a non-dev dependency into core is caught | ✓ VERIFIED | `scripts/check-no-runtime-deps.cjs` implements `checkNoRuntimeDeps(pkg)` flagging any entry in `dependencies`/`peerDependencies`/`optionalDependencies` using only `node:fs` (zero new deps). `Makefile:97-101` `verify-no-runtime-deps` target runs it against root `package.json` only (no `PLUGIN_BUILD_ORDER` loop, confirmed by grep). Wired into `.PHONY` (line 7) and as a prerequisite of `release`/`publish` (lines 64, 71). `.github/workflows/ci.yml:28-29` runs it as named step `Zero-runtime-dependency assertion (GATE-02)`, after GATE-01 and before `make test`. `make verify-no-runtime-deps` exits 0 locally (`OK: package.json declares no external runtime-visible dependency.`). Guard test `tests/check-no-runtime-deps.test.ts` passes (11/11). REQUIREMENTS.md and ROADMAP.md wording corrected to name the core package explicitly (no more "any package"). |
| 3 | Renovate is configured for the pnpm workspace with grouped PRs, release-age gating, and an automerge policy that blocks unreviewed major toolchain bumps (tsup/vite/vitest/Biome/TypeScript) | ✓ VERIFIED | `renovate.json` extends `config:recommended`, sets `minimumReleaseAge: "3 days"`, defines a `toolchain` packageRules group listing all six toolchain packages with `automerge: false`, a reinforcing major-only rule for the same six packages (`automerge: false`), a non-major devDependency automerge rule that excludes the toolchain six, an object-shaped `lockFileMaintenance` (`enabled: true`, weekly schedule, `automerge: false`). No deprecated `config:base`/`matchPackagePatterns`/boolean-`lockFileMaintenance` tokens present (grep confirms none). Guard test `tests/renovate-config.test.ts` passes (10/10). Note: automation only goes *live* once the Mend Renovate GitHub App is installed by the repo operator — this is explicitly documented as a `user_setup` operator next-step in `09-03-PLAN.md`/`09-03-SUMMARY.md`, not a phase-goal claim that the app is already installed. |
| 4 | `loadManifests()` validates that `registry.json` is an array; a wrong-shape `200` emits `dx:error` (source `shell:manifest`) instead of throwing an uncaught `TypeError` in `init()` before `window.__DXKIT__` is exposed (WR-01) | ✓ VERIFIED | `src/shell.ts:274-289` — the parsed registry-fetch 200 body is `Array.isArray()`-guarded; on a wrong shape it emits an ungated `dx:error` (source `shell:manifest`) and returns `[]` (fail-closed), so `normalizeAndValidateManifests()`'s `for...of` never sees a non-array. The emit is deliberately NOT wrapped in `registryUrlExplicit` (confirmed by reading the code — matches D-10 requirement). Four regression tests in `tests/shell.test.ts` (`-t "ROB-05"`, 4/4 pass) cover: explicit-registryUrl wrong-shape emit, default-silent-probe wrong-shape emit (ungated), post-init `window.__DXKIT__` exposure, and happy-path array-body pass-through unchanged. Full `tests/shell.test.ts` file (68/68) is green — no regression to existing D-15 tests. `make typecheck` exits 0.

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | Named GATE-01 + GATE-02 steps between `make smoke` and `make test` | ✓ VERIFIED | Both steps present, correctly ordered, correctly named |
| `tests/typecheck-config.test.ts` | Guard block locking GATE-01 CI wiring | ✓ VERIFIED | `describe('GATE-01 CI deprecation gate wiring')` present, 2/2 tests pass |
| `scripts/check-no-runtime-deps.cjs` | Pure `checkNoRuntimeDeps(pkg)` + CLI entry, node built-ins only | ✓ VERIFIED | Zero npm deps, `require('node:fs')` only |
| `tests/check-no-runtime-deps.test.ts` | Fixture unit test + `GATE-02 wiring` guard | ✓ VERIFIED | 11/11 tests pass |
| `Makefile` | `verify-no-runtime-deps` target, `.PHONY`, release/publish prereq | ✓ VERIFIED | All three present, target body is root-only (no `PLUGIN_BUILD_ORDER`) |
| `renovate.json` | Repo-root config encoding D-01..D-04 | ✓ VERIFIED | All invariants present and schema-conformant |
| `tests/renovate-config.test.ts` | Schema/invariant guard test | ✓ VERIFIED | 10/10 tests pass |
| `src/shell.ts` | `Array.isArray()` guard in `loadManifests()` after `await res.json()` | ✓ VERIFIED | Present at lines 274-289, ungated emit, fail-closes to `[]` |
| `tests/shell.test.ts` | ROB-05 regression tests (explicit + default-probe + init-exposure + happy-path) | ✓ VERIFIED | 4/4 ROB-05 tests + 64 other shell tests all pass (68/68 total) |
| `.planning/REQUIREMENTS.md` | GATE-02 core-only wording | ✓ VERIFIED | References core `@dnzn/dxkit` package explicitly |
| `.planning/ROADMAP.md` | Phase 9 success criterion #2 core-only wording | ✓ VERIFIED | No "into any package" phrasing; core-only scope stated |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| CI GATE-01 step | `make typecheck` | `run: make typecheck` | WIRED | Confirmed in ci.yml, exits 0 locally |
| `make typecheck` | `tsc --noEmit -p tsconfig.typecheck.json` | Makefile target body | WIRED | Scoped to `src`/`tests` (core) + each plugin's own typecheck config |
| CI GATE-02 step | `make verify-no-runtime-deps` | `run: make verify-no-runtime-deps` | WIRED | Confirmed in ci.yml, exits 0 locally |
| `make verify-no-runtime-deps` | `node scripts/check-no-runtime-deps.cjs package.json` | Makefile target body | WIRED | Root-only, no plugin loop |
| `release`/`publish` targets | `verify-no-runtime-deps` | Makefile prerequisite chain | WIRED | Both targets list it as a prereq |
| `renovate.json` | Mend Renovate GitHub App (external, hosted) | Committed config, app install pending | CONFIGURED (external activation pending) | Config-side of the link is complete; live PR automation requires the operator to install the hosted app — documented as `user_setup` in 09-03-PLAN.md, not a phase-goal claim |
| `loadManifests()` array guard | `normalizeAndValidateManifests()` | Prevents non-array value from reaching the `for...of` | WIRED | Guard returns `[]` before the array ever reaches the validator on the registry-fetch tier |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GATE-01 | 09-01-PLAN.md | CI fails build on tsc typecheck/deprecation errors, scoped to project-owned paths | ✓ SATISFIED | Named CI step, guard test, `make typecheck` green |
| GATE-02 | 09-02-PLAN.md | CI asserts zero-runtime-dep posture of core package | ✓ SATISFIED | Named CI step, guard test, `make verify-no-runtime-deps` green |
| GATE-03 | 09-03-PLAN.md | Renovate configured for pnpm workspace, grouped PRs, release-age gating, blocked major toolchain automerge | ✓ SATISFIED | `renovate.json` + guard test; app install is operator next-step (documented, not a gap) |
| ROB-05 | 09-04-PLAN.md | `loadManifests()` validates registry.json is an array, emits `dx:error` instead of throwing | ✓ SATISFIED | Array guard + 4 regression tests, scoped exactly as ROADMAP SC#4 states ("registry.json") |

No orphaned requirements — all four IDs in REQUIREMENTS.md Phase 9 traceability table are claimed by exactly one plan each, and all four are marked `[x]` complete in REQUIREMENTS.md.

### Anti-Patterns Found

No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) found in any of the phase's modified files.

`09-REVIEW.md` (code review, same commit range) found one Critical and two Warning items. Per verification scope, these are assessed against the phase's must-haves and ROADMAP success criteria below — none invalidate a verified truth, but CR-01 is a real scope gap worth carrying forward.

| File | Finding | Severity | Impact on phase goal |
|------|---------|----------|----------------------|
| `src/shell.ts:250-257` | CR-01: the `Array.isArray()` guard covers only the `registryUrl`-fetch tier of `loadManifests()`'s three input tiers (`dapps` entries, inline `manifests`, registry fetch). The `dapps` and inline-`manifests` tiers still throw an uncaught `TypeError` on a malformed value before `window.__DXKIT__` is exposed, reachable by untyped IIFE/static-HTML consumers (this project's first-class deployment target). | Info (scope-extending, not a phase-goal gap) | **Does not fail ROB-05 as scoped.** ROADMAP success criterion #4 and the 09-04-PLAN.md must-haves both name `registry.json` / the "200 registry body" specifically — the plan's own prohibitions state "ROB-05 only guards the top-level array shape" of the registry tier, and its `<read_first>`/`key_links` never reference the `dapps`/`manifests` tiers. The other two tiers are TypeScript-typed at the config surface (`config.manifests?: DappManifest[]`), a materially different trust boundary than an untrusted network fetch. CR-01 correctly observes this leaves a gap in the broader "failures are visible, never silent" charter for non-TS/IIFE consumers passing malformed `dapps`/`manifests` config — worth a small follow-up (recommend a quick task or Phase-10 backlog item to extract the shared array-coercion helper CR-01 proposes), but it is outside ROB-05's stated scope and not part of this phase's contract. |
| `tests/typecheck-config.test.ts:313-317` | WR-01 (review): vacuous `||` disjunct makes the first, meaningful named-step assertion irrelevant to the `expect` outcome (the subsequent `stepBlockMatch` assertions still enforce the real invariant, so the guard test as a whole is not defeated). | Warning | No — the guard test's overall behavior still fails on regression via the `stepBlockMatch` assertions; only one redundant assertion within it is dead logic. Does not affect GATE-01 truth. |
| `scripts/check-no-runtime-deps.cjs:32` | WR-02 (review): `JSON.parse(fs.readFileSync(...))` has no try/catch — an uncaught exception on missing/malformed `package.json` still exits non-zero (CI gate doesn't silently pass) but produces a raw stack trace instead of the script's own `FAIL:` style. | Warning | No — CLI still fails closed; cosmetic/consistency issue only. Does not affect GATE-02 truth. |
| `src/shell.ts:283`, `scripts/check-no-runtime-deps.cjs:14`, `tests/renovate-config.test.ts:95-98` | IN-01/IN-02/IN-03 (review): `typeof null` misreport, array-shaped dep-field edge case, fragile rule-selection heuristic in a guard test | Info | No — all three are minor, low-probability edge cases with no effect on the phase's four success criteria. |

### Human Verification Required

None. All four success criteria are verifiable from the codebase; the one external dependency (Mend Renovate App installation) is explicitly out of phase-goal scope per the plan's own `user_setup` block and does not require human UAT to confirm the phase goal — the goal is "Renovate is *configured*," not "Renovate is live."

### Gaps Summary

No gaps block the phase goal. All four ROADMAP success criteria are observably true in the codebase: GATE-01 and GATE-02 are named, wired, and green CI steps; GATE-03's `renovate.json` encodes the required grouping/gating/automerge policy and is guard-tested; ROB-05's array guard closes the specific registry.json crash path the requirement names, with four passing regression tests and zero regression to the existing 64 shell tests.

One informational carry-forward: the code review's CR-01 finding (the `dapps`/inline-`manifests` tiers of `loadManifests()` remain unguarded against non-array shapes) is a legitimate scope-extension beyond ROB-05's stated contract, not a failure of it. Recommend logging it as a follow-up quick task or backlog item before the next robustness-themed phase, since it shares CR-01's own proposed fix (a shared `coerceManifestArray()` helper) with the code already landed in this phase.

---

_Verified: 2026-07-18T06:30:05Z_
_Verifier: Claude (gsd-verifier)_

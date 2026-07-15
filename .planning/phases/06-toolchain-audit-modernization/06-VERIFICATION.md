---
phase: 06-toolchain-audit-modernization
verified: 2026-07-15T18:00:00Z
status: gaps_found
score: 4/5 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "Every package.json (core + 4 plugins) declares engines >=22 and, with engine-strict set, a pnpm install on the declared Node floor is internally consistent — a wrong-Node install fails fast and no version admitted by the declared floor also fails"
    status: failed
    reason: >
      CR-01 (06-REVIEW.md) is independently confirmed against pnpm-lock.yaml: the declared
      floor `>=22` admits Node 22.0-22.11 and Node 23.x, but the toolchain pinned in this
      same phase rejects both. vite@8.1.4 (and every @rolldown/binding-* it pulls in)
      declares `engines: {node: ^20.19.0 || >=22.12.0}` — Node 22.0-22.11 satisfies the
      project's ">=22" but fails vite's own engine-strict check. vitest@4.1.10 declares
      `engines: {node: ^20.0.0 || ^22.0.0 || >=24.0.0}` — Node 23.x satisfies ">=22" but
      matches neither vitest sub-range. With .npmrc's engine-strict=true (confirmed
      present), a contributor on Node 22.5 or Node 23.x hits `pnpm install` failure despite
      being inside the workspace's own documented floor. This is the exact "documented vs.
      actual" drift the milestone's Core Value (CLAUDE.md) exists to eliminate, and directly
      contradicts the phase goal's claim of "an enforced Node 22 LTS floor." CI's bare
      `node-version: [22, 24]` matrix resolves to the latest patch of each line and never
      exercises the broken 22.0-22.11 / 23.x sub-ranges, so the pipeline stays green over an
      inaccurate contract (WR-02, also confirmed).
    artifacts:
      - path: "package.json:8-10"
        issue: "engines.node \">=22\" is broader than the pinned toolchain's actual supported range"
      - path: "plugins/auth/package.json (and wallet/theme/settings, identical)"
        issue: "Same over-broad >=22 string, lockstep-mirrored from root per D-05"
      - path: ".npmrc:3"
        issue: "engine-strict=true converts the sub-range mismatches into real install failures, not just warnings"
      - path: "pnpm-lock.yaml:2024, 2067"
        issue: "vite@8.1.4 engines: {node: ^20.19.0 || >=22.12.0}; vitest@4.1.10 engines: {node: ^20.0.0 || ^22.0.0 || >=24.0.0} — both independently confirmed via grep this session"
    missing:
      - "Tighten engines.node to a range that matches the pinned toolchain's real floor across all five package.json (e.g. \"^22.12.0 || >=24.0.0\", per CR-01's suggested fix) — or accept the mismatch explicitly via an override with a documented rationale (e.g. \"engine-strict failures on 22.0-22.11/23.x are acceptable collateral, CI only tests supported patches\")."
      - "Add a CI matrix leg that pins an exact lower-bound patch (e.g. 22.12.0) so the declared floor is a tested contract rather than silently rounded up to latest by actions/setup-node (WR-02)."
deferred: []
behavior_unverified_items:
  - truth: "A pnpm install on Node 18/20 fails fast with engine-strict, proven by a negative install test"
    test: "On a Node 18 or Node 20 runtime, run `pnpm install` (or `pnpm install --frozen-lockfile`) and confirm it fails with an ERR_PNPM_UNSUPPORTED_ENGINE-family error naming `Expected version: >=22` against the actual old version."
    expected: "pnpm install exits non-zero before resolving/downloading packages, citing the engines mismatch."
    why_human: "No Node 18/20 runtime was reachable in either the original execution sandbox (per 06-01-SUMMARY.md) or this verification session (checked: nvm, fnm, volta, docker — none installed). The mechanism (engines >=22 + engine-strict=true) is structurally present and verified, and is standard, well-documented pnpm behavior, but the specific negative-install proof the ROADMAP criterion asks for has never actually been executed and observed in this project."
human_verification:
  - test: "On a Node 18 or Node 20 runtime, run `pnpm install` and confirm it fails fast citing the engines >=22 mismatch (verbatim ERR_PNPM_UNSUPPORTED_ENGINE output)."
    expected: "Install fails before resolving dependencies, with an error naming the required >=22 floor."
    why_human: "Requires an old-Node runtime not available in any sandbox this phase has run in; this is the literal proof Success Criterion 1 asks for and has not yet been captured."
  - test: "Run `make commit` (`npx cz`) end-to-end on a real TTY: select a type, enter a subject, confirm, and verify the resulting git log entry is a valid conventional-commit message."
    expected: "cz-git's interactive type-selection prompt completes and produces a commit matching conventional-commit format."
    why_human: "The 06-04 SUMMARY's own verification was a non-interactive smoke run (no TTY in the autonomous sandbox) that confirmed the adapter resolves and renders the prompt, but stopped short of a completed interactive commit. This verification session confirmed the same resolution behavior (`npx cz` under /dev/null correctly reaches cz-git's own staging-check, not a module-not-found error) but likewise could not complete an interactive session."
---

# Phase 6: Toolchain Audit & Modernization Verification Report

**Phase Goal:** The dev toolchain runs on current, TS6-compatible versions with an enforced Node 22 LTS floor, and all three build outputs still emit correctly — establishing the version baseline every phase below depends on.
**Verified:** 2026-07-15T18:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every package.json (root + 4 plugins) declares identical `engines.node >=22` | ✓ VERIFIED | All 5 files grepped directly; byte-identical `"node": ">=22"` / `{ "node": ">=22" }` in package.json, plugins/auth, plugins/wallet, plugins/theme, plugins/settings |
| 2 | `.npmrc` engine-strict=true is the load-bearing enforcement mechanism | ✓ VERIFIED | `.npmrc` present at repo root, contains `engine-strict=true` with explanatory comment |
| 3 | A wrong-Node (18/20) install fails fast, proven by a negative install test | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Mechanism present and correct in isolation, but no Node 18/20 runtime was available in either the execution sandbox or this verification session to actually run and observe the failure — see Human Verification |
| 4 | **The declared `>=22` floor is internally consistent — no version admitted by it also fails install under the pinned toolchain** | ✗ FAILED | CR-01 confirmed: vite@8.1.4 requires `^20.19.0 \|\| >=22.12.0` (excludes Node 22.0-22.11); vitest@4.1.10 requires `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` (excludes Node 23.x). Both ranges verified directly in pnpm-lock.yaml this session. `engine-strict=true` turns these into real `pnpm install` failures for anyone on those sub-versions, despite satisfying the project's own `>=22` contract |
| 5 | CI runs the full suite on Node 22 and 24, no EOL Node 18/20 in the matrix | ✓ VERIFIED | `.github/workflows/ci.yml` matrix is `node-version: [22, 24]`; no 18/20 present; step ordering (`pnpm/action-setup@v4` before `actions/setup-node@v4`) preserved |
| 6 | tsup, vite, vitest, happy-dom bumped to current TS6-compatible versions, `make test` green | ✓ VERIFIED | package.json: tsup ^8.5.1, vite ^8.1.4, vitest ^4.1.10, happy-dom ^20.10.6. Ran `make test` this session: biome check clean (31 files), vitest 321/321 passing |
| 7 | Biome bumped to current stable 2.x, `biome.json` `$schema` in lockstep | ✓ VERIFIED | package.json: `@biomejs/biome` ^2.5.4; biome.json `$schema` points to `.../2.5.4/schema.json` |
| 8 | cz-git is the active commitizen adapter, cz-conventional-changelog removed, conventional commits still emitted | ✓ VERIFIED | `config.commitizen.path` = `node_modules/cz-git`; `cz-git` devDependency present; `cz-conventional-changelog` absent from package.json; `node_modules/cz-git` resolves on disk; `npx cz` this session reached cz-git's own "no files staged" check rather than a module-resolution error, confirming the adapter loads correctly. Full interactive completion is a human-verification item (below) |
| 9 | All three build outputs (ESM/CJS/IIFE) produced and present per package (root + 4 plugins) after the bumps | ✓ VERIFIED | Ran `make clean && make build && make verify-outputs` fresh this session: all 15 files (3 formats × 5 packages) present, `verify-outputs` exits 0 |

**Score:** 7/9 truths verified (1 present-but-behavior-unverified, 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` (root) | `engines.node: ">=22"`, bumped devDeps, `config.commitizen.path` → cz-git | ✓ VERIFIED | Confirmed all fields present and correct |
| `plugins/auth/package.json` | `engines.node: ">=22"` | ✓ VERIFIED | Byte-identical to root string |
| `plugins/wallet/package.json` | `engines.node: ">=22"` | ✓ VERIFIED | Byte-identical to root string |
| `plugins/theme/package.json` | `engines.node: ">=22"` | ✓ VERIFIED | Byte-identical to root string |
| `plugins/settings/package.json` | `engines.node: ">=22"` | ✓ VERIFIED | Byte-identical to root string |
| `.npmrc` | `engine-strict=true` | ✓ VERIFIED | Present, correct content, explanatory comment |
| `.github/workflows/ci.yml` | `node-version: [22, 24]` | ✓ VERIFIED | Matrix correct; no 18/20 |
| `biome.json` | `$schema` bumped to 2.5.4 | ✓ VERIFIED | Confirmed |
| `Makefile` | `verify-outputs` target | ✓ VERIFIED | Present, `.PHONY`, ran green this session |
| `pnpm-lock.yaml` | Regenerated per bump | ✓ VERIFIED | Contains vite@8.1.4, vitest@4.1.10, biome/cz-git resolutions with real engine constraints (source of the CR-01 gap) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `.npmrc engine-strict` | `package.json engines` | pnpm install-time enforcement | ✓ WIRED (mechanism), ✗ MISCALIBRATED (range) | The pairing works as designed, but the range it enforces is wider than the toolchain actually supports (CR-01) |
| `config.commitizen.path` | `node_modules/cz-git` | commitizen runtime module resolution | ✓ WIRED | `npx cz` this session resolved the module and reached cz-git's own logic (staging check), not a resolution error |
| `Makefile build` → `verify-outputs` | dist/ output presence | manual invocation only | ⚠️ PARTIAL | `verify-outputs` correctly checks dist/ but is not called by `test`, `release`, or `publish` targets (WR-01) — confirmed by reading Makefile: `release: build test`, `publish: build test`, `test: lint` — none reference `verify-outputs` |
| CI `ci.yml` matrix | `engines` floor | GitHub Actions runner Node install | ⚠️ PARTIAL | CI passes today because `actions/setup-node` resolves bare `22`/`24` to latest patches, which happen to sit inside vite/vitest's narrower sub-ranges — this masks CR-01 rather than catching it (WR-02) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Fresh build produces all 15 outputs | `make clean && make build && make verify-outputs` | 15/15 `OK` lines, "All build outputs present (3 formats x 5 packages)" | ✓ PASS |
| Full test suite green on bumped toolchain | `make test` | biome check clean (31 files), vitest 321/321 passing | ✓ PASS |
| cz-git adapter resolves at runtime | `npx cz < /dev/null` | Exited with cz-git's own "No files added to staging!" message (not a module-resolution error) | ✓ PASS (resolution only — full interactive flow not completed, see Human Verification) |
| vite/vitest sub-range mismatch vs. declared floor | `grep -n "engines:" pnpm-lock.yaml` for vite@8.1.4 / vitest@4.1.10 | `vite@8.1.4: engines: {node: ^20.19.0 \|\| >=22.12.0}`; `vitest@4.1.10: engines: {node: ^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0}` | ✗ FAIL (confirms CR-01) |
| Negative install on Node 18/20 | N/A — no old-Node runtime available | Not run | ? SKIP (routed to human verification) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| TOOL-01 | 06-01 | engines >=22 + engine-strict enforcement | ⚠️ PARTIAL | Mechanism present and correctly wired; the *specific negative-install proof* is unverified (behavior_unverified), and the *range itself is internally inconsistent* with the toolchain this same phase pinned (CR-01, failed) |
| TOOL-02 | 06-02 | CI on Node 22/24, no EOL 18/20 | ✓ SATISFIED | ci.yml matrix confirmed `[22, 24]` |
| TOOL-03 | 06-03, 06-04 | tsup/vite/vitest/happy-dom/Biome bumped, `make test` green | ✓ SATISFIED | All versions confirmed in package.json; `make test` run green this session |
| TOOL-04 | 06-04 | cz-git active, cz-conventional-changelog removed, conventional commits still emitted | ✓ SATISFIED (with human-verification recommended for full interactive flow) | Adapter resolution confirmed; commit history since Plan 06-01 itself is in valid conventional-commit form |
| TOOL-05 | 06-05 | All 3 build outputs present per package after bumps | ✓ SATISFIED | 15/15 outputs confirmed present via fresh `make clean && make build && make verify-outputs` |

No orphaned requirements — REQUIREMENTS.md lists exactly TOOL-01 through TOOL-05 for Phase 6, and all five appear across the five plans' frontmatter.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any file modified by this phase (package.json ×5, .npmrc, biome.json, Makefile, ci.yml).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `package.json:8-10` (+ 4 plugin mirrors) | engines field | Over-broad range vs. pinned toolchain (CR-01) | 🛑 Blocker | Declared "enforced Node 22 LTS floor" is self-contradictory; contributors on legitimate `>=22` versions can hit install failures |
| `Makefile:64,71` | `release`/`publish` targets | `verify-outputs` not included (WR-01) | ⚠️ Warning | Safeguard exists but is inert in the automated release/publish path |
| `.github/workflows/ci.yml:14` | bare `[22, 24]` matrix | No pinned lower-bound patch (WR-02) | ⚠️ Warning | CI cannot catch CR-01-style floor drift; masks rather than proves the contract |
| `pnpm-lock.yaml` (transitive) | `@types/node@25.5.0` | Type-checking against Node 25 API surface on a Node 22 floor (WR-03) | ℹ️ Info | Lower severity per code review — DxKit's runtime is browser/IIFE-oriented, but still a latent hole in "failures are visible" |

### Human Verification Required

### 1. Negative install test on Node 18/20

**Test:** On a Node 18 or Node 20 runtime (nvm/fnm/Volta/Docker), run `pnpm install` against this repo.
**Expected:** Install fails fast with an `ERR_PNPM_UNSUPPORTED_ENGINE`-family error citing `Expected version: >=22` against the actual old version, before any packages resolve.
**Why human:** No old-Node runtime was reachable in the execution sandbox (per 06-01-SUMMARY.md) or in this verification session (checked nvm/fnm/volta/docker — none present). This is the literal proof ROADMAP Success Criterion 1 asks for and has never actually been captured in this project.

### 2. Complete interactive commitizen flow

**Test:** Run `make commit` (`npx cz`) on a real TTY: select a commit type, write a subject, confirm, and inspect the resulting `git log` entry.
**Expected:** cz-git's type-selection prompt completes interactively and produces a valid conventional-commit message.
**Why human:** Both the original 06-04 execution and this verification session could only run `npx cz` non-interactively (no TTY), which proves the adapter *resolves* correctly but not that a full interactive session completes cleanly end-to-end.

## Gaps Summary

**Blocker — CR-01 confirmed, not a false positive.** Independently re-derived from `pnpm-lock.yaml` this session: `vite@8.1.4` declares `engines: {node: ^20.19.0 || >=22.12.0}` and `vitest@4.1.10` declares `engines: {node: ^20.0.0 || ^22.0.0 || >=24.0.0}`. Combined with this phase's own `.npmrc engine-strict=true`, the workspace's declared `engines.node: ">=22"` is not the actual floor — Node 22.0-22.11 and all of Node 23.x satisfy DxKit's own contract but fail `pnpm install` on a sub-dependency's engine check. The phase goal explicitly promises "an enforced Node 22 LTS floor," and the milestone's stated Core Value (CLAUDE.md) is that "the documented behavior matches the actual behavior" — this defect is precisely that kind of drift, introduced by this phase's own toolchain bumps, and it is currently invisible to CI because the `[22, 24]` matrix resolves to latest patches that happen to avoid the broken sub-ranges (WR-02). This must be resolved (tighten the range, e.g. to `^22.12.0 || >=24.0.0` per CR-01's suggested fix) or explicitly overridden with a documented rationale before this phase's success criteria can be considered fully met.

**Warning — TOOL-01's literal "negative install test" proof is still undocumented-by-observation.** The engine-strict mechanism is correctly wired and is standard, well-documented pnpm behavior, but no one has yet actually run `pnpm install` on Node 18/20 against this repo and captured the failure. This was scoped as a documented (not CI-enforced) check by phase decision D-06, which is a reasonable interpretation for the old-floor (18/20) case specifically, but it does mean the "proven by a negative install test" clause of Success Criterion 1 remains unobserved, not merely a design choice.

**Warning — `verify-outputs` is not wired into any automated path (WR-01).** It exists, passes, and was run manually to produce Success Criterion 5's evidence, but nothing in CI/`release`/`publish` calls it automatically, so a future regression (e.g. tsup silently dropping the IIFE output) would not be caught before a release ships.

**Not gaps, informational:** WR-03 (`@types/node@25` vs. Node 22 floor) is real but lower severity and does not block any literal success criterion this phase.

---

_Verified: 2026-07-15T18:00:00Z_
_Verifier: Claude (gsd-verifier)_

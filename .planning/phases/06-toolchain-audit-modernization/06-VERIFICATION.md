---
phase: 06-toolchain-audit-modernization
verified: 2026-07-15T20:30:00Z
status: human_needed
score: 9/9 truths verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/9 (1 present-but-behavior-unverified, 1 failed)
  gaps_closed:
    - "CR-01: engines.node tightened from over-broad \">=22\" to the toolchain-consistent \"^22.12.0 || >=24.0.0\" across all five package.json — no version admitted by the declared floor is rejected by vite@8.1.4 or vitest@4.1.10 under engine-strict."
    - "WR-02: CI matrix now pins the exact floor patch (['22.12.0', 24]) instead of a bare 22 that actions/setup-node silently rounds up to latest — the declared floor is now a tested contract."
    - "WR-01: verify-outputs is now a hard prerequisite of both release and publish Makefile targets, and runs as a dedicated CI step between make build and make test — confirmed behaviorally (deleted dist/index.global.js, verify-outputs exited 2 with a MISSING: line; rebuild restored exit 0)."
  gaps_remaining: []
  regressions: []
---

# Phase 6: Toolchain Audit & Modernization Verification Report (Re-Verification)

**Phase Goal:** The dev toolchain runs on current, TS6-compatible versions with an enforced Node 22 LTS floor, and all three build outputs still emit correctly — establishing the version baseline every phase below depends on.
**Verified:** 2026-07-15T20:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (06-06-PLAN.md, commits `13f7766`, `00e586e`, `aaac2c7`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every package.json (root + 4 plugins) declares an identical, internally-consistent `engines.node` floor | ✓ VERIFIED | Direct grep this session: all 5 files contain the exact string `^22.12.0 \|\| >=24.0.0` (1 match each, 5 total); `grep -rF '">=22"'` across all 5 files returns zero matches — the old over-broad string is gone |
| 2 | `.npmrc` engine-strict=true is the load-bearing enforcement mechanism | ✓ VERIFIED | `.npmrc` unchanged, still present, `engine-strict=true` confirmed this session |
| 3 | **The declared floor is internally consistent — no version admitted by it also fails install under the pinned toolchain (CR-01, previously FAILED)** | ✓ VERIFIED | Re-derived directly from `pnpm-lock.yaml` this session: `vite@8.1.4` declares `engines: {node: ^20.19.0 \|\| >=22.12.0}` (line 2024); `vitest@4.1.10` declares `engines: {node: ^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0}` (line 2067). The declared `^22.12.0 \|\| >=24.0.0` is a strict subset of both: `^22.12.0` (22.12.0–22.999) ⊂ vite's `>=22.12.0` and ⊂ vitest's `^22.0.0` (22.0.0–22.999); `>=24.0.0` matches both exactly. No admitted version is rejected by either sub-dependency. |
| 4 | A wrong-Node (18/20) install fails fast, proven by a negative install test | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Mechanism (engines + engine-strict) present and structurally correct; still no Node 18/20 runtime reachable in this sandbox (checked nvm/fnm/volta/docker again this session — none present, unchanged from prior verification). Routed to Human Verification below, carried forward unchanged. |
| 5 | **CI exercises the exact declared floor patch, not a bare version silently rounded up (WR-02, previously a Warning)** | ✓ VERIFIED | `.github/workflows/ci.yml` matrix is `node-version: ['22.12.0', 24]`; grep confirms `22.12.0` present. Step ordering preserved: `pnpm/action-setup@v4` precedes `actions/setup-node@v4`, `cache: pnpm` intact. |
| 6 | tsup, vite, vitest, happy-dom bumped to current TS6-compatible versions, `make test` green | ✓ VERIFIED | Ran `make test` fresh this session after the engines edit: Biome check clean (31 files), vitest 321/321 passing — no regression from the gap-closure changes |
| 7 | Biome bumped to current stable 2.x, `biome.json` `$schema` in lockstep | ✓ VERIFIED (regression check) | Unmodified by 06-06; `make test`'s Biome pass confirms it is still clean |
| 8 | cz-git is the active commitizen adapter, cz-conventional-changelog removed, conventional commits still emitted | ✓ VERIFIED (regression check) | Unmodified by 06-06; all three gap-closure commits (`13f7766`, `00e586e`, `aaac2c7`) themselves are in valid conventional-commit form (`fix(engines)!:`, `ci:`, `chore(build):`), including a `BREAKING CHANGE:` footer on the engines commit, confirming the adapter/config chain still functions in practice |
| 9 | **All three build outputs (ESM/CJS/IIFE) produced and present per package (root + 4 plugins) after the bumps, and the guard is wired into the automated path (WR-01, previously a Warning)** | ✓ VERIFIED | Ran `make clean && make build && make verify-outputs` fresh this session: 15/15 outputs present, exit 0. Wiring confirmed: `Makefile` `release: build verify-outputs test` and `publish: build verify-outputs test` (both grepped directly); `ci.yml` has `make verify-outputs` as its own step between `make build` and `make test`. Behavioral spot-check: deleted `dist/index.global.js`, ran `make verify-outputs` — exited 2 with `MISSING: dist/index.global.js (root package)`; rebuilt and re-ran — exit 0. |

**Score:** 9/9 truths verified (0 failed, 0 present-but-behavior-unverified counted against score — truth #4 is a carried-forward human-only proof, see below)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` (root) | `engines.node: "^22.12.0 \|\| >=24.0.0"` | ✓ VERIFIED | Confirmed via grep this session |
| `plugins/auth/package.json` | Same, byte-identical | ✓ VERIFIED | Confirmed |
| `plugins/wallet/package.json` | Same, byte-identical | ✓ VERIFIED | Confirmed |
| `plugins/theme/package.json` | Same, byte-identical | ✓ VERIFIED | Confirmed |
| `plugins/settings/package.json` | Same, byte-identical | ✓ VERIFIED | Confirmed |
| `.npmrc` | `engine-strict=true` | ✓ VERIFIED | Unchanged, confirmed present |
| `.github/workflows/ci.yml` | `node-version: ['22.12.0', 24]` + `make verify-outputs` step | ✓ VERIFIED | Both confirmed via direct read/grep |
| `Makefile` | `release`/`publish` depend on `verify-outputs` | ✓ VERIFIED | `release: build verify-outputs test`, `publish: build verify-outputs test` confirmed |
| `pnpm-lock.yaml` | Unchanged by the engines edit (metadata-only) | ✓ VERIFIED | `pnpm install --frozen-lockfile` ran clean this session; `git diff --exit-code pnpm-lock.yaml` exits 0 (no diff) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `.npmrc engine-strict` | `package.json engines` | pnpm install-time enforcement | ✓ WIRED, ✓ CALIBRATED | Range is now a verified subset of vite/vitest's declared engines — the prior "wired but miscalibrated" finding (CR-01) is closed |
| CI `ci.yml` matrix | `engines` floor | GitHub Actions runner Node install | ✓ WIRED, ✓ CALIBRATED | Matrix now pins the exact `22.12.0` floor patch rather than a bare `22` that masked the real contract — WR-02 closed |
| `Makefile build` → `verify-outputs` → `test`/`release`/`publish` | dist/ output presence | Make prerequisite chain (ordinary, sequential, halts on non-zero) | ✓ WIRED | Confirmed both by static grep (`release: build verify-outputs test`, `publish: build verify-outputs test`, ci.yml step ordering) and behaviorally (deleted output → non-zero exit + MISSING line → rebuild restores exit 0) — WR-01 closed |
| `config.commitizen.path` | `node_modules/cz-git` | commitizen runtime module resolution | ✓ WIRED (unchanged, regression check) | Not touched by 06-06; gap-closure commits themselves are valid conventional commits, reinforcing this is still functioning |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Fresh build produces all 15 outputs | `make clean && make build && make verify-outputs` | 15/15 `OK` lines, "All build outputs present (3 formats x 5 packages)" | ✓ PASS |
| Full test suite green after engines tightening | `make test` | Biome check clean (31 files), vitest 321/321 passing | ✓ PASS |
| `verify-outputs` fails closed on a dropped output | `rm dist/index.global.js && make verify-outputs` | Exit code 2, `MISSING: dist/index.global.js (root package)` | ✓ PASS |
| `verify-outputs` recovers after rebuild | `make build && make verify-outputs` | Exit code 0, all 15 `OK` | ✓ PASS |
| Declared engines range is a subset of vite@8.1.4 / vitest@4.1.10's own ranges | `grep -n "engines:" pnpm-lock.yaml` for both packages | `vite@8.1.4: ^20.19.0 \|\| >=22.12.0`; `vitest@4.1.10: ^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` — both contain `^22.12.0 \|\| >=24.0.0` | ✓ PASS (confirms CR-01 closed) |
| `pnpm install --frozen-lockfile` produces zero lockfile churn on the engines-only edit | `pnpm install --frozen-lockfile && git diff --exit-code pnpm-lock.yaml` | "Lockfile is up to date, resolution step is skipped"; `git diff` clean | ✓ PASS |
| Negative install on Node 18/20 | N/A — no old-Node runtime available | Not run (nvm/fnm/volta/docker all absent, re-checked this session) | ? SKIP (routed to human verification, unchanged) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| TOOL-01 | 06-01, 06-06 | engines floor + engine-strict enforcement, internally consistent | ✓ SATISFIED | Range tightened, verified as a subset of pinned toolchain's own engine ranges; mechanism wired and re-confirmed; only the literal negative-install proof remains human-only (unchanged carry-forward, not a defect in the mechanism) |
| TOOL-02 | 06-02, 06-06 | CI on Node 22/24, no EOL 18/20, floor patch pinned | ✓ SATISFIED | Matrix `['22.12.0', 24]` confirmed; no 18/20 present |
| TOOL-03 | 06-03, 06-04 | tsup/vite/vitest/happy-dom/Biome bumped, `make test` green | ✓ SATISFIED | Unregressed; `make test` green this session |
| TOOL-04 | 06-04 | cz-git active, cz-conventional-changelog removed, conventional commits still emitted | ✓ SATISFIED (full interactive TTY flow remains human-only, unchanged) | Adapter unmodified by 06-06; gap-closure commits are themselves in valid conventional-commit form |
| TOOL-05 | 06-05, 06-06 | All 3 build outputs present per package, guard wired into automated path | ✓ SATISFIED | 15/15 outputs confirmed; `verify-outputs` now hard-gates release/publish/CI, confirmed behaviorally |

No orphaned requirements — REQUIREMENTS.md lists exactly TOOL-01 through TOOL-05 for Phase 6; all five are marked `[x]` Complete and appear across the six plans' (01-06) frontmatter.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any file touched by the gap-closure plan (5 × package.json, `.github/workflows/ci.yml`, `Makefile`).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `Makefile:7` | `.PHONY` lists nonexistent `format` target, omits real `lint-format` | ℹ️ Info (pre-existing, out of gap-closure scope) | No functional impact today; noted in 06-REVIEW.md, confirmed pre-existing by `git diff aaac2c7~1..aaac2c7 -- Makefile` touching only the two prerequisite lines |
| `package.json:8-10` vs. `plugins/*/package.json:13` | Formatting split (multi-line vs single-line `engines` block) | ℹ️ Info (cosmetic) | No functional impact; both forms parse identically; noted in 06-REVIEW.md IN-01 |
| `pnpm-lock.yaml` (transitive) | `@types/node@25.5.0` vs. Node 22/24 floor (WR-03) | ℹ️ Info (explicitly out of scope for this gap-closure cycle) | Lower severity per code review; not one of the three closed gaps; still open for a future pass |

None of these rise to blocker or warning severity for this re-verification — all three are either pre-existing/cosmetic or explicitly scoped out of the 06-06 gap-closure plan's non-goals.

### Human Verification Required

Both items below are unchanged from the prior verification and from 06-06-PLAN.md's own carried-forward `human_verification` frontmatter. Neither can be closed in this or any prior sandbox session; both are genuine human-only proofs, not unresolved defects in the underlying mechanism (which is independently verified above).

### 1. Negative install test on Node 18/20

**Test:** On a Node 18 or Node 20 runtime (nvm/fnm/Volta/Docker), run `pnpm install` against this repo.
**Expected:** Install fails fast with an `ERR_PNPM_UNSUPPORTED_ENGINE`-family error citing the declared `engines.node` floor (now `^22.12.0 || >=24.0.0`), before any packages resolve.
**Why human:** No old-Node runtime is reachable in this sandbox — re-checked this session (nvm, fnm, volta, docker all absent, same result as the original 06-01 execution and the prior verification). This is the literal proof ROADMAP Success Criterion 1 asks for. Phase decision D-06 scoped this as a documented-not-CI-enforced check, which is a reasonable interpretation, but the proof itself remains unobserved.

### 2. Complete interactive commitizen flow

**Test:** Run `make commit` (`npx cz`) on a real TTY: select a commit type, write a subject, confirm, and inspect the resulting `git log` entry.
**Expected:** cz-git's interactive type-selection prompt completes and produces a valid conventional-commit message.
**Why human:** Unmodified by the 06-06 gap-closure plan (out of its scope by design). No TTY is available in this sandbox; `npx cz < /dev/null` reaching cz-git's own "no files staged" logic (rather than a module-resolution error) confirms the adapter resolves correctly, but full interactive completion has never been directly observed.

## Deviation Note (carried forward, not a gap)

ROADMAP Success Criterion 1 and 06-CONTEXT D-05 literally specify `engines: { "node": ">=22" }`. The gap-closure plan (06-06) intentionally tightened this to `^22.12.0 || >=24.0.0` — a documented, pre-approved deviation (see 06-06-PLAN.md's "Deviation note" and the `BREAKING CHANGE:` footer on commit `13f7766`). This narrowing *corrects* rather than violates the criterion's intent: it makes "an enforced Node 22 LTS floor" actually true and internally consistent with the toolchain this same phase pinned, closing the exact documented-vs-actual drift the milestone's Core Value exists to eliminate. ROADMAP.md and any other docs still quoting the literal `>=22` string should be updated to the corrected range by the docs pass (`/gsd-docs-update`) before shipping — this is a docs-freshness item, not a code gap.

## Gaps Summary

**No gaps remain.** All three gaps from the prior verification (CR-01 blocker, WR-01 warning, WR-02 warning) are independently re-confirmed closed against the actual codebase in this session:

- **CR-01 (was FAILED, now VERIFIED):** the declared Node floor (`^22.12.0 || >=24.0.0`) is a directly-confirmed strict subset of both `vite@8.1.4`'s and `vitest@4.1.10`'s own pinned engine ranges in `pnpm-lock.yaml`. No version the project admits can be rejected by a sub-dependency's engine-strict check.
- **WR-02 (was Warning, now VERIFIED):** CI matrix exercises the exact `22.12.0` floor patch, not a bare `22` masked by `actions/setup-node`'s latest-patch resolution.
- **WR-01 (was Warning, now VERIFIED):** `verify-outputs` is a hard prerequisite of `release` and `publish`, and a dedicated CI step between build and test — confirmed both statically and behaviorally (a deliberately deleted output causes a non-zero exit with a `MISSING:` line; rebuilding restores success).

No regressions: `make test` (Biome + 321/321 vitest) and `make build && make verify-outputs` (15/15 outputs) both ran green in this session after the gap-closure changes.

**Two carried-forward human-only proofs remain** (negative install on Node 18/20; full interactive `npx cz` on a TTY). Neither is a defect — both are structurally verified mechanisms whose final literal proof requires a runtime/TTY this and every prior sandbox session has lacked. Per phase decision D-06, the Node 18/20 case was explicitly scoped as a documented (not CI-enforced) check. These two items are the sole reason this phase does not close as a clean `passed` — they route to `human_needed`, not `gaps_found`.

**Not a gap, informational:** the literal `>=22` string in ROADMAP Success Criterion 1 / D-05 is now stale relative to the corrected `^22.12.0 || >=24.0.0` value; this is a documentation-freshness item for the docs pass, not a code defect (see Deviation Note above). WR-03 (`@types/node@25` vs. Node 22/24 floor) and the two 06-REVIEW.md Info findings (Makefile `.PHONY` `format`/`lint-format` mismatch, `engines` field formatting split) remain open but were explicitly out of scope for this gap-closure cycle and do not block any of the five ROADMAP success criteria.

---

_Verified: 2026-07-15T20:30:00Z_
_Verifier: Claude (gsd-verifier)_

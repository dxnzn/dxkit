---
phase: 07
slug: typescript-6-migration-standalone-typecheck
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-17
updated: 2026-07-17
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (unchanged by this phase) + `tsc --noEmit` (new typecheck surface) |
| **Config file** | `vitest.config.ts` (read-only reference); new `tsconfig.typecheck.json` ×5 |
| **Quick run command** | `npx vitest run` / per-package `tsc --noEmit -p tsconfig.typecheck.json` |
| **Full suite command** | `make typecheck && make test` |
| **Estimated runtime** | ~1–2 seconds (vitest ~1.1s; typecheck a few seconds cold) |

---

## Sampling Rate

- **After every task commit:** Run the worked package's `tsc --noEmit -p tsconfig.typecheck.json` plus `npx vitest run`
- **After every plan wave:** Run `make typecheck` (all 5 packages) + `make test` (full suite)
- **Before `/gsd-verify-work`:** `make build && make verify-outputs && make test` all green (mirrors CI `ci.yml`)
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01 | 01 | 1 | TS6-01, TS6-03 | — | N/A | typecheck | `make typecheck` (root) | ✅ | ✅ green |
| 07-02 | 02 | 1 | TS6-01, TS6-03 | — | N/A | typecheck | `make typecheck` (4 plugins) | ✅ | ✅ green |
| 07-03 | 03 | 2 | TS6-03 | — | N/A | integration | `make typecheck && make test` | ✅ | ✅ green |
| 07-04 | 04 | 3 | TS6-01, TS6-02 | — | N/A | typecheck | `make typecheck && make build && make verify-outputs && make test` | ✅ | ✅ green |
| 07-G1 | validate | — | TS6-02 (invariant guard) | — | no `ignoreDeprecations`/`baseUrl` shim; all 5 packages typechecked | unit | `npx vitest run tests/typecheck-config.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tsconfig.typecheck.json` (root) — standalone `tsc --noEmit` config, independent of tsup `dts:true`
- [x] `plugins/{auth,wallet,theme,settings}/tsconfig.typecheck.json` — per-package typecheck configs
- [x] `Makefile` `typecheck` target + `.PHONY` update + `test` / `test-watch` prerequisite wiring
- [x] Baseline fixes: `DeepPartial<T>` utility in `src/utils.ts` + the cataloged pre-existing test-only type errors (green *before* the TS6 version bump landed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| _None_ | — | — | — |

*All phase behaviors have automated verification. The former manual-only TS6-02 static grep was promoted to an automated regression guard (`tests/typecheck-config.test.ts`) during this validation pass — see the audit below.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-17

---

## Validation Audit 2026-07-17

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Gap (TS6-02):** The "no `ignoreDeprecations` shim" invariant — plus the related prohibitions (no `baseUrl` in typecheck configs; all 5 packages present in the typecheck loop) — was verified only by an execution-time grep, with no persistent regression guard. A future edit could reintroduce a shim, add `baseUrl` (TS5101), or silently drop a package from `PLUGIN_BUILD_ORDER` while `make typecheck`/`make test` stayed green.

**Resolution:** Added `tests/typecheck-config.test.ts` (34 assertions) as a persistent automated guard, wired into `make test`/CI. Typed via `tests/node-builtins.d.ts` (fresh ambient declarations) rather than `@types/node`, preserving the phase's deliberate no-new-devDependency posture. Verified: `make test` green (355 tests) with zero `@types/node`; the guard fails RED when `ignoreDeprecations` is injected. Committed in `6086964`.

---
phase: 07
slug: typescript-6-migration-standalone-typecheck
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-17
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
| _TBD — populated after plans exist_ | — | — | TS6-01/02/03 | — | N/A | typecheck | `make typecheck` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tsconfig.typecheck.json` (root) — standalone `tsc --noEmit` config, independent of tsup `dts:true`
- [ ] `plugins/{auth,wallet,theme,settings}/tsconfig.typecheck.json` — per-package typecheck configs
- [ ] `Makefile` `typecheck` target + `.PHONY` update + `test` / `test-watch` prerequisite wiring
- [ ] Baseline fixes: `DeepPartial<T>` utility in `src/utils.ts` + the ~15 cataloged pre-existing test-only type errors (must be green *before* the TS6 version bump lands)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No `ignoreDeprecations` shim remains | TS6-02 | Static-grep assertion, not a runtime test | `grep -rn "ignoreDeprecations" tsconfig.json plugins/*/tsconfig*.json` returns nothing |

*All other phase behaviors have automated verification via typecheck + vitest.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 4
slug: testing-stress-edge-case-regression-coverage
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-13
updated: 2026-07-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 + happy-dom 20.10.6 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run <changed test file>` |
| **Full suite command** | `make test` |
| **Estimated runtime** | ~30 seconds (312 tests across 12 files) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <changed test file>`
- **After every plan wave:** Run `make test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| mount-race fix + stress suite | 04-01 | 1 | TEST-01 | T-04-01-01..03 | last-navigation-wins; disabled dapp's in-flight mount abandoned | integration | `pnpm vitest run tests/stress.test.ts` | ✅ `tests/stress.test.ts` | ✅ green |
| manifest/route validation + WR-01 | 04-02 | 2 | TEST-02 | T-04-02-01..03 | invalid manifests rejected across all tiers; duplicate routes surfaced via `dx:error` | unit | `pnpm vitest run tests/shell.test.ts tests/router.test.ts` | ✅ `tests/shell.test.ts:426`, `tests/router.test.ts:151` | ✅ green |
| settings cleanup e2e + deepMerge lock | 04-03 | 1 | TEST-03, TEST-02 | T-04-03-01..02 | disabled dapp's handlers never fire; prototype-pollution keys rejected | integration + unit | `pnpm vitest run plugins/settings/tests/integration.test.ts tests/utils.test.ts` | ✅ both files | ✅ green |
| D-01 gap closure #1 (null-branch invalidation) | 04-04 | 1 | TEST-01 | T-04-04-01..02 | dapp→unmatched transition abandons in-flight mount | integration | `pnpm vitest run tests/stress.test.ts` | ✅ `tests/stress.test.ts:207` | ✅ green |
| D-01 gap closure #2 (finally clobber) | 04-05 | 1 | TEST-01 | T-04-05-01..03 | stale settle cannot clobber newer mount's pending slot | integration | `pnpm vitest run tests/stress.test.ts` | ✅ `tests/stress.test.ts:244` | ✅ green |
| D-01 gap closure #3 (dedupe liveness) | 04-06 | 1 | TEST-01 | T-04-06-01..03 | re-navigation to an invalidated dapp mounts fresh (not dropped by dedupe) | integration | `pnpm vitest run tests/stress.test.ts` | ✅ `tests/stress.test.ts:362,404` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Requirement coverage:**

| Requirement | Evidence | Status |
|-------------|----------|--------|
| TEST-01 | `tests/stress.test.ts` — 9 scenarios (rapid A→B→A, disable mid-mount, unmatched-route abandonment ×2, timeout-races-navigation, sub-path freshness, dedupe-liveness ×2, init-race) | COVERED |
| TEST-02 | `tests/shell.test.ts` `manifest & route validation (D-06/D-07/D-08)`, `tests/router.test.ts` `duplicate exact routes`, `tests/utils.test.ts` `deepMerge` (override + prototype-pollution semantics) | COVERED |
| TEST-03 | `plugins/settings/tests/integration.test.ts` full-shell `disableDapp()` cleanup regression (incl. no over-pruning of unrelated dapps) | COVERED |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — vitest + happy-dom are installed and running; new test files were added under `tests/` following existing conventions. No Wave 0 gaps remain.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Audit 2026-07-14

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All three requirements classified COVERED: tests exist, target the required behavior (not implementation details — each was proven load-bearing against pre-fix commits during execution), and run green (`make test`: 312/312, verified 2026-07-14). No auditor spawn required.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-07-14

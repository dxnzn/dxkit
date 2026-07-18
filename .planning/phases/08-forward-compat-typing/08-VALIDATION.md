---
phase: 08
slug: forward-compat-typing
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-17
updated: 2026-07-17
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (existing) + a second, separate vitest config for the smoke target |
| **Config file** | `vitest.config.ts` (existing, unmodified) + `vitest.smoke.config.ts` (new, D-04) |
| **Quick run command** | `make typecheck` |
| **Full suite command** | `make build && make smoke` |
| **Estimated runtime** | ~30–90 seconds (build dominates; typecheck alone ~10s) |

---

## Sampling Rate

- **After every task commit:** Run `make typecheck` (flags 1 & 3 land here; fast — no build needed for FCT-01/FCT-03; build needed only to observe FCT-02's `onSuccess` pass)
- **After every plan wave:** Run `make build && make smoke` (full artifact-level confirmation)
- **Before `/gsd-verify-work`:** `make smoke` must be green (FCT-04's explicit "required gate, not optional" per STATE.md Blockers/Concerns)
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | FCT-01 | — | N/A | config-guard + existing suite | `make typecheck && make build && make test` | ✅ `tests/typecheck-config.test.ts:233` (`verbatimModuleSyntax: true (FCT-01)`) | ✅ green |
| 08-01-02 | 01 | 1 | FCT-03 | — | N/A | config-guard + existing suite | `make typecheck && make build` | ✅ `tests/typecheck-config.test.ts:245` (`erasableSyntaxOnly: true (FCT-03)`) | ✅ green |
| 08-01-03 | 01 | 1 | FCT-02 | — | N/A | config-guard + build-time `.d.ts` emit gate | `make build` (per-package `onSuccess: tsc --emitDeclarationOnly`) | ✅ `tests/typecheck-config.test.ts:239` (`isolatedDeclarations: true (FCT-02)`) + build emit | ✅ green |
| 08-02-01 | 02 | 2 | FCT-04 | — | IIFE global attaches + CJS `require()` interop returns expected exports | new smoke test | `make smoke` | ✅ `smoke/dist-exports.smoke.test.ts` (11 tests) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tsconfig.json` flag-presence guard test (mirrors `tests/typecheck-config.test.ts`'s TS6-02 pattern) — covers FCT-01/FCT-02/FCT-03 as a durable regression guard (`describe('Forward-compat flag presence …')`, lines 228–248)
- [x] `smoke/` directory + `vitest.smoke.config.ts` + fixture file (`smoke/fixtures/expected-exports.ts`) — covers FCT-04 entirely; the phase's core new test infrastructure
- [x] `biome.json` `files.includes` extended to cover the new `smoke/` directory (`smoke/**/*.ts`) — new test files are linted
- [x] `Makefile` `smoke` target (`smoke: build`) + `.PHONY` update + CI wiring (`.github/workflows/ci.yml`, after `verify-outputs`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-17 — all 4 requirements (FCT-01..04) have automated verification; no manual-only gaps.

---

## Validation Audit 2026-07-17

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

State A audit of the executed phase. All Wave 0 test infrastructure was built during execution (plans 08-01, 08-02). Cross-referenced each requirement to its automated test and re-ran fresh: `tests/typecheck-config.test.ts` (47 passed, includes the FCT-01/02/03 flag-presence guard) and `smoke/dist-exports.smoke.test.ts` via `vitest.smoke.config.ts` (11 passed, FCT-04). No MISSING or PARTIAL requirements — phase is Nyquist-compliant.

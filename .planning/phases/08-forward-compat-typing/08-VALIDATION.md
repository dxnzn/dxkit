---
phase: 08
slug: forward-compat-typing
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-17
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
| 08-01-01 | 01 | 1 | FCT-01 | — | N/A | config-guard + existing suite | `make typecheck && make build && make test` | ❌ W0 (tsconfig flag-presence guard) | ⬜ pending |
| 08-01-02 | 01 | 1 | FCT-03 | — | N/A | config-guard + existing suite | `make typecheck && make build` | ❌ W0 (same guard test as FCT-01) | ⬜ pending |
| 08-01-03 | 01 | 1 | FCT-02 | — | N/A | build-time gate (fails loudly on `.d.ts` error) | `make build` (per-package `onSuccess: tsc --emitDeclarationOnly`) | ✅ existing mechanism | ⬜ pending |
| 08-02-01 | 02 | 2 | FCT-04 | — | IIFE global attaches + CJS `require()` interop returns expected exports | new smoke test | `make smoke` | ❌ W0 (entire deliverable of this phase) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tsconfig.json` flag-presence guard test (new, mirrors `tests/typecheck-config.test.ts`'s TS6-02 pattern) — covers FCT-01/FCT-03 as a durable regression guard, not just a one-time build-green check
- [ ] `smoke/` directory + `vitest.smoke.config.ts` + fixture file (`EXPECTED_EXPORTS` shape) — covers FCT-04 entirely; the phase's core new test infrastructure
- [ ] `biome.json` `files.includes` extended to cover the new `smoke/` directory (Pitfall 3) — required for the new test files to actually be linted
- [ ] `Makefile` `smoke` target + `.PHONY` update + CI wiring (`.github/workflows/ci.yml`, after `verify-outputs`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

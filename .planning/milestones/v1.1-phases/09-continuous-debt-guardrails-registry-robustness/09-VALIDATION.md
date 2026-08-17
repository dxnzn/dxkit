---
phase: 9
slug: continuous-debt-guardrails-registry-robustness
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-18
validated: 2026-07-18
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 09-RESEARCH.md § Validation Architecture. GATE-02 scope is
> **core-only** per revised D-08 (CONTEXT.md, commit dd28293).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 + happy-dom 20.10.6 |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run tests/shell.test.ts` |
| **Full suite command** | `make test` (lint → typecheck → vitest) |
| **Estimated runtime** | ~15 seconds (unit); CI wiring gates verified by `make typecheck` / `make <dep-check>` |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/shell.test.ts` (ROB-05) or the specific new Makefile target (GATE-01/GATE-02)
- **After every plan wave:** Run `make test` + the new gate targets as standalone invocations (mirroring how CI calls them)
- **Before `/gsd-verify-work`:** `make build && make verify-outputs && make smoke && make test && make <dep-check>` all green; plus a manual read of `renovate.json` against the live Renovate schema
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01 | 09-01 | 1 | GATE-01 | T-09 V14 | build fails loudly on tsc/deprecation error, scoped to project-owned paths | integration (CI/Makefile guard) | `make typecheck` + `vitest run tests/typecheck-config.test.ts` (`GATE-01 CI deprecation gate wiring`) | ✅ `tests/typecheck-config.test.ts` | ✅ green |
| 09-02 | 09-02 | 2 | GATE-02 | T-09 V10 | core package.json declaring an external runtime dep fails the build | unit + integration | `make verify-no-runtime-deps` + `vitest run tests/check-no-runtime-deps.test.ts` (11 specs: `checkNoRuntimeDeps` + `GATE-02 wiring`) | ✅ `tests/check-no-runtime-deps.test.ts` | ✅ green |
| 09-03 | 09-03 | 1 | GATE-03 | T-09 V10 | release-age gate + blocked toolchain-major automerge | config validation (automated invariants + external manual) | `vitest run tests/renovate-config.test.ts` (10 specs) | ✅ `tests/renovate-config.test.ts` | ✅ green |
| 09-04 | 09-04 | 1 | ROB-05 | T-09 V5 | wrong-shape 200 → dx:error, no throw, init() completes | unit (vitest) | `vitest run tests/shell.test.ts -t "ROB-05"` (4 dedicated specs) | ✅ `tests/shell.test.ts` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Coverage note (from 09-REVIEW.md WR-01):** the `GATE-01 CI deprecation gate wiring`
> block contains one redundant `||`-vacuous assertion; the requirement behavior is still
> covered by the adjacent `stepBlockMatch` assertion and by `make typecheck` exiting 0.
> GATE-01 is COVERED; the dead assertion is a quality follow-up, not a coverage gap.

---

## Wave 0 Requirements

- [x] `tests/shell.test.ts` — ROB-05 regression tests: (a) explicit `registryUrl` + 200 non-array body → `dx:error` (`shell:manifest`), no throw, `getManifests()` empty; (b) same wrong-shape-200 with `registryUrl` omitted (default probe) → `dx:error` still fires (proves D-10 ungated); (c) `shell.init()` resolves and `window.__DXKIT__` is defined after; plus a happy-path array pass-through — **all 4 green**
- [x] GATE-02 dep-check script (`scripts/check-no-runtime-deps.cjs`) + fixture-based unit tests proving it passes on the zero-dep root package.json and fails on external `dependencies`/`peerDependencies`/`optionalDependencies` — **11 specs green**
- [x] `tests/typecheck-config.test.ts` GATE-01 wiring guard + `tests/check-no-runtime-deps.test.ts` GATE-02 wiring guard assert the named CI steps and Makefile targets exist — **green**
- [x] No new test framework/config needed — `vitest.config.ts` + existing `tests/` covered the testable surface

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Renovate actually opens/gates PRs | GATE-03 | Renovate runs externally on Mend infra, only after the operator installs the Mend GitHub App | Validate `renovate.json` against `https://docs.renovatebot.com/renovate-schema.json` (or `npx renovate-config-validator`); confirm app-install as a recorded operator next-step |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none remained — all requirements COVERED)
- [x] No watch-mode flags (`vitest run` one-shot; `make` targets one-shot)
- [x] Feedback latency < 20s (targeted 4-file run ~0.6s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-18

---

## Validation Audit 2026-07-18

| Metric | Count |
|--------|-------|
| Requirements audited | 4 (GATE-01, GATE-02, GATE-03, ROB-05) |
| COVERED | 4 |
| PARTIAL | 0 |
| MISSING | 0 |
| Gaps found | 0 |
| Resolved (tests generated) | 0 (no gaps — all delivered under execution) |
| Escalated to manual-only | 0 (GATE-03 external PR-opening already recorded as manual-only) |

**State A audit — no auditor spawn required.** All four requirements were verified COVERED
by direct execution: `vitest run` over the 4 requirement test files → 147/147 green; `make
typecheck` → exit 0; `make verify-no-runtime-deps` → exit 0. GATE-03's automated surface
(config invariants) is covered by `tests/renovate-config.test.ts`; its runtime PR-opening
behavior remains legitimately manual-only (external Mend infra) and was already documented.
One quality follow-up carried from 09-REVIEW.md WR-01 (redundant assertion in the GATE-01
wiring test) — does not affect coverage.

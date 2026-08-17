---
phase: 10
slug: close-gap-cr-01-guard-dapps-inline-manifests-tiers
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (`environment: 'happy-dom'`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/shell.test.ts` |
| **Full suite command** | `make test` (lint → typecheck → `npx vitest run`) |
| **Estimated runtime** | ~10 seconds (single-file quick run); full suite ~30s |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/shell.test.ts`
- **After every plan wave:** Run `make test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-XX | 01 | 1 | ROB-06 | T-10-01 (client-side DoS on malformed config) | Wrong-shape `dapps`/`manifests` emits `dx:error` (source `shell:manifest`), `init()` resolves, `window.__DXKIT__` still exposed | unit | `npx vitest run tests/shell.test.ts` | ✅ existing file, add cases | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · Task IDs finalized by the planner.*

---

## Wave 0 Requirements

- [ ] New `it(...)` cases in `tests/shell.test.ts` for `dapps: <non-array>` — both failure modes: truthy-`.length` throw-today (e.g. a string) and falsy-`.length` silent-fallthrough-today (e.g. a plain object).
- [ ] New `it(...)` cases for `manifests: <non-array>` — both failure modes: non-iterable throw-today (plain object) and iterates-as-string-today (a string → must emit exactly one shape error, not N per-character validation errors).
- [ ] New `it(...)` case asserting `window.__DXKIT__` is still defined after `init()` for every wrong-shape case (pre-exposure ordering — mirrors the existing ROB-05 line-532 test).
- [ ] New `it(...)` case asserting `manifests: []` does not trigger a `fetch()` to `registryUrl` (closes the Pitfall 3 coverage gap — not asserted today even for current behavior).
- [ ] No new fixtures/mocks needed — `testLoaders`, `onDxError()`, and the `window.fetch` mock pattern already used in `tests/shell.test.ts` cover every new case.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | All phase behaviors have automated vitest verification. |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

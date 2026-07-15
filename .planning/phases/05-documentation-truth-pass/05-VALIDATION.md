---
phase: 05
slug: documentation-truth-pass
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 + happy-dom |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `make test` (lint + vitest) |
| **Full suite command** | `make test` |
| **Estimated runtime** | ~10-30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `make test`
- **After every plan wave:** Run `make test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> The planner populates this table from PLAN.md tasks. The three folded code fixes
> (D-15, D-16, D-17) carry regression tests and are automated. The doc-by-doc sweep
> is validated by the drift-log artifact (D-01) + compile-checked snippets (D-04);
> most doc edits are manual verifications (see below).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner fills) | — | — | DOC-01 | — | N/A | — | `make test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing vitest infrastructure covers all folded-fix regression tests (D-15/D-16/D-17 extend `tests/shell.test.ts`, `tests/router.test.ts`, `tests/lifecycle.test.ts`). No new framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Doc claims match 0.2.0 code truth | DOC-01 | Prose verification against source — not machine-assertable | Doc-by-doc sweep producing the drift-log artifact (D-01); each claim traced to source |
| No AI slop / filler remains | DOC-02 | Editorial judgment against the ruthless bar (D-13) | Read each doc against the slop bar; every sentence must earn its place |
| CSP guidance + limitations note correct | DOC-03 | Reasoned against loaders, not browser-enforced (D-09) | Verify `docs/security.md` CSP directives against `src/lifecycle.ts` loader behavior |
| TypeScript doc snippets compile | DOC-01 | Throwaway scratch harness, not committed CI (D-04) | Extract/mirror TS snippets into scratch harness, type-check against real 0.2.0 types |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or documented manual-verification rationale
- [ ] Folded code fixes (D-15/D-16/D-17) carry regression tests
- [ ] Wave 0 covers all MISSING references (none — existing infra suffices)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

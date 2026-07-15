---
phase: 6
slug: toolchain-audit-modernization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x → latest (bumped this phase) + happy-dom |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `make test` (biome check + vitest run) |
| **Full suite command** | `make build && make test` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `make test`
- **After every plan wave:** Run `make build && make test`
- **Before `/gsd-verify-work`:** Full suite must be green on Node 22
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner populates during PLAN.md creation)_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Build-output presence check (TOOL-05) — verify `dist/index.js`, `dist/index.cjs`, `dist/index.global.js` per package (`test -f` shape from RESEARCH.md). No existing script covers this.

*Existing vitest infrastructure covers all functional test requirements; toolchain bumps are verified via `make test` green.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| engine-strict install failure on Node 18/20 | TOOL-01/TOOL-02 | D-06 scopes this to engine-strict config + documented expected failure, NOT a CI negative-install job | Documented steps in migration note; capture verbatim `ERR_PNPM_UNSUPPORTED_ENGINE` text during implementation |
| commitizen flow emits conventional commits via cz-git | TOOL-04 | Interactive commit prompt | Run `pnpm cz` (or configured commit script), confirm output is a valid conventional commit |

*Remaining phase behaviors have automated verification via `make test` / `make build`.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

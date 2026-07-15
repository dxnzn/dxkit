---
phase: 6
slug: toolchain-audit-modernization
status: draft
nyquist_compliant: true
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
| 06-01 T1 | 01 | 1 | TOOL-01 | T-06-01-01 | engine-strict + engines >=22 across 5 pkgs | config presence | `grep engine-strict=true .npmrc && count 5 pkgs with node>=22` | ✅ created this plan | ⬜ pending |
| 06-01 T2 | 01 | 1 | TOOL-01 | T-06-01-02 | old-Node install fails fast (documented, D-06) | manual/documented | `grep` presence (auto) + human-check old-Node `pnpm install` | N/A (doc step) | ⬜ pending |
| 06-02 T1 | 02 | 1 | TOOL-02 | T-06-02-01 | CI matrix on 22/24, no EOL 18/20 | CI config check | `grep node-version [22,24] && ! grep 18/20` | ✅ ci.yml exists | ⬜ pending |
| 06-03 T1 | 03 | 2 | TOOL-03 | T-06-03-SC | tsup bump, emit + suite green | integration (existing) | `make build && make test` | ✅ existing suite | ⬜ pending |
| 06-03 T2 | 03 | 2 | TOOL-03 | T-06-03-SC | vite 7→8 isolated, suite green, no config-shape edit | integration (existing) | `make test && grep-guard vitest.config.ts` | ✅ existing suite | ⬜ pending |
| 06-03 T3 | 03 | 2 | TOOL-03 | T-06-03-01 | vitest bump, happy-dom latest, suite green | integration (existing) | `make test` | ✅ existing suite | ⬜ pending |
| 06-04 T1 | 04 | 3 | TOOL-03 | T-06-04-01 | Biome bump + $schema lockstep, lint/test green | integration (existing) | `make lint && make test` | ✅ existing suite | ⬜ pending |
| 06-04 T2 | 04 | 3 | TOOL-04 | T-06-04-SC | cz-git active adapter, conventional-commit flow | manual + config check | `grep cz-git path && ! grep old adapter && make test` + human-check `npx cz` | N/A (interactive) | ⬜ pending |
| 06-05 T1 | 05 | 4 | TOOL-05 | T-06-05-02 | verify-outputs target asserts 3 formats × 5 pkgs | build-output existence (Wave 0) | `make clean && make build && make verify-outputs` | ⬜ created this plan (Wave 0 gap) | ⬜ pending |
| 06-05 T2 | 05 | 4 | TOOL-05 | T-06-05-01 | full phase gate green, 15 outputs present | build-output existence + suite | `make build && make test && make verify-outputs` | ✅ after T1 | ⬜ pending |

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

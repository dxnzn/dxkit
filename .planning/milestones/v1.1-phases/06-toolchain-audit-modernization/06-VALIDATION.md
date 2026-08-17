---
phase: 6
slug: toolchain-audit-modernization
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-15
validated: 2026-07-17
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
| 06-01 T1 | 01 | 1 | TOOL-01 | T-06-01-01 | engine-strict + engines floor across 5 pkgs | config presence | `grep engine-strict=true .npmrc && count 5 pkgs with node floor` | ✅ | ✅ green |
| 06-01 T2 | 01 | 1 | TOOL-01 | T-06-01-02 | old-Node install fails fast (documented, D-06) | manual/documented | `grep` presence (auto) + human-check old-Node `pnpm install` | N/A (doc step) | ✅ verified (UAT-1) |
| 06-02 T1 | 02 | 1 | TOOL-02 | T-06-02-01 | CI matrix on 22/24, no EOL 18/20 | CI config check | `grep node-version && ! grep 18/20` | ✅ ci.yml | ✅ green |
| 06-03 T1 | 03 | 2 | TOOL-03 | T-06-03-SC | tsup bump, emit + suite green | integration (existing) | `make build && make test` | ✅ existing suite | ✅ green |
| 06-03 T2 | 03 | 2 | TOOL-03 | T-06-03-SC | vite 7→8 isolated, suite green, no config-shape edit | integration (existing) | `make test && grep-guard vitest.config.ts` | ✅ existing suite | ✅ green |
| 06-03 T3 | 03 | 2 | TOOL-03 | T-06-03-01 | vitest bump, happy-dom latest, suite green | integration (existing) | `make test` | ✅ existing suite | ✅ green |
| 06-04 T1 | 04 | 3 | TOOL-03 | T-06-04-01 | Biome bump + $schema lockstep, lint/test green | integration (existing) | `make lint && make test` | ✅ existing suite | ✅ green |
| 06-04 T2 | 04 | 3 | TOOL-04 | T-06-04-SC | cz-git active adapter, conventional-commit flow | manual + config check | `grep cz-git path && ! grep old adapter && make test` + human-check `npx cz` | N/A (interactive) | ✅ verified (UAT-2) |
| 06-05 T1 | 05 | 4 | TOOL-05 | T-06-05-02 | verify-outputs target asserts 3 formats × 5 pkgs | build-output existence (Wave 0) | `make clean && make build && make verify-outputs` | ✅ Makefile | ✅ green |
| 06-05 T2 | 05 | 4 | TOOL-05 | T-06-05-01 | full phase gate green, 15 outputs present | build-output existence + suite | `make build && make test && make verify-outputs` | ✅ | ✅ green |
| 06-06 T1 | 06 | 5 | TOOL-01 | T-06-01-02 | engines tightened to `^22.12.0 \|\| >=24.0.0` across 5 pkgs (CR-01) | config presence | `grep -Fc '^22.12.0 \|\| >=24.0.0' … == 5 && ! grep '">=22"' && pnpm install --frozen-lockfile` | ✅ 5 pkgs | ✅ green |
| 06-06 T2 | 06 | 5 | TOOL-02 | T-06-CI | CI pins exact-floor `22.12.0` leg (WR-02) | CI config check | `grep "'22.12.0'" .github/workflows/ci.yml` (ordering + cache preserved) | ✅ ci.yml | ✅ green |
| 06-06 T3 | 06 | 5 | TOOL-05 | T-06-CI | `verify-outputs` wired into release/publish/CI (WR-01) | build-output gate wiring | `grep 'verify-outputs' Makefile release/publish + ci.yml step`; deletion → non-zero (spot-checked) | ✅ Makefile+ci.yml | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ✅ verified (manual, evidence in UAT)*

---

## Wave 0 Requirements

- [x] Build-output presence check (TOOL-05) — `make verify-outputs` verifies `dist/index.js`, `dist/index.cjs`, `dist/index.global.js` per package (15 checks). Added in 06-05, wired into release/publish/CI in 06-06, and behaviorally spot-checked (deleting an output → non-zero exit).

*Existing vitest infrastructure covers all functional test requirements; toolchain bumps are verified via `make test` green (321 specs this session).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Result |
|----------|-------------|------------|-------------------|--------|
| engine-strict install failure on old Node | TOOL-01/TOOL-02 | D-06 scopes this to engine-strict config + documented expected failure, NOT a CI negative-install job (no old-Node runtime in sandbox) | Run `pnpm install` on Node 18/20; expect `ERR_PNPM_UNSUPPORTED_ENGINE` naming the required floor | ✅ PASS (UAT-1, 2026-07-17) — Node v20.20.2 aborted with `ERR_PNPM_UNSUPPORTED_ENGINE`, `Expected version: ^22.12.0 \|\| >=24.0.0` |
| commitizen flow emits conventional commits via cz-git | TOOL-04 | Interactive commit prompt (no TTY in sandbox) | Run `make commit` (`npx cz`), complete the prompt, confirm `git log` shows a conventional commit | ✅ PASS (UAT-2, 2026-07-17) — interactive flow completed and produced a valid conventional commit |

*Both manual-only items are now verified with evidence in `06-UAT.md`. Remaining phase behaviors have automated verification via `make test` / `make build` / `make verify-outputs`.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (build-output check landed + wired)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-07-17

---

## Validation Audit 2026-07-17

| Metric | Count |
|--------|-------|
| Requirements audited | 5 (TOOL-01…05) |
| Automated-covered | 5 |
| MISSING (new tests generated) | 0 |
| Manual-only (evidence in UAT) | 2 |
| Escalated to impl bug | 0 |

**Verdict:** Nyquist-compliant. Every requirement has automated verification via `make test` / `make build` / `make verify-outputs` or grep-verifiable config presence; the two inherently-manual behaviors (old-Node negative install, interactive `cz`) are documented manual-only and both PASSED in `06-UAT.md`. No test-generation gaps — the phase modifies build/CI configuration, not application behavior, so no new vitest specs were warranted. CI coverage improved during gap closure (06-06): the exact floor `22.12.0` is now exercised, and `verify-outputs` runs automatically in release/publish/CI.

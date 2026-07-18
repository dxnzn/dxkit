---
phase: 9
slug: continuous-debt-guardrails-registry-robustness
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-18
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
| _(planner fills per task)_ | | | GATE-01 | T-09 V14 | build fails loudly on tsc/deprecation error, scoped to project-owned paths | integration (CI/Makefile guard) | `make typecheck` + guard test | ❌ W0 | ⬜ pending |
| _(planner fills per task)_ | | | GATE-02 | T-09 V10 | core package.json declaring an external runtime dep fails the build | unit + integration | new dep-check target + fixture test | ❌ W0 | ⬜ pending |
| _(planner fills per task)_ | | | GATE-03 | T-09 V10 | release-age gate + blocked toolchain-major automerge | config validation (external) | `npx renovate-config-validator renovate.json` (manual) | ❌ N/A | ⬜ pending |
| _(planner fills per task)_ | | | ROB-05 | T-09 V5 | wrong-shape 200 → dx:error, no throw, init() completes | unit (vitest) | `npx vitest run tests/shell.test.ts -t "registry"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/shell.test.ts` — ROB-05 regression test(s): (a) explicit `registryUrl` + 200 non-array body → `dx:error` (`shell:manifest`), no throw, `getManifests()` empty; (b) **critically** the same wrong-shape-200 with `registryUrl` omitted (default probe) → `dx:error` still fires (proves D-10 ungated, distinct from the silent-404-on-default-probe test); (c) `shell.init()` resolves and `window.__DXKIT__` is defined after
- [ ] GATE-02 dep-check script + a fixture-based unit test proving it passes on the current core package.json (zero deps) and fails when the core declares an external (non-`workspace:`) runtime dep
- [ ] (Optional) `typecheck-config.test.ts`-style guard test asserting the new Makefile target(s) exist and are invoked as named steps in `ci.yml`
- [ ] No new test framework/config needed — `vitest.config.ts` + existing `tests/` cover the testable surface

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Renovate actually opens/gates PRs | GATE-03 | Renovate runs externally on Mend infra, only after the operator installs the Mend GitHub App | Validate `renovate.json` against `https://docs.renovatebot.com/renovate-schema.json` (or `npx renovate-config-validator`); confirm app-install as a recorded operator next-step |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

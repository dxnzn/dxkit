---
phase: 06
slug: toolchain-audit-modernization
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-16
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Scope note:** Phase 6 is a toolchain/build-config modernization — it touches only
`package.json` manifests, `.npmrc`, `.github/workflows/ci.yml`, `biome.json`, and the
`Makefile`, plus devDependency version bumps. There is **no runtime code, no network or
auth surface, and no new runtime dependency** (zero-runtime-dep posture preserved). The
only meaningful security surface is supply-chain (what enters the repo at install time)
and install/CI gate integrity. Register authored at plan time across all six plans;
ASVS L1 grep-depth verification is sufficient for this surface.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| runtime env → `pnpm install` | Node version of the executing environment crosses into the install gate; `engine-strict` decides pass/fail | Node version string vs. `engines.node` |
| npm registry → local devDependencies | Bumped/added package tarballs (tsup, vite, vitest, happy-dom, Biome, cz-git) cross into the repo at install time | Package tarballs + lockfile resolutions |
| CI config → GitHub Actions runner | Workflow YAML controls which Node runtimes execute build/test | Matrix values, pinned action refs |
| commitizen runtime → `config.commitizen.path` | commitizen loads the adapter module by resolved path at commit time | Adapter module resolution |
| build tooling → `dist/` artifacts | tsup emit is the source of the files `verify-outputs` checks for existence | Emitted build artifacts |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01-01 | Tampering | `.npmrc` / `engines` fields | low | mitigate | pnpm-native `engine-strict` gate (not a custom preinstall script); five lockstep `engines.node` strings — verified byte-identical `^22.12.0 \|\| >=24.0.0` via grep this session | closed |
| T-06-01-02 | Denial of Service | Node range blocking legitimate contributors | low | accept | Range tightened to `^22.12.0 \|\| >=24.0.0` (CR-01 fix) — now matches the pinned vite/vitest support exactly; documented as a BREAKING CHANGE with migration note | closed (accepted) |
| T-06-02-01 | Tampering | `ci.yml` step ordering | low | mitigate | Only matrix values changed; pinned action refs (`@v4`) and `pnpm/action-setup`→`setup-node` ordering + `cache: pnpm` preserved — verified this session | closed |
| T-06-02-02 | Denial of Service | CI green on an unsupported Node | low | accept | Matrix `['22.12.0', 24]` now exercises the exact declared floor (WR-02 fix); `--frozen-lockfile` install unchanged | closed (accepted) |
| T-06-03-SC | Tampering | npm bumps (tsup/vite/vitest/happy-dom) | medium | mitigate | RESEARCH Package Legitimacy Audit cleared all as established, high-download, no postinstall scripts; per-tool `make test` gate (D-02); caret ranges + committed lockfile keep resolution intentional; `make test` green (321/321) this session | closed |
| T-06-03-01 | Tampering | `pnpm-lock.yaml` drift in CI | low | mitigate | CI uses `--frozen-lockfile` (unchanged); lockfile updates committed intentionally per bump, never silently regenerated | closed |
| T-06-04-SC | Tampering | new devDependency `cz-git` (typosquat / supply chain) | medium | mitigate | Legitimacy Audit OK — canonical repo (github.com/Zhengqbbb/cz-git), ~64k weekly downloads, no postinstall; stays a devDependency (zero runtime-dep posture preserved) | closed |
| T-06-04-01 | Tampering | Biome bump postinstall / provenance | low | mitigate | Established official tooling, no postinstall; `make lint`/`make test` gate blocks a bad bump before commit | closed |
| T-06-04-02 | Denial of Service | broken commit flow after adapter swap | low | mitigate | `pnpm install` after remove+add; full interactive `npx cz` flow completed on a real TTY (UAT Test 2, pass) — adapter resolves AND produces a valid conventional commit | closed |
| T-06-05-01 | Spoofing | stale `dist/` masking a broken emit | low | mitigate | Phase gate runs `make clean` before `make build` so the check verifies freshly-emitted artifacts | closed |
| T-06-05-02 | Tampering | `verify-outputs` false-green (weak check) | low | mitigate | Explicit `test -f` per format per package with fail-on-missing; now wired into release/publish/CI (WR-01 fix) and behaviorally spot-checked (deleting an output → non-zero exit) | closed |
| T-06-SC | Tampering | npm/pnpm installs (gap-closure) | low | accept | No new dependencies introduced — engines metadata edit only; `git diff --exit-code pnpm-lock.yaml` asserts zero lockfile churn (verified) | closed (accepted) |
| T-06-CI | Tampering | `ci.yml`, `Makefile` (gap-closure) | low | mitigate | Small reviewed config diffs (matrix leg value + one run step + two prerequisite edges); step ordering + pnpm cache asserted preserved; confirmed by code review (0 critical) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-01-02 | Narrowing the declared Node floor to `^22.12.0 \|\| >=24.0.0` intentionally excludes Node 22.0–22.11 and 23.x — this is correct (the pinned toolchain rejects them) and documented as a BREAKING CHANGE with migration note. | Denizen. | 2026-07-16 |
| AR-06-02 | T-06-02-02 | Residual: CI cannot *machine-prove* the old-floor negative install (Node 18/20 not in matrix); scoped as a documented check per decision D-06 and confirmed manually (UAT Test 1, pass on Node 20.20.2). | Denizen. | 2026-07-16 |
| AR-06-03 | T-06-SC | Gap-closure edits `engines` metadata only; no new packages, zero lockfile churn asserted — no install/audit checkpoint required. | Denizen. | 2026-07-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-16 | 13 | 13 | 0 | Claude (gsd-secure-phase, ASVS L1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-16

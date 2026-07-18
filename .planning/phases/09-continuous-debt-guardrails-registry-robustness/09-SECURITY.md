---
phase: 9
slug: continuous-debt-guardrails-registry-robustness
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-18
---

# Phase 9 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 4 plans carry a `<threat_model>` block); verified
> at ASVS L1 (grep-depth mitigation confirmation) — sufficient for this phase's threat set.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| contributor commit → CI | untrusted source changes cross into the build; a type/deprecation regression must fail loudly | TypeScript source (`src/`, `tests/`, `plugins/*/src/`) |
| automated dep bump / contributor → published core package | an added external runtime dep would expand DxKit's supply-chain surface for downstream consumers | `@dnzn/dxkit` package.json dependency fields |
| npm registry → toolchain deps → build | a freshly-published or compromised version could be pulled before the community flags it | devDependency version ranges |
| Mend Renovate App → repo (external) | hosted app opens PRs; automerge policy governs which land unattended | dependency-update PRs |
| remote registry.json → shell.init() | untrusted network JSON crosses into the shell's init sequence before `window.__DXKIT__` is exposed | fetched `registry.json` 200 body (untrusted) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Tampering | CI type/deprecation gate (V14 Configuration) | low | mitigate | Named blocking CI step `Typecheck / deprecation gate (GATE-01)` runs `make typecheck` (`ci.yml:26-27`); scope pinned to `src`/`tests` via `tsconfig.typecheck.json:14` `include` so node_modules noise never causes unfixable-red | closed |
| T-09-02 | Tampering | Core package runtime deps (V10 Supply Chain) | medium | mitigate | `scripts/check-no-runtime-deps.cjs` fails the build if root `@dnzn/dxkit` declares any external runtime-visible dep; wired as named CI step `Zero-runtime-dependency assertion (GATE-02)` (`ci.yml:28-29`), `make verify-no-runtime-deps` target, and a `release`/`publish` prerequisite (`Makefile:64,71,97`) | closed |
| T-09-SC | Tampering | npm/pip/cargo installs | high | accept | No package-manager install tasks in this phase (P4 forbids new deps; RESEARCH Package Legitimacy Gate = N/A). No repo-side install surface to gate — see Accepted Risks Log | closed |
| T-09-03 | Tampering | Toolchain dependency updates (V10 Supply Chain) | medium | mitigate | `renovate.json:4` `minimumReleaseAge: "3 days"` filters yanked/compromised fresh releases; toolchain group forces `automerge: false` on majors for tsup/vite/vitest/happy-dom/@biomejs/biome/typescript (D-02); CI (typecheck + smoke + tests) gates the automerged non-major tier | closed |
| T-09-05 | Denial of Service | loadManifests() registry parse (V5 Input Validation) | medium | mitigate | `src/shell.ts:275` `Array.isArray()` guard on the parsed 200 body; fail-closes to `[]` + a visible ungated `dx:error` (source `shell:manifest`), so a malformed/attacker-influenced registry can never throw an uncaught `TypeError` that prevents `window.__DXKIT__` exposure | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-09-01 | T-09-SC | Phase 9 installs zero packages — all four plans add only source/config/CI wiring, and project constraint P4 forbids new runtime deps. `renovate.json` is consumed by an external hosted app, not by a repo-side install step. There is no install surface in this phase to gate, so the (otherwise high) supply-chain install threat has no attack surface here. | Denizen. | 2026-07-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-18 | 5 | 5 | 0 | Claude (secure-phase, ASVS L1 short-circuit — register authored at plan time, grep-depth mitigation verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-18

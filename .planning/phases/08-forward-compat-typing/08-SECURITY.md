---
phase: 08
slug: forward-compat-typing
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-17
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| build toolchain → tsconfig | Compiler flags only; no runtime input surface, no network, no user data. | None (compile-time config) |
| built dist/ artifact → vm.runInContext | Smoke test executes this repo's own freshly-built dist/ JS in a shared V8 context. Trusted content only — same trust level as running the project's own compiled code. | Repo-local bundle source (trusted) |
| repo filesystem → smoke test path resolution | dist/ paths resolved deterministically from the repo root (`process.cwd()`), never from an env var or CLI argument. | Deterministic file paths (no external input) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01 | Tampering | tsconfig.json compiler flags | low | mitigate | Flag-presence guard test (`tests/typecheck-config.test.ts:228-248`, `Forward-compat flag presence` block) makes a silent flag removal / reintroduced suppression shim fail `make test`. Verified present. | closed |
| T-08-02 | Tampering | smoke test dist/ path resolution | medium | mitigate | dist/ paths resolved via `resolve(process.cwd(), pkg.cjsPath/iifePath)` — repo-relative, never env/CLI (`smoke/dist-exports.smoke.test.ts:59,72,91` + comment L13); `make smoke` runs `build` first (`Makefile:109 smoke: build`) so the artifact is never stale. Verified present. | closed |
| T-08-03 | Information Disclosure / Tampering | vm.runInContext executing bundle source | low | mitigate | `vm.runInContext` reads only hardcoded repo-local dist/ paths via `readFileSync` (`smoke/dist-exports.smoke.test.ts:73-76`); never points at external/untrusted script content — no http/fetch/env-driven source. Documented by inline comment L74-76. Verified present. | closed |
| T-08-SC | Tampering | npm/pnpm installs (supply chain) | low | accept | Zero new packages introduced — happy-dom/vitest/typescript are existing devDependencies; node:vm/node:module/node:fs/node:path are Node builtins. Research Package Legitimacy Audit = n/a; no [ASSUMED]/[SUS] packages. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-SC | Phase installs zero new packages; all tooling is pre-existing devDependencies or Node builtins. No new supply-chain surface introduced. | Denizen. | 2026-07-17 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-17 | 4 | 4 | 0 | gsd-secure-phase (L1 grep-depth; register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-17

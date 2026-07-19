---
phase: 10
slug: close-gap-cr-01-guard-dapps-inline-manifests-tiers
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-19
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| developer config → shell | Untyped `dapps`/`manifests` values from IIFE/static-HTML consumers cross into `loadManifests()` with no compile-time type enforcement. | Developer-supplied config values (expected: arrays) |
| fetched registry.json → shell | External JSON body crosses into `loadManifests()` (already guarded by ROB-05; this phase routes it through the shared helper). | Fetched JSON body (expected: array) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | Denial of Service | `loadManifests()` `dapps`/`manifests`/registry tiers in `src/shell.ts` | low | mitigate | `coerceManifestArray()` (`src/shell.ts:199`) performs a fail-closed-and-visible `Array.isArray()` precondition check before any iteration. A malformed developer-supplied config or fetched JSON emits an observable `dx:error` (source `shell:manifest`) and continues with a safe empty default (`coerced === null` → `[]`, 3 call sites) instead of throwing an uncaught `TypeError` that would prevent `window.__DXKIT__` from ever being exposed. ASVS V5 (Input Validation). | closed — below `high` threshold (non-blocking) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Verification (ASVS L1, grep-depth — plan-time register, no open threats at/above block threshold):**
- `coerceManifestArray<T>(value, messagePrefix): T[] | null` present at `src/shell.ts:199` — single emission point.
- All three `loadManifests()` tiers route through the helper (4 `coerceManifestArray<` references: 1 definition + 3 tier call sites); ROB-05's old inline `Array.isArray(parsed)` block removed (0 occurrences).
- Fail-closed control present at all 3 tiers (`coerced === null` → `return []`, 3 occurrences); never branches on `.length`.
- Observable failure: `events.emit('dx:error', { source: 'shell:manifest', … })` inside the helper.
- Behavioral proof: 7 `ROB-06:` regression tests in `tests/shell.test.ts` assert every wrong-shape case (`dapps`/`manifests` as string, plain object; string emits exactly one error) emits `dx:error` and resolves `init()` without throwing, with `window.__DXKIT__` still exposed. Full suite green (411 tests).

No package-manager installs occurred this phase (zero new dependencies), so no supply-chain (`T-10-SC`) threat or legitimacy checkpoint applies.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks. (T-10-01 is mitigated and closed, not an accepted risk.)

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-19 | 1 | 1 | 0 | secure-phase (State B, ASVS L1 short-circuit — plan-time register, threats_open: 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-19

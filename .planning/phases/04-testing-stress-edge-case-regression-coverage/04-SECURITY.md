---
phase: 04
slug: testing-stress-edge-case-regression-coverage
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-14
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register authored at plan time (all 6 PLAN.md files carry `<threat_model>` blocks). Threat IDs below are
namespaced `T-04-{plan}-{n}` because the source plans reused local IDs (each plan restarted at T-04-01).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| operator/admin → shell (`disableDapp`) | Access-revocation decision crosses into the shell; a racing in-flight mount must honor it | Dapp id (access-control signal) |
| browser navigation → shell route resolution | User-driven URL changes (incl. unmatched routes, disable/enable transitions) drive mount/unmount; a re-navigation must not be dropped and no superseded mount may commit | URL paths |
| async mount chain → shared `#dx-mount` container | Concurrent in-flight `mount()` calls contend for the single container the current dapp must exclusively own | Template HTML, script-injected DOM |
| developer/remote manifest host → shell | Manifest data (inline / dapp-entry fetch / registry.json) drives routing + script-injection decisions | Manifest JSON (routes, entry URLs) |
| manifest override input → `deepMerge` | Override objects (potentially remote-origin) merge into base manifests; malicious keys must not pollute prototypes | Manifest override objects |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01-01 | Elevation of Privilege | `shell.disableDapp` / `lifecycle.mount` (TOCTOU) | high | mitigate | `mountGeneration` guard + `invalidatePendingMount(id)` in `disableDapp` (src/shell.ts:139); stress scenario asserts a disabled dapp's in-flight mount is fully abandoned | closed |
| T-04-01-02 | Tampering | `lifecycle.mount` `container.innerHTML` writes | medium | mitigate | `isStale()` re-check immediately before every `innerHTML` write (src/lifecycle.ts:368-371); stress scenario asserts DOM matches the winning navigation | closed |
| T-04-01-03 | Repudiation | stale-mount `dx:error` / container clear | medium | mitigate | Stale mounts suppress their own `dx:error` and never clear the container (`!isStale()` guards, src/lifecycle.ts:381-387) | closed |
| T-04-02-01 | Tampering | `loadManifests` three tiers / `isValidManifest` | high | mitigate | `isValidManifest` applied uniformly across tiers (src/shell.ts:173,198,269) + reject-unfixable routes (D-06); tests assert inline + registry tiers discard invalid manifests | closed |
| T-04-02-02 | Spoofing | duplicate-route resolution | medium | mitigate | `dx:error` naming both conflicting ids, deterministic first-wins (src/shell.ts:300, D-08); router tests assert emit + winner | closed |
| T-04-02-03 | Repudiation | `loadDappManifest` silent catch (WR-01) | medium | mitigate | `dx:error` emitted on fetch throw, non-2xx, and JSON-parse failure (src/shell.ts:184-229); tests assert all three modes emit | closed |
| T-04-03-01 | Elevation of Privilege | settings cleanup on `disableDapp` | medium | mitigate | ROB-04 cleanup (Phase 2) + full-shell integration regression (plugins/settings/tests/integration.test.ts) proving disabled dapp's handlers do not fire | closed |
| T-04-03-02 | Tampering | `deepMerge` prototype-pollution guard | high | mitigate | `__proto__`/`constructor`/`prototype` rejection (src/utils.ts:5) locked by D-09 tests incl. nested keys (tests/utils.test.ts) | closed |
| T-04-04-01 | Spoofing | `handleRouteChange` null branch (src/shell.ts) | medium | mitigate | Pending-mount invalidation on dapp→unmatched transition prevents stale DOM/template commit under an unmatched URL | closed |
| T-04-04-02 | Tampering | `#dx-mount` container | low | mitigate | Generation bump before DOM write prevents superseded mount's stale write | closed |
| T-04-04-03 | Information Disclosure | `dx:route:subpath` payload | low | accept | Eliminated as a side effect of the fix; payload carries route/id only, no dapp secrets (see Accepted Risks AR-01) | closed |
| T-04-05-01 | Spoofing | `handleRouteChange` null branch — slot clobber bypass | high | mitigate | `invalidateAnyPendingMount()` reads lifecycle's own in-flight id (src/shell.ts:373, src/lifecycle.ts:455) — stale commit prevented regardless of shell bookkeeping | closed |
| T-04-05-02 | Tampering | `#dx-mount` container | medium | mitigate | Generation bump before every DOM write/commit gate prevents stale write | closed |
| T-04-05-03 | Tampering | shell `pendingMountId` slot | medium | mitigate | Guarded `finally` (superseded by 04-06's token guard) prevents cross-mount state corruption | closed |
| T-04-05-04 | Information Disclosure | `dx:mount` / `dx:dapp:mounted` / `dx:route:subpath` payloads | low | accept | Misattributed events eliminated by the fix; payloads carry route/id/container only (see Accepted Risks AR-02) | closed |
| T-04-06-01 | Denial of Service | `mountDapp` same-id dedupe + `pendingMountId` slot | high | mitigate | Call-scoped `pendingMountToken` + `releasePendingMount()` at both invalidation sites (src/shell.ts:376,388,436) close the up-to-30s re-navigation drop window; two stress regressions lock it | closed |
| T-04-06-02 | Spoofing | `dx:route:changed` vs actual mounted dapp | medium | mitigate | Fix makes DOM/`dx:mount` state agree with the last navigation (last-navigation-wins verified 4/4 in 04-VERIFICATION.md) | closed |
| T-04-06-03 | Tampering | shell `pendingMountId` slot | medium | mitigate | Token-guarded `finally` (`pendingMountToken === myToken`) prevents cross-call slot corruption | closed |
| T-04-06-04 | Information Disclosure | `dx:mount` / `dx:dapp:mounted` payloads | low | accept | Payloads carry route/id/container only — no dapp secrets (see Accepted Risks AR-03) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

No package-manager installs occurred in this phase (zero-dep posture preserved) — no supply-chain (T-04-SC) checkpoint required.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-04-04-03 | `dx:route:subpath` payload names route/id only; misattribution eliminated by the 04-04 fix; no secret exposure possible | plan 04-04 threat model (plan-time disposition) | 2026-07-14 |
| AR-02 | T-04-05-04 | Mount-event payloads carry route/id/container only; misattributed events eliminated by the 04-05 fix | plan 04-05 threat model (plan-time disposition) | 2026-07-14 |
| AR-03 | T-04-06-04 | Mount-event payloads carry route/id/container only; no mitigation needed beyond the correctness fix | plan 04-06 threat model (plan-time disposition) | 2026-07-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-14 | 19 | 19 | 0 | /gsd-secure-phase L1 short-circuit (plan-time register; grep-verified mitigations; 312/312 tests green; 04-REVIEW.md 0 critical; 04-VERIFICATION.md passed 4/4) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-14

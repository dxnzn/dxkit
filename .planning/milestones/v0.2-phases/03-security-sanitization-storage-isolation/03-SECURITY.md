---
phase: 3
slug: security-sanitization-storage-isolation
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-12
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| fetched template HTML → DOM (`innerHTML`) | Untrusted/attacker-influencable template content crosses into live DOM; the sanitize hook is the input-validation/output-encoding control point (ASVS V5) | Untrusted HTML |
| framework consumer config → lifecycle manager | `sanitizeTemplate` is consumer-supplied code executed in the mount flow | Consumer callback |
| shared-origin localStorage → per-app wallet state | Multiple DxKit apps on one origin share the localStorage namespace; the storage key is the isolation boundary (ASVS V3 partial) | Persisted provider ID |
| injected EIP-1193 provider → wallet state/events | The provider's `eth_requestAccounts` response is untrusted input shaping emitted wallet state | Account addresses |
| untyped JS/IIFE consumer config → createShell | IIFE/`<script>` consumers bypass TypeScript; a silently-ignored removed field would leave loaders unconfigured without any signal | Shell configuration |
| ShellConfig.lifecycle → LifecycleManagerOptions | Nested group is the passthrough seam carrying the SEC-01 sanitizer to the mount flow | Loader/sanitizer options |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering / Elevation of Privilege | `mount()` `container.innerHTML =` injection of fetched template HTML | high | mitigate | Optional `sanitizeTemplate` hook runs on template HTML before injection, fail-closed: a throw aborts the mount and emits `dx:error` source `lifecycle:<id>:sanitize` (`src/lifecycle.ts:286-298`); fail-closed + unchanged-default tests (`tests/lifecycle.test.ts:787-848`) | closed |
| T-03-02 | Information Disclosure | Shared `localStorage['dxkit:wallet']` across apps on one origin | medium | mitigate | Configurable `WalletOptions.storageKey` (`plugins/wallet/src/index.ts:157-200`); isolation + no-migration tests (`plugins/wallet/tests/wallet.test.ts:542-591`) | closed |
| T-03-03 | Tampering | `connect()` emitting `connected:true, address:undefined` on empty accounts | medium | mitigate | `connect()` throws on empty accounts (`plugins/wallet/src/index.ts:47-48,58`); empty-accounts test (`plugins/wallet/tests/wallet.test.ts:107`) | closed |
| T-03-04 | Tampering | JS/IIFE consumers using removed flat loaders with no type checking | medium | mitigate | `createShell()` runtime guard throws a descriptive Error on removed flat loader keys (`src/shell.ts:16-25`); runtime-throw tests (`tests/shell.test.ts:875-895`) | closed |
| T-03-05 | Repudiation / Denial of Service | Silent auto-reconnect failure in `init()` | low | mitigate | Reconnect failure emits `dx:error` source `plugin:wallet:reconnect` and clears the persisted key (`plugins/wallet/src/index.ts:270`); regression test (`plugins/wallet/tests/wallet.test.ts:594-617`) | closed |
| T-03-06 | Information Disclosure | Sanitizer failure error source ambiguity | low | mitigate | Distinct `lifecycle:<id>:sanitize` source via dedicated try/catch (`src/lifecycle.ts:282-295`); source-equality test (`tests/lifecycle.test.ts:842`) | closed |
| T-03-07 | Tampering / Elevation of Privilege | Sanitizer unreachable from `createShell()`, leaving SEC-01 unusable by shell consumers | medium | mitigate | Nested `lifecycle` group forwards `sanitizeTemplate` into the lifecycle manager (`src/shell.ts:36-44`); passthrough test (`tests/shell.test.ts:840-870`) | closed |
| T-03-SC | Tampering | npm installs (supply chain) | high | accept | No packages installed by this phase (zero-runtime-deps posture); `dompurify` referenced only in docs/tests as an example and absent from every `package.json` (verified) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-SC | Zero-runtime-deps posture: no packages installed by any Phase 3 plan. DOMPurify is documentation/test example only, never a dependency — verified absent from all `package.json` files. | Denizen. (per plan-time disposition) | 2026-07-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-12 | 8 | 8 | 0 | gsd-secure-phase (L1 grep-depth, short-circuit — plan-time register, ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-12

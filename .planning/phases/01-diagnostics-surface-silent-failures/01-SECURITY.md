---
phase: 1
slug: diagnostics-surface-silent-failures
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-11
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Phase 1 surfaces previously-silent failures via `dx:error` events (missing mount container,
plugin `localStorage` read/write failures, post-injection load failures). It adds no new
external inputs, no network surface, and no dependencies (zero-dep posture preserved). The
security-relevant question is therefore narrow: do the new error emissions leak sensitive
data, and does the new container-clear correctly remove stale DOM. Register authored at
plan time (both plans carried `<threat_model>` blocks); verified retroactively at L1
grep-depth. Block-on threshold is `high`; all six threats are `low`, so no threat is
blocking.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| shell/lifecycle → `dx:error` listeners | Failure messages emitted on the bus are visible to any registered `dx:error` handler (dapps, plugins, dev tooling). | Manifest id + failure condition (developer-authored, already public) |
| plugin storage code → `dx:error` listeners | Wrapped storage-failure messages emitted on the bus are visible to every `dx:error` handler on the origin. | Operation identity + caught exception `err.message` (e.g. QuotaExceededError) |
| dapp DOM ← lifecycle | `container.innerHTML` is written/cleared by the shell; a failed mount must not leave a prior dapp's DOM addressable. | Rendered dapp DOM |
| `localStorage` (browser/user-controlled) → plugin restore path | `getItem`/`JSON.parse` consume attacker- or corruption-controlled bytes on `restore()`. | Persisted settings/theme/wallet-provider bytes |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01A-01 | Information Disclosure | `shell:mount` / `lifecycle:<id>` error messages | low | accept | Messages include only `manifest.id` (developer-authored, already public) and the DOM-not-found condition — no user data or secrets on this path. | closed |
| T-01A-02 | Denial of Service | `mountDapp` missing-container branch | low | accept | Emit-every-time (D-04), no dedupe; each emit is a bounded synchronous CustomEvent, and the repetition is the intended signal (D-09). Dedupe explicitly deferred. | closed |
| T-01A-03 | Tampering | Stale dapp DOM after failed mount | low | mitigate | `container.innerHTML = ''` on both post-injection catches (`src/lifecycle.ts:142,157`) removes partially-injected / prior-dapp DOM so a failed mount leaves no addressable stale nodes (DIAG-03). Verified present. | closed |
| T-01B-01 | Information Disclosure | `plugin:<name>:storage:<op>` error messages | low | mitigate | Emitted `Error` messages interpolate only a static operation label + `err.message`/`String(err)` — never the stored settings values, wallet provider id, or parsed JSON payload. Verified at all six emit sites (settings/theme/wallet `:read`/`:write`). | closed |
| T-01B-02 | Tampering / DoS | `restore()` consuming corrupted `localStorage` JSON | low | mitigate | `catch (err)` emits `:read` and falls back to defaults (D-08); a hostile/corrupt value cannot crash init or block the plugin, and parsing is bounded by `localStorage` size limits. Verified present. | closed |
| T-01B-03 | Denial of Service | Repeated identical storage-failure emits | low | accept | No dedupe (D-09): a persistently-full quota emits per write. Each emit is a bounded synchronous CustomEvent; the flood is itself the intended signal. Throttle/dedupe explicitly deferred. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01A-01 | Emitted shell/lifecycle messages carry only developer-authored, already-public manifest ids and a DOM-not-found condition — no secrets in scope. | Denizen. | 2026-07-11 |
| AR-02 | T-01A-02 | Un-deduped missing-container emits are the intended diagnostic signal; each is a bounded synchronous CustomEvent. Dedupe deferred (D-09). | Denizen. | 2026-07-11 |
| AR-03 | T-01B-03 | Un-deduped storage-failure emits are the intended diagnostic signal under a persistently-full quota; each is a bounded synchronous CustomEvent. Throttle/dedupe deferred (D-09). | Denizen. | 2026-07-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-11 | 6 | 6 | 0 | gsd-secure-phase (L1 grep-depth, register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-11

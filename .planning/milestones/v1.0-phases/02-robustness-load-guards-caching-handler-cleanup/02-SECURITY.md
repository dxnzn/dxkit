---
phase: 2
slug: robustness-load-guards-caching-handler-cleanup
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-12
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Phase 2 hardens availability and cleanup on the existing surfaces: a per-fetch load timeout
with true abort (`src/lifecycle.ts`), a construction-time router sort cache (`src/router.ts`),
a per-manager URL-keyed template cache (`src/lifecycle.ts`), and settings handler pruning on
dapp disable (`plugins/settings/src/index.ts`). It adds **no new external input, no network
surface, and no runtime dependencies** (zero-dep posture preserved) — every change is an
internal guard or optimization over data the shell already handled. The security-relevant
questions are therefore narrow: can a timed-out asset still execute late, can cleanup
over-reach and remove the wrong handlers, and can the template cache serve poisoned/stale
HTML. Register authored at plan time (all four plans carried `<threat_model>` blocks);
verified retroactively at L1 grep-depth against the merged implementation. Block-on threshold
is `high`; the three high-severity threats (T-02-01, T-02-02, T-02-07) are all mitigated and
verified, so no threat is blocking.

Note: template `innerHTML` sanitization and wallet storage-key isolation are explicitly
**out of scope** for this phase — they are SEC-01/SEC-02 in Phase 3. This phase does not
change the injection surface; the template cache only avoids re-fetching identical HTML.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| remote asset URL → shell DOM | Untrusted script/style/template content crosses into `document.head` / the mount container. A hung URL is a denial-of-availability vector; a late-firing node is a stale-execution vector. | Developer-authored asset URLs + fetched script/style/template bytes |
| navigation path → manifest resolution | Path strings resolve to manifests via longest-prefix matching. The sort hoist is a pure internal optimization; no new external input. | Navigation path string (already routed) |
| disabled dapp → settings handler callbacks | A disabled dapp must stop receiving setting-change callbacks it registered; a leaked handler keeps observing settings state after disable. | `onChange`/`onAnyChange` callback references + setting values |
| cached template HTML → mount container `innerHTML` | Cached HTML is re-injected via `innerHTML` on re-mount. The cache stores only what a successful fetch returned for a given URL. | Fetched template HTML (developer-authored, content-addressed target) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Denial of Service | `mount()` awaiting a hung loader | high | mitigate | Per-fetch 30s default timeout (`isTimeoutActive` / `withTimeout`, `src/lifecycle.ts:19-44`) aborts the load and rejects (surfaced as `dx:error`) instead of hanging the mount. Verified present. | closed |
| T-02-02 | Tampering / Elevation | built-in script/style node firing after timeout | high | mitigate | On timeout the injected node is torn down — `onload=null; onerror=null; node.remove()` (`src/lifecycle.ts:89-91,129-131`) — so a late asset cannot execute into a cleared or next dapp. Reinforced by WR-01 fix (timer cleared on settle). Verified present. | closed |
| T-02-03 | Denial of Service | custom opaque loader that never resolves | medium | mitigate | `withTimeout` race abandons the wait and rejects; the underlying load continues in background (documented degradation). WR-01 fix clears the timer on settle so a fast custom loader leaves no dangling ~30s timer. Verified present. | closed |
| T-02-04 | Availability (intentional opt-out) | `timeout: 0` / `Infinity` restoring hang-forever | low | accept | Documented escape hatch (`src/lifecycle.ts:18`) for legitimately-slow IPFS gateways; consumer opts in explicitly. See AR-01. | closed |
| T-02-05 | Tampering | `resolve()` returning a wrong manifest after the sort hoist | low | mitigate | Sort hoisted to a `sorted` snapshot in the `createRouter` closure (`src/router.ts:24`); `resolve()` iterates it without re-sorting. Router immutability keeps the cache consistent with the live manifest set; regression tests assert unchanged longest-prefix behavior. Verified present. | closed |
| T-02-06 | Information Disclosure | leaked settings handler firing after `disableDapp()` | medium | mitigate | Subscribes to `dx:dapp:disabled` and prunes the dapp's handler entries via `cleanup(dappId)` (`plugins/settings/src/index.ts:142-144,242`). Verified present. | closed |
| T-02-07 | Denial of Service (self-inflicted) | over-broad cleanup removing the `_shell` toggle-bridge or a sibling dapp's handlers | high | mitigate | Handlers are keyed in a nested `Map<dappId, Map<key, …>>` (WR-02 fix, `src/index.ts:34-36`); `cleanup()` does an **exact-match** `keyHandlers.delete(dappId)` — no prefix matching — so `_shell:*` and sibling ids like `foo:bar` are untouched when `foo` is disabled. Regression tests cover both the `_shell` bridge and the sibling-id collision. Verified present. | closed |
| T-02-08 | Tampering | stale / poisoned template served from cache | low | mitigate | Only successfully-fetched HTML is cached, keyed by exact URL (`src/lifecycle.ts:214-218`); explicit `clearTemplateCache()` / `invalidateTemplate(url)` and the `cacheTemplates:false` opt-out cover live-editing and forced refresh. Content-addressed IPFS/static target makes URL-keyed caching safe. Verified present. | closed |
| T-02-09 | Information Disclosure | template cache surviving across manager teardown | low | accept | Cache is per-manager closure state (`src/lifecycle.ts:209`), garbage-collected with the manager instance; no cross-instance or module-level leakage. See AR-02. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-02-04 | `timeout: 0` / `Infinity` is a deliberate, documented opt-out that restores hang-forever behavior for legitimately-slow IPFS gateways; the consumer must set it explicitly. Default (30s) is safe. | Denizen. | 2026-07-12 |
| AR-02 | T-02-09 | The template cache is per-manager closure state, collected with the manager instance; there is no module-level or cross-instance cache to leak. Deeper isolation deferred as unnecessary. | Denizen. | 2026-07-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-12 | 9 | 9 | 0 | secure-phase (L1 grep-depth, register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-12

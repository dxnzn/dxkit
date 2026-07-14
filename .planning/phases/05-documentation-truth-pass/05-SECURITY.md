---
phase: 05
slug: documentation-truth-pass
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-14
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

This phase is a documentation truth pass plus three folded code fixes (D-15/D-16/D-17 in
`src/shell.ts` and `src/lifecycle.ts`). The dominant threat class is **false assurance** — docs
that misstate security-relevant behavior (`dx:error` sources, CSP directives, sanitizer scope,
`storageKey` isolation) mislead consumers building real error handling and deployment hardening.
The mitigation for that class is verification against source, which the phase performed and the
phase verifier independently confirmed (7/7 must-haves, `DOC-01`/`DOC-02`/`DOC-03`). The three
code threats are the landed fixes, covered by regression tests (321/321 green).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| consumer config → shell | `registryUrl` and manifest/dapp sources are consumer-supplied; shell fetches them | URLs, manifest JSON (consumer-trusted) |
| browser navigation → shell | route changes and `disableDapp` calls drive mount/unmount control flow | navigation events, dapp ids |
| template/manifest source → shell (`innerHTML`) | untrusted template HTML crosses into the DOM via `container.innerHTML` | HTML markup (potentially untrusted) |
| docs → consumer | consumers rely on documented event/type/config/CSP contracts to build dapps, error handlers, and deployment hardening | behavior/type/security claims |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Information Disclosure | D-15 registry `dx:error` message | low | accept | Message carries only the consumer-supplied `registryUrl` + underlying fetch/parse error; no framework secrets introduced | closed |
| T-05-02 | Denial of Service | D-16 `disableDapp` `navigate('/')` | low | accept | Single bounded navigate mirroring the existing `rebuildRouter` branch; no loop or re-entrancy introduced | closed |
| T-05-03 | Tampering | D-17 `inFlightMountId` ownership | medium | mitigate | `inFlightGeneration`/`clearOwnedInFlightMarker()` ownership guard in `src/lifecycle.ts:279-313` prevents a stale mount clearing a newer call's marker; regression test `tests/lifecycle.test.ts:1022` locks the invariant | closed |
| T-05-04 | Elevation of Privilege | mount/route control flow | low | accept | Fixes are event-emission + navigation-outcome corrections; no new injection or storage path introduced | closed |
| T-05-02a | Repudiation | events-reference `dx:error` catalog | medium | mitigate | `dx:error` catalog rewritten wholesale against source-grepped sources (23 rows) so failures are visible to consumers building listeners (`docs/events-reference.md`) | closed |
| T-05-02b | Spoofing (false assurance) | api-reference type/default claims | low | mitigate | Every option shape traced to current 0.2.0 types; mechanically compile-checked in Plan 08 (`docs/api-reference.md`) | closed |
| T-05-03a | Tampering | config snippets (loader shape) | medium | mitigate | All snippets corrected to nested `lifecycle` loader shape and compile-checked in Plan 08 (`docs/configuration.md`) | closed |
| T-05-03b | Spoofing (false assurance) | timeout default claim | low | mitigate | 30000ms default + `0`/`Infinity` opt-out documented, traced to `src/lifecycle.ts` | closed |
| T-05-04a | Spoofing (false assurance) | container-clear / stale-DOM claims | medium | mitigate | Container-clear guarantee traced to `container.innerHTML = ''` sites in `src/lifecycle.ts` (`docs/system-internals.md`) | closed |
| T-05-04b | Repudiation | disable-while-active rule | low | mitigate | Single post-D-16 outcome rule documented against post-fix code (`docs/dapp-development.md`) | closed |
| T-05-05a | Information Disclosure | `storageKey` isolation claims | medium | mitigate | Documented that wallet/theme/settings all expose configurable `storageKey`; only wallet got SEC-02 treatment; risk is the unchanged default, not a missing knob (`docs/plugins/*.md`, `docs/security.md`) | closed |
| T-05-05b | Spoofing (false assurance) | wallet WR-02/WR-03 status | low | mitigate | Stale "known bug" notes removed; reconnect `dx:error` documented, traced to `plugins/wallet/src/index.ts` | closed |
| T-05-06a | Tampering | cookbook recipe API shapes | low | mitigate | Recipes corrected to current API and compile-checked in Plan 08 (`docs/cookbook.md`) | closed |
| T-05-06b | Spoofing (false assurance) | build/test command claims | low | accept | Wrong commands are self-evident on run; verified against `Makefile`/`package.json` | closed |
| T-05-07a | Tampering | CSP policy examples | high | mitigate | Every directive reasoned against `src/lifecycle.ts` loaders; `'self'` on `script-src`/`style-src`/`connect-src` permits all DxKit injection without disabling CSP (`docs/security.md`) | closed |
| T-05-07b | Repudiation | meta-tag CSP directive support | high | mitigate | Header-vs-`<meta>` section states meta-safe vs header-only (`frame-ancestors`/`report-uri`/`sandbox`) directive lists explicitly (`docs/security.md`) | closed |
| T-05-07c | Spoofing (false assurance) | DOMPurify sanitizer recipe | high | mitigate | Doc states sanitizer covers template HTML only; entry scripts are trusted code (Phase 3 D-14) (`docs/security.md`) | closed |
| T-05-07d | Information Disclosure | limitations inventory | medium | mitigate | localStorage-plaintext and `storageKey`-collision facts documented explicitly in the limitations inventory (`docs/security.md`) | closed |
| T-05-08a | Tampering | doc TS snippets | medium | mitigate | D-04 `tsc --noEmit --strict` harness caught 2 real type-shape drifts; all snippets pass against real 0.2.0 types | closed |
| T-05-08b | Repudiation | cross-doc contradictions | low | mitigate | Consistency sweep reconciled divergent behavior descriptions; drift log records the reconciliation (`05-DRIFT-LOG.md`) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-01 | Registry `dx:error` exposes only consumer-supplied URL + underlying error; no framework secrets. Surfacing the failure is the intended visible-failure behavior. | Denizen. | 2026-07-14 |
| AR-05-02 | T-05-02 | `disableDapp` navigate-to-`/` is a single bounded navigation with no loop/re-entrancy; DoS surface unchanged. | Denizen. | 2026-07-14 |
| AR-05-03 | T-05-04 | Code fixes touch event-emission and navigation-outcome only; no new trust boundary, injection, or storage path. | Denizen. | 2026-07-14 |
| AR-05-04 | T-05-06b | Wrong build/test commands fail visibly on execution; verified against `Makefile`/`package.json` this phase. | Denizen. | 2026-07-14 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-14 | 20 | 20 | 0 | Claude (gsd-secure-phase, ASVS L1 grep-depth, register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-14

# Phase 3: Security — Sanitization & Storage Isolation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 3-security-sanitization-storage-isolation
**Areas discussed:** Todo folding, Sanitizer hook contract, Sanitizer × cache & failures, Wallet storage key shape, Wallet fix semantics, ShellConfig API shape, Sanitizer scope boundary, Security test depth, IIFE sanitizer ergonomics

---

## Todo Folding

| Option | Description | Selected |
|--------|-------------|----------|
| WR-03: auto-reconnect error | Tagged `resolves_phase: 3`; emit dx:error when init auto-reconnect fails instead of silently clearing persisted state | ✓ |
| WR-02: empty-accounts bug | `eth_requestAccounts` returning `[]` produces `connected: true, address: undefined`; correctness fix in the same file | ✓ |

**User's choice:** Fold both.

---

## Sanitizer Hook Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Sync or async | `(html, manifest) => string \| Promise<string>`; mount awaits the result — supports DOMPurify and async sanitizers alike | ✓ |
| Sync only | `(html) => string`; simplest contract, rules out async policy lookups | |

| Option | Description | Selected |
|--------|-------------|----------|
| Both + fix Phase 2 gap | Sanitizer reachable from ShellConfig AND forward timeout/cacheTemplates (fixing the existing passthrough gap) | ✓ |
| Both, sanitizer only | Forward only the sanitizer; leave the Phase 2 gap | |
| LifecycleManagerOptions only | Shell users can't reach the hook | |

| Option | Description | Selected |
|--------|-------------|----------|
| Hook-only, no built-in | Consumers bring DOMPurify; homegrown sanitizer = false security, zero-dep conflict | ✓ |
| Built-in basic stripper | Strip `<script>`/`on*` by default — changes 0.1.5 default behavior | |
| Optional exported helper | Best-effort helper consumers opt into | |

**Notes:** Option naming (`sanitizeTemplate` vs `templateSanitizer`) left to Claude's discretion.

---

## Sanitizer × Cache & Failures

| Option | Description | Selected |
|--------|-------------|----------|
| Cache raw, sanitize per mount | Cache keeps raw fetched HTML; sanitizer runs every mount after cache retrieval | ✓ |
| Sanitize once, cache sanitized | Faster re-mounts but cache holds stale sanitizer output on config change | |

| Option | Description | Selected |
|--------|-------------|----------|
| Abort mount, dx:error | Fail-closed: sanitizer throw = no injection, mount aborted | ✓ |
| Inject raw HTML, warn | Fail-open — silently defeats the configured sanitizer | |

| Option | Description | Selected |
|--------|-------------|----------|
| `lifecycle:<id>:sanitize` | Distinct per-stage error source per Phase 1 convention | ✓ |
| Reuse `lifecycle:<id>:template` | Fewer sources but conflates fetch vs sanitize failures | |

---

## Wallet Storage Key Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Full storageKey override | `WalletOptions.storageKey?: string`, default `'dxkit:wallet'`; literal key, zero magic | ✓ |
| Namespace prefix | `namespace?: string` → `dxkit:${ns}:wallet`; pre-empts a shell-wide namespace design | |
| Both options | Two knobs for one value | |

**Notes:** User asked for a full context breakdown before deciding (what the key stores, the same-origin IPFS-gateway collision scenario, and the theme/settings parallel) — then took the recommendation.

| Option | Description | Selected |
|--------|-------------|----------|
| No migration | Custom key starts fresh; old default entry left in place for other apps on the origin | ✓ |
| One-time migrate + delete | Would steal/clear the other app's state on multi-app origins | |

---

## Wallet Fix Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Throw from connect() | Empty accounts treated like existing failure modes; state stays disconnected, no events | ✓ |
| Stay disconnected + dx:error | connect() resolving while not connected is a confusing contract | |

| Option | Description | Selected |
|--------|-------------|----------|
| dx:error + clear persist | Emit `plugin:wallet:reconnect` with cause, keep the clear-persisted behavior | ✓ |
| dx:error + keep persist | Risks error-on-every-load loop | |

---

## ShellConfig API Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat top-level fields | Additive, consistent with existing flat loaders (was the initial recommendation) | |
| Nested lifecycle group | `lifecycle?: LifecycleManagerOptions` grouping all six knobs — breaking change | ✓ |

**User's choice:** Nested group — free-text rationale: "DxKit is published as 'alpha — do not use in production'. Now is the time to make breaking changes. I'm in favor of grouping relevant configurations together… deprecate the flat loaders hard (throw if they are passed?)."
**Notes:** User asked for a before/after sample ShellConfig comparison of both options before deciding, then overrode the flat-fields recommendation.

| Option | Description | Selected |
|--------|-------------|----------|
| Remove from types + runtime throw | Compile errors for TS users; createShell() throws with migration-pointing message for JS/IIFE users | ✓ |
| Remove from types only | Old keys silently ignored — contradicts "failures are visible" | |

---

## Sanitizer Scope Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| JSDoc now, full docs Phase 5 | JSDoc states template-only reach; security note + CSP guidance stays with DOC-03 | ✓ |
| Ship security doc this phase | Front-loads part of DOC-03 | |
| JSDoc only, nothing for Phase 5 | Leaves DOC-03 thinner than the concerns audit called for | |

---

## Security Test Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Plumbing + XSS fixtures | Hook plumbing tests plus script/onerror payload fixtures proving pass-through default and strip-when-configured | ✓ |
| Plumbing only | Security gate has less to point at | |
| Full adversarial suite | mXSS vectors etc. — bypass-resistance is the consumer sanitizer's test surface | |

---

## IIFE Sanitizer Ergonomics

| Option | Description | Selected |
|--------|-------------|----------|
| Docs-only, no code | The hook is a plain function; DOMPurify-global example lands in Phase 5 | ✓ |
| Auto-detect DOMPurify global | Violates unchanged-default criterion; depends on script-tag ordering | |

---

## Claude's Discretion

- Hook option/type naming (`sanitizeTemplate` vs `templateSanitizer`)
- Flat-loader migration Error message and sanitizer-failure dx:error message wording
- `storageKey` edge handling (empty-string validation)
- Internal `updateState` guards replacing the removed `address!` assertions
- Test structure/placement within the existing vitest + happy-dom suites

## Deferred Ideas

- Shell-level namespace isolating ALL persisted plugin state (wallet + theme + settings) — future milestone
- Built-in/exported best-effort sanitizer helper — rejected this phase (false security, zero-dep conflict)
- CSP guidance + security/limitations documentation — Phase 5 (DOC-03)
- Theme/settings `storageKey` options — folds into the shell-level namespace idea

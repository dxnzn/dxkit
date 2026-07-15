# Phase 3: Security — Sanitization & Storage Isolation - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Two security hardenings plus two folded wallet correctness fixes:

- **SEC-01** — The lifecycle manager exposes an optional **template sanitizer hook** that runs on fetched template HTML before `innerHTML` injection (`src/lifecycle.ts`). With no sanitizer configured, injection behavior is unchanged from 0.1.5.
- **SEC-02** — The wallet plugin's **storage key is configurable** via `WalletOptions`, so two DxKit apps on the same origin persist wallet-provider selection independently (`plugins/wallet/src/index.ts`).
- **WR-02 (folded)** — `connect()` no longer reports `connected: true, address: undefined` when the provider returns an empty accounts array.
- **WR-03 (folded)** — Init auto-reconnect failure emits `dx:error` instead of being silently swallowed.

**This phase also carries one deliberate breaking change:** `ShellConfig`'s lifecycle passthrough is restructured into a nested `lifecycle` options group (D-04/D-05 below) — the seam the sanitizer needs anyway, redesigned properly while the alpha window allows it.

**Not in scope:** built-in sanitization logic (hook-only), theme/settings storage-key isolation (wallet only per SEC-02), CSP guidance + security/limitations docs (Phase 5 DOC-03), stress/edge-case test suites (Phase 4), storage encryption (out of milestone).
</domain>

<decisions>
## Implementation Decisions

### SEC-01 — Sanitizer hook contract
- **D-01 (signature):** `(html: string, manifest: DappManifest) => string | Promise<string>`. The mount flow `await`s the result, so sync (DOMPurify) and async (dynamically-imported/policy-driven) sanitizers both work. The manifest arg enables per-dapp policies.
- **D-02 (hook-only, no built-in):** DxKit ships **no built-in sanitizer** — the hook is bring-your-own (DOMPurify or equivalent). A homegrown stripper would be false security and conflict with the zero-runtime-deps posture. No auto-detection of `window.DOMPurify` either (D-13). Docs point consumers at DOMPurify + CSP in Phase 5.
- **D-03 (config surface):** The sanitizer is configured on `LifecycleManagerOptions` and reaches shell consumers through the new nested `ShellConfig.lifecycle` group (D-04).

### ShellConfig restructure (BREAKING)
- **D-04 (nested lifecycle group):** `ShellConfig` gains `lifecycle?: LifecycleManagerOptions` carrying ALL lifecycle knobs — `scriptLoader`, `styleLoader`, `templateLoader`, `timeout`, `cacheTemplates`, and the new sanitizer option. This also closes the Phase 2 gap where `timeout`/`cacheTemplates` existed on `LifecycleManagerOptions` but were unreachable from `createShell()` (`src/shell.ts:31-36` forwards only the three loaders). Owner's rationale: alpha is the time for breaking changes; related config belongs grouped.
- **D-05 (hard deprecation of flat loaders):** The flat `scriptLoader`/`styleLoader`/`templateLoader` fields are **removed from the `ShellConfig` type** (TS users get compile errors) **and `createShell()` throws** a descriptive `Error` at runtime if any of the three keys is present in the config object — the message points to `config.lifecycle.*`. The runtime throw catches JS/IIFE consumers who get no type checking. Requires `BREAKING CHANGE:` footer + migration notes per milestone constraints.

### SEC-01 — Cache interaction & failure semantics
- **D-06 (cache raw, sanitize per mount):** The Phase 2 template cache keeps storing **raw fetched HTML** (D-12 semantics untouched); the sanitizer runs **on every mount**, after cache retrieval, immediately before `innerHTML`. The cache never holds output from a stale sanitizer config, and `clearTemplateCache()`/`invalidateTemplate()` stay purely "drop the fetch".
- **D-07 (fail-closed):** A sanitizer throw/rejection **aborts the mount** exactly like a template fetch failure: emit `dx:error` and return — never inject HTML the configured sanitizer couldn't process. Follows the Phase 1 blocking-template convention (no stale DOM concern here since the abort happens before injection).
- **D-08 (error source):** Sanitizer failures emit with source **`lifecycle:<id>:sanitize`** — a distinct per-stage source following the Phase 1 per-asset convention (`:styles`, `:template`, `:dependency`), so "template wouldn't fetch" and "sanitizer rejected the HTML" are distinguishable.

### SEC-02 — Wallet storage key
- **D-09 (full override):** `WalletOptions.storageKey?: string`, default `'dxkit:wallet'` (unchanged). The consumer passes the literal key (e.g. `'dxkit:myapp:wallet'`). No namespace-building magic — a shell-wide namespace concept is deferred (see Deferred Ideas).
- **D-10 (no migration):** A custom `storageKey` starts fresh. The old `'dxkit:wallet'` entry is ignored and left in place — another app on the origin may still be using it. Worst case the user re-connects once.

### Folded wallet fixes
- **D-11 (WR-02 — empty accounts throws):** When `eth_requestAccounts` returns `[]`, `connect()` **throws** — consistent with its existing failure modes ("no wallet detected", "provider not found"). State stays disconnected, no events fire. The `address!` non-null assertions in `updateState` emit paths are removed so the `{ address: string }` event contract can't be violated.
- **D-12 (WR-03 — reconnect surfaces):** The init auto-reconnect catch emits `dx:error` with source **`plugin:wallet:reconnect`** (caught error as `cause`, per the Phase 1 wallet convention) and **keeps** the existing clear-persisted-provider behavior. Staying silent remains correct only when reconnect isn't applicable (no persisted id, or provider unavailable).

### Boundary, tests, ergonomics
- **D-13 (IIFE ergonomics — docs only):** The no-bundler story needs zero code accommodation — the hook is a plain function and the `DOMPurify`-global pattern already works. Cookbook/security examples land in Phase 5. No `window.DOMPurify` auto-detection (would violate success criterion 2 and depend on script-tag ordering).
- **D-14 (scope boundary docs):** The `sanitizeTemplate` option's JSDoc states plainly that it applies to **template HTML only** — dapp entry scripts are trusted code whose runtime DOM writes are outside the sanitizer's reach. The full security/limitations note + CSP guidance stays with Phase 5 (DOC-03).
- **D-15 (test depth — plumbing + XSS fixtures):** Tests cover the hook plumbing (called with `(html, manifest)`, result awaited, abort-on-throw, cache-raw ordering, `ShellConfig.lifecycle` passthrough, flat-loader runtime throw) **plus** XSS-shaped fixtures: `<script>`/`onerror` payloads pass through verbatim with no sanitizer configured (proving criterion 2's unchanged default) and a test sanitizer strips them (proving the seam sees the payload before `innerHTML`). No full adversarial/mXSS suite — bypass-resistance is the consumer sanitizer's test surface, not DxKit's. Wallet fixes (D-11/D-12) each ship a regression test.

### Claude's Discretion
- Exact option name for the hook (`sanitizeTemplate` vs `templateSanitizer`) and the exported type name.
- Wording of the flat-loader migration `Error` message and the sanitizer-failure `dx:error` message (consistent with existing `lifecycle:*` messages).
- `storageKey` edge handling (e.g. empty-string validation) — verbatim use is the simplest correct default.
- How `updateState` guards replace the removed `address!` assertions internally.
- Test structure/placement, consistent with the existing vitest + happy-dom suites.

### Folded Todos
- **WR-03 — Surface wallet auto-reconnect failure on init** (`.planning/todos/pending/2026-07-11-surface-wallet-auto-reconnect-failure-on-init.md`, tagged `resolves_phase: 3`): silent catch at `plugins/wallet/src/index.ts:260-266` upgraded to `dx:error` per D-12. Same file SEC-02 opens — avoids touching it twice.
- **WR-02 — Wallet connect empty accounts yields undefined address** (`.planning/todos/pending/2026-07-11-wallet-connect-empty-accounts-yields-undefined-address.md`): data-integrity fix per D-11 at `plugins/wallet/src/index.ts:46-50` and `:214`. Rides along for the same single-touch reason.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 3: Security — Sanitization & Storage Isolation" — goal + three success criteria.
- `.planning/REQUIREMENTS.md` — SEC-01, SEC-02 definitions.
- `.planning/PROJECT.md` §Constraints — zero-runtime-deps, IIFE/IPFS-first, breaking-changes-must-be-justified posture. Note: D-04/D-05 is this phase's justified breaking change.

### Folded todos
- `.planning/todos/pending/2026-07-11-surface-wallet-auto-reconnect-failure-on-init.md` — WR-03 problem statement + solution sketch.
- `.planning/todos/pending/2026-07-11-wallet-connect-empty-accounts-yields-undefined-address.md` — WR-02 problem statement + solution sketch.
- `.planning/phases/01-diagnostics-surface-silent-failures/01-REVIEW.md` — original WR-02/WR-03 findings.

### Code truth (the sites this phase touches)
- `src/lifecycle.ts:139-160` — `LifecycleManagerOptions` (where the sanitizer option is added); `:191-220` — manager construction, template cache wrap (D-06 slots the sanitizer after `loadTemplate`, before `innerHTML`); `:252-264` — template mount block (injection site + blocking-failure pattern D-07 mirrors).
- `src/types/shell.ts:13-32` — `ShellConfig` (D-04 nested `lifecycle` group replaces the flat loaders `:26-31`).
- `src/shell.ts:15-36` — config destructure + `createLifecycleManager` wiring (D-04 forwarding; D-05 runtime throw goes here before/at construction).
- `plugins/wallet/src/index.ts:154` — `STORAGE_KEY` constant D-09 replaces; `:149-152` — `WalletOptions`; `:174-205` — `persistProvider`/`getPersistedProvider` (key threading); `:246-268` — `init()` auto-reconnect catch (D-12 site); `:40-67` — EIP-1193 `connect()` (D-11 site); `:207-220` — `updateState` with the `address!` assertions D-11 removes.
- `src/types/events.ts` — `dx:error` payload `{ source, error }` (unchanged; new sources `lifecycle:<id>:sanitize`, `plugin:wallet:reconnect`).

### Concerns audit (source of this phase's scope)
- `.planning/codebase/CONCERNS.md` §"XSS Risk in Template Injection" (SEC-01), §"Wallet Provider Persistence Relies on localStorage Key" (SEC-02), §"No Content Security Policy Guidance" (deliberately deferred to Phase 5 DOC-03 per D-14).

### Prior phase context
- `.planning/phases/02-robustness-load-guards-caching-handler-cleanup/02-CONTEXT.md` — template cache semantics (D-12 there: raw HTML by URL, successful fetches only) that D-06 here preserves; the wrap-at-the-manager-seam pattern the sanitizer follows.
- `.planning/phases/01-diagnostics-surface-silent-failures/01-CONTEXT.md` — `dx:error` source/message convention (per-asset sources, wrapped Error with `cause`) that D-08/D-12 reuse.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Template mount block** (`src/lifecycle.ts:252-264`) — the emit-and-return blocking-failure pattern is exactly what a sanitizer throw reuses (D-07); the sanitize call slots between `loadTemplate(...)` and `container.innerHTML = html`.
- **`loadTemplate` cache wrapper** (`src/lifecycle.ts:211-220`) — already separates "get HTML" from "inject HTML"; D-06 requires no cache changes at all, only a post-retrieval sanitize step in `mount()`.
- **Wallet storage helpers** (`plugins/wallet/src/index.ts:174-205`) — `persistProvider`/`getPersistedProvider` are the only two readers of `STORAGE_KEY`; D-09 is a constant→closure-variable swap with an options default.
- **Phase 1 wallet `dx:error` emits** (`plugin:wallet:storage:read`/`:write` with `cause: err`) — the exact template for the D-12 `plugin:wallet:reconnect` emit.

### Established Patterns
- Options are additive with defaults resolved at construction (`options.timeout ?? 30000`, `options.cacheTemplates ?? true`) — `storageKey` and the sanitizer follow (`options.storageKey ?? 'dxkit:wallet'`).
- Mount failures are contained: emit + return, never throw out of the mount flow — the sanitizer abort (D-07) obeys this. Wallet `connect()` by contrast IS a throwing API — D-11 stays consistent with that split.
- `createShell` destructures config once at the top (`src/shell.ts:15-26`) — the D-05 runtime guard naturally lives there, before lifecycle construction.

### Integration Points
- SEC-01: `LifecycleManagerOptions` (new sanitizer field) + `mount()`'s template block; `ShellConfig.lifecycle` (D-04) forwarding in `createShell`.
- SEC-02 + WR fixes: `WalletOptions.storageKey`, the two storage helpers, `init()`'s reconnect catch, EIP-1193 `connect()`, and `updateState`'s emit paths — all in `plugins/wallet/src/index.ts`.
- Breaking change: `src/types/shell.ts` (type removal) + `src/shell.ts` (runtime throw + nested forwarding); every existing test/doc/example constructing a shell with flat loaders must migrate (tests updated this phase; docs are Phase 5, but migration notes ship with the commit).

</code_context>

<specifics>
## Specific Ideas

- **Owner's stance on breaking changes:** "DxKit is published as 'alpha — do not use in production'. Now is the time to make breaking changes." Grouping related config (the nested `lifecycle` block) was the owner's explicit preference over the additive flat option, including hard-failing (`throw`) on the removed flat loaders rather than silently ignoring them.
- **Fail-closed is the security posture:** a configured sanitizer that fails must never be bypassed (D-07) — "inject raw + warn" was explicitly rejected as defeating the point of the hook.
- **The collision story that motivates SEC-02:** two DxKit apps on one IPFS gateway origin share `localStorage`; App A's provider selection leaks into App B, and B's disconnect clears A's auto-reconnect. The fix is per-app keys, not migration cleverness (D-10).

</specifics>

<deferred>
## Deferred Ideas

- **Shell-level namespace isolating ALL persisted plugin state** — one option (e.g. on `ShellConfig`) that namespaces wallet (`dxkit:wallet`), theme (`dxkit:theme`), and settings (`dxkit:settings`) keys together. Future milestone; SEC-02 is wallet-only. The D-09 full-key override deliberately avoids painting this design into a corner.
- **Built-in/exported best-effort sanitizer helper** — considered and rejected (D-02): false security, zero-dep conflict. Revisit only if a credible zero-dep sanitization approach emerges.
- **CSP guidance + security/limitations documentation** — Phase 5 (DOC-03) per D-14; this phase ships JSDoc only.
- **Theme/settings `storageKey` options** — same collision exists for `dxkit:theme`/`dxkit:settings`; folds naturally into the shell-level namespace idea above.

</deferred>

---

*Phase: 3-security-sanitization-storage-isolation*
*Context gathered: 2026-07-12*

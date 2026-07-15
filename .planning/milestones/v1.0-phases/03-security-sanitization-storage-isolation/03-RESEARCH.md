# Phase 3: Security — Sanitization & Storage Isolation - Research

**Researched:** 2026-07-12
**Domain:** DOM injection hardening (XSS-shaped sanitizer hook) + client-side storage key isolation
**Confidence:** HIGH

## Summary

This phase is almost entirely an internal-API design problem, not a "learn a new library" problem. Both SEC-01 (sanitizer hook) and SEC-02 (configurable storage key) are decided down to signatures and call sites in `03-CONTEXT.md` — research's job is to confirm those decisions align with how the ecosystem actually does these two things, surface the exact touch points in the current codebase, and flag the migration surface the breaking `ShellConfig.lifecycle` restructure creates.

For SEC-01: DxKit ships **no bundled sanitizer** (D-02, zero-runtime-deps posture). The hook is a plain `(html, manifest) => string | Promise<string>` function slotted into `src/lifecycle.ts`'s existing mount flow, between `loadTemplate()` (cache-aware fetch) and `container.innerHTML = html` (injection). DOMPurify — the de facto standard client-side sanitizer, confirmed via websearch as synchronous-by-default with an opt-in `RETURN_TRUSTED_TYPE` mode for CSP Trusted Types integration — is the reference implementation for docs/tests, but is never imported by DxKit itself. The hook's `Promise<string>` return type is what accommodates DOMPurify's synchronous call *and* async alternatives (dynamically-imported sanitizer, policy-fetched allowlist) without forcing either shape.

For SEC-02: the wallet plugin currently hardcodes `const STORAGE_KEY = 'dxkit:wallet'` as a module constant, read by exactly two functions (`persistProvider`, `getPersistedProvider`). Making it a closure-scoped variable resolved from `options.storageKey ?? 'dxkit:wallet'` at `createWallet()` construction time is a minimal, low-risk change — this is also the industry-standard fix for the collision class (confirmed via websearch: namespaced/prefixed storage keys are the standard mitigation for shared-origin localStorage collisions), which validates D-09's "literal full-key override, no magic" approach as sufficient rather than under-engineered.

The highest-risk item in this phase is **not** the sanitizer or the storage key — it's the breaking `ShellConfig` restructure (D-04/D-05). Flat `scriptLoader`/`styleLoader`/`templateLoader` fields are removed from the type and now throw a runtime `Error` if present, which touches **46 occurrences** across `tests/shell.test.ts` alone (verified by grep) plus every doc example in `docs/getting-started.md`, `docs/system-internals.md`, and `docs/api-reference.md` (docs are explicitly Phase 5 scope, but the planner should not be surprised these go stale this phase).

**Primary recommendation:** Implement SEC-01 as a single optional field on `LifecycleManagerOptions` (`sanitizeTemplate?: (html, manifest) => string | Promise<string>`) awaited inside the existing template `try` block in `mount()`, reusing the emit-and-return blocking-failure pattern already used for template-fetch and dependency-load failures. Implement SEC-02 as a closure-variable swap in `plugins/wallet/src/index.ts` with zero change to the public `Wallet`/`WalletProvider` interfaces. Treat the `ShellConfig` restructure as its own task with its own test-migration pass — it is the most mechanically invasive part of this phase even though it is conceptually the simplest.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (signature):** `(html: string, manifest: DappManifest) => string | Promise<string>`. The mount flow `await`s the result, so sync (DOMPurify) and async (dynamically-imported/policy-driven) sanitizers both work. The manifest arg enables per-dapp policies.
- **D-02 (hook-only, no built-in):** DxKit ships **no built-in sanitizer** — the hook is bring-your-own (DOMPurify or equivalent). A homegrown stripper would be false security and conflict with the zero-runtime-deps posture. No auto-detection of `window.DOMPurify` either (D-13). Docs point consumers at DOMPurify + CSP in Phase 5.
- **D-03 (config surface):** The sanitizer is configured on `LifecycleManagerOptions` and reaches shell consumers through the new nested `ShellConfig.lifecycle` group (D-04).
- **D-04 (nested lifecycle group):** `ShellConfig` gains `lifecycle?: LifecycleManagerOptions` carrying ALL lifecycle knobs — `scriptLoader`, `styleLoader`, `templateLoader`, `timeout`, `cacheTemplates`, and the new sanitizer option. This also closes the Phase 2 gap where `timeout`/`cacheTemplates` existed on `LifecycleManagerOptions` but were unreachable from `createShell()`.
- **D-05 (hard deprecation of flat loaders):** The flat `scriptLoader`/`styleLoader`/`templateLoader` fields are **removed from the `ShellConfig` type** (TS users get compile errors) **and `createShell()` throws** a descriptive `Error` at runtime if any of the three keys is present in the config object. Requires `BREAKING CHANGE:` footer + migration notes.
- **D-06 (cache raw, sanitize per mount):** The Phase 2 template cache keeps storing **raw fetched HTML**; the sanitizer runs **on every mount**, after cache retrieval, immediately before `innerHTML`. `clearTemplateCache()`/`invalidateTemplate()` stay purely "drop the fetch".
- **D-07 (fail-closed):** A sanitizer throw/rejection **aborts the mount** exactly like a template fetch failure: emit `dx:error` and return — never inject HTML the configured sanitizer couldn't process.
- **D-08 (error source):** Sanitizer failures emit with source **`lifecycle:<id>:sanitize`** — a distinct per-stage source.
- **D-09 (full override):** `WalletOptions.storageKey?: string`, default `'dxkit:wallet'` (unchanged). Consumer passes the literal key. No namespace-building magic.
- **D-10 (no migration):** A custom `storageKey` starts fresh. The old `'dxkit:wallet'` entry is ignored and left in place.
- **D-11 (WR-02 — empty accounts throws):** When `eth_requestAccounts` returns `[]`, `connect()` **throws** — consistent with existing failure modes. State stays disconnected, no events fire. The `address!` non-null assertions in `updateState` emit paths are removed.
- **D-12 (WR-03 — reconnect surfaces):** The init auto-reconnect catch emits `dx:error` with source **`plugin:wallet:reconnect`** (caught error as `cause`) and **keeps** the existing clear-persisted-provider behavior.
- **D-13 (IIFE ergonomics — docs only):** The hook is a plain function; `DOMPurify`-global pattern already works with no code accommodation. No `window.DOMPurify` auto-detection.
- **D-14 (scope boundary docs):** `sanitizeTemplate`'s JSDoc states it applies to **template HTML only** — dapp entry scripts are trusted code outside the sanitizer's reach. Full security/limitations note is Phase 5 (DOC-03).
- **D-15 (test depth — plumbing + XSS fixtures):** Tests cover hook plumbing (called with `(html, manifest)`, result awaited, abort-on-throw, cache-raw ordering, `ShellConfig.lifecycle` passthrough, flat-loader runtime throw) **plus** XSS-shaped fixtures: unsanitized-by-default passthrough test, and a stripping test-sanitizer proving the seam sees the payload. No full adversarial/mXSS suite. WR-02/WR-03 each ship a regression test.

### Claude's Discretion

- Exact option name for the hook (`sanitizeTemplate` vs `templateSanitizer`) and the exported type name.
- Wording of the flat-loader migration `Error` message and the sanitizer-failure `dx:error` message (consistent with existing `lifecycle:*` messages).
- `storageKey` edge handling (e.g. empty-string validation) — verbatim use is the simplest correct default.
- How `updateState` guards replace the removed `address!` assertions internally.
- Test structure/placement, consistent with the existing vitest + happy-dom suites.

### Deferred Ideas (OUT OF SCOPE)

- Shell-level namespace isolating ALL persisted plugin state (wallet + theme + settings keys together) — future milestone.
- Built-in/exported best-effort sanitizer helper — rejected (false security, zero-dep conflict).
- CSP guidance + security/limitations documentation — Phase 5 (DOC-03).
- Theme/settings `storageKey` options — same collision exists for `dxkit:theme`/`dxkit:settings`; folds into the shell-level namespace idea.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Lifecycle manager exposes an optional template sanitizer hook applied before `innerHTML` injection | Exact slot point confirmed at `src/lifecycle.ts:252-264` (template mount block); fail-closed pattern reuses the existing template-fetch-failure emit-and-return branch; DOMPurify confirmed sync-by-default via websearch, validating the `string \| Promise<string>` signature as accommodating both sync and async consumer sanitizers |
| SEC-02 | Wallet plugin storage key is configurable via options so two DxKit apps on the same origin don't collide | `STORAGE_KEY` constant and its two readers (`persistProvider`/`getPersistedProvider`) located at `plugins/wallet/src/index.ts:154,174-205`; websearch confirms key-namespacing/full-override is the standard mitigation for this exact collision class |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template sanitization (SEC-01) | Browser / Client | — | The hook runs synchronously in the browser's mount flow, immediately before a DOM write (`innerHTML`); it has no server or build-time component — DxKit has no server tier |
| Sanitizer configuration surface (`LifecycleManagerOptions`, `ShellConfig.lifecycle`) | Browser / Client (framework config) | — | Config is resolved at `createShell()`/`createLifecycleManager()` construction time, entirely client-side; no persistence, no network round-trip |
| Wallet storage key isolation (SEC-02) | Browser / Client (Storage) | — | `localStorage` is a browser-tier, origin-scoped API; the "collision" is purely a same-origin client storage problem, not a backend/session concern |
| Wallet reconnect failure surfacing (WR-03) | Browser / Client | — | `init()`'s auto-reconnect runs client-side against `window.ethereum`; the fix only changes how the client reports the failure (`dx:error` emit), no new tier involved |
| Wallet empty-accounts handling (WR-02) | Browser / Client | — | `connect()` throwing on empty accounts is a client-side state-integrity fix in the EIP-1193 provider wrapper |

**Note:** DxKit is a headless, zero-server client framework — every capability in this phase resolves to the Browser/Client tier. There is no SSR, API, or CDN tier to misassign work to; the map is included for completeness and to make explicit that no capability in this phase should be pushed to a tier DxKit doesn't have.

## Standard Stack

### Core

No new runtime dependencies are added by this phase — DxKit's zero-runtime-deps posture (project constraint) is preserved. Both SEC-01 and SEC-02 are pure TypeScript additions to existing files (`src/lifecycle.ts`, `src/types/shell.ts`, `src/shell.ts`, `plugins/wallet/src/index.ts`).

### Supporting (consumer-side reference, NOT a DxKit dependency)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dompurify` | 3.4.12 (verified via `npm view`, published 2026-07-11) [VERIFIED: npm registry] | HTML sanitization | Reference implementation for the `sanitizeTemplate` hook in tests, docs examples, and cookbook (Phase 5) — DxKit consumers install and configure this themselves; DxKit never imports it |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bring-your-own sanitizer hook (D-02) | DxKit-bundled minimal sanitizer | Rejected by owner — false security, conflicts with zero-runtime-deps posture; a homegrown allowlist stripper is a well-known source of XSS bypasses (regex/string-based HTML parsing is not reliable) |
| DOMPurify | `sanitize-html`, `xss` (npm packages) | Both are viable consumer-side choices; DOMPurify is the most widely adopted for browser/client-side `innerHTML` sanitization specifically (as opposed to server-side Node sanitization) — mentioned here only as docs/test reference, not a DxKit choice |
| Literal full-key `storageKey` override (D-09) | Auto-namespacing (`${namespace}:wallet`) | Deferred — a shell-wide namespace concept would need to also cover theme/settings keys; D-09 deliberately keeps the wallet fix minimal and unopinionated so the future namespace design isn't painted into a corner |

**Installation:** None required — this phase adds zero dependencies to `package.json` or any plugin's `package.json`.

**Version verification:** `dompurify` verified via `npm view dompurify version` → `3.4.12`, `npm view dompurify time.created` → `2014-05-21` (12 years old), `npm view dompurify` weekly downloads ≈ 50.7M — confirms it is the long-established, actively maintained choice referenced in docs/tests, not a claim requiring further validation.

## Package Legitimacy Audit

No packages are installed by this phase (zero-runtime-deps posture; SEC-01 is hook-only per D-02). `dompurify` is referenced only as a **documentation/test example** of a consumer-supplied sanitizer — it is never added to any `package.json` in this repo.

Ran the legitimacy gate on it anyway, since it will appear in Code Examples and test fixtures:

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `dompurify` | npm | 12 yrs (created 2014-05-21) [VERIFIED: npm registry] | ~50.7M/week [VERIFIED: npm registry] | github.com/cure53/DOMPurify [VERIFIED: npm registry] | `SUS` (automated) → **overridden to OK** | Reference-only in docs/tests, not installed |

**Note on the automated `SUS` verdict:** `gsd-tools query package-legitimacy check` flagged `dompurify` with reason `"too-new"`. This is a **false positive** — the heuristic reads `publishedAt` off the *latest version's* publish timestamp (3.4.12 published 2026-07-11, i.e. yesterday relative to this research), not the package's registry creation date. `npm view dompurify time.created` shows `2014-05-21`, and the package has ~50.7M weekly downloads and a well-known, long-standing source repo (`cure53/DOMPurify`, the same team that maintains other established security tooling). Treat this as a caution for the check itself (recent-version-bump ≠ new-package) rather than a finding about DOMPurify.

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `dompurify` (automated false positive, resolved above — no `checkpoint:human-verify` needed since it is not being installed by DxKit).

## Architecture Patterns

### System Architecture Diagram

```
                         createShell(config)
                                │
                config.lifecycle: LifecycleManagerOptions
                (scriptLoader, styleLoader, templateLoader,
                 timeout, cacheTemplates, sanitizeTemplate)  [D-04]
                                │
                                ▼
                   createLifecycleManager(events, options)
                                │
   ┌────────────────────────────────────────────────────────┐
   │  mount(manifest, container, path)                       │
   │                                                          │
   │  1. requires.plugins check ──fail──▶ dx:error, return    │
   │  2. loadStyle()      (non-blocking; dx:error on fail)    │
   │  3. loadTemplate(url) ◀── templateCache (Map<url,html>)  │
   │       │  cache hit ──▶ raw HTML returned immediately     │
   │       │  cache miss ─▶ fetch (timeout-guarded) ─▶ cache  │
   │       ▼                                                  │
   │  4. sanitizeTemplate(html, manifest)  ◀── NEW (SEC-01)   │
   │       │  configured, throws/rejects                      │
   │       │       └──▶ dx:error{source:'lifecycle:<id>:      │
   │       │                       sanitize'}, return (D-07)  │
   │       │  not configured ──▶ html passed through unchanged│
   │       │                     (backward-compat default)    │
   │       ▼                                                  │
   │  5. container.innerHTML = html   ◀── DOM WRITE            │
   │  6. loadScript() × dependencies (sequential)              │
   │  7. loadScript(entry)                                     │
   │  8. dx:mount / dx:dapp:mounted emitted                    │
   └────────────────────────────────────────────────────────┘

   plugins/wallet: createWallet({ providers, storageKey? })  [D-09]
                                │
              storageKey ?? 'dxkit:wallet'  (closure var, was module const)
                                │
              ┌─────────────────┴──────────────────┐
              ▼                                     ▼
     persistProvider(id)                  getPersistedProvider()
     localStorage.setItem(storageKey, id)  localStorage.getItem(storageKey)
              │                                     │
     init() auto-reconnect ──fail──▶ dx:error{source:'plugin:wallet:reconnect',
                                              cause: err}, persistProvider(null)  [D-12]

     connect() ──eth_requestAccounts returns []──▶ throw Error (no state change,
                                                     no events fired)  [D-11]
```

### Recommended Project Structure

No new files or directories — this phase modifies four existing files in place:

```
src/
├── lifecycle.ts       # LifecycleManagerOptions gets sanitizeTemplate; mount() slots the call
├── types/shell.ts      # ShellConfig: flat loaders removed, `lifecycle?: LifecycleManagerOptions` added
├── shell.ts             # config destructure + runtime throw guard (D-05) + lifecycle forwarding
plugins/wallet/src/
└── index.ts              # STORAGE_KEY → closure var; WalletOptions.storageKey; WR-02/WR-03 fixes
```

### Pattern 1: Fail-closed hook slotted into an existing blocking-failure branch

**What:** The sanitizer call is `await`ed inside the same `try` block that already wraps `loadTemplate()`, immediately before `container.innerHTML = html`. A throw from either step lands in the same `catch`, emits `dx:error` with a stage-specific `source`, and `return`s before injection.

**When to use:** Any time a new failable step is inserted into an existing sequential pipeline that already has an established "emit-and-return" failure contract (see `src/lifecycle.ts:252-264` template block, `:267-281` dependency block, `:284-294` entry block — all three follow this shape).

**Example (illustrative shape, not final code):**
```typescript
// Source: pattern derived from src/lifecycle.ts:252-264 (existing template-fetch branch)
if (manifest.template) {
  try {
    const html = await loadTemplate(manifest.template);
    const sanitized = options.sanitizeTemplate
      ? await options.sanitizeTemplate(html, manifest)
      : html;
    container.innerHTML = sanitized;
  } catch (err) {
    events.emit('dx:error', {
      source: `lifecycle:${manifest.id}:${/* fetch vs sanitize */ 'template'}`,
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return;
  }
}
```
Note: D-08 requires *distinguishing* a fetch failure (`:template`) from a sanitizer failure (`:sanitize`) — this means the sanitize call likely needs its own inner try/catch (or a tagged error) rather than sharing the outer catch verbatim as drawn above. Flagging this as a planning-level implementation detail, not a settled decision.

### Pattern 2: Config restructure with dual-layer breaking-change enforcement (type removal + runtime throw)

**What:** `ShellConfig`'s flat loader fields are deleted from the TypeScript interface (compile-time signal for TS consumers) AND `createShell()` inspects the raw config object at runtime for the presence of those keys, throwing a descriptive `Error` before any lifecycle construction happens (runtime signal for JS/IIFE consumers who bypass the type checker).

**When to use:** Any breaking config-shape change in a library that ships both typed (ESM/CJS+bundler) and untyped (IIFE/`<script>`) consumption paths — the type system alone doesn't protect the IIFE audience.

**Example:**
```typescript
// Source: pattern derived from src/shell.ts:15-26 (existing destructure) + D-05 requirement
export function createShell(config: ShellConfig = {}): Shell {
  const flatLoaderKeys = ['scriptLoader', 'styleLoader', 'templateLoader'] as const;
  const present = flatLoaderKeys.filter((k) => k in config);
  if (present.length > 0) {
    throw new Error(
      `ShellConfig.${present.join('/')} ${present.length > 1 ? 'are' : 'is'} no longer supported — ` +
      `move to config.lifecycle.${present.join('/')}. See migration notes in CHANGELOG.`,
    );
  }

  const { plugins = {}, /* ...other existing fields... */, lifecycle = {} } = config;
  const lc = createLifecycleManager(events, {
    hasPlugin: (name) => registry.has(name),
    ...lifecycle,
  });
  // ...
}
```

### Pattern 3: Closure-scoped config value replacing a module-level constant

**What:** `STORAGE_KEY` moves from a module-level `const` (shared across every `createWallet()` call in the same module scope) to a value resolved once per-instance inside `createWallet()`'s closure, defaulting to the same literal.

**When to use:** Whenever a previously-hardcoded value needs to become configurable per-instance without touching any of its existing call sites' *signatures* — only their closure-captured reference.

**Example:**
```typescript
// Source: pattern derived from plugins/wallet/src/index.ts:154,157-158,174-205
export interface WalletOptions {
  providers: WalletProvider[];
  /** localStorage key for persisting the selected provider. Default: 'dxkit:wallet'. */
  storageKey?: string;
}

export function createWallet(options: WalletOptions): Wallet {
  const providers = options.providers;
  const storageKey = options.storageKey ?? 'dxkit:wallet';
  // persistProvider/getPersistedProvider close over `storageKey` instead of the old module STORAGE_KEY
  // ...
}
```

### Anti-Patterns to Avoid

- **Auto-detecting `window.DOMPurify`:** Explicitly rejected (D-13) — would silently change default injection behavior based on unrelated script-tag load order, violating success criterion 2 ("with no sanitizer configured, behavior is unchanged from 0.1.5").
- **Sanitizing before caching:** Would bake a stale sanitizer's output into the cache, so a later `sanitizeTemplate` config change wouldn't take effect on cache hits, and cache invalidation semantics would need to account for sanitizer changes too. D-06 keeps the cache holding only raw fetched HTML.
- **"Inject raw + warn" on sanitizer failure:** Explicitly rejected in CONTEXT.md specifics — defeats the entire purpose of a fail-closed security hook. A sanitizer that can silently be bypassed by throwing is not a security control.
- **Namespace-building magic for `storageKey`:** e.g. auto-deriving `${appId}:wallet` from some ambient config. Rejected (D-09) as premature — the shell-wide namespace idea is deferred; a literal override is simpler and doesn't foreclose that future design.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| HTML sanitization for XSS prevention | A regex/string-based tag/attribute stripper inside DxKit | Consumer-supplied DOMPurify (or equivalent) via the `sanitizeTemplate` hook | String/regex-based HTML sanitization is a well-documented source of bypasses (nested tags, mutation XSS, encoding tricks); DOMPurify's DOM-based parse-then-serialize approach handles cases a naive stripper cannot, and it is the ecosystem-standard tool for this exact job |

**Key insight:** This phase's "don't hand-roll" boundary is already enforced by D-02 — the research finding here is confirmatory, not corrective. The one thing worth flagging for the planner: don't let scope creep introduce even a *minimal* built-in fallback sanitizer "just for the unconfigured case" — that would violate both D-02 and success criterion 2.

## Runtime State Inventory

This phase changes a persisted-data key's *configurability* (SEC-02) and a config *shape* (D-04/D-05, compile-time/construction-time only, not persisted). Both were explicitly scoped in CONTEXT.md; this section confirms no additional runtime state is implicated.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `localStorage['dxkit:wallet']` — single string value (provider ID), written/read only by `plugins/wallet/src/index.ts`. No other datastore keys the wallet, theme, or settings state under this phase's touched code. | Code edit only (closure var swap, D-09). **No data migration** — D-10 explicitly keeps the existing key's semantics unchanged for the default case; a custom `storageKey` simply starts an empty new key, old key is left untouched (may still be read by another app instance on the same origin). |
| Live service config | None — DxKit has no backend/live-service config surface; `ShellConfig` is passed programmatically at `createShell()` call time, not persisted anywhere. | None |
| OS-registered state | None — browser-only client library, no OS-level registration of any kind. | None |
| Secrets/env vars | None — no secrets or env vars are read or written by this phase's code. | None |
| Build artifacts | None — no `package.json`/build config changes; `tsup.config.ts` outputs are unaffected by an internal API restructure. | None |

**Verified by:** direct reads of `plugins/wallet/src/index.ts` (only two functions touch `STORAGE_KEY`), `src/shell.ts`/`src/types/shell.ts` (config is constructor-time only, never persisted), and `.planning/codebase/CONCERNS.md` §"Wallet Provider Persistence Relies on localStorage Key" (confirms `dxkit:wallet` is the only hardcoded storage key this phase touches; theme/settings keys are explicitly out of scope per D-09/Deferred Ideas).

## Common Pitfalls

### Pitfall 1: Conflating "fetch failure" and "sanitize failure" `dx:error` sources
**What goes wrong:** If the sanitize call shares the exact same try/catch as the `loadTemplate()` fetch call without any way to distinguish which step threw, both failure modes end up emitting `source: 'lifecycle:<id>:template'`, violating D-08's requirement for a distinct `:sanitize` source.
**Why it happens:** The natural, minimal-diff implementation is to just add one more `await` inside the existing try block — which is correct for the fail-closed *behavior* (D-07) but insufficient for the *source-labeling* requirement (D-08) without extra bookkeeping (e.g. a nested try/catch around just the sanitize call, or tagging the thrown error).
**How to avoid:** Wrap the sanitize call in its own try/catch (or equivalent discriminator) so the `dx:error` source can be `lifecycle:<id>:sanitize` specifically, distinct from `lifecycle:<id>:template` for fetch failures.
**Warning signs:** A test asserting `errorHandler.mock.calls[0][0].source` equals `'lifecycle:<id>:sanitize'` for a sanitizer-throw case fails or returns `:template` instead.

### Pitfall 2: Underestimating the `ShellConfig` flat-loader migration surface
**What goes wrong:** Treating D-05 as "just update the type" and missing that **46 occurrences** of `scriptLoader:`/`styleLoader:`/`templateLoader:`/`testLoaders` spread exist in `tests/shell.test.ts` alone (verified via grep this research session), every one of which will now throw at `createShell()` construction and fail every existing shell test until migrated to `{ lifecycle: { ... } }`.
**Why it happens:** The change is conceptually small (move 3 fields into a nested object) but mechanically wide — it touches every test file that constructs a shell with a custom loader, not just the sanitizer-specific new tests.
**How to avoid:** Budget an explicit task for migrating `tests/shell.test.ts`'s `testLoaders` helper and every inline `createShell({ scriptLoader: ..., ... })` call to the nested shape, as a precondition for the D-05 runtime-throw test passing the rest of the suite.
**Warning signs:** Running `make test` after implementing D-05 shows dozens of failures in `shell.test.ts` unrelated to the sanitizer or storage-key logic — that's this migration surface, not a regression.

### Pitfall 3: Docs going stale this phase (expected, not a bug)
**What goes wrong:** `docs/getting-started.md:158-159`, `docs/system-internals.md:184`, and `docs/api-reference.md:87-89,328-340` all reference the flat `scriptLoader`/`styleLoader`/`templateLoader` fields directly on `ShellConfig`. After D-04/D-05 ship, these examples will no longer compile/run.
**Why it happens:** DOC-01/DOC-02/DOC-03 (verify-docs-against-code, slop removal, gap-fill) are explicitly Phase 5 scope — this phase is not expected to fix docs.
**How to avoid:** Nothing to avoid — this is expected drift. The `BREAKING CHANGE:` footer + migration notes required by CONTEXT.md's constraints should be sufficient for Phase 5 to pick up cleanly; the planner does not need to add a docs-fix task in *this* phase, but should not be alarmed when `grep` post-phase shows the docs are now inaccurate.
**Warning signs:** None needed — this is a known, accepted, sequenced-later gap, not a phase-3 defect.

### Pitfall 4: Removing `address!` non-null assertions without an equivalent guard
**What goes wrong:** D-11 removes the `address!` non-null assertions in `updateState`'s emit paths (`plugins/wallet/src/index.ts:214,218`). If the guard that replaces them is dropped rather than replaced, TypeScript's `strict: true` will fail to compile on `dx.events.emit('dx:plugin:wallet:connected', { address: newState.address, ... })` because `newState.address` is typed `string | null` while the event payload requires `address: string`.
**Why it happens:** The assertions were doing double duty — silencing the type error AND (incorrectly) asserting a runtime invariant that D-11 proves can be false (empty accounts array). Simply deleting `!` without adding a real guard breaks the build.
**How to avoid:** Since D-11 makes `connect()` throw before ever reaching `updateState` with an empty-accounts result, the `newState.connected && newState.address` combination should be structurally guaranteed non-null by the time `updateState` runs — but this needs either a type-narrowing check (`if (newState.connected && newState.address)`) or a documented invariant test, not a bare re-assertion.
**Warning signs:** `tsc`/build fails with a type error on the `updateState` emit lines after removing `!`, or (worse) a new `!` is silently reintroduced.

### Pitfall 5: `security_enforcement` config flag raises scrutiny bar for this phase specifically
**What goes wrong:** `.planning/config.json` has `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: "high"` — this phase (unlike Phases 1/2) directly touches `innerHTML` DOM injection and client-side storage, both ASVS-relevant surfaces. Planning or reviewing this phase without the Security Domain section's ASVS mapping in mind risks under-scrutinizing the fail-closed guarantee (D-07) or the storage-isolation boundary (D-09/D-10).
**Why it happens:** Easy to treat this as "just add an optional hook" when the actual security property being delivered is "a misconfigured or failing sanitizer must never result in unsanitized injection" — a property that needs explicit negative-path test coverage, not just happy-path plumbing tests.
**How to avoid:** Ensure the plan's verification step explicitly tests the fail-closed path (sanitizer throws → `dx:error` + no injection, per D-07/D-15) and the unchanged-default path (no sanitizer configured → raw HTML injected verbatim, proving criterion 2), not just "sanitizer is called."
**Warning signs:** Test suite covers "sanitizer strips a payload" but not "a sanitizer that throws never lets its input reach `innerHTML`."

## Code Examples

### Sanitizer hook type export (new, for `src/index.ts` barrel)

```typescript
// Source: pattern derived from src/lifecycle.ts existing ScriptLoader/StyleLoader/TemplateLoader export style
export type TemplateSanitizer = (html: string, manifest: DappManifest) => string | Promise<string>;

export interface LifecycleManagerOptions {
  // ...existing fields (scriptLoader, styleLoader, templateLoader, hasPlugin, timeout, cacheTemplates)...
  /**
   * Optional hook that runs on fetched template HTML before it is injected via `innerHTML`.
   * Applies to template HTML only — dapp entry scripts are trusted code whose runtime DOM
   * writes are outside this hook's reach (D-14). With no sanitizer configured, injection
   * behavior is unchanged from 0.1.5 (backward-compatible default). A throw/rejection aborts
   * the mount — never injects HTML the sanitizer couldn't process (D-07).
   */
  sanitizeTemplate?: TemplateSanitizer;
}
```

### Consumer usage with DOMPurify (docs/cookbook reference shape — Phase 5 will formalize)

```typescript
// Source: pattern derived from DOMPurify's documented synchronous sanitize() API (websearch, cure53/DOMPurify)
import DOMPurify from 'dompurify';
import { createShell } from '@dnzn/dxkit';

const shell = createShell({
  lifecycle: {
    sanitizeTemplate: (html) => DOMPurify.sanitize(html), // sync return satisfies string | Promise<string>
  },
});
```

### Wallet storage key threading (existing pattern, options resolved once at construction)

```typescript
// Source: pattern derived from src/lifecycle.ts:192 (options.timeout ?? 30000) — same additive-default convention
export interface WalletOptions {
  providers: WalletProvider[];
  storageKey?: string;
}

export function createWallet(options: WalletOptions): Wallet {
  const storageKey = options.storageKey ?? 'dxkit:wallet';
  // persistProvider/getPersistedProvider (plugins/wallet/src/index.ts:174-205) reference
  // `storageKey` instead of the deleted module-level STORAGE_KEY constant.
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `ShellConfig` flat loader fields (`scriptLoader`/`styleLoader`/`templateLoader` at top level) | Nested `ShellConfig.lifecycle: LifecycleManagerOptions` group | This phase (0.2.0, D-04/D-05) | Breaking change — TS compile error + runtime throw for old shape; closes the Phase 2 gap where `timeout`/`cacheTemplates` were unreachable from `createShell()` |
| No template sanitization surface | Optional `sanitizeTemplate` hook, hook-only (no bundled sanitizer) | This phase (0.2.0, SEC-01) | Additive default-safe change — existing 0.1.5 behavior is the unconfigured default; opt-in hardening for consumers who add DOMPurify or similar |
| Hardcoded `dxkit:wallet` localStorage key | Configurable `WalletOptions.storageKey`, same default | This phase (0.2.0, SEC-02) | Additive — existing single-app consumers see no change; multi-app-on-one-origin consumers gain isolation |
| DOMPurify's Trusted Types support (`RETURN_TRUSTED_TYPE`) | Confirmed current as of DOMPurify 3.x — synchronous `sanitize()`, opt-in `TrustedHTML` return for CSP `require-trusted-types-for` environments | Ongoing DOMPurify 2.x→3.x evolution | Not directly consumed by DxKit (hook-only), but relevant context for Phase 5's CSP guidance (DOC-03) — a consumer wanting full Trusted Types CSP compliance would configure `sanitizeTemplate` to call `DOMPurify.sanitize(html, { RETURN_TRUSTED_TYPE: true })` and handle the `TrustedHTML` return, which is *not* a `string` — worth flagging as a potential signature gap for Phase 5 docs (see Open Questions) |

**Deprecated/outdated:** None specific to this phase's domain — DOMPurify's sanitize() API and localStorage namespacing are both long-stable, well-established patterns with no recent breaking changes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Exact option name `sanitizeTemplate` and type name `TemplateSanitizer` are illustrative — CONTEXT.md leaves this to Claude's Discretion, not locked | Code Examples, Architecture Patterns | Low — naming is cosmetic; any consistent name satisfies success criteria. Flagged only so the planner doesn't treat the illustrated name as locked. |
| A2 | The `DOMPurify.sanitize(html, { RETURN_TRUSTED_TYPE: true })` return-type mismatch (`TrustedHTML` vs the hook's `string` contract) has not been explicitly reconciled in CONTEXT.md's D-01 signature | State of the Art, Open Questions | Low for this phase (Trusted Types CSP integration is out of scope — Phase 5 DOC-03) but worth a footnote in Phase 5's cookbook so consumers attempting full Trusted Types compliance don't hit a silent type mismatch |
| A3 | The exact mechanism for distinguishing sanitizer-throw from fetch-throw (nested try/catch vs. tagged error) is a planner-level implementation detail, not resolved by CONTEXT.md decisions | Pattern 1, Pitfall 1 | Medium — if unaddressed, D-08's distinct-source requirement (`:sanitize` vs `:template`) could be silently unmet; flagged explicitly so the plan includes this as a concrete task, not an assumed side-effect |

## Open Questions

1. **Does the sanitizer hook need a documented Trusted Types caveat?**
   - What we know: DOMPurify's `RETURN_TRUSTED_TYPE: true` mode returns `TrustedHTML`, not `string` — the hook's declared signature (`string | Promise<string>`) doesn't accommodate that return type directly.
   - What's unclear: Whether any DxKit consumer will actually need full Trusted Types CSP compliance in the near term, or whether `RETURN_TRUSTED_TYPE: false` (default) is sufficient for all realistic use cases this milestone targets.
   - Recommendation: No action needed in Phase 3 — D-14 already scopes the JSDoc to "template HTML only" without promising Trusted Types support. Flag for Phase 5 (DOC-03/CSP guidance) to document that `sanitizeTemplate` expects a `string` return, so DOMPurify consumers should call it without `RETURN_TRUSTED_TYPE` or `.toString()` the result themselves.

2. **Exact mechanism for `:sanitize` vs `:template` source discrimination (Pitfall 1 / A3)**
   - What we know: D-08 requires a distinct `lifecycle:<id>:sanitize` source; the natural implementation slots the sanitize call inside the existing template try/catch.
   - What's unclear: Whether the plan should use a nested try/catch around just the sanitize call, or some other discriminator (e.g. a custom error subclass/tag).
   - Recommendation: Planner should make this an explicit task-level decision — nested try/catch is the simplest, most consistent-with-existing-patterns approach (matches how `styles`/`dependency`/entry blocks each get their own try/catch already).

## Environment Availability

Skipped — this phase has no new external tool, service, or runtime dependencies. It modifies existing TypeScript source files using the project's already-established toolchain (Node 18+, pnpm, vitest, happy-dom, Biome — all already verified available in prior phases). No new CLI, database, or network service is introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 (config: `vitest.config.ts`, environment: `happy-dom`) |
| Config file | `/Users/derks/Development/Denizen/dxkit/vitest.config.ts` |
| Quick run command | `npx vitest run tests/lifecycle.test.ts plugins/wallet/tests/wallet.test.ts` |
| Full suite command | `npx vitest run` (equivalently `make test`, which runs lint first) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| SEC-01 | Sanitizer hook called with `(html, manifest)`, result awaited, injected in place of raw HTML | unit | `npx vitest run tests/lifecycle.test.ts -t "sanitiz"` | ❌ new tests needed in `tests/lifecycle.test.ts` |
| SEC-01 | With no sanitizer configured, injection behavior unchanged from 0.1.5 (raw HTML incl. `<script>`/`onerror` payloads passes verbatim) | unit (XSS-shaped fixture) | `npx vitest run tests/lifecycle.test.ts -t "unsanitized"` | ❌ new test needed |
| SEC-01 | Sanitizer throw/rejection aborts mount, emits `dx:error` source `lifecycle:<id>:sanitize`, no injection | unit (fail-closed) | `npx vitest run tests/lifecycle.test.ts -t "sanitize fail"` | ❌ new test needed |
| SEC-01 | Cache stores raw HTML; sanitizer re-runs on every mount even for cached templates | unit | `npx vitest run tests/lifecycle.test.ts -t "cache"` | ⚠️ existing `describe('template cache', ...)` block exists (`tests/lifecycle.test.ts:686-785`) — extend, don't replace |
| D-04/D-05 | `ShellConfig.lifecycle` passthrough reaches `LifecycleManagerOptions`; flat loader keys throw at `createShell()` | unit | `npx vitest run tests/shell.test.ts -t "lifecycle"` | ❌ new tests needed; existing `testLoaders` helper (`tests/shell.test.ts:6-9`) and 46 call sites need migration first |
| SEC-02 | `WalletOptions.storageKey` isolates persistence — two wallet instances with different keys don't collide | unit | `npx vitest run plugins/wallet/tests/wallet.test.ts -t "storageKey"` | ❌ new test needed; existing storage tests hardcode `'dxkit:wallet'` (`plugins/wallet/tests/wallet.test.ts:248,419,439,448,555`) as a pattern to follow |
| WR-02 | `connect()` throws when `eth_requestAccounts` returns `[]`, no state change, no events | unit (regression) | `npx vitest run plugins/wallet/tests/wallet.test.ts -t "empty accounts"` | ❌ new test needed |
| WR-03 | Init auto-reconnect failure emits `dx:error` source `plugin:wallet:reconnect` with `cause`, still clears persisted provider | unit (regression) | `npx vitest run plugins/wallet/tests/wallet.test.ts -t "reconnect"` | ❌ new test needed |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run tests/lifecycle.test.ts` or `npx vitest run plugins/wallet/tests/wallet.test.ts` depending on which file the task touches
- **Per wave merge:** `npx vitest run` (full suite) — critical this phase specifically because D-05's runtime throw will break any test file still using flat loaders, including ones outside `lifecycle.test.ts`/`wallet.test.ts`
- **Phase gate:** Full suite green (`make test`, includes Biome lint) before `/gsd-verify-work`

### Wave 0 Gaps
- No new test files needed — `tests/lifecycle.test.ts` and `plugins/wallet/tests/wallet.test.ts` already exist with established patterns (manifest builders, `mockEIP1193Provider`, fake-timer blocks) that new tests should extend, not duplicate.
- `tests/shell.test.ts`'s `testLoaders` helper (line 6-9) and its 46 flat-loader call sites are a **required precondition**, not a gap in coverage — they must be migrated to the nested `lifecycle` shape before the D-05 runtime-throw behavior can be tested without breaking every other shell test.
- No framework install needed — vitest/happy-dom already configured project-wide.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | No | Wallet `connect()` is a client-side capability handshake with an injected provider, not an authentication system DxKit issues/verifies — SEC-01/SEC-02 don't touch auth |
| V3 Session Management | Partial | `localStorage['dxkit:wallet']` (or configured key) persists a provider-selection token across page loads — not a session token, but SEC-02's isolation directly addresses cross-app session-state bleed on shared origins |
| V4 Access Control | No | No access-control decisions are made in this phase's code paths |
| V5 Input Validation | **Yes** | SEC-01's `sanitizeTemplate` hook is the input-validation/output-encoding control point for fetched template HTML before DOM injection — standard control is a DOM-based HTML sanitizer (DOMPurify or equivalent), never a hand-rolled stripper (see Don't Hand-Roll) |
| V6 Cryptography | No | No cryptographic operations in this phase; storage remains unencrypted plaintext (STOR-01 encryption is explicitly out of milestone scope) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Reflected/stored XSS via `innerHTML` injection of fetched template HTML | Tampering / Elevation of Privilege (arbitrary script execution in `window.__DXKIT__` context) | Consumer-supplied DOM-based sanitizer (DOMPurify) via the `sanitizeTemplate` hook (SEC-01); fail-closed on sanitizer error (D-07) so a broken sanitizer never silently degrades to "inject anyway" |
| Cross-app information disclosure via shared `localStorage` key | Information Disclosure (App A's wallet-provider selection leaks into App B; disconnect in one clears state in the other) | Per-app configurable `storageKey` (SEC-02/D-09) — each DxKit instance on a shared origin uses a distinct key |
| CSP bypass / lack of defense-in-depth for `innerHTML` + external script loading | Tampering (in the absence of CSP, sanitizer is the only control) | Out of this phase's scope — CSP header guidance is Phase 5 (DOC-03); this phase's sanitizer hook is one layer, not a substitute for CSP `script-src`/`require-trusted-types-for` |
| Wallet state desync — `connected: true` with `address: undefined` (pre-WR-02) | Tampering (violates the `{ address: string }` event contract, could crash naive consumers doing `address.slice(0, 6)`) | `connect()` throws on empty accounts instead of emitting a malformed state (D-11) |
| Silent failure masking a security-relevant condition (pre-WR-03: auto-reconnect failure swallowed) | Repudiation / Denial of Service (user has no signal their wallet didn't actually reconnect, may proceed assuming connected) | `dx:error` emission on reconnect failure (D-12) — consistent with this milestone's core value ("failures are visible, never silent") |

## Sources

### Primary (HIGH confidence)
- `src/lifecycle.ts` (full file read) — exact mount flow, cache wrapper, error-emit conventions
- `src/shell.ts` (full file read) — config destructure, `createLifecycleManager` wiring
- `src/types/shell.ts` (full file read) — current `ShellConfig` shape
- `plugins/wallet/src/index.ts` (full file read) — `STORAGE_KEY`, `persistProvider`/`getPersistedProvider`, `connect()`, `updateState`, `init()` reconnect catch
- `src/types/events.ts` (full file read) — `dx:error` payload shape
- `src/types/manifest.ts`, `src/types/interfaces.ts` (full file read) — `DappManifest`, `Wallet`/`WalletProvider`/`WalletState` contracts
- `tests/lifecycle.test.ts`, `plugins/wallet/tests/wallet.test.ts` (full file read) — existing test conventions and fixtures to extend
- `.planning/codebase/CONCERNS.md` §"XSS Risk in Template Injection", §"Wallet Provider Persistence Relies on localStorage Key" — origin of this phase's scope
- `npm view dompurify version/time.created/repository.url` — [VERIFIED: npm registry] package facts

### Secondary (MEDIUM confidence)
- WebSearch: DOMPurify synchronous `sanitize()` API, `RETURN_TRUSTED_TYPE` behavior — cross-referenced against DOMPurify's own GitHub repo (cure53/DOMPurify) and MDN's Trusted Types API docs [CITED: github.com/cure53/DOMPurify, developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API]
- WebSearch: localStorage key namespacing pattern for multi-app same-origin collisions — general industry pattern, not tied to a single authoritative source, but consistent across multiple independent sources [CITED: multiple, see websearch results]

### Tertiary (LOW confidence)
- None — no unverified/single-source claims are load-bearing for this phase's plan.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; DOMPurify facts directly verified via `npm view`
- Architecture: HIGH — every pattern is grounded in direct reads of the actual files this phase touches, with line-accurate references
- Pitfalls: HIGH — the 46-occurrence migration-surface count and the `:sanitize`-vs-`:template` source-discrimination gap were both discovered via direct grep/code-read this session, not inferred

**Research date:** 2026-07-12
**Valid until:** 2026-08-11 (30 days — stable domain, no fast-moving dependencies; re-verify DOMPurify version if Phase 5 cookbook work happens significantly later)

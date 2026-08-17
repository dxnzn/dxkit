# Phase 5: Documentation — Truth Pass - Research

**Researched:** 2026-07-14
**Domain:** Documentation verification against source of truth (TypeScript framework + 4 plugins); CSP/security technical writing
**Confidence:** HIGH

## Summary

This phase has no new code surface to design — its "research" job is to compile the single
source of ground truth the doc-by-doc sweep checks every claim against, then hand the planner
concrete landing sites for the three folded code fixes. Every fact below was read directly from
`src/`, `plugins/*/src/`, and `tests/` on the current branch (`gsd/phase-05-documentation-truth-pass`,
which sits on top of Phases 1–4, already merged). Nothing here is inferred from docs or from
training-data assumptions about what a framework "usually" does — where a doc claim could not be
confirmed against source it is flagged in the Drift Map instead of asserted as truth.

Three findings shape planning most:

1. **The event catalog has drifted hardest.** `docs/events-reference.md`'s `dx:error` section
   lists only 4 of the ~16 actual `source` strings emitted across `src/` and `plugins/*/src/`
   (verified by grep — see Event Catalog). This is the single highest-value doc to rewrite from
   scratch against the table in this document rather than edit incrementally.
2. **One breaking-change example already reads correctly** (`docs/getting-started.md:157-161`
   nests `scriptLoader`/`styleLoader` under `lifecycle:`, matching 0.2.0) — so D-05's flat-loader
   removal is not universally undocumented; the sweep must still check every doc individually
   since correctness is doc-by-doc, not global.
3. **No doc currently mentions CSP** (`grep -rl "CSP\|Content-Security-Policy" docs/ README.md`
   returns nothing) — `docs/security.md` (D-08) is a wholesale new document, not a rewrite.

**Primary recommendation:** Sequence the three folded code fixes (D-15/D-16/D-17) first, in a
single wave, each with its regression test — then run the doc-by-doc sweep against this
document's Code Truth tables, doc file by doc file, logging every correction to the D-01 drift
log. `docs/security.md` is net-new content assembled from the CSP/DOMPurify findings below plus
`.planning/codebase/CONCERNS.md`'s "Known Limitations" and "Deployment Concerns" sections.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Event catalog documentation | Docs (this phase) | Core (`src/events.ts`, `src/types/events.ts`) | Docs describe; core defines the type-level contract (`EventMap`) that is the actual source of truth |
| Config defaults documentation | Docs (this phase) | Core (`src/shell.ts`, `src/lifecycle.ts`) | Defaults are resolved at construction in core; docs must restate the literal values, not re-derive them |
| CSP / security guidance | Docs (this phase, `docs/security.md`) | Core (`src/lifecycle.ts` loaders) | Docs reason about what the *browser* enforces given what core's loaders do (`innerHTML`, dynamic `<script>`/`<link>`, `fetch`) — no runtime CSP enforcement lives in DxKit itself |
| Registry-fallback error surfacing (D-15) | Core (`src/shell.ts`) | Docs (`docs/events-reference.md`, `docs/getting-started.md`) | Code change first; docs then describe the resulting behavior per D-03 ("code is truth") |
| Disable-mid-flight navigation (D-16) | Core (`src/shell.ts`) | Docs (`docs/dapp-development.md`, `docs/system-internals.md`) | Same — behavior change lands before the doc describing it is verified |
| inFlightMountId hygiene (D-17) | Core (`src/lifecycle.ts`) | Tests (`tests/shell.test.ts`, `tests/router.test.ts`) | Internal invariant tightening + test-file nits; no public-facing doc describes `inFlightMountId` today (it's not public API) |
| Compile-checked snippets (D-04) | Tooling (throwaway harness, not committed) | Docs (all `.md` files with `ts`/`js` code fences) | The harness lives outside `src/`; it consumes the real published types as an oracle |

## Standard Stack

Not applicable in the conventional sense — this phase adds no runtime dependency (project stays
zero-runtime-deps per `.claude/CLAUDE.md` §Constraints). The only "stack" decision is the D-04
compile-check harness, which is dev-tooling-only and not shipped.

### Supporting (dev-only, doc-referenced, never installed by DxKit itself)

| Library | Verified version | Purpose | When referenced |
|---------|---------|---------|-------------|
| `dompurify` | `3.4.12` (npm, checked 2026-07-14) [VERIFIED: npm registry] | Bring-your-own template sanitizer for `sanitizeTemplate` hook (`SEC-01`) | `docs/security.md` (D-10) sanitizer recipes, both ESM and IIFE-global consumption modes; `docs/configuration.md` already has one ESM DOMPurify snippet (line 73) that must stay consistent |
| TypeScript | `5.8.3` (repo `devDependency`, unchanged this milestone) [VERIFIED: package.json] | Oracle for the D-04 compile-check harness | Scratch harness only, not committed |

**No new packages are installed by this phase.** DOMPurify is referenced in doc prose/snippets
only — the consumer installs it themselves. Because DxKit itself does not add it as a dependency,
the Package Legitimacy Gate protocol (which governs packages this phase would install into the
project) does not apply; the `dompurify` version cited above was still verified against the npm
registry (`npm view dompurify version`) so the doc snippet isn't citing a stale or hallucinated
version.

## Package Legitimacy Audit

**Not applicable.** This phase installs no packages — `package.json` gains no new
`dependencies` or `devDependencies`. The one third-party name that appears in doc prose
(`dompurify`) is a bring-your-own consumer choice, never a DxKit install; its version was
spot-checked (`npm view dompurify version` → `3.4.12`) purely so the doc snippet cites a real,
current version rather than a stale or invented one.

## Architecture Patterns

### Doc-Sweep Data Flow

```text
 05-CONTEXT.md (locked decisions)          05-RESEARCH.md (this file — code truth)
            │                                          │
            ▼                                          ▼
   ┌──────────────────────────────────────────────────────────┐
   │  Wave 0 — Folded code fixes (D-15, D-16, D-17)            │
   │  src/shell.ts (D-15, D-16) → src/lifecycle.ts (D-17)      │
   │  each fix ships with its own regression test              │
   └──────────────────────────┬───────────────────────────────┘
                               ▼
   ┌──────────────────────────────────────────────────────────┐
   │  Wave 1 — Doc-by-doc sweep (D-02), one doc = one unit     │
   │  For each of 14 docs/ files + README.md + example:        │
   │    1. Read doc claim-by-claim                             │
   │    2. Check claim against this RESEARCH.md's code-truth   │
   │       table (event/config/behavior) — or against source   │
   │       directly if the claim isn't covered here            │
   │    3. Correct drift in place (D-03: code is truth)         │
   │    4. Apply slop bar (D-13) + README voice (D-14)          │
   │    5. Log the doc's before/after in the D-01 drift log     │
   └──────────────────────────┬───────────────────────────────┘
                               ▼
   ┌──────────────────────────────────────────────────────────┐
   │  Wave 2 — New docs/security.md (D-08/D-09/D-10/D-11)      │
   │  Sourced from CONCERNS.md + lifecycle.ts loader reasoning  │
   │  Gets a README doc-table row (D-12)                        │
   └──────────────────────────┬───────────────────────────────┘
                               ▼
   ┌──────────────────────────────────────────────────────────┐
   │  Wave 3 — Cross-doc consistency sweep (D-02)                │
   │  Catch contradictions introduced by independent doc edits  │
   │  (e.g. two docs describing the same event differently)     │
   └──────────────────────────┬───────────────────────────────┘
                               ▼
                     Drift log (D-01) = phase's proof
```

### Recommended Sweep Order (not a file structure — a work-unit order)

The docs surface has no new files to create except `docs/security.md`; recommended order
minimizes rework by doing high-fanout/foundational docs first:

1. `docs/events-reference.md` — highest drift concentration (event catalog below); other docs
   quote event names/payloads and should be checked against the corrected version, not the stale one.
2. `docs/api-reference.md` — public type surface; `docs/configuration.md` and per-plugin docs
   restate option shapes that must match.
3. `docs/configuration.md`, `docs/getting-started.md` — config defaults + migration section (D-05).
4. `docs/dapp-development.md`, `docs/system-internals.md` — D-16 routing-behavior description.
5. `docs/plugin-development.md`, `docs/plugins/*.md` — plugin option/event truth.
6. `docs/cookbook.md`, `docs/development.md`, `docs/testing.md` — lower fanout, edit last.
7. `README.md` — doc table + install claims, fixed after the docs it indexes are settled.
8. `docs/security.md` — net-new, can be written in parallel with the sweep since it doesn't
   depend on other docs being corrected first (only on source + CONCERNS.md).
9. `examples/getting-started/` — spot-check against final `ShellConfig`/manifest shape (see
   Folded-Fix Landing Sites → D-04 note: the example already uses IIFE + nested `lifecycle`
   correctly, no flat loaders found).
10. Cross-doc consistency pass.

### Anti-Patterns to Avoid

- **Editing a doc from memory of "what DxKit usually does":** every correction must trace to a
  specific file:line read this phase (or in the sweep). This document's tables are a starting
  index, not a substitute for reading the doc's actual claims.
- **Silently softening a wrong claim instead of correcting or deleting it (D-13):** "may emit an
  error" when the code always emits is scope creep of hedging — state the actual behavior.
- **Reopening shipped code to make a doc's claim true (D-03):** if a doc describes behavior that's
  actually a bug, describe the real (buggy) behavior and file a todo — do not fix the bug here
  unless it's D-15/D-16/D-17.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML sanitization for `docs/security.md` examples | A custom regex/strip-tags snippet | DOMPurify (`sanitize-template` hook consumer example) | Phase 3 D-02 already rejected a built-in sanitizer as "false security" — the docs must not contradict that by suggesting a homegrown alternative |
| TypeScript snippet verification (D-04) | Manually re-reading every snippet against `src/types/` by eye | A throwaway `tsc --noEmit` harness importing the real `src/types/index.ts` | Manual eyeballing is exactly how the flat-loader-shape drift would have been missed originally; a compiler catches type-shape drift mechanically |
| CSP policy correctness | Guessing directive syntax from memory | MDN CSP reference + OWASP CSP Cheat Sheet, reasoned against actual loader code | CSP syntax has sharp edges (nonce vs strict-dynamic vs hash); getting a directive wrong in copy-paste docs would ship a broken (or falsely-reassuring) security guide |

**Key insight:** This phase's "don't hand-roll" risk is almost entirely about *documentation
methodology* (verify mechanically, don't eyeball) rather than about avoiding a library — there's
no new production code being written except the three folded fixes.

## Code Truth: Event Catalog

Read from `src/types/events.ts` (`EventMap`, `SHELL_EVENTS`), `src/events.ts`, every
`events.emit('dx:error', …)` call site, and each plugin's `dx.events.emit(...)` call (grepped
exhaustively across `src/*.ts` and `plugins/*/src/index.ts` — see Sources for the exact grep).

### Shell / lifecycle events (`SHELL_EVENTS`, cannot be registered at runtime)

| Event | Payload (`EventMap`) | Emitted from | Notes |
|---|---|---|---|
| `dx:ready` | `Record<string, never>` (empty) | `src/shell.ts:364`, end of `init()` | Fires once, after initial route resolve/mount attempt |
| `dx:route:changed` | `{ path: string; manifest?: DappManifest }` | `src/shell.ts:382-385`, end of `handleRouteChange()` | `manifest` is `undefined` (not `null`) on unmatched routes — `manifest ?? undefined` |
| `dx:mount` | `{ id: string; container: HTMLElement; path: string }` | `src/lifecycle.ts:421` | Dispatched to the *dapp* — its contract is to listen for this and render. `path` falls back to `manifest.route` if not passed |
| `dx:dapp:mounted` | `{ id: string }` | `src/lifecycle.ts:422` | Broadcast (distinct from `dx:mount`) — fires immediately after |
| `dx:unmount` | `{ id: string }` | `src/lifecycle.ts:432` | Dapp's teardown signal |
| `dx:dapp:unmounted` | `{ id: string }` | `src/lifecycle.ts:433` | Broadcast pair to `dx:unmount` |
| `dx:route:subpath` | `{ id: string; path: string; previousPath: string }` | `src/shell.ts:404` (same-dapp subpath nav) and `:439` (fresh-path catch-up after a mount that raced a subpath nav) | Fired when navigating within an already-mounted dapp's route tree, no remount |
| `dx:dapp:enabled` | `{ id: string }` | `src/shell.ts:126` | `enableDapp()` |
| `dx:dapp:disabled` | `{ id: string }` | `src/shell.ts:145` | `disableDapp()` — fires even when the dapp had no active/pending mount |
| `dx:error` | `{ source: string; error: Error }` | Many sites — see full source table below | The `error` is always an `Error` instance; sites that catch non-Error throws wrap with `new Error(String(err))` |
| `dx:plugin:registered` | `{ name: string }` | `src/shell.ts:320` | Once per plugin during `init()`, before plugin `init()` is called |
| `dx:event:registered` | `{ source: string; events: string[] }` | `src/events.ts:130` | Fired by `EventRegistry.registerEvent()` when ≥1 new event name is registered (no-op re-registration by the same source does not re-fire) |

### `dx:error` — complete `source` string catalog (verified by grep, 2026-07-14)

This is the highest-drift area (`docs/events-reference.md:163` lists only 4 of these). Every
row below is a literal string found at the cited call site.

| `source` string | File:line | Trigger |
|---|---|---|
| `shell:manifest` | `src/shell.ts:192` | `loadDappManifest()` — non-OK HTTP response fetching a dapp-entry manifest (WR-01) |
| `shell:manifest` | `src/shell.ts:200` | `loadDappManifest()` — fetched manifest fails `isValidManifest()` |
| `shell:manifest` | `src/shell.ts:216` | `loadDappManifest()` — fetch throws or `res.json()` parse fails (network + parse indistinguishable by design, `cause` preserves original) |
| `shell:manifest` | `src/shell.ts:274` | `normalizeAndValidateManifests()` — any-tier manifest fails `isValidManifest()` (tier-uniform validation, D-07 of Phase 4) |
| `shell:route` | `src/shell.ts:285` | `normalizeAndValidateManifests()` — manifest route is empty/whitespace-only after trim, discarded |
| `shell:manifest` | `src/shell.ts:301` | `normalizeAndValidateManifests()` — duplicate exact route across two manifests (both ids named in message; first-registered wins at resolve time) |
| `` `plugin:${name}` `` (e.g. `plugin:bad`) | `src/shell.ts:334` | Plugin `init()` throws — shell continues, that plugin is simply unavailable |
| `shell:mount` | `src/shell.ts:417` | `mountDapp()` — `#dx-mount` container not found in the DOM |
| **NOT YET SURFACED (D-15 target)** | `src/shell.ts:237-244` | `loadManifests()` registry.json fetch/parse failure — currently a silent `catch { /* No registry.json — that's fine */ }`. D-15 adds a `shell:manifest` emit here, gated on `registryUrl` being explicitly configured (see Folded-Fix Landing Sites) |
| `` `lifecycle:${manifest.id}` `` | `src/lifecycle.ts:311` | `mount()` — one or more `manifest.requires.plugins` not registered |
| `` `lifecycle:${manifest.id}:styles` `` | `src/lifecycle.ts:328` | Style load failure — **non-blocking**, mount continues |
| `` `lifecycle:${manifest.id}:template` `` | `src/lifecycle.ts:343` | Template fetch failure — blocking, mount aborts |
| `` `lifecycle:${manifest.id}:sanitize` `` | `src/lifecycle.ts:365` | `sanitizeTemplate` hook throws/rejects/times out — blocking, mount aborts (fail-closed, Phase 3 D-07) |
| `` `lifecycle:${manifest.id}:dependency` `` | `src/lifecycle.ts:387` | A `manifest.dependencies[]` script fails to load — blocking; container is cleared (`container.innerHTML = ''`) since this is post-injection |
| `` `lifecycle:${manifest.id}` `` | `src/lifecycle.ts:406` | `manifest.entry` script fails to load — blocking; container is cleared (post-injection) |
| `plugin:wallet:storage:write` | `plugins/wallet/src/index.ts:189` | `persistProvider()` — `localStorage.setItem`/`removeItem` throws |
| `plugin:wallet:storage:read` | `plugins/wallet/src/index.ts:203` | `getPersistedProvider()` — `localStorage.getItem` throws |
| `plugin:wallet:state` | `plugins/wallet/src/index.ts:223` | `updateState()` — a provider reports `connected: true` with no `address` (provider-contract violation) |
| `plugin:wallet:reconnect` | `plugins/wallet/src/index.ts:279` | `init()` auto-reconnect from persisted `storageKey` fails (Phase 3 WR-03) — persisted provider id is then cleared |
| `plugin:theme:storage:write` | `plugins/theme/src/index.ts:80` | `persist()` — localStorage write throws |
| `plugin:theme:storage:read` | `plugins/theme/src/index.ts:98` | `restore()` — localStorage read/JSON.parse throws (message notes "corrupted data — falling back to defaults") |
| `plugin:settings:storage:write` | `plugins/settings/src/index.ts:59` | `persist()` — localStorage write throws |
| `plugin:settings:storage:read` | `plugins/settings/src/index.ts:82` | `restore()` — localStorage read/JSON.parse throws |

**Convention confirmed:** every `dx:error` site either passes a genuine `Error` or wraps a
non-Error throw as `new Error(String(err))`; storage/reconnect sites additionally pass
`{ cause: err }` to preserve the original error for `error.cause` inspection — this is the
"wrapped-Error-with-`cause`" convention CONTEXT.md references from Phase 1. Not every site sets
`cause` (e.g. the plain manifest-validation/route-reject emits construct a fresh descriptive
`Error` with no original error to wrap).

### Plugin (custom) events — `dx:plugin:<name>:<action>` namespace

| Event | Payload | Source plugin | File:line |
|---|---|---|---|
| `dx:plugin:wallet:connected` | `{ address: string; chainId: number }` | wallet | `plugins/wallet/src/index.ts:228` |
| `dx:plugin:wallet:disconnected` | `Record<string, never>` | wallet | `plugins/wallet/src/index.ts:230` |
| `dx:plugin:wallet:changed` | `{ address: string; chainId: number }` | wallet | `plugins/wallet/src/index.ts:232` |
| `dx:plugin:auth:authenticated` | `{ address: string }` | auth | `plugins/auth/src/index.ts:42` |
| `dx:plugin:auth:deauthenticated` | `Record<string, never>` | auth | `plugins/auth/src/index.ts:45`, `:100` |
| `dx:plugin:theme:changed` | `{ theme: string; mode: ThemeMode; resolved: 'light' \| 'dark' }` | theme | `plugins/theme/src/index.ts:119`, `:125` (fired on both mode-change and theme-change) |
| `dx:plugin:settings:changed` | `{ dappId: string; key: string; value: unknown }` | settings | `plugins/settings/src/index.ts:172` |

All four plugins register their custom events via `context.eventRegistry.registerEvent(<name>, [...])`
during `init()`, matching the `dx:plugin:<name>:<action>` namespace rule enforced by
`src/events.ts:104-116` (segments.length must be 4, segment[2] must equal the registering source).

## Code Truth: Config Defaults Resolved at Construction

| Config path | Default | Resolved in | Notes |
|---|---|---|---|
| `ShellConfig.registryUrl` | `'/registry.json'` | `src/shell.ts:35` destructure | Used only when neither `dapps` nor `manifests` is provided (three-tier fallback, see Behavior Truth) |
| `ShellConfig.basePath` | `'/'` | `src/shell.ts:36` | Passed through to `createRouter()` |
| `ShellConfig.mode` | `'history'` | `src/shell.ts:37` | `'history' \| 'hash'` |
| `ShellConfig.lifecycle` | `{}` | `src/shell.ts:38` | Nested group replacing the removed flat loaders (Phase 3 D-04/D-05, **breaking**) |
| `LifecycleManagerOptions.timeout` | `30000` (ms) | `src/lifecycle.ts:253` `options.timeout ?? 30000` | **Breaking change vs 0.1.5** — per-fetch, applies to script/style/template loads AND the custom-sanitizer hang guard. `0` or `Infinity` restores hang-forever (`isTimeoutActive()`, `src/lifecycle.ts:41-43`) |
| `LifecycleManagerOptions.cacheTemplates` | `true` | `src/lifecycle.ts:279` `options.cacheTemplates ?? true` | Cache wraps outermost, above the timeout-wrapped fetch — a cache hit skips fetch+timeout entirely. Only successful fetches are cached (raw HTML; sanitizer runs after cache retrieval every time) |
| `LifecycleManagerOptions.sanitizeTemplate` | `undefined` (pass-through, unchanged from 0.1.5) | `src/lifecycle.ts:265-267` | **No `??` default** — `undefined` is meaningfully different from a no-op function; template injection is byte-identical to 0.1.5 when unset |
| `LifecycleManagerOptions.hasPlugin` | `() => true` when unset; shell always binds it | `src/lifecycle.ts:263`; `src/shell.ts:44-49` | `createShell()` binds `hasPlugin` LAST (after spreading `lifecycleOptions`) so a consumer-supplied `hasPlugin` (even `undefined`) cannot disable required-plugin enforcement. `ShellConfig.lifecycle` type is `Omit<LifecycleManagerOptions, 'hasPlugin'>` — not configurable from `createShell()` |
| `LifecycleManagerOptions.scriptLoader` / `styleLoader` / `templateLoader` | Built-in DOM-injecting loaders when unset | `src/lifecycle.ts:254-262` | Custom loaders get wrapped in a `Promise.race`-style hang guard (`withTimeout`), NOT a true abort — the underlying promise keeps running in the background even after the guard rejects (documented limitation, Phase 2 D-07) |
| `WalletOptions.storageKey` | `'dxkit:wallet'` | `plugins/wallet/src/index.ts:163` `options.storageKey ?? 'dxkit:wallet'` | Full literal override, no prefixing/namespacing magic; no migration from the old key when changed (Phase 3 D-10) |
| `CSSThemeOptions.storageKey` | `'dxkit:theme'` | `plugins/theme/src/index.ts:31` | Same collision risk as wallet's pre-Phase-3 state — **theme has NOT been given the SEC-02 treatment**; this is accurate current behavior, not drift, but worth flagging in `docs/security.md`'s limitations (D-11) since CONCERNS.md's "Wallet Provider Persistence" section only names wallet |
| `CSSThemeOptions.defaultMode` | `'system'` | `plugins/theme/src/index.ts:31` | |
| `CSSThemeOptions.themes` | `['default']` | `plugins/theme/src/index.ts:31` | |
| `SettingsPluginOptions.storageKey` | `'dxkit:settings'` | `plugins/settings/src/index.ts:21` | Same collision-risk note as theme |
| `PassthroughAuthOptions.walletPlugin` | `'wallet'` | `plugins/auth/src/index.ts:21` | Looked up via `context.getPlugin(walletPlugin)`; auth degrades gracefully (no wallet) if not found |
| `LocalWalletProviderOptions.address` | `'0x0000000000000000000000000000000001'` | `plugins/wallet/src/index.ts:106` | Dev-only deterministic address |
| `DappManifest.optional` | `false` (undocumented in type but behaviorally: `!manifest.optional` ⇒ always enabled) | `src/shell.ts:65-68`, `:151` | |
| `DappManifest.enabled` | `true` when `optional` (manifest default before persisted-settings override) | `src/shell.ts:75` `m.enabled !== false` | Persisted settings (`_shell` section) override this at `initEnabledState()`, `src/shell.ts:86-93` |
| `DappManifest.standalone` | `true` (per type JSDoc `src/types/manifest.ts:57`) | Not enforced in `src/`; standalone-mode is a doc-level convention for dapp authors, not shell-checked | Docs must not overstate this as shell-enforced |

**BREAKING CHANGE confirmed:** the flat `ShellConfig.scriptLoader`/`styleLoader`/`templateLoader`
fields are removed from the type AND `createShell()` throws a runtime `Error` if any is present
as an own key on the config object (`src/shell.ts:20-29`), using `Object.hasOwn` (not `in`) so
prototype-chain keys don't false-positive. This is what D-05's migration section documents.

## Code Truth: Behavior

### Route normalization and rejection (`src/router.ts`, `src/shell.ts`)

- **Router-level** `normalizePath()` (`src/router.ts:27-39`): strips `basePath` prefix if present,
  ensures a leading slash, strips a trailing slash except for root `/`. Applied on every
  `resolve()` and `getCurrentPath()` call.
- **Shell-level** `normalizeRoute()` (`src/shell.ts:254-263`) is a *different, narrower* function
  applied once at manifest-load time (not per-navigation): trims whitespace first (fixing the
  `' /a'` → `'/ /a'` bug that existed before the trim was added), then leading/trailing-slash
  normalization identical in spirit to the router's. Returns `null` for the unfixable case
  (empty or whitespace-only route after trim) — the manifest is discarded with a `shell:route`
  `dx:error` (see Event Catalog). **These two normalizers are not the same function** — a doc
  claiming there's a single normalization path would be wrong; document them as the two-tier
  reality they are.
- **Longest-prefix match wins** (`src/router.ts:44-48`): manifests are sorted by `route.length`
  descending once at router construction (`src/router.ts:24`, hoisted per Phase 2 ROB-02 —
  never re-sorted per `resolve()` call). A path matches if it equals `manifest.route` exactly OR
  starts with `` `${manifest.route}/` ``.
- **Duplicate exact routes:** kept in the manifest list (not discarded); router's stable sort
  guarantees first-registered-wins at `resolve()` time regardless of array order passed to
  `createRouter()` (confirmed by `tests/router.test.ts:163-172` — reversed input order still
  resolves to whichever id was declared first in the *original manifests array*, not the sorted
  one). `normalizeAndValidateManifests()` separately emits one `shell:manifest` `dx:error` naming
  both colliding ids (`src/shell.ts:294-309`).
- **Three-tier manifest loading** (`loadManifests()`, `src/shell.ts:227-247`): `dapps` entries
  (fetch each `manifest.json`) → else inline `manifests` → else `registryUrl` fetch (default
  `/registry.json`). First tier with content wins; tiers are NOT merged.
- **Hash-mode navigation quirk** (`src/router.ts:65-84`): assigning a *different* hash fires
  `hashchange` (async) which the router listens for; assigning the *identical* hash fires nothing,
  so `navigate()` explicitly calls `notifyListeners()` in that branch to preserve same-route
  navigation semantics (subpath/refresh). `pushState` never fires `popstate`, so history-mode
  `navigate()` always calls `notifyListeners()` explicitly.

### Mount semantics — last-navigation-wins (`src/lifecycle.ts`, `src/shell.ts`)

- **Generation guard** (`mountGeneration`, `inFlightMountId` — `src/lifecycle.ts:273-274`,
  closure-scoped, never module-level): every `mount()` call captures `generation = ++mountGeneration`
  at entry; `isStale()` re-checks `generation !== mountGeneration` at every commit gate (post-style,
  post-template-fetch, post-sanitize, mid-dependency-loop, pre-entry-commit). Only the single
  most-recently-started mount can ever reach `currentDappId`/`dx:mount`.
- **Shell-level dedupe** (`pendingMountId` + call-scoped `pendingMountToken` —
  `src/shell.ts:58-61`): a duplicate call for the *same* dapp id while one is already in flight is
  dropped (`src/shell.ts:412`) rather than double-mounting. The `finally` block
  (`src/shell.ts:443-450`) only clears `pendingMountId` if `pendingMountToken === myToken` — a
  stale/invalidated call can never clear a newer attempt's slot.
- **Container-clear guarantee:** style-load failure is non-blocking (mount continues, error only
  reported if not stale). Template-fetch, sanitize, and pre-commit failures are all pre-injection
  (return before writing `innerHTML`) so nothing needs clearing. Dependency-load and entry-load
  failures are **post-injection** — both explicitly do `container.innerHTML = ''`
  (`src/lifecycle.ts:391`, `:410`) before returning `false`, so no stale dapp DOM survives a
  post-injection failure.
- **Sub-path navigation within the mounted dapp** does not remount — `mountDapp()`
  (`src/shell.ts:400-407`) detects `lifecycle.getCurrentDapp() === manifest.id` and emits
  `dx:route:subpath` only if the path actually changed, then returns without touching lifecycle.
- **Fresh-path catch-up** (`src/shell.ts:433-441`): after a mount commits, the shell re-reads
  `router.getCurrentPath()` (not the path captured when the call started) and emits a catch-up
  `dx:route:subpath` if the browser moved during the mount — closes the race where a sub-path nav
  arriving mid-mount would otherwise be silently dropped by the `pendingMountId` dedupe.

### `disableDapp()` — current divergence that D-16 closes

Two "disable while its route is currently active" paths currently end in **different
user-visible states** (this is exactly what the D-16 folded fix corrects — see Folded-Fix
Landing Sites below for the precise diff target):

1. **Committed mount, then disabled:** `disableDapp()` (`src/shell.ts:129-146`) sets
   `enabledState`, calls `lifecycle.invalidatePendingMount(id)` (no-op if nothing in flight for
   this id) and `releasePendingMount()` if it owns the slot, then `rebuildRouter()`
   (`src/shell.ts:97-117`). `rebuildRouter()` checks `lifecycle.getCurrentDapp()` — since the
   mount had committed, this is non-null, is no longer in `getEnabledManifests()`, so it calls
   `lifecycle.unmount()` **and `router.navigate('/')`** (`src/shell.ts:110-116`). User ends up at
   `/`.
2. **In-flight (not-yet-committed) mount, then disabled:** the same `disableDapp()` runs, but
   `lifecycle.getCurrentDapp()` is still `null` (nothing committed yet) — `rebuildRouter()`'s
   `if (currentDapp)` branch does not fire, so **no `navigate('/')` happens**. The browser is left
   parked on the now-unmatched route with an empty container (the in-flight mount was invalidated
   via `invalidatePendingMount`/`releasePendingMount`, so no stale commit occurs — but no
   redirect either).

### Settings handler cleanup (`plugins/settings/src/index.ts`)

- Cleanup is triggered **only** by `dx:dapp:disabled` (`context.events.on('dx:dapp:disabled', ({id}) => cleanup(id))`,
  `:242`) — explicitly NOT subscribed to `dx:unmount`, so handlers survive normal
  navigation-away-and-back (only an actual `disableDapp()` call prunes them).
- `cleanup(dappId)` (`:142-145`) deletes both `keyHandlers.get(dappId)` and
  `dappHandlers.get(dappId)` wholesale — nested `Map<dappId, Map<key, Set<handler>>>` structure
  (not a colon-joined composite key), so a dapp id that is a colon-prefix of another (`'foo'` vs
  `'foo:bar'`) cannot collide during cleanup.
- The `_shell` toggle-bridge handlers (settings UI toggle → `enableDapp`/`disableDapp`) live under
  their own `'_shell'` section entry, untouched by another dapp's `cleanup()`.

### Template cache (`src/lifecycle.ts:276-291`)

- Cache wraps **outermost**, above the timeout-wrapped loader — a cache hit returns immediately,
  never touching `fetch` or its timeout.
- Only successful fetches are cached; failures/timeouts reject through uncached.
- Cache stores **raw** HTML — the `sanitizeTemplate` hook runs fresh on every mount including
  cache hits (never caches sanitized output).
- `clearTemplateCache()` drops everything; `invalidateTemplate(url)` drops one entry, keyed by
  the manifest-declared template URL verbatim (`src/lifecycle.ts:445-451`).

## Folded-Fix Landing Sites

### D-15 — registry.json failures (remaining WR-01 tier)

**Site:** `src/shell.ts:237-244`, inside `loadManifests()`:

```typescript
try {
  const res = await fetch(registryUrl);
  if (res.ok) {
    return await res.json();
  }
} catch {
  // No registry.json — that's fine
}

return [];
```

**Confirmed current behavior:** non-OK response, fetch throw, AND `res.json()` parse failure are
ALL swallowed silently regardless of whether `registryUrl` was left at its default
(`'/registry.json'`) or explicitly configured.

**Required change (per D-15/todo spec):** emit `dx:error` (source `'shell:manifest'`, matching
the existing manifest-tier taxonomy) on any of the three failure modes, **but only when
`registryUrl` was explicitly passed in `ShellConfig`** — the default probe must stay silent since
absence of `/registry.json` is an expected, not-misconfigured state for `dapps`/`manifests`-only
consumers.

**Implementation note:** `registryUrl` is destructured with a default at `src/shell.ts:35`
(`registryUrl = '/registry.json'`), which already erases whether the caller passed it explicitly.
The fix needs to check `Object.hasOwn(config, 'registryUrl')` (mirroring the existing
`Object.hasOwn` pattern used for the D-05 flat-loader guard at `src/shell.ts:23`) captured
**before** the destructure with default, or destructure `registryUrl` without a default and apply
`?? '/registry.json'` separately while keeping the raw presence-check.

**Template to mirror:** the existing `loadDappManifest()` fetch/parse-failure emit
(`src/shell.ts:211-223`) — same message shape ("Failed to load ... — request failed or response
was not valid JSON"), same `cause: err` preservation for the throw/parse-failure case; the non-OK
case mirrors `src/shell.ts:187-196`'s status-info message shape.

**Regression tests to add (extends the existing WR-01 tests at `tests/shell.test.ts:310-372`,
which cover the `dapps` tier only):**
- Explicit `registryUrl` + non-OK response → `dx:error` emitted, source `shell:manifest`.
- Explicit `registryUrl` + fetch throw → `dx:error` emitted, message includes original error.
- Explicit `registryUrl` + JSON parse failure → `dx:error` emitted.
- Default `registryUrl` (omitted from config) + any of the above three failure modes → **no**
  `dx:error`, `getManifests()` returns `[]` (preserves current default-silence contract).

### D-16 — disable-mid-flight navigates to `/`

**Sites:** `src/shell.ts:97-117` (`rebuildRouter()`, the template) and `:129-146`
(`disableDapp()`, where the fix lands).

**Owner's decision (per CONTEXT.md D-16):** option (a) — mirror the committed-mount path. After
`disableDapp()` invalidates an in-flight mount whose route matches the *current* browser path,
navigate to `/`, exactly like `rebuildRouter()`'s existing `router.navigate('/')` branch
(`src/shell.ts:114`).

**Implementation shape:** `disableDapp()` currently calls `lifecycle.invalidatePendingMount(id)`
(`:139`) and conditionally `releasePendingMount()` (`:142`) BEFORE `rebuildRouter()` (`:143`).
Because `rebuildRouter()`'s navigate-to-`/` branch gates on `lifecycle.getCurrentDapp()` being
non-null (which is `null` for an in-flight, uncommitted mount), the fix needs a second condition
in `disableDapp()` (or a parameter into `rebuildRouter()`) that detects "the currently-resolved
route belongs to the disabled dapp AND nothing was committed" and navigates to `/` in that case
too. The router's own `resolve(router.getCurrentPath())` (same pattern `init()` uses,
`src/shell.ts:359`) is how to check "does the current path belong to this dapp" without adding
new router API.

**Test to add:** disable a dapp whose manifest matches the current route while its mount is still
in flight (slow loader, matching the stress-test pattern in `tests/stress.test.ts`) — assert the
browser ends up navigated to `/` (same final state as the already-tested committed-mount disable
path), not left parked on the dead route.

**Docs impact:** once this lands, `docs/dapp-development.md`/`docs/system-internals.md` describe
ONE disable-while-active rule ("disabling the dapp whose route is currently active always
navigates to `/`"), not two divergent paths — do this fix before verifying those docs (per
CONTEXT.md's explicit fixes-first sequencing note).

### D-17 — inFlightMountId hygiene + test nits

**Site 1 — hygiene fix:** `src/lifecycle.ts`'s `mount()` function has four bare
`if (isStale()) return false;` gates that do NOT clear `inFlightMountId` when they fire (current
line numbers as read this phase — todo cites `:348`/`:392` from a slightly earlier revision;
verify exact lines at implementation time since the file has moved since the todo was filed):

- `src/lifecycle.ts:352-353` — after template fetch, before sanitize (bare gate).
- `src/lifecycle.ts:372` — after sanitize await (bare gate).
- `src/lifecycle.ts:396` — mid-dependency-loop (bare gate).
- `src/lifecycle.ts:415` — final gate before commit (bare gate).

Contrast with the *catch* blocks in the same function (`:342-349` template catch, `:362-371`
sanitize catch, `:383-395` dependency catch, `:402-414` entry catch), which DO clear
`inFlightMountId = null` inside their `if (!isStale())` branch — but only when the failure is
NOT stale. When a call is superseded (stale) and hits one of the four bare gates above instead of
a catch, `inFlightMountId` is left pointing at that superseded call's manifest id.

**Consequence today (confirmed benign):** `invalidateAnyPendingMount()`
(`src/lifecycle.ts:462-469`) checks `inFlightMountId !== null` and bumps `mountGeneration` if so —
a stale leftover id causes one spurious-but-harmless generation bump (nothing is actually in
flight; the bump is a no-op beyond wasting a generation number). The code comment "No-op when
nothing is in flight" (`:465`) overstates the actual invariant.

**Required fix (per D-17):** clear `inFlightMountId` only when the *returning* call is the one
that set it — track a generation value alongside `inFlightMountId` (mirroring the existing
`pendingMountToken`/`pendingMountId` pairing pattern already used in `src/shell.ts:58-61` and
`:391-394`/`:443-450`) so a stale call's bare-gate return can safely null out `inFlightMountId`
only if it still owns it.

**Test to add:** unit test locking the tightened invariant — e.g. two overlapping `mount()` calls
where the first is invalidated mid-flight via a bare-gate path (not a catch path), asserting
`inFlightMountId` reflects only the second (current) call's state, not a stale leftover.

**Site 2 — test nit, `dx:error` listener accumulation:** confirmed in `tests/shell.test.ts` —
multiple tests (`:118-121`, `:312-314`, `:333-335`, `:353-355`, `:390-392`, `:405-407`,
`:573-575`, and more) call `window.addEventListener('dx:error', ...)` and never
`window.removeEventListener` it, unlike the `dx:ready`/`dx:plugin:registered` tests earlier in the
same file (`:46-48`, `:60-64`) which do clean up. Since each test pushes to its own local `errors`
array, there's no cross-test assertion contamination — but listeners accumulate on `window` for
the remainder of the test file's run. Fix: add matching `window.removeEventListener` calls (or
factor a `beforeEach`/`afterEach` helper), consistent with the file's cleaned-up pattern.

**Site 3 — test nit, confusing manifest ids in router duplicate-route test:** confirmed in
`tests/router.test.ts:163-172` — the "resolve() still returns the first-registered manifest when
input order is reversed" test builds `manifests: [manifest({id:'second', route:'/dup'}), manifest({id:'first', route:'/dup'})]`
and asserts `router.resolve('/dup')?.id` is `'second'` — because `'second'` is literally the
*first* item in the array. The assertion is correct (first-array-position wins), but naming the
first-position manifest `'second'` makes the passing assertion read like a contradiction at a
glance. Fix: rename to something order-neutral (e.g. `'alpha'`/`'beta'`) or add a clarifying
comment above the assertion.

## Package Legitimacy Audit

(Restated per template — see "Package Legitimacy Audit" above; no table needed since no packages
are installed. `dompurify@3.4.12` referenced in docs was checked via `npm view dompurify version`
against the npm registry as a version-freshness sanity check only.)

## Runtime State Inventory

**Not applicable — this is a documentation phase, not a rename/refactor/migration phase.** No
runtime state (databases, live service config, OS-registered state, secrets, build artifacts)
changes name or shape in this phase. The three folded code fixes (D-15/D-16/D-17) are behavior
additions/corrections, not renames — verified by inspection of all three landing sites above:
none touch a persisted key name, a registered task/service name, or a build-artifact path.

## Common Pitfalls

### Pitfall 1: Treating `docs/events-reference.md`'s existing `dx:error` table as "mostly right, just needs a few additions"

**What goes wrong:** The doc lists 4 example source strings in a parenthetical
(`'lifecycle:my-dapp'`, `:styles`, `:template`, `:dependency`) as if illustrative, but omits
`:sanitize` (added Phase 3), all `shell:*` sources (added Phases 1/4), `` `plugin:${name}` ``
(plugin init failure), and all six plugin-storage/state/reconnect sources (added Phases 1/3).
**Why it happens:** the doc was written before those phases landed and never got a full pass.
**How to avoid:** replace the table wholesale using the Event Catalog section above as the
checklist, don't patch it incrementally.
**Warning signs:** if the corrected table doesn't have 22 distinct source-string rows (one per
row in the "complete `dx:error` catalog" table above, collapsing the duplicate `shell:manifest`/
`` `lifecycle:${manifest.id}` `` entries that share a literal string but differ by trigger), it's
still incomplete.

### Pitfall 2: Assuming `ShellConfig.lifecycle` is a flat merge of all `LifecycleManagerOptions`

**What goes wrong:** `ShellConfig.lifecycle` type is `Omit<LifecycleManagerOptions, 'hasPlugin'>`
(`src/types/shell.ts:32`) — `hasPlugin` is NOT configurable from `createShell()`, it's always
shell-bound. A doc example showing `lifecycle: { hasPlugin: () => true }` would compile-fail under
the D-04 harness and is factually wrong about what's overridable.
**Why it happens:** easy to assume all lifecycle-manager options are equally consumer-facing.
**How to avoid:** cross-check every `LifecycleManagerOptions` field mentioned in docs against
whether it survives the `Omit` in `ShellConfig`.
**Warning signs:** a compile-check failure on any doc snippet passing `hasPlugin` through
`createShell()`.

### Pitfall 3: Describing the D-16 fix and the existing rebuildRouter navigate-to-`/` as two separate behaviors in docs

**What goes wrong:** after D-16 lands, both paths converge to the same user-visible outcome, but
they remain two different code paths (`rebuildRouter()`'s branch vs. `disableDapp()`'s new
branch) with different preconditions. A doc could accidentally describe them as "the same
function handles this" when they're not — or conversely still describe the pre-fix divergence if
verified before the code lands.
**Why it happens:** the fix converges *outcomes*, not *code paths* — easy to over-simplify.
**How to avoid:** state the outcome rule ("disabling the dapp whose route is currently active —
mounted or still loading — always returns you to `/`") without asserting a single implementation
path, and verify against the post-fix code, not the description in this document (which reflects
pre-D-16 state plus the planned fix).
**Warning signs:** doc prose citing a specific function name for this behavior when the actual
mechanism spans two call sites.

### Pitfall 4: CSP guidance that assumes a `<meta>` tag can do everything a header can

**What goes wrong:** `frame-ancestors`, `report-uri`/`report-to`, and `sandbox` directives are
**not honored** in a `<meta http-equiv="Content-Security-Policy">` tag per the CSP spec — only a
real HTTP response header enforces them. A static/IPFS deployment that can only control `<meta>`
(no server-side header control) cannot use those directives at all — the docs must say so rather
than presenting a policy example that silently drops enforcement for those directives.
**Why it happens:** copy-pasting a header-oriented CSP example into `<meta>` context without
checking directive support.
**How to avoid:** `docs/security.md`'s IPFS-gateway policy example should explicitly note the
`<meta>`-tag limitation and which directives are meta-safe (`default-src`, `script-src`,
`style-src`, `img-src`, `connect-src`, `font-src`, `object-src`, `base-uri`, `form-action` are
meta-compatible; `frame-ancestors`/`report-uri`/`sandbox` are not).
**Warning signs:** a security doc that doesn't distinguish header-delivered from meta-delivered
CSP at all.

## Code Examples

### `dx:error` handling pattern (verified against `docs/events-reference.md:166-169`, matches source)

```typescript
// Source: src/types/events.ts:20 (EventMap['dx:error'] shape) + src/events.ts on() typing
dx.events.on('dx:error', ({ source, error }) => {
  console.warn(`[${source}]`, error.message);
  if (error.cause) console.warn('caused by:', error.cause);
});
```

### D-15's planned emit shape (not yet in source — this is the pattern to follow, mirroring `src/shell.ts:211-223`)

```typescript
// Mirrors the existing loadDappManifest() catch-all pattern (src/shell.ts:211-223)
events.emit('dx:error', {
  source: 'shell:manifest',
  error: new Error(
    `Failed to load registry from ${registryUrl} — request failed or response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    { cause: err },
  ),
});
```

### DOMPurify — ESM/bundler consumption (verified against `docs/configuration.md:68-75`, already correct)

```javascript
// Source: docs/configuration.md:68-75 (existing, correct) + DOMPurify README
import DOMPurify from 'dompurify';

DxKit.createShell({
  lifecycle: {
    sanitizeTemplate: (html) => DOMPurify.sanitize(html),
  },
});
```

### DOMPurify — IIFE/script-tag consumption (net-new for `docs/security.md`, D-10)

```html
<!-- No bundler: DOMPurify vendored or loaded from a CDN pinned to a specific version -->
<script src="vendor/purify.min.js"></script>
<script src="vendor/dxkit.global.js"></script>
<script>
  const shell = DxKit.createShell({
    lifecycle: {
      // window.DOMPurify — same .sanitize(html) call shape as the ESM import.
      sanitizeTemplate: (html) => DOMPurify.sanitize(html),
    },
  });
</script>
```

## State of the Art

| Old Approach (0.1.5) | Current Approach (0.2.0) | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `createShell({ scriptLoader, styleLoader, templateLoader })` — flat top-level fields | `createShell({ lifecycle: { scriptLoader, styleLoader, templateLoader, timeout, cacheTemplates, sanitizeTemplate } })` — nested group | Phase 3 (D-04/D-05) | **Breaking.** TS consumers get compile errors; JS/IIFE consumers get a runtime `Error` thrown from `createShell()` if any flat key is present |
| No load timeout — a hung script/style/template URL freezes the mount forever | 30000ms default timeout on every fetch-based load, `timeout: 0`/`Infinity` opt-out | Phase 2 (ROB-01) | **Breaking** (new default behavior) but additive API — existing code that never hit a slow loader is unaffected |
| Router re-sorts manifests by length on every `resolve()` call | Sort hoisted to `createRouter()` construction, `resolve()` never re-sorts | Phase 2 (ROB-02) | Non-breaking, perf-only |
| Templates re-fetched on every mount | Cached by URL (`cacheTemplates` default `true`), `clearTemplateCache()`/`invalidateTemplate(url)` for manual busting | Phase 2 (ROB-03) | Non-breaking; default-on caching means dev/live-editing workflows should set `cacheTemplates: false` |
| Settings handlers leak after `disableDapp()` | Handlers pruned on `dx:dapp:disabled` | Phase 2 (ROB-04) | Non-breaking bug fix |
| No template sanitization seam | Optional `sanitizeTemplate` hook, fail-closed, applied before every `innerHTML` write including cache hits | Phase 3 (SEC-01) | Additive; default (unset) behavior is byte-identical to 0.1.5 |
| Hardcoded `'dxkit:wallet'` localStorage key | Configurable `WalletOptions.storageKey`, default unchanged | Phase 3 (SEC-02) | Additive |
| Many silent catches (mount container missing, storage r/w failures, entry-load failures, manifest fetch/parse failures for the `dapps` tier) | All surface `dx:error` | Phase 1 + Phase 4 | Additive — consumers that previously relied on silence now see events; no throw behavior changed |
| `registry.json` fetch/parse failures always silent | Silent for default probe; surfaces `dx:error` when `registryUrl` explicitly configured | **Phase 5 (D-15, this phase)** | Additive, in-flight |
| Disable-mid-flight leaves URL parked on dead route | Navigates to `/`, matching the committed-mount disable path | **Phase 5 (D-16, this phase)** | Behavior fix, in-flight |

**Deprecated/outdated:** `createEthereumWallet()` in `plugins/wallet/src/index.ts:391-393` carries
an explicit `@deprecated` JSDoc tag pointing at `createWallet({ providers: [createEIP1193Provider()] })`
— confirm whichever plugin doc(s) mention it still describe it as deprecated, not as a first-class API.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CSP `<meta>` tags do not honor `frame-ancestors`/`report-uri`/`sandbox` directives (only real HTTP headers do) | Common Pitfalls → Pitfall 4; feeds `docs/security.md` | This is well-established CSP spec behavior (cited via MDN in the CSP research digest), but was not verified against a live browser test in this session — if wrong, `docs/security.md` would need correction post-hoc. Confidence: MEDIUM (CITED, not independently browser-tested per D-09's own scope decision) |
| A2 | IPFS gateways vary in whether they set any CSP header by default, and a dapp on a shared gateway origin lacks true origin isolation without a dedicated subdomain/DNSLink | CSP / security.md content research | Sourced from a GitHub issue discussion (`ipfs/in-web-browsers#196`) and IPFS blog commentary, not an IPFS spec document — treat as directionally correct guidance, not a normative claim. If the planner wants a harder citation, the IPFS gateway spec itself should be checked at plan/execution time |
| A3 | `DOMPurify.sanitize(html)` has an identical call signature whether consumed via ESM import or `window.DOMPurify` global (script tag) | Code Examples → DOMPurify IIFE snippet | Standard for UMD-style libraries and consistent with `docs/configuration.md`'s existing ESM example, but the IIFE snippet itself was not run against a real DOMPurify build in this session |

**Note:** none of these three assumptions affect the code-truth tables (events, config defaults,
behavior) — those are all read directly from source and are not in this log. The assumptions are
confined to the CSP/DOMPurify web-research portion feeding `docs/security.md`.

## Open Questions

1. **Exact `dx:error` message wording for the D-15 registry emit.**
   - What we know: the existing `loadDappManifest()` catch (`src/shell.ts:211-223`) is the
     template to mirror; message shape and `cause` threading are established conventions.
   - What's unclear: whether to distinguish "non-OK" vs "throw/parse" registry failures into two
     messages (like `loadDappManifest()` does) or unify them, since the todo's problem statement
     doesn't specify.
   - Recommendation: mirror `loadDappManifest()`'s two-message split (status-info message for
     non-OK, unified network/parse message for the catch) for consistency — this is explicitly
     marked Claude's Discretion in CONTEXT.md.

2. **Whether `docs/security.md`'s CSP examples should be presented as header syntax, meta-tag
   syntax, or both.**
   - What we know: D-09 targets three deployment shapes (same-origin static host, IPFS gateway,
     cross-origin-asset dapps); same-origin static hosts typically control headers (nginx/Apache/
     hosting-platform config), IPFS gateways typically only allow meta-tag control by the dapp
     author (per A2 above).
   - What's unclear: whether "same-origin static host" in this project's context means a host the
     developer controls (headers available) or a generic static file server (meta-tag only,
     unless documented as configurable).
   - Recommendation: show both syntaxes for the same-origin-host section (header preferred, meta
     as fallback with the Pitfall 4 caveat), and meta-only for the IPFS-gateway section, explicitly
     noting the directive-support gap.

3. **D-04 harness mechanic — extraction script vs. hand-mirrored scratch file.**
   - What we know: no `tsc`/type-check script exists in `package.json` today; `tsconfig.json`'s
     `include: ["src"]` would need widening or a second tsconfig for a harness that imports
     `@dnzn/dxkit` types while type-checking `.md`-sourced snippets.
   - What's unclear: whether extracting snippets programmatically (regex/AST pull from `.md` code
     fences) is worth the tooling investment for a one-time, not-committed verification pass, versus
     a planner just hand-copying each doc's TS snippets into one `scratch.ts` file per doc and
     running `npx tsc --noEmit --strict` against it with a throwaway `tsconfig.scratch.json`
     (`moduleResolution: bundler`, path-aliased to `src/index.ts` and each plugin's `src/index.ts`,
     matching `vitest.config.ts`'s alias map).
   - Recommendation: hand-mirrored scratch file per doc, using the alias map already defined in
     `vitest.config.ts:6-11` as the template for a throwaway `tsconfig.scratch.json`'s `paths` —
     lowest tooling investment, matches "not committed as CI" (D-04), and the alias map is already
     proven correct (it's what the test suite uses).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 + happy-dom 20.10.6 (existing, unchanged this phase) |
| Config file | `vitest.config.ts` (alias map for `@dnzn/dxkit*` → `src/`/`plugins/*/src/`) |
| Quick run command | `npx vitest run tests/shell.test.ts tests/router.test.ts tests/lifecycle.test.ts` (targets the three files D-15/D-16/D-17 touch) |
| Full suite command | `pnpm test` (runs `biome check .` via `make test`, then `vitest run` across `tests/**/*.test.ts` and `plugins/*/tests/**/*.test.ts`) |

This phase does not add a test framework — it is documentation-primary. The "test" surface is:
(a) three small regression tests for the folded code fixes, and (b) the D-04 compile-check
harness, which is a throwaway `tsc` invocation, not a vitest suite.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | Every doc claim traces to verified source | manual (doc-by-doc sweep + drift log) | N/A — the D-01 drift log is the audit trail, not an automated test | ✅ this document is the checkable input |
| DOC-01 | TS snippets in docs compile against real 0.2.0 types | compile-check | `npx tsc --noEmit --strict -p tsconfig.scratch.json` (harness, not committed) | ❌ Wave 0 — harness doesn't exist yet, per D-04 |
| DOC-02 | No AI-tell slop remains | manual (D-13 ruthless-bar review) | N/A | — |
| DOC-03 | CSP guidance + security/limitations note exist | manual (doc review against this RESEARCH.md's CSP/DOMPurify findings + CONCERNS.md) | N/A | — |
| D-15 (folded) | Registry fetch/parse failure surfaces `dx:error` when `registryUrl` explicit; stays silent on default | unit | `npx vitest run tests/shell.test.ts -t "registry"` | ❌ Wave 0 — new test cases needed in `tests/shell.test.ts` |
| D-16 (folded) | Disable-mid-flight navigates to `/` | integration (real `createShell`) | `npx vitest run tests/shell.test.ts -t "disable"` | ❌ Wave 0 — new test case needed |
| D-17 (folded) | `inFlightMountId` cleared only by its owning call | unit | `npx vitest run tests/lifecycle.test.ts -t "inFlightMountId"` | ❌ Wave 0 — new test case needed |

### Sampling Rate

- **Per task commit:** targeted `vitest run` on the touched test file(s) (fast, matches the
  existing per-plan pattern from Phases 1–4).
- **Per wave merge:** `make test` (lint + full suite) — must stay green; 312 tests passing as of
  Phase 4 completion (per STATE.md), the three new D-15/D-16/D-17 tests bring this to 315+.
- **Phase gate:** full suite green + drift log (D-01) complete for all 14 docs + README + example
  before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/shell.test.ts` — add D-15 registry-fetch-failure cases (explicit→emits ×3 failure
      modes, default→silent ×3 failure modes); add D-16 disable-mid-flight-navigates-to-`/` case.
- [ ] `tests/lifecycle.test.ts` — add D-17 `inFlightMountId` ownership regression (verify exact
      test file — `tests/lifecycle.test.ts` exists at 1022 lines and is the natural home per its
      existing mount-generation-guard coverage; confirm no more specific stress-test home is
      more appropriate at plan time).
- [ ] `tsconfig.scratch.json` — throwaway TS config for D-04's compile-check harness, aliasing
      `@dnzn/dxkit*` to `src/`/`plugins/*/src/` per `vitest.config.ts`'s existing alias map. Not
      committed as CI (per D-04) — likely lives in a scratch/tmp location during the sweep, or as
      a gitignored file if the planner wants it reusable within the phase.

## Security Domain

### Applicable ASVS Categories

`security_enforcement` is enabled (`security_asvs_level: 1`, `security_block_on: "high"` per
`.planning/config.json`). This phase changes no authentication, session, or cryptography code —
its security surface is entirely **documentation of existing behavior** plus three small,
narrowly-scoped fixes (visibility of a previously-silent failure, a navigation-outcome
convergence, and an internal bookkeeping tightening). None of the three folded fixes touch
`innerHTML` injection, storage writes, or trust boundaries — they're event-emission and
navigation-flow corrections.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Out of scope — no auth code changes this phase |
| V3 Session Management | No | Out of scope |
| V4 Access Control | No | Out of scope |
| V5 Input Validation | Marginal — `docs/security.md` documents (does not implement) the `sanitizeTemplate` hook's fail-closed contract | Existing hook, Phase 3 SEC-01; this phase only documents it accurately, including its scope limit (template HTML only, not entry scripts) |
| V6 Cryptography | No | Out of scope — `localStorage` plaintext limitation is documented (D-11), not remediated (STOR-01 is explicitly out-of-milestone per REQUIREMENTS.md) |
| V14 Configuration (CSP, security headers) | **Yes** — this is the core of DOC-03 | `docs/security.md` CSP guidance (D-09); reasoned against `src/lifecycle.ts`'s actual DOM-injection/fetch call sites, not guessed |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation (as documented, not newly implemented) |
|---------|--------|---------------------------------------------------------|
| XSS via unsanitized template `innerHTML` | Tampering / Elevation of Privilege | `sanitizeTemplate` hook (bring-your-own DOMPurify), documented scope limit (template HTML only — dapp entry scripts are trusted code, Phase 3 D-14) |
| Reflected/stored XSS via untrusted manifest/template URLs | Tampering | Document "templates and entry scripts must come from trusted sources" as an explicit limitation (D-11) — DxKit performs no URL allowlisting itself |
| Same-origin storage collision across multiple DxKit apps | Information Disclosure | `storageKey` override for wallet (SEC-02, shipped); theme/settings still use hardcoded default keys — documented as a known gap, not silently glossed over (see Config Defaults table note) |
| Global-namespace collision in IIFE builds | Tampering (third-party script overwrites `window.DxKit`/`DxWallet`/etc.) | Documented limitation only (D-11) — no code mitigation planned this milestone (CONCERNS.md "IIFE Builds Attach to Global Namespace") |
| Missing CSP allowing arbitrary script injection if an attacker controls a template/manifest source | Tampering / Elevation of Privilege | `docs/security.md` CSP guidance (D-09) — directs consumers to constrain `script-src`/`style-src`/`connect-src` to known origins |
| Stale `window.__DXKIT__` listeners across multiple shell instances | Denial of Service (resource exhaustion) | Documented limitation: `shell.destroy()` required before creating a new shell (D-11, from CONCERNS.md "Window Event Listeners Not Cleaned Up on Shell Reuse") |

No new threat surface is introduced by this phase — the security domain work here is entirely
**documentation of existing, already-shipped mitigations and their honest limits**, which is the
DOC-03 requirement itself.

## Sources

### Primary (HIGH confidence — read directly from source this session)

- `src/shell.ts` (full file, 513 lines) — config destructure, manifest loading/validation,
  mount/route orchestration, `enableDapp`/`disableDapp`, `destroy()`.
- `src/lifecycle.ts` (full file, 482 lines) — loaders, timeout/hang-guard machinery, template
  cache, sanitizer wrap, `mount()`/`unmount()`, generation-guard invalidation API.
- `src/router.ts` (full file, 118 lines) — normalization, resolve, navigate, hash/history modes.
- `src/events.ts` (full file, 144 lines) — event bus, event registry, namespace validation.
- `src/registry.ts`, `src/utils.ts` (full files) — plugin registry, `deepMerge`.
- `src/types/events.ts`, `src/types/shell.ts`, `src/types/manifest.ts`, `src/types/context.ts`,
  `src/types/interfaces.ts`, `src/types/settings.ts`, `src/types/index.ts` (all full files) —
  complete public type surface.
- `plugins/wallet/src/index.ts`, `plugins/auth/src/index.ts`, `plugins/theme/src/index.ts`,
  `plugins/settings/src/index.ts` (full files) — every plugin's option surface, event emits,
  storage helpers.
- `tests/shell.test.ts` (targeted reads: lines 1-140, 300-430, 565-610), `tests/router.test.ts`
  (lines 148-192) — confirmed the D-17 test-nit claims (listener accumulation, confusing ids) and
  existing WR-01/D-15-adjacent test coverage directly.
- `examples/getting-started/main.js`, `index.html` — confirmed the example already uses the
  post-D-05 nested `lifecycle` shape correctly (no flat-loader drift there).
- `grep -rn "events.emit\|source:"` across `src/` and `plugins/*/src/` — exhaustive event/source
  catalog cross-check (two independent greps, cross-referenced against each other).
- `grep -rn` doc-drift spot checks across `docs/*.md`, `README.md`, `examples/` — confirmed
  `docs/events-reference.md`'s incomplete `dx:error` source list, confirmed no CSP mentions
  anywhere in current docs, confirmed README's doc table omits `configuration.md`/`development.md`/
  `testing.md`.
- `.planning/codebase/CONCERNS.md` — full read; source of DOC-03 content per D-11's explicit
  source-list citation.
- `.planning/phases/03-security-sanitization-storage-isolation/03-CONTEXT.md` — cross-checked
  SEC-01/SEC-02 decisions against current `src/lifecycle.ts`/`plugins/wallet/src/index.ts` to
  confirm they shipped as decided.
- `npm view dompurify version` → `3.4.12` (registry check, 2026-07-14).
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.versionrc.json` — build/test/version
  tooling truth for the D-04 harness recommendation and D-06 README-table guidance.

### Secondary (MEDIUM confidence — WebSearch, cross-referenced against official sources)

- [MDN: Content-Security-Policy: script-src directive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src) — script-src governs dynamically-injected `<script>` elements.
- [MDN: Content-Security-Policy (CSP) guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) — general directive reference, meta-tag vs header support.
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) — strict-dynamic, nonce/hash approaches for dynamic script injection.
- [ipfs/in-web-browsers issue #196 — Gateways and Content-Security-Policy](https://github.com/ipfs/in-web-browsers/issues/196) — gateway CSP header variability, origin-isolation caveats for gateway-hosted dapps.
- [IPFS Blog — The State of Dapps on IPFS: Trust vs. Verification](https://blog.ipfs.tech/dapps-ipfs/) — general IPFS-hosted dapp security posture context.
- [DOMPurify GitHub README](https://github.com/cure53/DOMPurify) / [npm package page](https://www.npmjs.com/package/dompurify) — ESM vs global usage call-shape confirmation.

### Tertiary (LOW confidence — none used)

No claims in this document rest on unverified training-data assumptions alone; all training-data
recollections (e.g. "CSP meta tags don't support frame-ancestors") were cross-checked against the
MEDIUM-confidence sources above and are logged in the Assumptions Log rather than stated as bare
fact.

## Metadata

**Confidence breakdown:**
- Event catalog / config defaults / behavior truth: HIGH — every claim read directly from current
  source this session, cross-checked with grep for completeness.
- Folded-fix landing sites (D-15/D-16/D-17): HIGH for "what exists today", MEDIUM for "exact
  future line numbers" (source moves between research and execution — landing sites are described
  by function/pattern, not just line number, to stay robust to minor drift).
- CSP / DOMPurify content for `docs/security.md`: MEDIUM — web-sourced, cross-referenced against
  MDN/OWASP/DOMPurify's own README, not independently browser-tested (matches D-09's own
  reasoned-not-tested scope decision).
- Drift-map specifics (e.g. `docs/events-reference.md`'s incompleteness): HIGH — confirmed by
  direct read of the doc's current `dx:error` section against the full source-grep catalog.

**Research date:** 2026-07-14
**Valid until:** Through the end of this phase's execution window. This document is a snapshot of
`gsd/phase-05-documentation-truth-pass` at research time — if the branch's source changes during
planning/execution (e.g. a rebase pulls in further commits), re-verify the Code Truth tables
against the actual `git diff` before treating this document as current. Not intended to remain
valid past 0.2.0's release (a 0.3.0 milestone would need fresh research).

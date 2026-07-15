# Phase 2: Robustness — Load Guards, Caching & Handler Cleanup - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Three independent robustness hardenings plus one mechanical optimization, all within existing components — no new capabilities:

- **ROB-01** — Lifecycle manager gains an optional **per-fetch load timeout** so a hung script/style/template URL can't freeze a mount forever (`src/lifecycle.ts`).
- **ROB-02** — Router caches its length-sorted manifest list so `resolve()` stops re-sorting on every navigation (`src/router.ts`).
- **ROB-03** — Templates are **cached by URL** with an explicit invalidation path, avoiding re-fetch on repeated mounts of the same dapp (`src/lifecycle.ts`).
- **ROB-04** — Settings handlers registered by a dapp are cleaned up when that dapp is **disabled via `disableDapp()`** — no leaked handlers, no firing on disabled dapps (`plugins/settings/src/index.ts`).

**In scope:** the timeout option + true-abort machinery, the router sort cache, the template cache + invalidation API, and the settings handler cleanup on disable. **Not in scope:** SEC-01 template sanitizer hook / SEC-02 configurable wallet storage key (Phase 3), the stress/edge-case/cleanup *tests* as a dedicated track (Phase 4 — though each change here ships with its own unit tests), and any docs pass (Phase 5).
</domain>

<decisions>
## Implementation Decisions

### ROB-01 — Load timeout policy
- **D-01 (scope):** Timeout is **per-fetch** — each individual load (style, template, each dependency script, entry script) gets its own timeout clock. Not a whole-mount budget. Matches the requirement wording and yields a clean per-asset `dx:error` attribution.
- **D-02 (default — BEHAVIOR CHANGE):** A default timeout **ships enabled**: **30000ms (30s)** when the consumer doesn't configure one. This is a deliberate behavior change from today's hang-forever default and MUST carry a `BREAKING CHANGE:` footer + migration note (the milestone allows justified breaking changes).
- **D-03 (opt-out):** Passing `timeout: 0` (or `Infinity`) **disables** the timeout and restores the old hang-forever behavior — the documented escape hatch for legitimately-slow IPFS gateways. Migration note must call this out.
- **D-04 (style non-blocking):** A **style timeout is non-blocking** — emit `dx:error` (source `lifecycle:<id>:styles`) and **continue** the mount, identical to today's style-load-failure path (`lifecycle.ts:106-115`). Blocking-ness is a property of the asset type, not the failure mode. **Template, dependency, and entry timeouts ABORT** the mount (emit + `return`, clearing the container per the Phase 1 D-11/D-12 "no stale DOM" guarantee for post-injection paths).
- **D-05 (source/message convention):** Timeout errors reuse the Phase 1 emit convention (D-02/D-03 from Phase 1): `dx:error` with the existing per-asset source string (`lifecycle:<id>:styles` / `lifecycle:<id>:template` / `lifecycle:<id>:dependency` / `lifecycle:<id>`) and a wrapped, descriptive `Error` message naming the timeout + URL. Payload shape unchanged (`{ source, error }`).

### ROB-01 — Cancellation semantics
- **D-06 (true abort in built-ins):** On timeout, the **built-in loaders truly abort** the in-flight load, not just stop waiting:
  - **Template** (`defaultTemplateLoader`) → `fetch(src, { signal })` with an `AbortController`; call `.abort()` on timeout.
  - **Script / style** (`defaultScriptLoader` / `defaultStyleLoader`) → remove the injected `<script>`/`<link>` node and null its `onload`/`onerror` so a late-arriving asset can't execute into an already-cleared or next dapp.
- **D-07 (custom-loader fallback):** The timeout **wrapper reaches custom loaders too**, but since the manager can't cancel an opaque loader Promise, custom loaders get a **`Promise.race` fallback**: emit `dx:error` and abandon the wait; the underlying load continues in the background. Everyone gets the hang guard; abort fidelity degrades gracefully. **Document** that custom loaders are not truly cancelled. (Loader type signatures are NOT changed — no `AbortSignal` parameter — to keep this non-breaking for consumers with custom loaders.)

### ROB-02 — Router sort cache (mechanical)
- **D-08:** Sort the manifest list by `route.length` **once at `createRouter()` construction** and reuse it in every `resolve()`. The router is immutable and fully rebuilt whenever manifests change (`shell.rebuildRouter()` on enable/disable), so construction-time caching satisfies "re-sort only when manifests change." Replaces the per-call `[...manifests].sort(...)` at `router.ts:40`. No public API change.

### ROB-03 — Template caching
- **D-09 (default-on, opt-out):** Template-by-URL caching is **on by default**, with a config flag to disable (e.g. `cacheTemplates: false` on `LifecycleManagerOptions`). Safe for the content-addressed/immutable IPFS/static target and consistent with the script/style loaders that already dedupe by default. The opt-out covers the dev/live-editing case that would otherwise need explicit invalidation.
- **D-10 (invalidation API):** Two explicit methods added to the `LifecycleManager` interface: **`clearTemplateCache()`** (wipe all) and **`invalidateTemplate(url)`** (drop one URL). Satisfies ROB-03's "explicit invalidation path" with both full-reset and targeted-reload granularity.
- **D-11 (scope — per-manager, wraps any loader):** The cache is a **`Map<url, html>` held in the `createLifecycleManager` closure** and wraps `loadTemplate` whether built-in or custom (mirrors the D-07 wrap-custom-loaders stance). Each manager instance is independent (clean teardown, test isolation); avoids the module-level-singleton pattern flagged in CONCERNS.md. `clearTemplateCache`/`invalidateTemplate` operate on this Map.
- **D-12 (cache semantics):** Only a **successfully-fetched HTML string is cached** — failures/timeouts are never cached. A **cache hit skips the fetch entirely**, so no timeout applies to a re-mount of a cached template. Cache is keyed by the template URL exactly as given in the manifest.

### ROB-04 — Settings handler cleanup
- **D-13 (event-driven trigger):** The settings plugin subscribes to **`dx:dapp:disabled`** in `init()` (`dx.events.on('dx:dapp:disabled', ({ id }) => cleanup(id))`) and unsubscribes in `destroy()`. The shell already emits this on every `disableDapp()` (`shell.ts:120`). Fully decoupled — **no new shell API, no shell→plugin coupling, no duck-typing** — consistent with the event-driven architecture.
- **D-14 (cleanup scope):** On disable of dapp `X`, remove **only X's own handlers**: `keyHandlers` entries keyed `X:*` (the `${dappId}:${key}` map) **and** `dappHandlers.get('X')`. The settings plugin's own **`_shell:X` toggle-bridge handler is preserved** (it's registered under section `_shell`, not `X`, at `settings/index.ts:111`) so the enable path keeps working.
- **D-15 (disable-only, not unmount):** Cleanup fires on **`dx:dapp:disabled` only — NOT on `dx:unmount`**. A dapp is unmounted on every navigation-away but stays *enabled*; its handlers must survive normal navigation. When a disabled dapp is later re-enabled, its remount re-runs the entry script and re-registers handlers — acceptable and expected.

### Claude's Discretion
- Exact timeout `Error` message wording (per D-05), consistent with existing `lifecycle:*` messages.
- Whether the per-fetch timeout is implemented as a shared internal helper (`withTimeout(promise, ms, onAbort)`) vs inline per loader — planner/researcher decides.
- The precise config field names (`timeout`, `cacheTemplates`) if a clearer name emerges during planning — but keep them additive/optional on `LifecycleManagerOptions`.
- Unit-test approach for each change (fake timers for timeouts, cache-hit assertions, `dx:dapp:disabled` emit → handler-not-firing assertions). Dedicated stress/edge-case suites are Phase 4.
- Whether `invalidateTemplate(url)` normalizes the URL or matches the manifest string verbatim (verbatim is the simplest correct default).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 2: Robustness — Load Guards, Caching & Handler Cleanup" — goal + four success criteria.
- `.planning/REQUIREMENTS.md` — ROB-01, ROB-02, ROB-03, ROB-04 definitions.
- `.planning/PROJECT.md` §Constraints — additive-preferred, zero-runtime-deps, IIFE/IPFS-first, breaking-changes-must-be-justified posture that shapes D-02/D-07/D-09.

### Code truth (the sites this phase touches)
- `src/lifecycle.ts:60-69` — `LifecycleManagerOptions` (where `timeout` + `cacheTemplates` are added); `src/lifecycle.ts:3-8` — `LifecycleManager` interface (where `clearTemplateCache`/`invalidateTemplate` are added).
- `src/lifecycle.ts:14-35` — `defaultScriptLoader` (node-removal abort, D-06); `:37-58` — `defaultStyleLoader`; `:71-78` — `defaultTemplateLoader` (AbortController, D-06); `:80-84` — loader wiring in `createLifecycleManager`.
- `src/lifecycle.ts:87-166` — mount sequence; style catch `106-115` (D-04 non-blocking timeout), template inject `118-129`, dependency loop `131-146`, entry `148-159`, container-clear pattern `142`/`157` (Phase 1 D-11/D-12).
- `src/router.ts:17-49` — `createRouter` + `resolve()`; the per-call sort at `router.ts:40` that D-08 replaces.
- `plugins/settings/src/index.ts:32-34` — `keyHandlers`/`dappHandlers` maps; `:110-118` — the `_shell` toggle-bridge `onChange` (D-14 must preserve); `:202-213` — `onChange`/`onAnyChange`; `:219-231` — `init()` (subscribe site, D-13); `:233-237` — `destroy()` (unsubscribe + existing clear).
- `src/shell.ts:113-120` — `disableDapp()` emitting `dx:dapp:disabled` (D-13 trigger source).
- `src/types/events.ts:16` — `dx:dapp:disabled` payload `{ id: string }`; `:20` — `dx:error` payload `{ source, error }` (unchanged, reused for timeouts).

### Concerns audit (source of this milestone's scope)
- `.planning/codebase/CONCERNS.md` §"No Timeout for Script/Style/Template Loads" (ROB-01), §"Route Resolution Sorts Manifests on Every Call" (ROB-02), §"No Template Caching" (ROB-03), §"Settings Storage Per-Section Handlers" + §"Settings Plugin Handler Cleanup on Disable" (ROB-04), and the module-level-singleton caution informing D-11.

### Prior phase context
- `.planning/phases/01-diagnostics-surface-silent-failures/01-CONTEXT.md` — the `dx:error` source/message convention (Phase 1 D-02/D-03) and container-clear guarantee (D-11/D-12) that timeout aborts reuse.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`dx:error` emit sites** in `lifecycle.ts` (`106-115`, `123-128`, `137-140`, `152-155`) are the exact template for timeout emits — copy their source-naming and wrapped-Error style (Phase 1 convention).
- **Container-clear pattern** (`container.innerHTML = ''` at `lifecycle.ts:142`/`157`) is the "no stale DOM" recovery a template/dependency/entry timeout-abort reuses verbatim.
- **`loaded` Set dedupe** in `defaultScriptLoader`/`defaultStyleLoader` (per-loader closure, `lifecycle.ts:16`/`39`) is the precedent for D-11's per-manager template cache and for default-on caching (D-09 consistency).
- **`dx:dapp:disabled` event** (registered `events.ts:10`, emitted `shell.ts:120`) already exists — ROB-04 needs no new event, just a subscription.
- **`destroy()` in settings** (`index.ts:233-237`) already clears `keyHandlers`/`dappHandlers` and nulls `dx` — the D-13 unsubscribe hooks in here.

### Established Patterns
- Loaders are overridable via options and wired once in `createLifecycleManager` — the timeout wrapper (D-07) and template cache (D-11) both wrap at that seam so they cover custom loaders.
- Plugins hold the bus as `dx: Context | null`, subscribe in `init()`, tear down in `destroy()` — D-13 follows this lifecycle exactly.
- Failures are contained: emit + graceful return/continue, never throw out of the mount flow — timeout aborts (D-04) obey this.

### Integration Points
- ROB-01/03: `LifecycleManagerOptions` (new optional `timeout`, `cacheTemplates`) and the `LifecycleManager` interface (new `clearTemplateCache`/`invalidateTemplate`); the per-loader wrap seam at `lifecycle.ts:80-84`.
- ROB-02: `createRouter` closure — hoist the sort out of `resolve()`.
- ROB-04: settings `init()` subscribe to `dx:dapp:disabled`; a `cleanup(dappId)` helper iterating `keyHandlers` for the `${dappId}:` prefix + `dappHandlers.delete(dappId)`; unsubscribe in `destroy()`.
</code_context>

<specifics>
## Specific Ideas

- **Consistency with Phase 1 is the throughline:** timeouts are "just another failure mode" — same `dx:error` source strings, same wrapped-message style, same emit-and-abort-vs-emit-and-continue split (styles non-blocking, everything post-injection aborts + clears).
- **Two decisions deliberately mirror each other:** the timeout wrapper (D-07) and the template cache (D-11) both wrap `loadTemplate`/loaders at the manager seam so custom loaders inherit the behavior — one mental model for both features.
- **The 30s-default + `0`/`Infinity` escape hatch (D-02/D-03)** is the one place this phase chooses a behavior change over pure additive; it earns the `BREAKING CHANGE:` note because "un-hangable mounts by default" is the point of ROB-01.
</specifics>

<deferred>
## Deferred Ideas

- **Passing `AbortSignal` into loader signatures** so custom loaders can honor true cancellation — considered and rejected this phase (D-07) because it breaks the `ScriptLoader`/`StyleLoader`/`TemplateLoader` type contract; revisit only if custom-loader cancellation becomes a real need.
- **Whole-mount timeout budget / overall cap** — considered and rejected (D-01) in favor of per-fetch; a future refinement if per-fetch proves insufficient.
- **Caching scripts/styles by URL with invalidation** (parallel to ROB-03) — out of scope; ROB-03 is template-only. The loaders already dedupe within an instance.
- **SEC-01 template sanitizer hook / SEC-02 configurable wallet storage key** — Phase 3.
- **Dedicated stress tests for concurrent navigation / mount races (TEST-01), manifest edge cases (TEST-02), handler-cleanup suite (TEST-03)** — Phase 4. Each Phase 2 change still ships with its own unit tests.

### Reviewed Todos (not folded)
None — the three open todos (WR-01/02/03 from Phase 1 review) target shell manifest-load and wallet paths, not Phase 2's lifecycle/router/settings scope. WR-03 is already tagged `resolves_phase: 3`.
</deferred>

---

*Phase: 2-robustness-load-guards-caching-handler-cleanup*
*Context gathered: 2026-07-11*

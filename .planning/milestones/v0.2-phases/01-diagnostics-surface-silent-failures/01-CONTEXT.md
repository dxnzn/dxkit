# Phase 1: Diagnostics — Surface Silent Failures - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Make three previously-silent failure paths emit `dx:error` so developers can see them:

- **DIAG-01** — the shell can't resolve `#dx-mount` (today `shell.ts:288-289` does `if (!container) return;` — a silent no-op).
- **DIAG-02** — a `localStorage` read/write fails in the wallet, theme, or settings plugin (today swallowed in bare `catch {}` blocks).
- **DIAG-03** — an entry-script fails to load. `lifecycle.ts:147-155` *already* emits `dx:error` here; this phase adds clearing/restoring the mount container so stale dapp DOM isn't left visible.

**In scope:** emitting `dx:error` on these paths, and clearing the mount container on failed mounts. **Not in scope:** the template sanitizer hook, configurable wallet storage key (SEC-01/SEC-02, Phase 3), load timeouts / caching / handler cleanup (Phase 2), and any change to the `dx:error` payload shape.
</domain>

<decisions>
## Implementation Decisions

### `dx:error` payload & source taxonomy
- **D-01:** Payload stays `{ source: string; error: Error }` (`src/types/events.ts:20`). No `EventMap` reshape — this keeps the change fully additive/non-breaking. The `source` string carries the plugin/operation identity; the payload is not enriched with new fields.
- **D-02:** Source strings follow the existing colon-hierarchical convention (`lifecycle:${id}:template`, `shell:manifest`). New sites:
  - Missing `#dx-mount` container → `shell:mount`
  - Plugin storage failures → `plugin:<name>:storage:<op>` where `<name>` ∈ {wallet, theme, settings} and `<op>` ∈ {read, write}. The `plugin:` prefix intentionally mirrors the plugin-event namespace (`dx:plugin:<name>:<action>`) so consumers can distinguish plugin-origin errors from shell/lifecycle errors when filtering. A corrupted-JSON restore failure is a **read** (`plugin:<name>:storage:read`).
  - Existing `lifecycle:*` and `shell:manifest` sources are unchanged.
- **D-03:** The `error` object is **wrapped with a descriptive message** matching the existing convention (`new Error(\`Failed to load dapp template: ...\`)` style) — e.g. `Settings persist failed: <cause>`. Preserve the original caught error as `cause` where reasonable. Rationale: `source` names the plugin+op; the message adds the human-readable "what" for greppable debugging.

### DIAG-01 — missing mount container
- **D-04:** Emit `dx:error` (source `shell:mount`) on **every** failed mount attempt where `#dx-mount` can't be resolved. No dedupe/once-only state. The error correlates with the specific navigation the developer expected to render.
- **D-05:** Keep the current control flow: `emit → return`. No throw (would break the silent-continue contract and could crash route-change handlers) and **no** init-time validation of `#dx-mount` (the container is documented as *lazily* resolved and may legitimately not exist at init; an init check risks false positives). Behavior stays backward-compatible — just no longer silent.

### DIAG-02 — localStorage failures
- **D-06:** Emit `dx:error` on genuine **operation failures** — `setItem`/`getItem`/`removeItem` throwing when storage *is* available (quota exceeded, `SecurityError`, etc.).
- **D-07:** Storage **entirely unavailable** (`canUseStorage()` returns false — SSR, private mode, storage disabled) stays **silent**. This is an expected environment condition, not a failure; plugins already degrade to in-memory. Emitting here would flood `dx:error` on every SSR render / private-mode load and train developers to ignore the event.
- **D-08:** **Corrupted JSON on restore** (`JSON.parse` throws in `restore()`) **emits** `dx:error` (source `plugin:<name>:storage:read`), then still falls back to defaults — so behavior is unchanged but the "settings/theme mysteriously reset" failure becomes visible.
- **D-09:** Repeated identical storage failures **emit every time** (e.g. `settings.persist()` runs on every `setValue`; a persistently-full quota emits per write). No throttle/dedupe state — consistent with D-04, and a flood of identical `dx:error` is itself a signal that storage is broken.
- **D-10 (contract):** Emit via the plugin's captured context bus using optional chaining (`dx?.events.emit(...)`). `restore()` runs *after* `dx = context` in both settings and theme `init()`, and all writes happen through post-init plugin methods, so the bus is available at every real storage site. If the bus is genuinely absent (e.g. a storage op after `destroy()` sets `dx = null`), the emit silently no-ops — there's nowhere to send it.

### DIAG-03 — entry-script load failure & container recovery
- **D-11:** On failure, recover the container by clearing it: `container.innerHTML = ''`. Only one dapp mounts at a time and the previous dapp was unmounted before this sequence began, so "empty" *is* the correct restored state. No snapshot/restore machinery.
- **D-12:** Clear-on-failure applies to **all post-injection failure paths**, not just the entry script — i.e. entry-script failure **and** dependency-script failure (both occur after `container.innerHTML = html` at `lifecycle.ts:121`). This is slightly broader than DIAG-03's literal wording but delivers one consistent guarantee: *a failed mount never leaves visible DOM*. (The template-inject failure itself returns at/before injection, so nothing stale exists there — but the clear can be applied uniformly.)

### Claude's Discretion
- Exact wording of the wrapped error messages (per D-03), so long as they name the operation and read consistently with the existing `lifecycle:*` messages.
- How the wallet plugin's `persistProvider`/`readStoredProvider` closures reach `dx?.events` (they already close over `dx` in `createWallet`).
- Test approach for the new emit paths (mocking `localStorage` to throw, asserting `dx:error` payloads) — researcher/planner decides.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 1: Diagnostics — Surface Silent Failures" — goal + three success criteria.
- `.planning/REQUIREMENTS.md` — DIAG-01, DIAG-02, DIAG-03 definitions.

### Code truth (the failure sites this phase touches)
- `src/types/events.ts:20` — `dx:error` payload type `{ source: string; error: Error }` (locked, do not reshape).
- `src/events.ts:14` — `dx:error` is a registered shell event.
- `src/shell.ts:288-305` — `getMountContainer()` lazy resolution + the `if (!container) return;` silent no-op (DIAG-01).
- `src/shell.ts:165`, `src/shell.ts:224` — existing `dx:error` emit sites / source-string convention (`shell:manifest`).
- `src/lifecycle.ts:87-162` — mount sequence; entry-load emit at 147-155 (DIAG-03), template injection at 121, dependency loop at 132-144.
- `plugins/settings/src/index.ts:38-75` — `canUseStorage()`, `persist()`, `restore()` (DIAG-02). `dx` set in `init()` at line 209, `restore()` at 213.
- `plugins/theme/src/index.ts:61-91` — theme storage helpers; `dx` set at 171, `restore()` at 175. Note re-entrancy `syncing` flag at 37-38 (don't break it).
- `plugins/wallet/src/index.ts:154,166-181` — module-level `STORAGE_KEY` const + `persistProvider`/`readStoredProvider` catch blocks (DIAG-02). Storage-key configurability is Phase 3 (SEC-02), out of scope here.

### Concerns audit (source of this milestone's scope)
- `.planning/codebase/CONCERNS.md` §"Mount Container Lazy Resolution with No Fallback" and §"Settings Storage Lacks Encryption" — the flagged silent-failure paths.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing `events.emit('dx:error', { source, error })` calls in `lifecycle.ts` and `shell.ts` are the exact template for every new emit — copy their shape and source-naming style.
- `canUseStorage()` (settings/theme) already separates "storage unavailable" from "operation failed" — the D-07 silent-vs-emit split maps directly onto this existing guard: unavailable path stays silent, the inner `try/catch` around actual ops becomes the emit site.

### Established Patterns
- Source strings are `<component>:<detail>[:<op>]`, colon-delimited (`lifecycle:${id}:template`). New sources conform (D-02).
- Errors are wrapped in `new Error(\`descriptive: ...\`)` at emit sites, not raw-thrown DOM errors (D-03).
- Plugins hold the bus as `dx: Context | null`, emit via `dx?.events.emit(...)`, set in `init()`, cleared to `null` in `destroy()` (D-10).
- Failures are contained: emit + graceful return, never throw out of shell/lifecycle flow (D-05).

### Integration Points
- DIAG-01: inside `shell.ts` mount flow, before the `if (!container) return;` at 288-289.
- DIAG-02: inside the inner `try/catch` of `persist()`/`restore()`/`persistProvider()`/`readStoredProvider()` across the three plugins.
- DIAG-03: inside `lifecycle.ts` entry-catch (149-154) and dependency-catch (136-142), adding `container.innerHTML = ''` before the `return`.
</code_context>

<specifics>
## Specific Ideas

- Consistency is the throughline: the two "how loud?" decisions (D-04 mount, D-09 storage writes) both resolve to "emit every time, no dedupe state" so the whole phase behaves one way.
- `dx:error` must stay trustworthy — D-07 (silent on unavailable storage) exists specifically to avoid training developers to ignore the event.
</specifics>

<deferred>
## Deferred Ideas

- Configurable wallet storage key (avoid same-origin collisions) — **Phase 3 / SEC-02**. Wallet uses a module-level `STORAGE_KEY` today; leave as-is this phase.
- Template sanitizer hook before `innerHTML` injection — **Phase 3 / SEC-01**.
- Throttle/dedupe of repeated identical `dx:error`s — considered and rejected (D-04, D-09); if noise becomes a real problem it's a future refinement, not this phase.
- Init-time validation of `#dx-mount` — considered and rejected (D-05) due to lazy-resolution false-positive risk.
- Storage encryption — out of scope for the whole milestone (v2).
</deferred>

---

*Phase: 1-diagnostics-surface-silent-failures*
*Context gathered: 2026-07-11*

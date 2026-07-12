# Phase 2: Robustness — Load Guards, Caching & Handler Cleanup - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 3 (all modified, no new files)
**Analogs found:** 3 / 3 (all analogs are within the same file being modified, or a sibling plugin)

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|----------------|------|-----------|-----------------|---------------|
| `src/lifecycle.ts` (ROB-01 timeout, ROB-06 abort, ROB-03 template cache) | service (asset loader / mount orchestrator) | file-I/O (fetch/script/style) + event-driven | itself — `defaultScriptLoader`/`defaultStyleLoader` `loaded` Set dedupe (`src/lifecycle.ts:14-58`) for cache shape; existing `dx:error` emit sites (`src/lifecycle.ts:106-155`) for timeout error emits | exact (in-file precedent) |
| `src/router.ts` (ROB-02 sort cache) | service (route resolver) | CRUD-like lookup / transform | itself — `createRouter` closure pattern; `listeners`/`onPopState` closure-held state (`src/router.ts:19`, `97-104`) | exact (in-file precedent) |
| `plugins/settings/src/index.ts` (ROB-04 handler cleanup) | service (plugin, event-driven) | event-driven pub/sub | `plugins/auth/src/index.ts:52-79` — subscribe-in-init / unsubscribe-in-destroy lifecycle | exact (cross-plugin precedent) |

## Pattern Assignments

### `src/lifecycle.ts` — ROB-01: per-fetch load timeout + true abort

**Analog:** the existing `dx:error` emit sites and container-clear pattern already in this file (Phase 1 convention) — copy their shape verbatim for timeout emits.

**dx:error emit convention** (`src/lifecycle.ts:106-115`, style — non-blocking):
```typescript
if (manifest.styles) {
  try {
    await loadStyle(manifest.styles);
  } catch (err) {
    events.emit('dx:error', {
      source: `lifecycle:${manifest.id}:styles`,
      error: err instanceof Error ? err : new Error(String(err)),
    });
  }
}
```
Timeout emits reuse this exact `{ source, error }` shape — same source string (`lifecycle:<id>:styles`), only the `Error` message differs (name the timeout ms + URL). Style timeout is non-blocking: emit and **continue**, do not `return`.

**dx:error emit + abort convention** (`src/lifecycle.ts:123-129`, template — blocking):
```typescript
if (manifest.template) {
  try {
    const html = await loadTemplate(manifest.template);
    container.innerHTML = html;
  } catch (err) {
    events.emit('dx:error', {
      source: `lifecycle:${manifest.id}:template`,
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return;
  }
}
```
Dependency loop (`:131-146`) and entry (`:148-159`) follow the same shape but additionally clear `container.innerHTML = ''` before `return` (post-injection "no stale DOM" guarantee, Phase 1 D-11/D-12) — reuse this exact two-line abort sequence for template/dependency/entry timeout aborts.

**Dedupe/cache-shape precedent for the timeout wrapper and template cache** (`src/lifecycle.ts:14-35`, script loader `loaded` Set):
```typescript
function defaultScriptLoader(): ScriptLoader {
  const loaded = new Set<string>();

  return (src: string) => {
    if (loaded.has(src)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = src;
      script.onload = () => {
        loaded.add(src);
        resolve();
      };
      script.onerror = () => {
        reject(new Error(`Failed to load dapp script: ${src}`));
      };
      document.head.appendChild(script);
    });
  };
}
```
This closure-held `Set`/`Map` per loader instance is the direct precedent for:
- D-11's `Map<url, html>` template cache — same "per-manager closure, default-on" shape, just `Map` instead of `Set` since the value (HTML) must be retained, not just presence-checked.
- D-06's abort machinery — on timeout, mirror `onload`/`onerror`: null them out and remove the injected node so a late-arriving asset can't fire into a torn-down mount. `defaultStyleLoader` (`:37-58`) is structurally identical — same fix applies to both.

**AbortController precedent for template fetch** (`src/lifecycle.ts:71-78`):
```typescript
function defaultTemplateLoader(): TemplateLoader {
  return async (src: string) => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to load dapp template: ${src} (${res.status})`);
    return res.text();
  };
}
```
D-06 requires wiring `fetch(src, { signal })` with an `AbortController` here, calling `.abort()` when the timeout fires — the `if (!res.ok) throw ...` line's message style (`Failed to load dapp template: ${src} (${res.status})`) is the wording precedent for the new timeout-specific message (e.g. `Timed out loading dapp template after ${ms}ms: ${src}`).

**Wiring seam for both the timeout wrapper (D-07) and template cache (D-11)** (`src/lifecycle.ts:80-84`):
```typescript
export function createLifecycleManager(events: EventBus, options: LifecycleManagerOptions = {}): LifecycleManager {
  const loadScript = options.scriptLoader ?? defaultScriptLoader();
  const loadStyle = options.styleLoader ?? defaultStyleLoader();
  const loadTemplate = options.templateLoader ?? defaultTemplateLoader();
  const hasPlugin = options.hasPlugin ?? (() => true);
```
Both features wrap at this seam — `loadTemplate` (and the script/style loaders for the timeout, D-07) should be wrapped here so custom loaders inherit timeout + cache behavior, per CONTEXT.md D-07/D-11. `LifecycleManagerOptions` (`:60-69`) is where `timeout`/`cacheTemplates` fields get added; `LifecycleManager` interface (`:3-8`) is where `clearTemplateCache()`/`invalidateTemplate(url)` get added, following the existing method style (`mount`, `unmount`, `getCurrentDapp`, `destroy` — all no-arg or single-primitive-arg, `void`/`Promise<void>` returns).

---

### `src/router.ts` — ROB-02: sort cache

**Analog:** in-file — the router already caches other derived/listener state in the closure (`listeners` Set at `:19`); apply the same construction-time-once pattern to the sorted manifest list.

**Current per-call sort to replace** (`src/router.ts:36-49`):
```typescript
function resolve(path: string): DappManifest | null {
  const normalized = normalizePath(path);

  // Longest prefix wins — /tools/sender matches before /tools
  const sorted = [...manifests].sort((a, b) => b.route.length - a.route.length);

  for (const manifest of sorted) {
    if (normalized === manifest.route || normalized.startsWith(`${manifest.route}/`)) {
      return manifest;
    }
  }

  return null;
}
```
D-08: hoist `const sorted = [...manifests].sort(...)` out of `resolve()` into the `createRouter` closure body (alongside `const { mode, basePath, manifests } = config;` at `:18` and `const listeners = new Set(...)` at `:19`), computed once. `resolve()` then just iterates the pre-sorted array — no other logic changes. No public API change (matches the router's existing "closure holds construction-time state, functions read it" style used throughout this file, e.g. `onPopState`/`onHashChange` set up once at `:97-104` and referenced by `destroy()`).

---

### `plugins/settings/src/index.ts` — ROB-04: handler cleanup on disable

**Analog:** `plugins/auth/src/index.ts:52-79` — subscribe-to-another-plugin's-events in `init()`, unsubscribe in `destroy()`, store the unsubscribe function in closure state.

**Subscribe/unsubscribe lifecycle precedent** (`plugins/auth/src/index.ts:52-79`):
```typescript
async init(context: Context): Promise<void> {
  dx = context;

  context.eventRegistry.registerEvent('auth', [
    { name: 'dx:plugin:auth:authenticated' },
    { name: 'dx:plugin:auth:deauthenticated' },
  ]);

  wallet = context.getPlugin<Wallet>(walletPlugin) ?? null;

  if (wallet) {
    // Sync initial state
    const ws = wallet.getState();
    if (ws.connected && ws.address) {
      state = { authenticated: true, address: ws.address, token: null, expiresAt: null };
    }

    // Listen for wallet changes
    walletUnsub = wallet.onStateChange(syncFromWallet);
  }
},

async destroy(): Promise<void> {
  if (walletUnsub) {
    walletUnsub();
    walletUnsub = null;
  }
  handlers.clear();
```
D-13 follows this exactly: declare a closure variable (e.g. `let disabledUnsub: (() => void) | null = null;`) alongside `dx`, `keyHandlers`, `dappHandlers` (`plugins/settings/src/index.ts:32-36`); in `init()` (`:219-231`) add `disabledUnsub = context.events.on('dx:dapp:disabled', ({ id }) => cleanup(id));` after `loadDefinitions(context)`; in `destroy()` (`:233-237`) call `disabledUnsub?.(); disabledUnsub = null;` before the existing `keyHandlers.clear(); dappHandlers.clear(); dx = null;`.

**Cleanup scope — what to iterate and preserve** (`plugins/settings/src/index.ts:202-213`, the handler registration shape defines the deletion shape):
```typescript
onChange(dappId: string, key: string, handler: (value: unknown) => void): () => void {
  const mapKey = `${dappId}:${key}`;
  if (!keyHandlers.has(mapKey)) keyHandlers.set(mapKey, new Set());
  keyHandlers.get(mapKey)!.add(handler);
  return () => keyHandlers.get(mapKey)?.delete(handler);
},

onAnyChange(dappId: string, handler: (key: string, value: unknown) => void): () => void {
  if (!dappHandlers.has(dappId)) dappHandlers.set(dappId, new Set());
  dappHandlers.get(dappId)!.add(handler);
  return () => dappHandlers.get(dappId)?.delete(handler);
},
```
`keyHandlers` is keyed `${dappId}:${key}` — D-14's `cleanup(dappId)` must iterate `keyHandlers.keys()` and delete entries whose key starts with `${dappId}:`, then `dappHandlers.delete(dappId)`. **Must NOT** touch the `_shell` toggle-bridge registration at `:110-118` (`settingsAPI.onChange('_shell', m.id, ...)`), which is keyed `_shell:${m.id}` — a `${dappId}:` prefix match naturally excludes it since the dappId there is `_shell`, not the disabled dapp's own id. Verify this with a unit test asserting the `_shell:X` handler survives `cleanup('X')`.

**`destroy()` clear-both-maps precedent to mirror at smaller scope** (`plugins/settings/src/index.ts:233-237`):
```typescript
async destroy(): Promise<void> {
  keyHandlers.clear();
  dappHandlers.clear();
  dx = null;
},
```
`cleanup(dappId)` is the per-dapp analog of this full-clear — same two maps, targeted deletion instead of `.clear()`.

---

## Shared Patterns

### `dx:error` emit shape (Phase 1 convention, reused for ROB-01 timeouts)
**Source:** `src/lifecycle.ts:110-113`, `123-126`, `137-140`, `152-155`
**Apply to:** all timeout emit sites in `src/lifecycle.ts`
```typescript
events.emit('dx:error', {
  source: `lifecycle:${manifest.id}:<asset-type>`,
  error: err instanceof Error ? err : new Error(String(err)),
});
```
Timeout errors use the identical source strings; only the underlying `Error` message changes to describe a timeout rather than a load failure.

### Container-clear "no stale DOM" guarantee (Phase 1 D-11/D-12)
**Source:** `src/lifecycle.ts:142`, `157`
**Apply to:** template, dependency, and entry timeout aborts in `src/lifecycle.ts` (NOT style timeouts, which are non-blocking)
```typescript
container.innerHTML = '';
return;
```

### Closure-held per-instance Map/Set cache
**Source:** `src/lifecycle.ts:16` (`defaultScriptLoader`'s `loaded` Set), `src/lifecycle.ts:39` (`defaultStyleLoader`'s `loaded` Set)
**Apply to:** ROB-03's template cache (`Map<url, html>`) — same per-manager-instance closure scoping, default-on behavior, no module-level singleton (avoids the CONCERNS.md-flagged anti-pattern).

### Plugin init/destroy subscribe lifecycle
**Source:** `plugins/auth/src/index.ts:52-79` (`walletUnsub` pattern)
**Apply to:** ROB-04's `dx:dapp:disabled` subscription in `plugins/settings/src/index.ts` — subscribe in `init()`, store unsubscribe fn in closure, call it in `destroy()`.

## No Analog Found

None — all three modified files have strong in-file or sibling-plugin precedent for every planned change. No RESEARCH.md external patterns needed.

## Metadata

**Analog search scope:** `src/lifecycle.ts`, `src/router.ts`, `plugins/settings/src/index.ts`, `plugins/auth/src/index.ts`, `src/shell.ts` (disableDapp emit site)
**Files scanned:** 5
**Pattern extraction date:** 2026-07-11

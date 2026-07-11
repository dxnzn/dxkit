# Phase 1: Diagnostics — Surface Silent Failures - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 5 (all modified, no new files)
**Analogs found:** 5 / 5 (in-file analogs — each target file already contains the canonical emit pattern nearby)

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|----------------|------|-----------|-----------------|---------------|
| `src/shell.ts` | orchestrator/controller | event-driven | `src/shell.ts:224-227` (own file, plugin-init emit) and `src/lifecycle.ts:97-100` | exact (in-file) |
| `src/lifecycle.ts` | lifecycle manager | event-driven | `src/lifecycle.ts:110-114` / `:123-127` (adjacent emit sites in same function) | exact (in-file) |
| `plugins/settings/src/index.ts` | plugin (service) | event-driven / file-I/O (localStorage) | `plugins/theme/src/index.ts:68-94` (identical `persist`/`restore`/`canUseStorage` shape) | exact (cross-plugin) |
| `plugins/theme/src/index.ts` | plugin (service) | event-driven / file-I/O (localStorage) | `plugins/settings/src/index.ts:46-75` (identical shape) | exact (cross-plugin) |
| `plugins/wallet/src/index.ts` | plugin (service) | event-driven / file-I/O (localStorage) | `plugins/settings/src/index.ts:38-75` (canUseStorage-based read/write pattern to adapt) | role-match (wallet lacks `canUseStorage()` split today — must add per D-06/D-07) |

## Pattern Assignments

### `src/shell.ts` (DIAG-01 — `shell:mount`)

**Analog A — existing emit-with-return in same file** (`src/shell.ts:164-172`, `loadDappManifest`):
```typescript
if (!isValidManifest(base)) {
  events.emit('dx:error', {
    source: 'shell:manifest',
    error: new Error(
      `Invalid manifest from ${entry.manifest} — missing required fields (id, route, entry, nav.label)`,
    ),
  });
  return null;
}
```

**Analog B — plugin-init try/catch emit** (`src/shell.ts:219-228`):
```typescript
try {
  await plugin.init(context);
} catch (err) {
  events.emit('dx:error', {
    source: `plugin:${name}`,
    error: err instanceof Error ? err : new Error(String(err)),
  });
}
```

**Target site** (`src/shell.ts:288-289`, inside `mountDapp`):
```typescript
const container = getMountContainer();
if (!container) return;
```
Becomes (per D-04/D-05 — emit every time, no dedupe, keep emit-then-return control flow):
```typescript
const container = getMountContainer();
if (!container) {
  events.emit('dx:error', {
    source: 'shell:mount',
    error: new Error(`Mount failed for "${manifest.id}" — #dx-mount container not found in the DOM`),
  });
  return;
}
```
`manifest` is already in scope in `mountDapp(manifest: DappManifest)` (line 270) — use `manifest.id` in the message per D-03 (descriptive, correlates to the specific navigation).

---

### `src/lifecycle.ts` (DIAG-03 — clear container on post-injection failure)

**Analog — dependency-load emit site** (`src/lifecycle.ts:132-144`):
```typescript
if (manifest.dependencies?.length) {
  for (const dep of manifest.dependencies) {
    try {
      await loadScript(dep);
    } catch (err) {
      events.emit('dx:error', {
        source: `lifecycle:${manifest.id}:dependency`,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return;
    }
  }
}
```

**Analog — entry-script emit site (already emits, needs clear added)** (`src/lifecycle.ts:147-155`):
```typescript
try {
  await loadScript(manifest.entry);
} catch (err) {
  events.emit('dx:error', {
    source: `lifecycle:${manifest.id}`,
    error: err instanceof Error ? err : new Error(String(err)),
  });
  return;
}
```

Per D-11/D-12, both catch blocks above (dependency loop at 136-142 and entry-script at 149-154) need `container.innerHTML = '';` inserted before `return;` — `container` is the parameter already in scope (`mount(manifest, container, path)` at line 87). Template injection happens at line 121 (`container.innerHTML = html`), so both these catches fire post-injection and must clear. The template-catch itself (118-128) returns before/at injection — no stale DOM exists there, so D-12 notes it does not strictly need clearing but applying it uniformly is acceptable/harmless.

Emit shape to copy is identical across all three catch blocks in this file — only the `source` suffix (`:dependency` vs none vs `:styles`) and message text differ. No new pattern needed, just replicate + add the one line.

---

### `plugins/settings/src/index.ts` (DIAG-02 — `plugin:settings:storage:read` / `plugin:settings:storage:write`)

**Current code** (`plugins/settings/src/index.ts:38-75`):
```typescript
function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function';
  } catch {
    return false;
  }
}

function persist(): void {
  if (!canUseStorage()) return;
  try {
    const data: Record<string, Record<string, unknown>> = {};
    for (const [dappId, values] of store) {
      data[dappId] = Object.fromEntries(values);
    }
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    /* storage full or blocked */
  }
}

function restore(): void {
  if (!canUseStorage()) return;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const data = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    for (const [dappId, values] of Object.entries(data)) {
      const map = new Map<string, unknown>();
      for (const [key, value] of Object.entries(values)) {
        map.set(key, value);
      }
      store.set(dappId, map);
    }
  } catch {
    /* corrupted — use defaults */
  }
}
```
`dx: Context | null` declared at line 36, set in `init()` at line 209 (`dx = context`), `restore()` called at line 213 (after `dx` is set — so `dx?.events` is available inside `restore()`).

**Required change shape** (per D-06/D-07/D-08/D-09/D-10 — the `canUseStorage()` early-return stays silent; only the inner `try/catch` becomes an emit site):
```typescript
function persist(): void {
  if (!canUseStorage()) return;
  try {
    const data: Record<string, Record<string, unknown>> = {};
    for (const [dappId, values] of store) {
      data[dappId] = Object.fromEntries(values);
    }
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (err) {
    dx?.events.emit('dx:error', {
      source: 'plugin:settings:storage:write',
      error: new Error(`Settings persist failed: ${err instanceof Error ? err.message : String(err)}`, {
        cause: err,
      }),
    });
  }
}

function restore(): void {
  if (!canUseStorage()) return;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const data = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    for (const [dappId, values] of Object.entries(data)) {
      const map = new Map<string, unknown>();
      for (const [key, value] of Object.entries(values)) {
        map.set(key, value);
      }
      store.set(dappId, map);
    }
  } catch (err) {
    dx?.events.emit('dx:error', {
      source: 'plugin:settings:storage:read',
      error: new Error(`Settings restore failed (corrupted data) — falling back to defaults: ${err instanceof Error ? err.message : String(err)}`, {
        cause: err,
      }),
    });
  }
}
```
Note: `restore()` also has a silent `getItem` failure path implicitly covered by the same catch (D-06 covers `getItem` throwing too — not just JSON.parse). One catch block covers both per D-08's "corrupted JSON on restore" wording — both map to `plugin:settings:storage:read`.

---

### `plugins/theme/src/index.ts` (DIAG-02 — `plugin:theme:storage:read` / `plugin:theme:storage:write`)

**Current code** (`plugins/theme/src/index.ts:60-94`) — identical shape to settings:
```typescript
function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function';
  } catch {
    return false;
  }
}

function persist(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        theme: currentTheme,
        mode: currentMode,
      }),
    );
  } catch {
    /* storage full or blocked */
  }
}

function restore(): void {
  if (!canUseStorage()) return;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.theme && themes.includes(saved.theme)) currentTheme = saved.theme;
    if (saved.mode && ['light', 'dark', 'system'].includes(saved.mode)) currentMode = saved.mode;
  } catch {
    /* corrupted — use defaults */
  }
}
```
`dx: Context | null` declared at line 35, set in `init()` at line 171 (`dx = context`), `restore()` called at line 175 (after `dx` is set).

Apply the same transform as settings: `catch {}` → `catch (err) { dx?.events.emit('dx:error', { source: 'plugin:theme:storage:write' | 'plugin:theme:storage:read', error: new Error(...) }); }`. Note the re-entrancy `syncing` flag (lines 37-38) is unrelated to `persist`/`restore` — do not touch it.

---

### `plugins/wallet/src/index.ts` (DIAG-02 — `plugin:wallet:storage:read` / `plugin:wallet:storage:write`)

**Current code** (`plugins/wallet/src/index.ts:154, 166-184`) — **differs from settings/theme**: no `canUseStorage()` guard exists here; both functions wrap the whole operation in one bare `try/catch`:
```typescript
const STORAGE_KEY = 'dxkit:wallet';

function persistProvider(providerId: string | null): void {
  try {
    if (providerId) {
      localStorage.setItem(STORAGE_KEY, providerId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* localStorage unavailable */
  }
}

function getPersistedProvider(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
```
(CONTEXT.md's `<canonical_refs>` calls these `persistProvider`/`readStoredProvider`, but the actual current names are `persistProvider`/`getPersistedProvider` — planner should use the real names.)

`dx: Context | null` declared at line 161, set in `init()` at line 226 (`dx = context`). `getPersistedProvider()` is called at line 235 inside `init()`, **after** `dx = context` at line 226 — so `dx?.events` is available. `persistProvider()` is called at lines 243, 287, 315 — all post-init.

Since wallet's catch is a single combined "storage unavailable OR operation failed" block (unlike settings/theme's split), and D-07 requires *silent* on genuinely-unavailable storage, the planner must decide (per "Claude's Discretion") whether to introduce a `canUseStorage()`-style guard in wallet too, mirroring settings/theme, so the D-06/D-07 split applies consistently:
```typescript
function persistProvider(providerId: string | null): void {
  try {
    if (providerId) {
      localStorage.setItem(STORAGE_KEY, providerId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    dx?.events.emit('dx:error', {
      source: 'plugin:wallet:storage:write',
      error: new Error(`Wallet provider persist failed: ${err instanceof Error ? err.message : String(err)}`, {
        cause: err,
      }),
    });
  }
}

function getPersistedProvider(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    dx?.events.emit('dx:error', {
      source: 'plugin:wallet:storage:read',
      error: new Error(`Wallet provider restore failed: ${err instanceof Error ? err.message : String(err)}`, {
        cause: err,
      }),
    });
    return null;
  }
}
```
Adding a `canUseStorage()` guard (copied verbatim from settings/theme, lines 38-44/60-66) ahead of the try in each function is the closest-to-existing-convention way to preserve D-07's silent-on-unavailable behavior; without it, wallet will emit on every SSR/private-mode load, violating D-07. Recommend planner add it for consistency, scoped strictly to DIAG-02 (not touching STORAGE_KEY per D out-of-scope note).

## Shared Patterns

### `dx:error` emit shape (canonical, do not reshape)
**Source:** `src/types/events.ts:20`
```typescript
'dx:error': { source: string; error: Error };
```
**Apply to:** every new emit site in this phase.

### Wrapped-error-message convention
**Source:** `src/lifecycle.ts:97-100`, `:110-114`, `:123-127`, `:150-153`; `src/shell.ts:165-170`
```typescript
new Error(`Invalid manifest from ${entry.manifest} — missing required fields (id, route, entry, nav.label)`)
```
Pattern: `new Error(\`<Descriptive action>: <cause or context>\`)`. Existing sites don't set `cause` (they re-derive the message from `err instanceof Error ? err : new Error(String(err))` and pass that whole object as `error`, not wrapping-with-cause). New DIAG-02 sites (per D-03) should instead construct a *fresh* descriptive `Error` and set `cause: err` — this is a new sub-pattern not previously used in the codebase; keep it consistent across settings/theme/wallet.

### Plugin-held bus reference (`dx: Context | null`)
**Source:** `plugins/settings/src/index.ts:36,209`; `plugins/theme/src/index.ts:35,171`; `plugins/wallet/src/index.ts:161,226`
```typescript
let dx: Context | null = null;
// ...
async init(context: Context): Promise<void> {
  dx = context;
  // ...
},
```
**Apply to:** all three plugin storage emit sites — emit via `dx?.events.emit(...)`, optional-chained (D-10). No `destroy()` currently nulls `dx` in these three files except where noted in CONTEXT — verify each `destroy()` before assuming `dx = null` there; if absent, the optional-chaining guard is still correct defensively.

### `canUseStorage()` availability guard
**Source:** `plugins/settings/src/index.ts:38-44`, `plugins/theme/src/index.ts:60-66` (byte-identical)
```typescript
function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function';
  } catch {
    return false;
  }
}
```
**Apply to:** wallet plugin, if planner chooses to add the split (see wallet section above) — copy verbatim.

## No Analog Found

None — every target file already contains at least one existing `dx:error` emit site or an equivalent-shaped sibling file (settings ↔ theme) to copy from.

## Metadata

**Analog search scope:** `src/shell.ts`, `src/lifecycle.ts`, `src/types/events.ts`, `plugins/settings/src/index.ts`, `plugins/theme/src/index.ts`, `plugins/wallet/src/index.ts`
**Files scanned:** 6
**Pattern extraction date:** 2026-07-11

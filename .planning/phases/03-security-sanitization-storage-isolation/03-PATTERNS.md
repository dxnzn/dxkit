# Phase 3: Security — Sanitization & Storage Isolation - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 4 (all modified, none new)
**Analogs found:** 4 / 4 (all self-analogs — this phase modifies existing files in place, extending established patterns already present in the same files)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/lifecycle.ts` | service (DOM/asset orchestrator) | request-response (fetch + DOM injection pipeline) | itself — existing template/style/dependency mount blocks | exact (in-file precedent) |
| `src/types/shell.ts` | config/type | transform (config shape) | itself — existing `ShellConfig` interface | exact (in-file precedent) |
| `src/shell.ts` | service (orchestrator/factory) | request-response (config → wired subsystems) | itself — existing config destructure + `createLifecycleManager` wiring | exact (in-file precedent) |
| `plugins/wallet/src/index.ts` | service (plugin/provider coordinator) | CRUD (localStorage read/write) + event-driven (state change/dx:error emits) | itself — existing `persistProvider`/`getPersistedProvider`/`updateState`/`init()` reconnect catch | exact (in-file precedent) |

No cross-file analogs were needed — every touched file already contains the exact pattern shape (emit-and-return failure branch, additive-default option resolution, closure-scoped config) that the new code must follow. This is a "extend the file's own conventions" phase, not a "port a pattern from elsewhere" phase.

## Pattern Assignments

### `src/lifecycle.ts` (service, request-response) — SEC-01 sanitizer hook

**Analog:** itself, `src/lifecycle.ts:252-264` (template mount block) and `:139-160` (`LifecycleManagerOptions`)

**Options interface pattern** (lines 139-160) — additive optional field with JSDoc explaining default/opt-out behavior, same shape `timeout`/`cacheTemplates` already use:
```typescript
export interface LifecycleManagerOptions {
  scriptLoader?: ScriptLoader;
  styleLoader?: StyleLoader;
  templateLoader?: TemplateLoader;
  hasPlugin?: (name: string) => boolean;
  timeout?: number;
  cacheTemplates?: boolean;
  // NEW: sanitizeTemplate?: TemplateSanitizer;  — follow this same optional-field + JSDoc shape
}
```

**Core emit-and-return failure pattern** (lines 252-264) — the exact block the sanitizer call slots into, immediately before `container.innerHTML`:
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
Per D-08/Pitfall 1 (RESEARCH.md), the sanitize call needs its **own** nested try/catch (or discriminator) so `source: lifecycle:<id>:sanitize` is distinguishable from `lifecycle:<id>:template` — do not just add one more `await` inside the existing catch. The three sibling blocks (`:styles` lines 240-250, `:dependency` lines 267-281, entry lines 284-294) all follow this same "own try/catch, own source suffix" shape — dependency/entry additionally reuse the "`container.innerHTML = ''`" post-injection cleanup, which is NOT needed here since sanitize runs before injection (D-07 note: abort happens before injection, no stale-DOM concern).

**Options resolution pattern** (lines 191-220) — additive-default construction-time resolution, e.g. `const timeoutMs = options.timeout ?? 30000;` and the cache-wrap-outermost comment block — same convention a `sanitizeTemplate` closure capture should follow (captured once at `createLifecycleManager` construction, called fresh on every `mount()`, never cached — D-06).

**Cache/mount separation** (lines 211-220, `loadTemplate`) — already separates "get HTML" (cache-aware) from "inject HTML" (mount's `container.innerHTML =`) — D-06 requires zero changes here; the sanitize call is purely a `mount()`-level insertion between the two.

---

### `src/types/shell.ts` (config/type, transform) — D-04/D-05 `ShellConfig` restructure

**Analog:** itself, lines 13-32 (current flat `ShellConfig`)

**Current flat shape to restructure** (lines 26-31):
```typescript
export interface ShellConfig {
  // ...
  scriptLoader?: (src: string) => Promise<void>;
  styleLoader?: (href: string) => Promise<void>;
  templateLoader?: (src: string) => Promise<string>;
}
```
D-04 removes these three fields and replaces with a single `lifecycle?: LifecycleManagerOptions` field (import `LifecycleManagerOptions` from `./lifecycle.js`... note: check current import boundaries, `types/shell.ts` currently only imports from `./interfaces.js`/`./manifest.js` — a new cross-module type import is required, follow the existing `import type { X } from './y.js'` style at lines 1-2).

---

### `src/shell.ts` (service/orchestrator, request-response) — D-04/D-05 wiring + runtime throw

**Analog:** itself, lines 15-36 (config destructure + `createLifecycleManager` call)

**Current destructure + forwarding pattern** (lines 15-36):
```typescript
export function createShell(config: ShellConfig = {}): Shell {
  const {
    plugins = {},
    dapps: dappEntries,
    manifests: inlineManifests,
    registryUrl = '/registry.json',
    basePath = '/',
    mode = 'history',
    scriptLoader,
    styleLoader,
    templateLoader,
  } = config;

  const events = createEventBus();
  const eventRegistry = createEventRegistry(events);
  const registry = createPluginRegistry();
  const lifecycle = createLifecycleManager(events, {
    hasPlugin: (name: string) => registry.has(name),
    scriptLoader,
    styleLoader,
    templateLoader,
  });
```
D-05's runtime throw guard belongs **before** this destructure (RESEARCH.md Pattern 2, illustrative shape):
```typescript
const flatLoaderKeys = ['scriptLoader', 'styleLoader', 'templateLoader'] as const;
const present = flatLoaderKeys.filter((k) => k in config);
if (present.length > 0) {
  throw new Error(`ShellConfig.${present.join('/')} ... move to config.lifecycle.*`);
}
```
This mirrors the existing "validate before proceeding" style already used elsewhere in the file (`isValidManifest` check at lines 148-157 gates before use, though that path emits+skips rather than throws — `createShell`'s config-shape violation is closer to a precondition failure, matching D-05's "throws a descriptive Error" requirement). After the guard, destructure becomes `const { ..., lifecycle = {} } = config;` and forwarding becomes `createLifecycleManager(events, { hasPlugin: ..., ...lifecycle })`.

---

### `plugins/wallet/src/index.ts` (service, CRUD + event-driven) — SEC-02, WR-02, WR-03

**Analog:** itself — four separate sites in the same file

**SEC-02 — storage key closure-variable swap.** Current module constant (line 154) and its two readers (lines 174-205):
```typescript
const STORAGE_KEY = 'dxkit:wallet';

function persistProvider(providerId: string | null): void {
  if (!canUseStorage()) return;
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
  if (!canUseStorage()) return null;
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
D-09 change: `WalletOptions` (line 149-152) gains `storageKey?: string`; `createWallet()` (line 157) resolves `const storageKey = options.storageKey ?? 'dxkit:wallet';` once at construction, and `persistProvider`/`getPersistedProvider` close over `storageKey` instead of the module const. The `dx:error` emit shape (`source`, wrapped `Error` with `cause: err`) is the exact template `plugin:wallet:reconnect` (WR-03) should reuse.

**WR-03 — reconnect catch, currently silent** (lines 255-267, `init()`):
```typescript
const savedId = getPersistedProvider();
if (savedId) {
  const provider = providers.find((p) => p.id === savedId);
  if (provider?.available()) {
    try {
      await plugin.connect(savedId);
    } catch {
      // Provider no longer available — clear persisted state
      persistProvider(null);
    }
  }
}
```
D-12 fix — reuse the `storage:write`/`storage:read` emit shape above, source `plugin:wallet:reconnect`, `cause: err`, **and** keep `persistProvider(null)`:
```typescript
} catch (err) {
  dx?.events.emit('dx:error', {
    source: 'plugin:wallet:reconnect',
    error: err instanceof Error ? err : new Error(String(err), { cause: err }),
  });
  persistProvider(null);
}
```

**WR-02 — empty accounts** (`connect()`, lines 40-67, esp. line 46-50):
```typescript
async connect(): Promise<WalletState> {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error('No wallet detected. Install MetaMask or another EIP-1193 wallet.');
  }

  const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
  const chainIdHex: string = await provider.request({ method: 'eth_chainId' });
  const chainId = parseInt(chainIdHex, 16);

  updateState({ connected: true, address: accounts[0], chainId, provider });
```
D-11 fix follows the existing "no provider" throw as the template — add a same-shape guard immediately after `eth_requestAccounts` resolves:
```typescript
if (accounts.length === 0) {
  throw new Error('Wallet connection request returned no accounts.');
}
```
before the `chainId`/`updateState` calls, keeping the file's established "throwing API, no state mutation on failure" contract (the `!provider` branch above is the direct precedent — same function, same failure-throws-immediately shape).

**`updateState` non-null assertion removal** (lines 207-220, esp. 214/218):
```typescript
function updateState(newState: WalletState): void {
  const wasConnected = state.connected;
  state = { ...newState };
  for (const handler of handlers) handler(state);

  if (!dx) return;
  if (newState.connected && !wasConnected) {
    dx.events.emit('dx:plugin:wallet:connected', { address: newState.address!, chainId: newState.chainId ?? 0 });
  } else if (!newState.connected && wasConnected) {
    dx.events.emit('dx:plugin:wallet:disconnected', {});
  } else if (newState.connected && wasConnected) {
    dx.events.emit('dx:plugin:wallet:changed', { address: newState.address!, chainId: newState.chainId ?? 0 });
  }
}
```
Per RESEARCH.md Pitfall 4: since D-11 makes `connect()` throw before `updateState` is ever called with an empty-accounts result, the `address!` assertions should be replaced with a type-narrowing guard (e.g. `if (newState.connected && newState.address) { ... emit ... }`) rather than a bare re-assertion — mirrors the file's existing defensive style (`provider.on?.(...)`, optional chaining throughout) rather than introducing a new pattern.

---

## Shared Patterns

### Emit-and-return blocking failure (fail-closed)
**Source:** `src/lifecycle.ts:252-264` (template block), also `:267-281` (dependency), `:284-294` (entry)
**Apply to:** SEC-01's sanitizer failure path (D-07) — same shape, distinct `source` suffix per D-08.
```typescript
} catch (err) {
  events.emit('dx:error', {
    source: `lifecycle:${manifest.id}:<stage>`,
    error: err instanceof Error ? err : new Error(String(err)),
  });
  return;
}
```

### Non-blocking failure (emit, continue)
**Source:** `src/lifecycle.ts:240-250` (styles block)
**Apply to:** NOT applicable to the sanitizer (D-07 requires fail-closed/blocking) — included here only to flag the contrast: styles is the one lifecycle stage that emits-and-continues, everything else (including the new sanitize stage) emits-and-returns.

### Wrapped-Error-with-cause `dx:error` emit
**Source:** `plugins/wallet/src/index.ts:182-189` (`storage:write`), `:196-204` (`storage:read`)
**Apply to:** WR-03's `plugin:wallet:reconnect` emit — identical `new Error(message, { cause: err })` + `dx?.events.emit('dx:error', { source, error })` shape.

### Additive-default option resolution
**Source:** `src/lifecycle.ts:192,208` (`options.timeout ?? 30000`, `options.cacheTemplates ?? true`)
**Apply to:** `WalletOptions.storageKey` (`options.storageKey ?? 'dxkit:wallet'`) and any `sanitizeTemplate` default handling (`options.sanitizeTemplate` — undefined means "pass through unchanged", no `??` needed since there's no literal default value, just a conditional call).

### Config destructure + subsystem forwarding
**Source:** `src/shell.ts:15-36`
**Apply to:** D-04's `lifecycle = {}` destructure and `...lifecycle` spread into `createLifecycleManager()`'s second argument — direct textual analog already present in the file, only the field list changes from three flat names to one spread object.

## No Analog Found

None — every file this phase touches already contains the exact pattern shape needed (in-file precedent for every change). No external/cross-file pattern porting is required.

## Metadata

**Analog search scope:** `src/lifecycle.ts`, `src/types/shell.ts`, `src/shell.ts`, `plugins/wallet/src/index.ts` (the four files named in CONTEXT.md's "Code truth" section — no broader codebase search was needed since CONTEXT.md/RESEARCH.md already pinpoint exact line ranges and the patterns to extend live in the same files being modified)
**Files scanned:** 4 (full reads, all ≤ 400 lines, single-pass)
**Pattern extraction date:** 2026-07-12

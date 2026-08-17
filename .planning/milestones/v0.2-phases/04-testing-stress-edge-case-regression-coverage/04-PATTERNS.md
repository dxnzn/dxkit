# Phase 4: Testing — Stress, Edge-Case & Regression Coverage - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 8 (2 new test files/scenarios, 6 modified source + existing test files)
**Analogs found:** 8 / 8

This phase is almost entirely internal (bug fixes + tests), so "analogs" are mostly existing
patterns *within the same files* being extended, plus one genuinely new test file. There is no
component/controller layer here — everything is service (lifecycle/shell/router/utils) or test.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/lifecycle.ts` (mount-generation guard) | service | event-driven / async-state-machine | `src/lifecycle.ts` `withTimeout`/`withSanitizeTimeout` staleness-guard idiom (same file, lines 37-95) | exact — same file, same "guard an in-flight async op" pattern class |
| `src/shell.ts` (invalidate-on-disable hook, tier validation, route normalize/reject, duplicate-route emit, WR-01 emit) | service | request-response / CRUD (manifest loading) | `src/shell.ts` `pendingMountId` guard (lines 56-58, 296-299) + existing `isValidManifest`/`dx:error` emit (lines 160-185) | exact — same file, generalizing an existing idiom |
| `src/router.ts` (no code change expected; normalization reused, not moved) | service | transform (pure function) | `src/router.ts` `normalizePath()` (lines 27-39) | exact — this *is* the algorithm D-06 reuses |
| `src/utils.ts` (no code change; behavior asserted only) | utility | transform | `src/utils.ts` `deepMerge()` (whole file, 22 lines) | exact — already implemented, only needs assertion coverage |
| `tests/stress.test.ts` (new) | test | event-driven / integration | `tests/shell.test.ts` `describe('mount de-duplication (double-mount regression)')` block (lines 526-653) | exact — direct structural ancestor; this phase's dedicated file supersedes/extends it |
| `tests/shell.test.ts` (extended: WR-01, D-06/D-07/D-08 cases) | test | request-response / integration | `tests/shell.test.ts` existing manifest-loading tests (lines 262-321) | exact — same file, same describe area |
| `tests/router.test.ts` (extended: route normalization, exact-duplicate) | test | transform / unit | `tests/router.test.ts` existing "uses longest prefix match" tests | exact — same file |
| `tests/shell.test.ts` or new `plugins/settings/tests/integration.test.ts` (TEST-03 real-wiring regression) | test | event-driven / integration | `plugins/settings/tests/settings.test.ts` mockContext-based tests (lines ~530-639) contrasted with `tests/shell.test.ts` real-`createShell` conventions | role-match — mirrors the *assertion*, but must drive through real `createShell`, not the mocked-context fixture |

## Pattern Assignments

### `src/lifecycle.ts` — mount-generation guard (service, event-driven)

**Analog:** same file — `withTimeout` staleness/settle-guard idiom (lines 37-64) and the existing `mount()` body (lines 272-369).

**Existing closure-state pattern to mirror** (lines 253, 364, 371-378):
```typescript
let currentDappId: string | null = null;
// ...
currentDappId = manifest.id;
events.emit('dx:mount', { id: manifest.id, container, path: path ?? manifest.route });
events.emit('dx:dapp:mounted', { id: manifest.id });
// ...
function unmount(): void {
  if (!currentDappId) return;
  const id = currentDappId;
  events.emit('dx:unmount', { id });
  events.emit('dx:dapp:unmounted', { id });
  currentDappId = null;
}
```
The new `mountGeneration` counter must live in this same closure (`createLifecycleManager()`), not module scope — per the project's "no new module-level singletons" convention already documented for `defaultScriptLoader`'s `loaded` Set (lines 98-99).

**Staleness-check idiom to generalize** (lines 44-63, `withTimeout`):
```typescript
return (arg: string) =>
  new Promise<R>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out loading dapp ${label} after ${timeoutMs}ms: ${arg}`));
    }, timeoutMs);
    loader(arg).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
```
This is the established "guard commit points after an await" shape — the generation guard applies the same discipline (check-before-mutate) but keyed on a monotonic counter instead of a timer.

**Every DOM/state mutation point that needs an `isStale()` re-check** (exact line anchors in current code):
- After `await loadTemplate(...)` (line 306) and before `container.innerHTML = ...` (lines 321, 330)
- After `await sanitizeTemplate(...)` (line 321)
- After each `await loadScript(dep)` in the dependencies loop (line 338)
- After `await loadScript(manifest.entry)` (line 353) and before `currentDappId = manifest.id` (line 364)

**Error handling pattern to preserve** (lines 282-287, 295-299, 308-312, etc.) — every catch already follows:
```typescript
events.emit('dx:error', {
  source: `lifecycle:${manifest.id}:<phase>`,
  error: err instanceof Error ? err : new Error(String(err)),
});
return; // or continue, per branch
```
New staleness-abandonment paths should mirror this shape but MUST NOT emit `dx:error` for a merely-superseded (not failed) mount — per RESEARCH.md's code example, a stale mount's own failure "is not worth reporting."

**New hook needed** (per RESEARCH.md recommendation, Claude's discretion on exact shape): an `invalidatePendingMount(id: string)`-style export added to the `LifecycleManager` interface (line 3-12), called from `shell.disableDapp()`/`rebuildRouter()` to close the D-03 scenario-1 gap (disable racing an in-flight, not-yet-committed mount).

---

### `src/shell.ts` — pendingMountId generalization, tier validation, route policy, WR-01 (service, request-response/CRUD)

**Analog:** same file — existing `pendingMountId` same-dapp dedupe guard (lines 56-58, 296-299) and `isValidManifest`/`dx:error` emit template (lines 160-185).

**Existing dedupe-guard pattern to generalize/extend** (lines 56-58, 296-299):
```typescript
// Set synchronously before mountDapp's first await so concurrent calls for the
// same dapp (e.g. a duplicate route notification) can't both pass the mount guard.
let pendingMountId: string | null = null;
// ...
// A mount for this same dapp is already in flight — drop the duplicate. ...
if (pendingMountId === manifest.id) return;
```
The disable-mid-flight fix (D-03 scenario 1) needs `disableDapp()` (lines 126-134) to call the new lifecycle invalidation hook when the dapp being disabled matches an in-flight (not-yet-`currentDappId`) mount — `rebuildRouter()` (lines 94-114) only currently checks `lifecycle.getCurrentDapp()`, which is `null` for in-flight mounts.

**Existing `dx:error` emit template to mirror for WR-01 / route-reject / duplicate-route** (lines 177-185):
```typescript
events.emit('dx:error', {
  source: 'shell:manifest',
  error: new Error(
    `Invalid manifest from ${entry.manifest} — missing required fields (id, route, entry, nav.label)`,
  ),
});
return null;
```

**WR-01 fix site — current silent-swallow to replace** (lines 172-193):
```typescript
async function loadDappManifest(entry: DappEntry): Promise<DappManifest | null> {
  try {
    const res = await fetch(entry.manifest);
    if (!res.ok) return null;                 // <-- also silent today (Open Question 3: recommend covering this too)
    const base = await res.json();
    if (!isValidManifest(base)) {
      events.emit('dx:error', { source: 'shell:manifest', error: new Error(/* ... */) });
      return null;
    }
    if (entry.overrides) return deepMerge(base, entry.overrides);
    return base;
  } catch {
    return null;                                // <-- WR-01 target: emit dx:error here
  }
}
```
Follow the `{ cause: err }` convention already used elsewhere in the codebase (cited in RESEARCH.md at `plugins/settings/src/index.ts:60-64,83-87`) when wrapping the caught error.

**D-07 tier-parity fix site** (lines 195-216, `loadManifests()`) — currently only the `dappEntries` branch runs `isValidManifest` (via `loadDappManifest`); the `inlineManifests` (line 202-204) and `registry.json` (lines 206-213) branches return unvalidated. Recommendation from RESEARCH.md: validate once in `init()` right after `manifests = await loadManifests()` (line 228), not per-tier.

**D-06 route normalization** — reuse `normalizePath`'s exact algorithm (`src/router.ts:27-39`, leading-slash/trailing-slash subset only, no basePath stripping) as a new shell-owned step between `loadManifests()` (line 228) and `createRouter()` (line 250/103). Empty/whitespace-only route → reject with `dx:error` (new source, e.g. `shell:route` per RESEARCH.md Open Question 1 recommendation).

**D-08 duplicate-route detection** — no `router.ts` change needed (stable-sort already guarantees first-registered-wins, per RESEARCH.md ECMA-262 citation). New shell-side step: `Map<route, id>` first-seen tracker over the normalized+validated manifest list, emitting `dx:error` naming both ids on collision, analogous to the existing manifest-validation emit template above.

**mountDapp/handleRouteChange — sub-path stale-path bug (D-03 scenario 3, Pitfall 5)** (lines 271-317): `const path = router.getCurrentPath()` is captured once at line 284; the dedupe branch at line 299 is a bare `return` with no path-freshness handling. Fix site is here; the existing `dx:route:subpath` emit pattern (lines 288-293) is the closest analog for what a "catch-up" event (if that's the chosen fix shape) should look like:
```typescript
if (lifecycle.getCurrentDapp() === manifest.id) {
  if (currentPath !== null && currentPath !== path) {
    const previousPath = currentPath;
    currentPath = path;
    events.emit('dx:route:subpath', { id: manifest.id, path, previousPath });
  }
  return;
}
```

---

### `src/router.ts` — normalizePath (service, transform) — read-only reference, not modified

**Analog:** itself. The exact algorithm D-06 needs, already implemented and battle-tested (lines 27-39):
```typescript
function normalizePath(path: string): string {
  let normalized = path;
  if (basePath !== '/' && normalized.startsWith(basePath)) {
    normalized = normalized.slice(basePath.length) || '/';
  }
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
```
Per RESEARCH.md's recommended shape 2 (shell-owned), this logic is **duplicated in shell.ts** (the basePath-stripping part omitted, since manifest routes are declared without basePath) rather than exported from `router.ts` — keeps `router.ts` free of an `EventBus` dependency it doesn't have today.

---

### `src/utils.ts` — deepMerge (utility, transform) — no code change, test-gap-fill only

**Analog:** itself; already implements every D-09 semantic (whole file, lines 1-22): recursive nested-object merge, wholesale array replace, null/undefined skip, `__proto__`/`constructor`/`prototype` pollution guard. `tests/utils.test.ts` (89 lines) already covers most cases per RESEARCH.md — this phase should verify gaps, not duplicate coverage.

---

### `tests/stress.test.ts` (new) — test, event-driven/integration

**Analog:** `tests/shell.test.ts` `describe('mount de-duplication (double-mount regression)')` (lines 526-653) — this is the direct structural ancestor.

**Fixture setup pattern to copy** (lines 1-11, `testLoaders` + imports):
```typescript
import type { DappManifest, Plugin, ScriptLoader, Shell, ShellConfig } from '@dnzn/dxkit';
import { createShell } from '@dnzn/dxkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testLoaders: Pick<ShellConfig, 'lifecycle'> = {
  lifecycle: { scriptLoader: async () => {}, styleLoader: async () => {} },
};
```

**beforeEach/afterEach DOM setup to copy verbatim** (lines 13-28):
```typescript
describe('createShell', () => {
  let shell: Shell;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'dx-mount';
    document.body.appendChild(container);
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    if (shell) shell.destroy();
    container.remove();
    delete window.__DXKIT__;
  });
```

**`tick()` helper** (line 527):
```typescript
const tick = () => new Promise((r) => setTimeout(r, 0));
```

**`countMounts` event-counting fixture to extend for `countUnmounts`** (lines 546-553):
```typescript
function countMounts(id: string): { count: () => number; cleanup: () => void } {
  let n = 0;
  const handler = (e: Event) => {
    if ((e as CustomEvent).detail.id === id) n += 1;
  };
  window.addEventListener('dx:mount', handler);
  return { count: () => n, cleanup: () => window.removeEventListener('dx:mount', handler) };
}
```

**Deferred-loader fixture — direct ancestor of D-12's `deferred()`/`controllableScriptLoader()`** (lines 556-572):
```typescript
function deferredEntryLoader(): { loader: ScriptLoader; release: () => void } {
  let release!: () => void;
  let started = false;
  const first = new Promise<void>((res) => { release = res; });
  const loader: ScriptLoader = (_src: string) => {
    if (!started) { started = true; return first; }
    return Promise.resolve();
  };
  return { loader, release };
}
```
Generalize this into the keyed-by-src `controllableScriptLoader()` shape from RESEARCH.md's Code Examples section (allows independent release of A's and B's scripts, required for the full D-03 race matrix). Use `mode: 'history'` (not `hash`) per Pitfall 3 — history-mode `navigate()` calls `notifyListeners()` synchronously, making interleaving fully deterministic.

**Existing race-adjacent test to use as the direct template** (lines 606-625):
```typescript
it('drops a duplicate notification while a mount of the same dapp is in flight', async () => {
  const { loader, release } = deferredEntryLoader();
  shell = createShell({
    lifecycle: { scriptLoader: loader, styleLoader: async () => {} },
    mode: 'history',
    manifests: [dappB],
  });
  await shell.init();

  const mounts = countMounts('b');
  shell.navigate('/b');
  shell.navigate('/b');
  release();
  await tick();

  expect(mounts.count()).toBe(1);
  mounts.cleanup();
});
```

**Fake-timer pattern for the timeout-racing-navigation scenario** — copy from `tests/lifecycle.test.ts`'s load-timeout describe block: `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync(ms)` + `await mountPromise` (resolve/reject the deferred fixture BEFORE advancing timers, then await the production promise directly — see RESEARCH.md Pitfall 2).

---

### `tests/shell.test.ts` (extended) — WR-01, D-06/D-07/D-08 cases

**Analog:** existing manifest-loading tests in the same file (lines 262-321).

**WR-01 target test that needs its assertion changed, not just supplemented** (lines 310-321):
```typescript
it('skips dapps with failed manifest fetch', async () => {
  const originalFetch = window.fetch;
  window.fetch = vi.fn(async () => ({ ok: false }) as Response) as any;
  shell = createShell({ ...testLoaders, dapps: [{ manifest: 'missing/manifest.json' }] });
  await shell.init();
  expect(shell.getManifests()).toHaveLength(0);   // <-- currently silent; must ALSO assert a dx:error was emitted once WR-01 lands
  window.fetch = originalFetch;
});
```

**Existing `dx:error` fetch/mock pattern to copy for HTTP/parse-failure cases** (lines 282-288):
```typescript
const originalFetch = window.fetch;
window.fetch = vi.fn(async (url: string) => {
  if (url === 'test/manifest.json') return { ok: true, json: async () => manifest } as Response;
  return { ok: false } as Response;
}) as any;
```

**Existing `dx:error` assertion pattern to copy** (lines 323-334, the `#dx-mount` absent test) — listen on `window` for `dx:error`, assert `source` and `error.message` content.

---

### `tests/router.test.ts` (extended) — route normalization, exact-duplicate

**Analog:** existing "uses longest prefix match" tests in the same file — extend with normalization (`"blog"` → `"/blog"`) and exact-duplicate-route cases using the same manifest-factory conventions already in that file.

---

### TEST-03 integration regression (service, event-driven)

**Analog:** `plugins/settings/tests/settings.test.ts` mockContext-based tests (~lines 530-639) contrasted with `tests/shell.test.ts`'s real-`createShell` conventions (this file, throughout).

**Contract to drive end-to-end** (per `plugins/settings/src/index.ts` cleanup wiring, already shipped in Phase 2/ROB-04) — subscribe via `settingsPlugin.getSettingsAPI().onChange(...)`, call the **real** `shell.disableDapp(id)` (not a mocked context emit), then assert the handler does not fire:
```typescript
it('settings handlers registered by a dapp stop firing after that dapp is disabled via shell.disableDapp()', async () => {
  const settingsPlugin = createSettings();
  shell = createShell({ ...testLoaders, plugins: { settings: settingsPlugin }, manifests: [optionalDapp] });
  await shell.init();

  const api = settingsPlugin.getSettingsAPI();
  const handler = vi.fn();
  api.onChange('hello', 'someKey', handler);

  shell.disableDapp('hello'); // drives the real dx:dapp:disabled emit through shell's real path

  api.set('hello', 'someKey', 'newValue');
  expect(handler).not.toHaveBeenCalled();
});
```
Place in `tests/shell.test.ts` (new describe block) per D-11's "fixtures inline, not shared files" convention, unless the plan opts for a new `plugins/settings/tests/integration.test.ts` file — either is consistent with existing structure; no strong existing precedent for a cross-package integration test file yet.

## Shared Patterns

### `dx:error` emission
**Source:** `src/shell.ts:177-185` (manifest validation) and `src/lifecycle.ts:282-287,295-299,308-312,322-327,339-344,354-359` (per-phase mount errors)
**Apply to:** All new emit sites (WR-01, route-reject, duplicate-route) in `src/shell.ts`; all staleness-abandonment paths in `src/lifecycle.ts` must NOT emit (mirror the "stale mount's own failure is not worth reporting" rule from RESEARCH.md).
```typescript
events.emit('dx:error', {
  source: '<colon-hierarchical-source>',
  error: err instanceof Error ? err : new Error(String(err)),
});
```

### Deferred-promise test fixtures
**Source:** `tests/shell.test.ts:556-572` (`deferredEntryLoader`)
**Apply to:** `tests/stress.test.ts` — generalize into a keyed `controllableScriptLoader()` per RESEARCH.md Code Examples, rather than reinventing.

### Fake timers for timeout-racing scenarios
**Source:** `tests/lifecycle.test.ts` (load-timeout describe block, uses `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()`)
**Apply to:** The one D-03 stress scenario involving the 30s timeout guard (`src/lifecycle.ts`'s `withTimeout`).

### Closure-scoped state, no module-level singletons
**Source:** `src/lifecycle.ts:253` (`currentDappId`), `src/lifecycle.ts:98-99` (`loaded` Set inside `defaultScriptLoader`), `src/shell.ts:56-58` (`pendingMountId`)
**Apply to:** The new `mountGeneration` counter in `createLifecycleManager()` and any new invalidation-tracking state — must live inside the factory closure.

## No Analog Found

None — every file/behavior in this phase either extends an existing file in place or is a new test file (`tests/stress.test.ts`) with a direct structural ancestor already in the codebase (`mount de-duplication` describe block).

## Metadata

**Analog search scope:** `src/`, `tests/`, `plugins/settings/src/`, `plugins/settings/tests/` (all read directly; no Glob/Grep search needed since RESEARCH.md and CONTEXT.md already cite exact file:line locations for every behavior in scope).
**Files scanned:** `src/lifecycle.ts`, `src/shell.ts`, `src/router.ts`, `src/utils.ts`, `tests/shell.test.ts`, `tests/router.test.ts` (partial), `plugins/settings/src/index.ts` (referenced via RESEARCH.md), `plugins/settings/tests/settings.test.ts` (referenced via RESEARCH.md).
**Pattern extraction date:** 2026-07-13

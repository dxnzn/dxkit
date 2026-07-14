---
phase: 04-testing-stress-edge-case-regression-coverage
reviewed: 2026-07-14T03:06:14Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - plugins/settings/tests/integration.test.ts
  - src/lifecycle.ts
  - src/shell.ts
  - src/utils.ts
  - tests/lifecycle.test.ts
  - tests/router.test.ts
  - tests/shell.test.ts
  - tests/stress.test.ts
  - tests/utils.test.ts
findings:
  critical: 0
  warning: 10
  info: 6
  total: 16
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-14T03:06:14Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Re-review after gap-closure plan 04-06 (call-scoped `pendingMountToken` + `releasePendingMount()`).

**Prior CR-01 (invalidated-but-parked `pendingMountId` dropping a re-navigation): RESOLVED.** The dedupe slot is now call-scoped. I verified the mechanism by exhaustive interleaving trace and by invariant induction: token bumps occur at exactly two sites — `mountDapp` (`src/shell.ts:420-421`, which simultaneously takes slot ownership) and `releasePendingMount` (`src/shell.ts:388-391`, which simultaneously clears the slot) — and both are synchronous pairs that no await boundary can split. Slot clears occur only in `releasePendingMount` or in the token-guarded `finally` (`src/shell.ts:437-439`). Therefore, after any bump, `pendingMountId` is either null or owned by the newest call; a stale call can never clobber a newer attempt's slot, and no id can stay parked after invalidation. Every path that makes the newest in-flight mount stale (a superseding `mountDapp`, `disableDapp`'s `invalidatePendingMount`, or the null-route branch's `invalidateAnyPendingMount`) either transfers the slot to the new owner or frees it via `releasePendingMount` — both invalidation sites now call it (`src/shell.ts:142`, `src/shell.ts:376`). I also traced the divergence candidates (slot ≠ `inFlightMountId`; `disableDapp` firing from a `dx:error` listener inside the missing-plugin early-return window; nested re-entrancy via `rebuildRouter()` → `navigate('/')`; repeated A→unmatched→A cycles with multiple suspended same-id calls) and found no hole. **Prior WR-01 (A→B→A `finally` clobber) is resolved by the same token**, and **prior WR-11's two missing regression tests now exist and pass** (`tests/stress.test.ts:362-402`, `tests/stress.test.ts:404-441`; suite: 149/149 green).

**The CR-01 class is closed. However, one adjacent stale-continuation hole remains** in the very block 04-05 added: `currentPath = freshPath` (`src/shell.ts:432`) executes unconditionally in *stale* calls' continuations too, and inside a hashchange/popstate dispatch window a stale settle can pre-write the new path and silently swallow the subsequent `dx:route:subpath` (WR-01 below). It corrupts sub-path bookkeeping only — not the mount/DOM invariants — so it is a Warning, not a reopened Critical.

**Carry-forwards:** plan 04-06 scoped only the dedupe-liveness hole. All other prior warnings and info items were re-verified against the current code and remain open (WR-02 through WR-10, IN-01 through IN-06 below, prior IDs cross-referenced). `src/utils.ts` (`deepMerge`) remains sound; `tests/router.test.ts`, `tests/utils.test.ts`, and `plugins/settings/tests/integration.test.ts` are solid.

## Warnings

### WR-01: `currentPath = freshPath` runs in stale mounts' continuations — a stale settle inside an async-notify window silently swallows a `dx:route:subpath`

**File:** `src/shell.ts:427-432`
**Issue:** The fresh-path commit block after `await lifecycle.mount(...)` guards the `dx:route:subpath` *emit* on `lifecycle.getCurrentDapp() === manifest.id`, but the `currentPath = freshPath` assignment on line 432 is outside that guard — it executes even when the call stale-returned without committing. `currentPath` is the sole dedupe input for the already-mounted sub-path branch (`src/shell.ts:397-403`), so a stale write can suppress a legitimate notification.

Trace (hash mode; the history-mode back/forward `popstate` window is identical):
1. A is committed at `#/a`; `currentPath = '/a'`. A stale B mount (from an earlier rapid A→B→A) is still suspended at its loader (window lasts up to the 30s default timeout).
2. User navigates to `#/a/sub`: the hash updates synchronously, but `hashchange` dispatches asynchronously.
3. Inside that window, stale B settles: its continuation reads `freshPath = '/a/sub'`, skips the emit (`getCurrentDapp() === 'a' !== 'b'`), but still executes `currentPath = '/a/sub'`.
4. `hashchange` fires → `mountDapp(a)` → already-mounted branch: `currentPath === path` → **no `dx:route:subpath`**.

Dapp A's sub-router never learns the URL moved to `/a/sub` — a silent navigation loss in the same D-01 family the phase set out to close, though confined to the sub-path channel (DOM, `dx:mount`, and `currentDappId` invariants all hold). The deliberately history-only, programmatic-navigate stress suite (its "Pitfall 3" note, `tests/stress.test.ts:12-14`) cannot reach this: `shell.navigate()` in history mode notifies synchronously, so the dispatch window never opens.
**Fix:** Move the assignment inside the ownership guard so only a call whose dapp is actually current updates the bookkeeping:
```typescript
const freshPath = router.getCurrentPath();
if (lifecycle.getCurrentDapp() === manifest.id) {
  if (freshPath !== path) {
    events.emit('dx:route:subpath', { id: manifest.id, path: freshPath, previousPath: path });
  }
  currentPath = freshPath;
}
```
Add a regression test: mount A, hold a stale B loader, `history.replaceState` to `/a/sub`, release B, then fire the route notification and assert `dx:route:subpath` still emits.

### WR-02: Unmatched-route abandonment after template injection leaves stale dapp HTML in the container (prior WR-02, unaddressed)

**File:** `src/shell.ts:364-378`, `src/lifecycle.ts:392,411` (uncleaning stale-return gates)
**Issue:** All regression tests for the null-route branch hold the *template* gate (`tests/stress.test.ts:207-242`, `362-402`) or use no template (`244-286`), so abandonment always happens pre-injection and `container.innerHTML === ''` passes trivially. Hold the *entry-script* gate instead: `navigate('/a')` → template injected (generation still current) → `navigate('/nowhere')` → generation bumped → release entry → the stale mount returns at the `src/lifecycle.ts:411` gate **without clearing the container**. `<div data-dapp="a">` stays visible under `/nowhere` indefinitely: nothing committed, so no `dx:unmount` ever fires, the dapp never received `dx:mount` so it won't tear down, and no successor mount overwrites the container. Stale-return gates intentionally leave the container alone because a newer dapp usually owns it — but when the successor is "no dapp", nobody cleans up.
**Fix:** In `handleRouteChange`'s null branch, after invalidating/releasing/unmounting, clear the container — at that synchronous moment any in-flight mount is stale and its pre-write gates guarantee it can never inject afterward:
```typescript
lifecycle.invalidateAnyPendingMount();
releasePendingMount();
lifecycle.unmount();
const c = getMountContainer();
if (c) c.innerHTML = '';
```
Add the post-injection (entry-gate) variant of the unmatched-route stress test — the one regression the otherwise-thorough 04-06 tests still lack.

### WR-03: `normalizeRoute` never trims whitespace — routes with stray spaces become silently unreachable (prior WR-03, unaddressed)

**File:** `src/shell.ts:252-260`
**Issue:** The function rejects whitespace-*only* routes via `route.trim() === ''` but then normalizes the **untrimmed** value. `route: '/blog '` is stored verbatim (trailing space) and no normalized browser path can ever match it; `route: ' blog'` becomes `'/ blog'`, equally unreachable. No `dx:error` fires — exactly the "silently unreachable dapp" failure mode D-06 set out to eliminate.
**Fix:**
```typescript
function normalizeRoute(route: string): string | null {
  const trimmed = route.trim();
  if (trimmed === '') return null;
  let normalized = trimmed;
  // ...
}
```

### WR-04: Missing staleness gate after the styles await — a superseded mount still initiates (and executes) the next load stage (prior WR-04, unaddressed)

**File:** `src/lifecycle.ts:316-329`, `src/lifecycle.ts:377-398`
**Issue:** On style-load *success* there is no `isStale()` check (the catch has one, but only to suppress the error emit). A mount superseded during its styles await proceeds to initiate the next stage: a template fetch (wasted network, mostly benign) — or, for a manifest with no template, the first dependency/entry `loadScript()`, which with the default loader injects and **executes** a `<script type="module">` for a mount that has already lost, running module top-level side effects for a dapp the user navigated away from and polluting the loader's `loaded` cache. Every other await is gated (template `:349`, sanitize `:368`, dep loop `:392`, entry `:411`); the styles success path is the one hole.
**Fix:** Add after the styles block:
```typescript
if (isStale()) return; // superseded during the styles await — don't initiate further loads
```

### WR-05: registry.json tier — non-array JSON crashes `init()`; fetch/parse failures are silent (prior WR-05, unaddressed)

**File:** `src/shell.ts:237-246`, `src/shell.ts:321`, `src/shell.ts:268`
**Issue:** (1) `return await res.json()` flows unchecked into `normalizeAndValidateManifests`, whose `for (const m of list)` throws `TypeError: list is not iterable` when registry.json holds a JSON object (`{}` — an easy authoring mistake). The throw escapes `init()` and crashes shell startup with a message naming neither the registry URL nor the cause — the opposite of the plugin-failure containment a few lines below, and contrary to the documented "invalid manifest → dx:error, shell continues" contract. (2) The bare `catch { /* No registry.json — that's fine */ }` swallows network failures **and** malformed-JSON parse failures silently, while the identical failure in the dapp-entries tier now emits `dx:error` — breaking the tier-uniform validation claim (D-07).
**Fix:**
```typescript
const parsed = await res.json();
if (!Array.isArray(parsed)) {
  events.emit('dx:error', {
    source: 'shell:manifest',
    error: new Error(`Registry ${registryUrl} did not return a JSON array of manifests`),
  });
  return [];
}
return parsed;
```
Emit `dx:error` for parse failures too; keep only a true 404/network miss as the acceptable silent case if desired.

### WR-06: Hash mode can emit a misattributed `dx:route:subpath` naming another dapp's route (prior WR-06, unaddressed)

**File:** `src/shell.ts:428-431`
**Issue:** The fresh-path commit trusts `router.getCurrentPath()` raw. In hash mode, `navigate('/b')` updates `location.hash` synchronously but the `hashchange` (and therefore B's mount / generation supersession) fires **asynchronously**. If A's in-flight mount commits inside that window, its continuation reads `freshPath = '/b'` with `getCurrentDapp() === 'a'` still true and emits `dx:route:subpath { id: 'a', path: '/b', previousPath: '/a' }` — telling dapp A's sub-router it owns dapp B's route. History mode is immune (synchronous notify), which is exactly why the deliberately history-only stress suite cannot catch this.
**Fix:** Gate the emit on the fresh path still resolving to this manifest (composes with WR-01's fix):
```typescript
if (freshPath !== path && router.resolve(freshPath)?.id === manifest.id) {
```

### WR-07: Disabling a dapp mid-mount strands the URL on the disabled dapp's dead route (prior WR-07, unaddressed)

**File:** `src/shell.ts:110-116`, `src/shell.ts:129-146`
**Issue:** Disabling a **committed** dapp unmounts it and navigates to `/`. Disabling an **in-flight** dapp invalidates the mount and (since 04-06) frees the dedupe slot, but `rebuildRouter()`'s recovery branch still keys on `lifecycle.getCurrentDapp()` — null for an uncommitted mount — so no `navigate('/')` happens. The app is left parked on a route (e.g. `/opt`) that no longer resolves: blank container, dead URL, no `dx:route:changed` to inform the host UI. Notably, 04-06 built exactly the detection needed (`pendingMountId === id` at `src/shell.ts:142`) and uses it only to free the slot. The D-03 scenario-1 stress test (`tests/stress.test.ts:178-205`) asserts no mount happened but never asserts where the user ends up; the dedupe-liveness twin (`:404-441`) immediately re-enables, sidestepping the stranding.
**Fix:** In `disableDapp`, when `pendingMountId === id` (an in-flight mount was abandoned), apply the committed-case recovery after `rebuildRouter()`: `router.navigate('/')`.

### WR-08: `shell.destroy()` does not abandon an in-flight mount — a dapp can ghost-commit after destroy, and the parked dedupe slot can drop a destroy→init remount (prior WR-08, extended)

**File:** `src/shell.ts:466-488`, `src/lifecycle.ts:434-436`
**Issue:** `destroy()` tears down the router and calls `lifecycle.destroy()` — but `lifecycle.destroy()` only unmounts a **committed** dapp (`if (currentDappId) unmount()`); it never bumps `mountGeneration`. A mount suspended in a loader when `destroy()` runs stays generation-current: when its loader settles, every `isStale()` gate passes and it commits — `currentDappId` set, template injected, `dx:mount`/`dx:dapp:mounted` fired — after the shell and its plugins are gone and `window.__DXKIT__` has been deleted. **New with the 04-06 token:** `destroy()` also leaves `pendingMountId`/`pendingMountToken` untouched, so on a destroy→`init()` cycle of the same shell instance, the initial route's `mountDapp` hits the still-parked slot (`src/shell.ts:409`) and is dropped — the reincarnation of the CR-01 symptom through the one invalidation-shaped path that doesn't call `releasePendingMount()`. `currentPath` similarly survives destroy and can suppress the first post-reinit sub-path event.
**Fix:** Bump the generation in `lifecycle.destroy()` and release the shell slot in `shell.destroy()`:
```typescript
// lifecycle.ts
function destroy(): void {
  mountGeneration++; // abandon any in-flight mount — nothing may commit after destroy
  inFlightMountId = null;
  if (currentDappId) unmount();
}
// shell.ts destroy():
releasePendingMount();
currentPath = null;
```

### WR-09: Overlapping navigations emit `dx:route:changed` with a stale manifest paired with the newer path (prior WR-09, unaddressed)

**File:** `src/shell.ts:364-383`
**Issue:** `handleRouteChange` awaits `mountDapp(manifest)` and only then emits `dx:route:changed`, reading `router.getCurrentPath()` at emit time. The router fires listeners without awaiting them, so overlapping navigations overlap here too. When a superseded call's `mountDapp` stale-settles, its handler resumes and emits `dx:route:changed { path: '/b', manifest: dappA }` — a self-inconsistent payload asserting the losing dapp owns the winning path, emitted **after** the winner's event. The unmatched-route variant is identical: A → `/nowhere` emits `{ path: '/nowhere', manifest: undefined }` immediately, then A's stale handler later emits `{ path: '/nowhere', manifest: A }`. Any consumer deriving "active dapp" from the latest `dx:route:changed` (nav highlighting, breadcrumbs, plugins) ends in the wrong state — a last-navigation-wins violation in the public event stream even though the DOM/`dx:mount` invariants hold. No stress test asserts on `dx:route:changed` ordering.
**Fix:** Guard the emit with a navigation epoch:
```typescript
let routeEpoch = 0;

async function handleRouteChange(manifest: DappManifest | null): Promise<void> {
  const epoch = ++routeEpoch;
  // ... existing mount/invalidate logic ...
  if (epoch !== routeEpoch) return; // a newer navigation already reported
  events.emit('dx:route:changed', { path: router.getCurrentPath(), manifest: manifest ?? undefined });
}
```

### WR-10: `getMountContainer()` caches the element forever — a re-rendered `#dx-mount` leaves all future mounts writing into a detached node, silently (prior WR-10, unaddressed)

**File:** `src/shell.ts:444-448`
**Issue:** `mountContainer` is cached on first lookup and never revalidated until `destroy()`. If the host layout removes/replaces `#dx-mount` (any host-side re-render), every subsequent mount injects templates into the **detached** old element and hands it to dapps via `dx:mount`. Nothing appears on screen and no error is emitted — a fully silent failure, contradicting the milestone's "failures are visible (never silent)" core value.
**Fix:**
```typescript
function getMountContainer(): HTMLElement | null {
  if (mountContainer?.isConnected) return mountContainer;
  mountContainer = document.getElementById('dx-mount');
  return mountContainer;
}
```

## Info

### IN-01: Inconsistent error wrapping in the sanitize catch (prior IN-01, unaddressed)

**File:** `src/lifecycle.ts:362`
**Issue:** `new Error(String(err), { cause: err })` is the only catch in the file attaching `cause`, and only on the non-`Error` branch where `String(err)` already carries the content. Sibling catches (styles, template, dependency, entry) drop the cause. Pick one convention — attaching `cause` everywhere matches `src/shell.ts:219`.

### IN-02: `inFlightMountId` left dangling after a stale/invalidated mount returns (prior IN-02, unaddressed)

**File:** `src/lifecycle.ts:348,368,392,411`, `src/lifecycle.ts:446-462`
**Issue:** Stale-return paths skip `inFlightMountId = null` (correct — a newer mount may own it), but when the newest mount is itself abandoned via an invalidator, its stale return leaves `inFlightMountId` stuck at the dead id until the next `mount()`. `invalidateAnyPendingMount()` treats non-null `inFlightMountId` as "something is in flight" and bumps `mountGeneration` — a spurious bump when nothing is actually pending. Verified still harmless (any live mount rewrites `inFlightMountId` and re-captures the generation at entry, so spurious bumps only occur with no mount in flight), but the field is documented as the invalidator's ground truth while being allowed to lie.
**Fix:** Clear `inFlightMountId = null` inside both invalidators when they bump the generation; consider returning a boolean so the shell can tell whether anything was invalidated (feeds WR-07's fix).

### IN-03: `isValidManifest` accepts empty-string `id` and `entry` (prior IN-03, unaddressed)

**File:** `src/shell.ts:173-182`
**Issue:** `typeof m.entry === 'string'` passes for `entry: ''` (and `id: ''`), deferring failure to a confusing mount-time load error (`Failed to load dapp script: `). Route emptiness got dedicated handling this phase; `id`/`entry` did not. Tighten to `m.id.length > 0 && m.entry.length > 0` at the validation choke point.

### IN-04: Test hygiene — mismatched `removeEventListener`, leaked listeners, fetch mocks restored outside `finally`, duplicated helpers (prior IN-04, unaddressed)

**File:** `tests/shell.test.ts:60-64,254-269,652-673`, `tests/stress.test.ts:16,44-51,89-104,316`
**Issue:** (1) `window.addEventListener('dx:plugin:registered', (e) => handler(...))` followed by `removeEventListener(..., handler)` removes nothing — the registered listener is the anonymous wrapper; same pattern at `tests/shell.test.ts:653-673` (`dx:route:subpath`). (2) ~12 tests register anonymous `dx:error` listeners never removed (`tests/shell.test.ts:119,312,333,353,390,405,455,481,498,521,617`; `tests/stress.test.ts:316`); the shared per-file `window` makes phantom listeners a flake source for any future count-based assertion. (3) `window.fetch = vi.fn(...)` restores (`tests/shell.test.ts:269,307,328,348,371,423,516`) are not in `try/finally` — one failing assertion mid-test leaves fetch mocked for every subsequent test in the file. (4) `countMounts`, `tick`, and the `dappA`/`dappB` fixtures are duplicated between `tests/stress.test.ts` and `tests/shell.test.ts:718-744`. Use `vi.stubGlobal('fetch', ...)` + `vi.unstubAllGlobals()` in `afterEach`, capture exact listener references, move cleanup into `afterEach`, and extract shared helpers to `tests/helpers.ts`.

### IN-05: 'disabled dapps are excluded from routing' test asserts nothing about mounting (prior IN-05, unaddressed)

**File:** `tests/shell.test.ts:1023-1032`
**Issue:** The test navigates to a disabled dapp's route and asserts only `getCurrentRoute() === '/api'` — which would also pass if the dapp *did* mount. The comment ("nothing mounts") is unverified. Add a `dx:dapp:mounted` spy and assert it was not called.

### IN-06: `init()` is not re-entrancy-safe — two concurrent calls both pass the `initialized` guard (prior IN-06, unaddressed)

**File:** `src/shell.ts:311-312`, `src/shell.ts:353`
**Issue:** `initialized` is set only after several awaits (manifest load, plugin inits), so two overlapping `init()` calls both pass the guard: plugins register and `init()` twice, `dx:plugin:registered` duplicates, and interleaved `router.destroy()`/`createRouter` pairs can leak a router with a live `popstate` listener. The "double init() is a no-op" test covers only sequential calls. Guard with a memoized promise: `if (initPromise) return initPromise; initPromise = doInit(); return initPromise;`.

---

_Reviewed: 2026-07-14T03:06:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

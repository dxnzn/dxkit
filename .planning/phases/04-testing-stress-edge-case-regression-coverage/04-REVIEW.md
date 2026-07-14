---
phase: 04-testing-stress-edge-case-regression-coverage
reviewed: 2026-07-14T01:59:26Z
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
  critical: 1
  warning: 11
  info: 6
  total: 18
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-14T01:59:26Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Re-review after gap-closure plan 04-05 (guarded `finally` in `mountDapp` + `invalidateAnyPendingMount()`).

**Prior CR-01 (reopened pendingMountId-clobber → B commits under `/nowhere`): RESOLVED.** The null-route branch now invalidates via lifecycle-owned `inFlightMountId` (`src/shell.ts:367`), which a corrupted shell-side `pendingMountId` cannot defeat, and the A→B→settle-A→`/nowhere`→settle-B interleaving is regression-tested (`tests/stress.test.ts:244-286`). I traced every interleaving I could construct through the lifecycle generation guard and found no path where a superseded `lifecycle.mount()` commits DOM, sets `currentDappId`, or emits `dx:mount`.

**However, the fix is not complete.** The shell's `pendingMountId` dedupe is still id-keyed rather than call-keyed and is never cleared when a pending mount is invalidated. That leaves one new Critical last-navigation-wins violation, provable by line-level trace: **A → unmatched → A silently drops the final navigation** (CR-01 below) — the invalidated mount's id is still parked in `pendingMountId`, so re-navigating to A is dropped by the dedupe and nothing ever mounts. The prior review's WR-07 (disable→enable re-navigation dropped) is the same root cause and folds into it. Additionally, the guarded-`finally` comment's premise ("the same-id early return above already excludes concurrent same-id calls" — a claim inherited verbatim from the prior review's fix suggestion) is **false** for A→B→A interleavings (WR-01), and the stress suite is missing the one regression test (re-navigate to the invalidated dapp) that would have caught CR-01 (WR-11).

**Prior review carry-forwards:** plan 04-05 scoped only the reopened CR-01; none of the prior review's other warnings (WR-01 residue, WR-02 route trim, WR-03 styles gate, WR-04 registry crash, WR-05 hash subpath, WR-06 stranded URL, WR-08 destroy ghost commit, WR-09 route:changed payload, WR-10 container cache) or info items were addressed. All were re-verified against the current code and remain open; they are re-reported below with prior IDs cross-referenced.

`src/utils.ts` (`deepMerge`) remains sound — prototype-pollution guards and non-mutation re-verified; its test suite is thorough. `tests/router.test.ts` and `plugins/settings/tests/integration.test.ts` are solid.

## Critical Issues

### CR-01: Navigating back to an invalidated dapp is silently dropped — last-navigation-wins violation (A → unmatched → A)

**File:** `src/shell.ts:392` (dedupe), `src/shell.ts:358-369` (null branch), `src/shell.ts:403,415-422`
**Issue:** `handleRouteChange`'s null-manifest branch calls `lifecycle.invalidateAnyPendingMount()` but leaves the shell's `pendingMountId` untouched. The invalidated `mountDapp` call is still suspended inside `lifecycle.mount()` — its `finally` has not run — so `pendingMountId` still holds the invalidated dapp's id. A subsequent navigation back to that dapp is dropped by the dedupe at line 392, and the invalidated mount later stale-returns without committing. Nothing ever mounts, no error fires, yet `dx:route:changed` (line 370) reports the manifest as routed.

Trace (history mode, synchronous notifications):
1. `navigate('/a')` → `mountDapp(a)`: `pendingMountId = 'a'`, `lifecycle.mount(a)` (gen 1) suspends at a loader await.
2. `navigate('/nowhere')` → `handleRouteChange(null)`: `invalidateAnyPendingMount()` bumps the generation. `pendingMountId` is still `'a'`.
3. `navigate('/a')` → `mountDapp(a)`: `pendingMountId === 'a'` → **early return**. No mount starts. The dedupe comment's justification ("the in-flight call sets currentDappId/currentPath when it finishes") is now false — that call has been invalidated and can never commit.
4. Gen-1's loader settles → `isStale()` → returns → `finally` clears `pendingMountId`.

Final state: URL `/a`, empty container, `getCurrentDapp()` null, no `dx:mount`, no `dx:error`. The window lasts as long as the invalidated mount's slowest loader (up to the 30s default timeout). The disable variant (prior review WR-07) is the same hole: `disableDapp(id)` invalidates via `lifecycle.invalidatePendingMount(id)` (`src/shell.ts:136`) without clearing `pendingMountId`, so `enableDapp(id)` + re-navigation inside the window is dropped identically.

**Fix:** Make the dedupe slot call-scoped and clear it on invalidation. A monotonic token also fixes WR-01:
```typescript
let pendingMountId: string | null = null;
let pendingMountToken = 0;

async function mountDapp(manifest: DappManifest): Promise<void> {
  // ... existing same-dapp + pendingMountId checks ...
  pendingMountId = manifest.id;
  const myToken = ++pendingMountToken;
  try {
    await lifecycle.mount(manifest, container, path);
    // ... fresh-path commit ...
  } finally {
    // Only the most recent mount attempt may clear the slot — id equality is not
    // ownership (see WR-01).
    if (pendingMountToken === myToken) pendingMountId = null;
  }
}

// handleRouteChange null branch:
lifecycle.invalidateAnyPendingMount();
pendingMountId = null;
pendingMountToken++; // the invalidated call's finally can no longer clobber
lifecycle.unmount();

// disableDapp, next to lifecycle.invalidatePendingMount(id):
if (pendingMountId === id) {
  pendingMountId = null;
  pendingMountToken++;
}
```
Add the regression tests described in WR-11.

## Warnings

### WR-01: `mountDapp`'s guarded `finally` premise is false under A→B→A — a stale same-id call clears a fresh same-id mount's slot

**File:** `src/shell.ts:415-422`
**Issue:** The guard comment claims concurrent same-id calls are "already excluded" by the line-392 dedupe. They are not: in A→B→A, the third navigation's `mountDapp('a')` passes the dedupe because `pendingMountId` is `'b'` at that instant — two `mountDapp('a')` calls are then concurrently in flight. When the stale first A settles, its `finally` sees `pendingMountId === 'a'` — the **new** A mount's slot — and nulls it while that mount is still in flight. In the window until the fresh A commits, the same-dapp dedupe is disarmed: a duplicate `/a` route notification (the exact double-notification the dedupe exists for, per `src/shell.ts:56-58`) starts a redundant concurrent `lifecycle.mount('a')`, re-running template/script loads and superseding the legitimate one. The lifecycle generation guard keeps `dx:mount` single, and `invalidateAnyPendingMount` is immune (it reads `inFlightMountId`), so the blast radius is redundant loads plus a documented invariant that does not hold — but the `rapid A -> B -> A` stress test (`tests/stress.test.ts:132-176`) walks straight through this clobber window without inspecting it, so it passes silently.
**Fix:** The call-scoped token from CR-01's fix — a stale call's `finally` compares its own token, never a reusable id. Rewrite the comment to describe the token invariant.

### WR-02: Unmatched-route abandonment after template injection leaves stale dapp HTML in the container (prior WR-01, unaddressed)

**File:** `src/shell.ts:358-369`, `src/lifecycle.ts:392,411` (uncleaning stale-return gates)
**Issue:** The new regression tests hold the *template* gate (`tests/stress.test.ts:207-242`) or use no template at all (244-286), so abandonment always happens pre-injection and `container.innerHTML === ''` passes. Hold the *entry-script* gate instead: `navigate('/a')` → template injected (generation still current) → `navigate('/nowhere')` → generation bumped → release entry → the stale mount returns at the line-411 gate **without clearing the container**. `<div data-dapp="a">` stays visible under `/nowhere` indefinitely: no `dx:unmount` will ever fire (nothing committed), the dapp never received `dx:mount` so it won't tear down, and no successor mount overwrites the container. Stale-return gates intentionally don't touch the container because a newer dapp usually owns it — but when the successor is "no dapp", nobody cleans up.
**Fix:** In `handleRouteChange`'s null branch, after invalidating and unmounting, clear the container — at that synchronous moment any in-flight mount is stale and its pre-write gates guarantee it can never inject afterward:
```typescript
lifecycle.invalidateAnyPendingMount();
lifecycle.unmount();
const c = getMountContainer();
if (c) c.innerHTML = '';
```
Extend the unmatched-route regression test with the entry-gate (post-injection) variant.

### WR-03: `normalizeRoute` never trims whitespace — routes with stray spaces become silently unreachable (prior WR-02, unaddressed)

**File:** `src/shell.ts:246-254`
**Issue:** The function rejects whitespace-*only* routes via `route.trim() === ''` but then normalizes the **untrimmed** value. `route: '/blog '` is stored verbatim (trailing space) and no normalized browser path can ever match it; `route: ' blog'` becomes `'/ blog'`, equally unreachable. No `dx:error` fires — the "silently unreachable dapp" failure mode D-06 set out to eliminate.
**Fix:**
```typescript
function normalizeRoute(route: string): string | null {
  const trimmed = route.trim();
  if (trimmed === '') return null;
  let normalized = trimmed;
  // ...
}
```

### WR-04: Missing staleness gate after the styles await — a superseded mount still initiates (and executes) the next load stage (prior WR-03, unaddressed)

**File:** `src/lifecycle.ts:316-332`, `src/lifecycle.ts:397-398`
**Issue:** On style-load *success* there is no `isStale()` check (only the catch has one, and only to suppress the error emit). A mount superseded during its styles await proceeds to initiate the next stage: a template fetch (wasted network, mostly benign) — or, for a manifest with no template, the first dependency/entry `loadScript()`, which with the default loader injects and **executes** a `<script type="module">` for a mount that has already lost, running module top-level side effects for a dapp the user navigated away from and polluting the loader's `loaded` cache. Every other await is gated (template :348, sanitize :368, dep loop :392, entry :411); the styles success path is the one hole.
**Fix:** Add after the styles block:
```typescript
if (isStale()) return; // superseded during the styles await — don't initiate further loads
```

### WR-05: registry.json tier — non-array JSON crashes `init()`; fetch/parse failures are silent (prior WR-04, unaddressed)

**File:** `src/shell.ts:231-240`, `src/shell.ts:315`, `src/shell.ts:262`
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

### WR-06: Hash mode can emit a misattributed `dx:route:subpath` naming another dapp's route (prior WR-05, unaddressed)

**File:** `src/shell.ts:410-413`
**Issue:** The fresh-path commit trusts `router.getCurrentPath()` raw. In hash mode, `navigate('/b')` updates `location.hash` synchronously but the `hashchange` (and therefore B's mount / generation supersession) fires **asynchronously**. If A's in-flight mount commits inside that window, its continuation reads `freshPath = '/b'` with `getCurrentDapp() === 'a'` still true and emits `dx:route:subpath { id: 'a', path: '/b', previousPath: '/a' }` — telling dapp A's sub-router it owns dapp B's route. History mode is immune (synchronous notify), which is exactly why the deliberately history-only stress suite (its "Pitfall 3" note, `tests/stress.test.ts:12-14`) cannot catch this.
**Fix:** Gate the emit on the fresh path still resolving to this manifest:
```typescript
if (freshPath !== path && lifecycle.getCurrentDapp() === manifest.id
    && router.resolve(freshPath)?.id === manifest.id) {
```

### WR-07: Disabling a dapp mid-mount strands the URL on the disabled dapp's dead route (prior WR-06, unaddressed)

**File:** `src/shell.ts:107-113`, `src/shell.ts:126-140`
**Issue:** Disabling a **committed** dapp unmounts it and navigates to `/`. Disabling an **in-flight** dapp invalidates the mount, but `rebuildRouter()`'s recovery branch keys on `lifecycle.getCurrentDapp()` — null for an uncommitted mount — so no `navigate('/')` happens. The app is left parked on a route (e.g. `/opt`) that no longer resolves: blank container, dead URL, no `dx:route:changed` to inform the host UI. The D-03 scenario-1 stress test (`tests/stress.test.ts:178-205`) asserts no mount happened but never asserts where the user ends up.
**Fix:** In `disableDapp`, when the invalidation abandoned an in-flight mount (detectable as `pendingMountId === id` before clearing it per CR-01's fix), apply the committed-case recovery: `router.navigate('/')` after `rebuildRouter()`.

### WR-08: `shell.destroy()` does not abandon an in-flight mount — a dapp can commit and emit `dx:mount` after the shell is destroyed (prior WR-08, unaddressed)

**File:** `src/shell.ts:448-470`, `src/lifecycle.ts:434-436`
**Issue:** `destroy()` tears down the router, unsubscribes, and calls `lifecycle.destroy()` — but `lifecycle.destroy()` only unmounts a **committed** dapp (`if (currentDappId) unmount()`); it never bumps `mountGeneration`. A mount suspended in a loader when `destroy()` runs stays generation-current: when its loader settles, every `isStale()` gate passes and it commits — `currentDappId` set, template injected, `dx:mount`/`dx:dapp:mounted` fired — after the shell and its plugins are gone and `window.__DXKIT__` has been deleted. A dapp entry acting on the ghost `dx:mount` dereferences a missing context.
**Fix:**
```typescript
function destroy(): void {
  mountGeneration++; // abandon any in-flight mount — nothing may commit after destroy
  inFlightMountId = null;
  if (currentDappId) unmount();
}
```

### WR-09: Overlapping navigations emit `dx:route:changed` with a stale manifest paired with the newer path (prior WR-09, unaddressed)

**File:** `src/shell.ts:358-374`
**Issue:** `handleRouteChange` awaits `mountDapp(manifest)` and only then emits `dx:route:changed`, reading `router.getCurrentPath()` at emit time. The router fires listeners without awaiting them, so overlapping navigations overlap here too. When a superseded call's `mountDapp` stale-settles, its handler resumes and emits `dx:route:changed { path: '/b', manifest: dappA }` — a self-inconsistent payload asserting the losing dapp owns the winning path, emitted **after** the winner's event. The unmatched-route variant is identical: A → `/nowhere` emits `{ path: '/nowhere', manifest: undefined }` immediately, then A's stale handler later emits `{ path: '/nowhere', manifest: A }`. Any consumer deriving "active dapp" from the latest `dx:route:changed` (nav highlighting, breadcrumbs, plugins) ends in the wrong state — a last-navigation-wins violation in the public event stream even though the DOM/`dx:mount` invariants hold. No stress test asserts on `dx:route:changed` ordering.
**Fix:** Guard the emit with a navigation epoch:
```typescript
let routeEpoch = 0;

async function handleRouteChange(manifest: DappManifest | null): Promise<void> {
  const epoch = ++routeEpoch;
  if (manifest) {
    await mountDapp(manifest);
  } else {
    lifecycle.invalidateAnyPendingMount();
    lifecycle.unmount();
  }
  if (epoch !== routeEpoch) return; // a newer navigation already reported
  events.emit('dx:route:changed', { path: router.getCurrentPath(), manifest: manifest ?? undefined });
}
```

### WR-10: `getMountContainer()` caches the element forever — a re-rendered `#dx-mount` leaves all future mounts writing into a detached node, silently (prior WR-10, unaddressed)

**File:** `src/shell.ts:426-430`
**Issue:** `mountContainer` is cached on first lookup and never revalidated until `destroy()`. If the host layout removes/replaces `#dx-mount` (any host-side re-render), every subsequent mount injects templates into the **detached** old element and hands it to dapps via `dx:mount`. Nothing appears on screen and no error is emitted — a fully silent failure, contradicting the milestone's "failures are visible (never silent)" core value.
**Fix:**
```typescript
function getMountContainer(): HTMLElement | null {
  if (mountContainer?.isConnected) return mountContainer;
  mountContainer = document.getElementById('dx-mount');
  return mountContainer;
}
```

### WR-11: Stress suite never re-navigates to an invalidated dapp — the regression test that would catch CR-01 is missing

**File:** `tests/stress.test.ts:207-286`
**Issue:** The suite proves an unmatched-route navigation abandons an in-flight mount (no `dx:mount`, empty container) and that the A→B-overlap variant survives a stale settle. But no test performs the natural third step: navigate **back** to the invalidated dapp while its abandoned mount is still suspended, and assert it mounts. That is the primary user-facing consequence of the invalidation design, and it currently fails (CR-01). The suite validates the mechanism it built without probing the state it leaves behind.
**Fix:** Add: hold A's loader → `navigate('/a')` → `navigate('/nowhere')` → `navigate('/a')` → release all gates → assert `dx:mount` for `a` fired exactly once, the container holds A's content, and `getCurrentRoute()` is `/a`. Add the disable→enable→re-navigate twin for `invalidatePendingMount`, and the post-injection variant from WR-02.

## Info

### IN-01: Inconsistent error wrapping in the sanitize catch (prior IN-01, unaddressed)

**File:** `src/lifecycle.ts:362`
**Issue:** `new Error(String(err), { cause: err })` is the only catch in the file attaching `cause`, and only on the non-`Error` branch where `String(err)` already carries the content. Sibling catches (styles, template, dependency, entry) drop the cause. Pick one convention — attaching `cause` everywhere matches `src/shell.ts:212`.

### IN-02: `inFlightMountId` left dangling after a stale/invalidated mount returns (prior IN-02, unaddressed — now feeds `invalidateAnyPendingMount`)

**File:** `src/lifecycle.ts:348,368,392,411`, `src/lifecycle.ts:446-462`
**Issue:** Stale-return paths skip `inFlightMountId = null` (correct — a newer mount may own it), but when the newest mount is itself abandoned via an invalidator, its stale return leaves `inFlightMountId` stuck at the dead id until the next `mount()`. Since 04-05, `invalidateAnyPendingMount()` treats non-null `inFlightMountId` as "something is in flight" and bumps `mountGeneration` — a spurious bump when nothing is actually pending. Harmless today (any live mount rewrites `inFlightMountId` at entry, so spurious bumps only occur with no mount in flight), but the field is now documented as the invalidator's ground truth while being allowed to lie.
**Fix:** Clear `inFlightMountId = null` inside both invalidators when they bump the generation; consider returning a boolean so the shell can tell whether anything was invalidated (feeds WR-07's fix).

### IN-03: `isValidManifest` accepts empty-string `id` and `entry` (prior IN-03, unaddressed)

**File:** `src/shell.ts:167-176`
**Issue:** `typeof m.entry === 'string'` passes for `entry: ''` (and `id: ''`), deferring failure to a confusing mount-time load error (`Failed to load dapp script: `). Route emptiness got dedicated handling this phase; `id`/`entry` did not. Tighten to `m.id.length > 0 && m.entry.length > 0` at the validation choke point.

### IN-04: Test hygiene — mismatched `removeEventListener`, leaked listeners, fetch mocks restored outside `finally`, duplicated helpers (prior IN-04, unaddressed; extended)

**File:** `tests/shell.test.ts:60-64,254-269,652-673`, `tests/stress.test.ts:16,44-51,89-104,316`
**Issue:** (1) `window.addEventListener('dx:plugin:registered', (e) => handler(...))` followed by `removeEventListener(..., handler)` removes nothing — the registered listener is the anonymous wrapper; same pattern at shell.test.ts:652-673 (`dx:route:subpath`). (2) ~10 tests register anonymous `dx:error` listeners never removed (shell.test.ts:119, 312, 333, 353, 390, 404, ...; stress.test.ts:316); the shared per-file `window` makes phantom listeners a flake source for any future count-based assertion. (3) `window.fetch = vi.fn(...)` restores are not in `try/finally` — one failing assertion mid-test leaves fetch mocked for every subsequent test in the file. (4) `countMounts`, `tick`, and the `dappA`/`dappB` fixtures are duplicated between stress.test.ts and shell.test.ts:718-744. Use `vi.stubGlobal('fetch', ...)` + `vi.unstubAllGlobals()` in `afterEach`, capture the exact listener references, move cleanup into `afterEach`, and extract shared helpers to `tests/helpers.ts`.

### IN-05: 'disabled dapps are excluded from routing' test asserts nothing about mounting (prior IN-05, unaddressed)

**File:** `tests/shell.test.ts:1023-1032`
**Issue:** The test navigates to a disabled dapp's route and asserts only `getCurrentRoute() === '/api'` — which would also pass if the dapp *did* mount. The comment ("nothing mounts") is unverified. Add a `dx:dapp:mounted` spy and assert it was not called.

### IN-06: `init()` is not re-entrancy-safe — two concurrent calls both pass the `initialized` guard (prior IN-06, unaddressed)

**File:** `src/shell.ts:305-306`
**Issue:** `initialized` is set only after several awaits (manifest load, plugin inits), so two overlapping `init()` calls both pass the guard: plugins register and `init()` twice, `dx:plugin:registered` duplicates, and interleaved `router.destroy()`/`createRouter` pairs can leak a router with a live `popstate` listener. The "double init() is a no-op" test covers only sequential calls. Guard with a memoized promise: `if (initPromise) return initPromise; initPromise = doInit(); return initPromise;`.

---

_Reviewed: 2026-07-14T01:59:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

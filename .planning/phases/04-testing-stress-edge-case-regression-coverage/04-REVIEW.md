---
phase: 04-testing-stress-edge-case-regression-coverage
reviewed: 2026-07-13T21:44:12Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lifecycle.ts
  - src/shell.ts
  - src/utils.ts
  - tests/lifecycle.test.ts
  - tests/router.test.ts
  - tests/shell.test.ts
  - tests/stress.test.ts
  - tests/utils.test.ts
  - plugins/settings/tests/integration.test.ts
findings:
  critical: 1
  warning: 10
  info: 6
  total: 17
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-13T21:44:12Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Re-review after gap-closure plan 04-04 (commit `70ebee4` + regression test `a04ec1f`). All 309 tests pass.

**Prior CR-01 status: partially resolved.** The direct hole — a single in-flight mount surviving navigation to an unmatched route — is fixed (`handleRouteChange`'s null branch now calls `lifecycle.invalidatePendingMount(pendingMountId)`) and regression-tested in `tests/stress.test.ts:207-242`. However, I **reproduced two residual violations of the same invariant against the current code** (repros run live, then deleted — not committed):

1. **Reopened via the `pendingMountId` clobber** (the prior review's WR-01, which plan 04-04 did not address): with two overlapping mounts A→B, the stale A call's unconditional `finally { pendingMountId = null; }` erases B's guard; a subsequent navigation to `/nowhere` then finds `pendingMountId === null`, skips the invalidation, and **B commits `dx:mount` with its DOM in the container while the URL is `/nowhere`** — the exact D-01 violation CR-01 was closed for. This is the new CR-01 below.
2. **Post-injection residue**: when the unmatched-route navigation arrives *after* the template was injected (mount held at the entry-script gate instead of the template gate), the abandoned mount's `isStale()` gate returns without clearing the container — **stale template HTML remains visible under `/nowhere`**, violating the `container.innerHTML === ''` invariant the new regression test asserts, just at a different gate. The regression test only covers the pre-injection interleaving.

Beyond CR-01, **none of the prior review's seven warnings or four info items were addressed** — plan 04-04 scoped only CR-01. They are re-reported below (with prior IDs cross-referenced) alongside three newly found issues in `src/shell.ts` (destroy-mid-mount ghost commit, mismatched `dx:route:changed` payloads, stale mount-container cache).

`src/utils.ts` (`deepMerge`) is sound — prototype-pollution guards verified, non-mutation verified, tests are thorough. `tests/router.test.ts`, `tests/utils.test.ts`, and `plugins/settings/tests/integration.test.ts` are solid.

## Critical Issues

### CR-01: Stale mount's `finally` clobbers `pendingMountId`, reopening the unmatched-route hole — a superseding dapp still commits under an unmatched URL

**File:** `src/shell.ts:412-414` (clobber), `src/shell.ts:358-366` (bypassed invalidation)
**Issue:** `mountDapp`'s `finally { pendingMountId = null; }` runs unconditionally, including for a *stale* call whose slot was already overwritten by a newer mount. Sequence (verified by live repro against current code, history mode, keyed gates):

1. `navigate('/a')` → `mountDapp('a')` sets `pendingMountId = 'a'`, suspends at entry gate.
2. `navigate('/b')` → `mountDapp('b')` overwrites `pendingMountId = 'b'`, supersedes A, suspends.
3. A's held loader settles → stale A returns → A's `finally` sets `pendingMountId = null` **while B is still in flight**.
4. `navigate('/nowhere')` → `handleRouteChange(null)` checks `if (pendingMountId)` — it is `null` — so `invalidatePendingMount` is **skipped**.
5. B's loader settles → every `isStale()` gate passes → **`dx:mount {id:'b'}` fires and B owns the container while `getCurrentRoute()` is `/nowhere`**.

This is the same last-navigation-wins (D-01) violation the phase's CR-01 fix was shipped to close; the fix keys off shell-side `pendingMountId`, which is corruptible by exactly the interleavings the stress suite creates (stress scenario "rapid A→B→A" exercises the clobber window without a follow-up unmatched navigation). Note `disableDapp` is immune — it passes the *disabled id* directly and lifecycle checks its own `inFlightMountId`; only the null-route branch depends on the corruptible slot.
**Fix:** two parts, both cheap:
```ts
// 1. mountDapp — a stale call must not clobber a newer mount's guard
} finally {
  if (pendingMountId === manifest.id) pendingMountId = null;
}
```
(Safe: concurrent same-id calls are already excluded by the `pendingMountId === manifest.id` early return at line 389, so `pendingMountId !== manifest.id` in `finally` can only mean a newer mount owns the slot.)
```ts
// 2. handleRouteChange null branch — don't depend on the shell-side slot at all; let
// lifecycle invalidate whatever is in flight (it owns the ground truth inFlightMountId):
lifecycle.invalidateAnyPendingMount(); // new method: if (inFlightMountId !== null) mountGeneration++;
```
Fix 1 alone closes the repro; fix 2 removes the entire class. Add a regression test for the A→B→settle-A→`/nowhere`→settle-B interleaving.

## Warnings

### WR-01: Unmatched-route abandonment after template injection leaves stale dapp HTML in the container

**File:** `src/shell.ts:362-365`, `src/lifecycle.ts:386,405` (uncleaning stale-return gates)
**Issue:** The CR-01 regression test (`tests/stress.test.ts:207-242`) holds the *template* gate, so abandonment happens before injection and the `container.innerHTML === ''` assertion passes. Hold the *entry-script* gate instead (template already injected) and the same scenario fails — verified by live repro: `navigate('/a')` → template injected → `navigate('/nowhere')` → release entry → stale mount returns at the `isStale()` gate **without clearing the container**, leaving `<div data-dapp="a">` visible under `/nowhere` forever (no `dx:unmount` will ever fire; the dapp never received `dx:mount` so it won't tear down; no successor mount overwrites). The stale-return gates intentionally don't touch the container because a *newer dapp* usually owns it — but when the successor is "no dapp", nobody cleans up.
**Fix:** in `handleRouteChange`'s null branch, after invalidating and unmounting, clear the mount container — at that synchronous moment any in-flight mount is stale and its pre-write gates guarantee it can never inject afterward:
```ts
} else {
  if (pendingMountId) lifecycle.invalidatePendingMount(pendingMountId);
  lifecycle.unmount();
  const c = getMountContainer();
  if (c) c.innerHTML = '';
}
```
(Alternative: track the injecting generation in the lifecycle closure and clear on stale abandon only when this generation still owns the container.) Extend the regression test with the entry-gate variant.

### WR-02: `normalizeRoute` never trims whitespace — routes with stray spaces become silently unreachable (prior WR-02, unaddressed)

**File:** `src/shell.ts:246-254`
**Issue:** The function rejects whitespace-*only* routes via `route.trim() === ''` but normalizes the **untrimmed** value. `route: '/blog '` is stored verbatim (trailing space) and no normalized browser path can ever match it; `route: ' blog'` becomes `'/ blog'`, equally unreachable. No `dx:error` is emitted — exactly the "silently unreachable dapp" failure mode D-06 set out to eliminate.
**Fix:**
```ts
function normalizeRoute(route: string): string | null {
  const trimmed = route.trim();
  if (trimmed === '') return null;
  let normalized = trimmed;
  ...
}
```

### WR-03: Missing staleness gate after the styles await — a superseded mount still initiates (and executes) the next load stage (prior WR-03, unaddressed; analysis refined)

**File:** `src/lifecycle.ts:310-323`
**Issue:** On style-load *success* there is no `isStale()` check (only the catch has one). A mount superseded during its styles await proceeds to initiate the next stage: the template fetch (wasted network, mostly benign), or — for a manifest with no template — the first dependency/entry `loadScript()`, which with the default loader injects and **executes** a `<script type="module">` for a mount that has already lost, polluting the loader's `loaded` cache and running module top-level side effects for a dapp the user navigated away from. All other awaits are correctly gated (template at :342, sanitize at :362, dep loop at :386, entry at :405); the styles success path is the one hole.
**Fix:** add after the styles block:
```ts
if (isStale()) return; // superseded during the styles await — don't initiate further loads
```

### WR-04: registry.json tier — non-array JSON crashes `init()`; fetch/parse failures are silent (prior WR-04, unaddressed)

**File:** `src/shell.ts:231-241`, `src/shell.ts:315`
**Issue:** (1) `return await res.json()` flows unchecked into `normalizeAndValidateManifests`, whose `for (const m of list)` throws `TypeError: list is not iterable` when registry.json holds a JSON object (`{}` — an easy authoring mistake). The throw escapes `init()` and crashes shell startup — the opposite of the plugin-failure containment a few lines below. (2) The bare `catch { /* No registry.json — that's fine */ }` swallows network failures **and** malformed-JSON parse failures silently, while the identical failure in the dapp-entries tier now emits `dx:error` (this phase's WR-01 hardening) — breaking the documented "tier-uniform validation (D-07)" claim.
**Fix:** validate `Array.isArray(data)` and emit `dx:error` (source `shell:manifest`) for non-array bodies and parse failures; keep only true fetch-404/network-miss as the acceptable silent case if desired.

### WR-05: Hash mode can emit a misattributed `dx:route:subpath` naming another dapp's route (prior WR-05, unaddressed)

**File:** `src/shell.ts:407-410`
**Issue:** The fresh-path commit trusts `router.getCurrentPath()` raw. In hash mode, `navigate('/b')` updates `location.hash` synchronously but the `hashchange` (and therefore B's mount / generation supersession) fires **asynchronously**. If A's in-flight mount commits inside that window, its continuation reads `freshPath = '/b'` with `getCurrentDapp() === 'a'` still true and emits `dx:route:subpath { id: 'a', path: '/b', previousPath: '/a' }` — telling dapp A's sub-router it owns dapp B's route. History mode is immune (synchronous notify), which is why the deliberately history-only stress suite (its "Pitfall 3" note) cannot catch this.
**Fix:** gate the emit on the fresh path still resolving to this manifest:
```ts
if (freshPath !== path && lifecycle.getCurrentDapp() === manifest.id
    && router.resolve(freshPath)?.id === manifest.id) {
```

### WR-06: `disableDapp()` mid-flight strands the URL on the disabled dapp's dead route (prior WR-06, unaddressed)

**File:** `src/shell.ts:126-140`, `src/shell.ts:107-113`
**Issue:** Disabling a **committed** dapp unmounts it and navigates to `/`. Disabling an **in-flight** dapp invalidates the mount, but `rebuildRouter()`'s recovery branch keys on `lifecycle.getCurrentDapp()` — null for an uncommitted mount — so no `navigate('/')` happens. The app is left parked on a route (e.g. `/opt`) that no longer resolves: blank container, dead URL, and no `dx:route:changed` fires to inform the host UI. The D-03 scenario-1 stress test (`tests/stress.test.ts:178-205`) asserts no mount happened but never asserts where the user ends up.
**Fix:** in `disableDapp`, when the disabled id matches the current route's resolution (or when `invalidatePendingMount` reports it actually invalidated something — see IN-02), apply the committed-case recovery: `router.navigate('/')`.

### WR-07: After disable→enable, re-navigating to the dapp is silently dropped while the abandoned mount's loader is still pending (prior WR-07, unaddressed)

**File:** `src/shell.ts:389`, `src/shell.ts:400-414`
**Issue:** `invalidatePendingMount(id)` bumps the lifecycle generation but the shell's `pendingMountId` stays set until the abandoned `lifecycle.mount()` promise settles (up to the full load timeout for a hung loader). In that window, `enableDapp(id)` + `navigate('/<id>')` hits `if (pendingMountId === manifest.id) return;` and is dropped — deferring to an in-flight mount that has been *invalidated* and will never commit. Result: the URL shows the dapp's route, nothing mounts, nothing replays when the abandoned promise settles (the fresh-path block only emits subpath events, never re-mounts).
**Fix:** after `await lifecycle.mount(...)`, if this call did not commit (`lifecycle.getCurrentDapp() !== manifest.id`) but the current path still resolves to this enabled manifest, re-attempt the mount — or have `disableDapp` clear `pendingMountId` when the invalidation actually fired.

### WR-08: `shell.destroy()` does not abandon an in-flight mount — a dapp can commit and emit `dx:mount` after the shell is destroyed

**File:** `src/shell.ts:440-462`, `src/lifecycle.ts:428-430`
**Issue:** `destroy()` tears down the router, unsubscribes, and calls `lifecycle.destroy()` — but `lifecycle.destroy()` only unmounts a **committed** dapp (`if (currentDappId) unmount()`); it never bumps `mountGeneration`. A mount suspended in a loader when `destroy()` runs stays generation-current: when its loader settles, every `isStale()` gate passes and it commits — `currentDappId` is set, template HTML is injected into the container, and `dx:mount`/`dx:dapp:mounted` fire on the window bus — all after the shell (and its plugins, already `destroy()`ed) are gone. `window.__DXKIT__` has been deleted at that point, so a dapp entry acting on the ghost `dx:mount` dereferences a missing context.
**Fix:** bump the generation in `lifecycle.destroy()`:
```ts
function destroy(): void {
  mountGeneration++; // abandon any in-flight mount — nothing may commit after destroy
  inFlightMountId = null;
  if (currentDappId) unmount();
}
```

### WR-09: Overlapping navigations emit `dx:route:changed` with a mismatched payload — stale manifest paired with the newer path

**File:** `src/shell.ts:358-371`
**Issue:** `handleRouteChange` awaits `mountDapp(manifest)` and only then emits `dx:route:changed`, reading `router.getCurrentPath()` **at emit time**. When navigations overlap (navigate `/a`, mount suspends; navigate `/b`), the stale A handler eventually resumes and emits `dx:route:changed { path: '/b', manifest: dappA }` — a payload asserting dapp A owns path `/b`. Consumers also see two `dx:route:changed` events for the same final path, potentially out of navigation order. Any nav-highlighting or breadcrumb UI keyed on this event renders the wrong active dapp.
**Fix:** capture the path at handler entry and skip the emit when the navigation has been superseded, e.g.:
```ts
async function handleRouteChange(manifest: DappManifest | null): Promise<void> {
  const path = router.getCurrentPath(); // capture at notification time
  ...
  if (router.getCurrentPath() === path) {
    events.emit('dx:route:changed', { path, manifest: manifest ?? undefined });
  }
}
```

### WR-10: `getMountContainer()` caches the element forever — a re-rendered `#dx-mount` leaves all future mounts writing into a detached node, silently

**File:** `src/shell.ts:418-422`
**Issue:** `mountContainer` is cached on first lookup and never revalidated until `destroy()`. If the host layout removes/replaces `#dx-mount` (any host-side re-render — common in SPA shells), every subsequent mount injects templates into the **detached** old element and hands it to dapps via `dx:mount`. Nothing appears on screen and no error is emitted — a fully silent failure, contradicting the milestone's "failures are visible (never silent)" core value.
**Fix:**
```ts
function getMountContainer(): HTMLElement | null {
  if (mountContainer?.isConnected) return mountContainer;
  mountContainer = document.getElementById('dx-mount');
  return mountContainer;
}
```

## Info

### IN-01: Inconsistent error wrapping in the sanitize catch (prior IN-01, unaddressed)

**File:** `src/lifecycle.ts:356`
**Issue:** `new Error(String(err), { cause: err })` is the only catch in the file attaching `cause`, and only on the non-`Error` branch where `String(err)` already carries the content. Sibling catches (styles, template, dependency, entry) drop the cause. Pick one convention — attaching `cause` everywhere matches `shell.ts:212`.

### IN-02: `inFlightMountId` left dangling after a stale mount returns (prior IN-02, unaddressed)

**File:** `src/lifecycle.ts:342,362,386,405,440-447`
**Issue:** Stale-return paths skip `inFlightMountId = null`, so an `invalidatePendingMount()`-abandoned mount with no successor leaves `inFlightMountId` stuck at the dead id until the next mount overwrites it. Harmless with today's single consumer (a spurious generation bump between mounts is a no-op), but any future consumer inherits a lie. Clear it inside `invalidatePendingMount` when it fires, and consider returning a boolean so the shell can tell whether anything was invalidated (feeds the WR-06 fix).

### IN-03: `isValidManifest` accepts empty-string `id` and `entry` (prior IN-04, unaddressed)

**File:** `src/shell.ts:167-176`
**Issue:** `typeof m.entry === 'string'` passes for `entry: ''` (and `id: ''`), deferring failure to a confusing mount-time load error (`Failed to load dapp script: `). Route emptiness got dedicated handling this phase; `id`/`entry` did not. Tighten to `m.id.length > 0 && m.entry.length > 0` at the validation choke point.

### IN-04: Test hygiene — mismatched `removeEventListener`, leaked listeners, fetch mocks restored outside `finally` (prior IN-03, unaddressed; extended)

**File:** `tests/shell.test.ts:60-64`, `tests/shell.test.ts:254-269` (and ~8 similar fetch-mock tests)
**Issue:** (1) `window.addEventListener('dx:plugin:registered', (e) => handler(...))` followed by `removeEventListener('dx:plugin:registered', handler)` removes nothing — the registered listener is the anonymous wrapper. (2) ~10 tests register anonymous `dx:error` listeners never removed; assertions currently survive only because each test reads its own closure array. (3) `window.fetch = vi.fn(...)` ... `window.fetch = originalFetch` restores are not in `try/finally` — one failing assertion mid-test leaves fetch mocked for every subsequent test in the file, cascading confusing failures that mask the root cause. Use `vi.stubGlobal('fetch', ...)` + `vi.unstubAllGlobals()` in `afterEach`, and capture listener wrappers.

### IN-05: 'disabled dapps are excluded from routing' test asserts nothing about mounting

**File:** `tests/shell.test.ts:1023-1032`
**Issue:** The test navigates to a disabled dapp's route and asserts only `getCurrentRoute() === '/api'` — which would also pass if the dapp *did* mount. The comment ("nothing mounts") is unverified. Add a `dx:dapp:mounted` spy and assert it was not called.

### IN-06: `init()` is not re-entrancy-safe — two concurrent calls both pass the `initialized` guard

**File:** `src/shell.ts:305-306`
**Issue:** `initialized` is set only after several awaits (manifest load, plugin inits), so two overlapping `init()` calls both pass the guard: plugins register and `init()` twice, `dx:plugin:registered` duplicates, and the interleaved `router.destroy()`/`createRouter` pairs can leak a router with a live `popstate` listener. The "double init() is a no-op" test covers only sequential calls. Guard with a memoized promise: `if (initPromise) return initPromise; initPromise = doInit(); return initPromise;`.

---

_Reviewed: 2026-07-13T21:44:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

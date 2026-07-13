---
phase: 04-testing-stress-edge-case-regression-coverage
reviewed: 2026-07-13T19:52:00Z
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
  warning: 7
  info: 4
  total: 12
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-13T19:52:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed the phase-04 mount-generation guard (`src/lifecycle.ts`), its shell wiring plus manifest normalize/validate/dedupe and WR-01 dx:error emits (`src/shell.ts`), the `deepMerge` JSDoc reconciliation (`src/utils.ts`), and the five new/extended test suites. All 308 tests pass, and the generation-guard design is sound for the dapp-to-dapp supersession matrix it targets (D-01/D-02/D-03 scenarios 1–4).

However, the last-navigation-wins invariant has a **proven hole**: navigating to a route that resolves to *no* manifest does not abandon an in-flight mount, so the stale dapp commits, emits `dx:mount`, and injects its template while the URL points elsewhere. I reproduced this with a live test against the current code (repro in scratchpad, not committed): navigate `/a` (entry held) → navigate `/nowhere` → release entry → `dx:mount {id:'a'}` fires and the container holds A's template while `getCurrentRoute()` is `/nowhere`. The D-03 stress matrix covers dapp→dapp and disable-mid-flight, but omits the dapp→unmatched-route transition entirely.

Several secondary races and validation gaps were also found in the new shell code (pendingMountId clobbering, untrimmed route normalization, registry.json tier crash, hash-mode subpath misattribution, disable-mid-flight aftermath).

## Critical Issues

### CR-01: Navigating to an unmatched route does not abandon an in-flight mount — stale dapp commits under the wrong URL

**File:** `src/shell.ts:358-368` (with `src/lifecycle.ts:283-413`)
**Issue:** `handleRouteChange(null)` (unmatched path) only calls `lifecycle.unmount()`, which no-ops when nothing has *committed* (`currentDappId` is null for an in-flight mount). The mount generation is never bumped, so the in-flight mount is still "current": when its loader settles, every `isStale()` gate passes and it commits — `currentDappId` is set, `dx:mount`/`dx:dapp:mounted` are emitted, and the template is injected — even though the browser URL now resolves to no dapp. The shell then also emits a bogus `dx:route:subpath { id, path: '/nowhere' }` from the fresh-path commit at `src/shell.ts:404-407`, because `freshPath !== path` and `getCurrentDapp() === manifest.id` are both true.

**Verified by repro** (history mode, held entry loader): `navigate('/a')` → `navigate('/nowhere')` → release loader ⇒ `dx:mount` for `a` fires; expected zero mounts. This violates the exact invariant (last-navigation-wins, D-01) this phase set out to fix, via a completely ordinary user action (clicking a dapp link, then quickly navigating to `/` or any non-dapp route).

**Fix:** invalidate the pending mount in the null branch, and add the missing scenario to the stress matrix:
```ts
async function handleRouteChange(manifest: DappManifest | null): Promise<void> {
  if (manifest) {
    await mountDapp(manifest);
  } else {
    // A navigation that resolves to no dapp must also supersede an in-flight mount,
    // not just unmount a committed one (last-navigation-wins, D-01).
    if (pendingMountId) lifecycle.invalidatePendingMount(pendingMountId);
    lifecycle.unmount();
  }
  ...
}
```
Add a regression test: navigate to a dapp with a held loader, navigate to an unmatched route, release the loader, assert no `dx:mount`, empty container, no `dx:route:subpath`.

## Warnings

### WR-01: `mountDapp`'s `finally` unconditionally clears `pendingMountId`, clobbering a newer concurrent mount's dedupe guard

**File:** `src/shell.ts:409-411`
**Issue:** `pendingMountId` is a single shared slot. Sequence: `mountDapp('a')` sets `'a'` and suspends; `mountDapp('b')` overwrites with `'b'`; the stale `'a'` call's lifecycle mount returns and its `finally { pendingMountId = null; }` runs — nulling the guard **while b's mount is still in flight**. A duplicate route notification for `b` arriving in that window passes the `pendingMountId === manifest.id` check and starts a redundant second `lifecycle.mount('b')` (extra generation bump, extra loader work). The lifecycle generation guard prevents a double `dx:mount`, but the shell-level dedupe this comment documents ("can't both pass the mount guard", line 56-58) is broken in exactly the interleaving the stress suite creates (stress scenario 4 exercises this clobber window without asserting on it).
**Fix:**
```ts
} finally {
  // Only clear our own guard — a stale call must not clobber a newer mount's dedupe.
  if (pendingMountId === manifest.id) pendingMountId = null;
}
```
Note: with concurrent same-id calls already excluded by the early return at line 386, this is safe.

### WR-02: `normalizeRoute` never trims whitespace — routes with stray spaces become silently unreachable

**File:** `src/shell.ts:246-254`
**Issue:** The function rejects whitespace-*only* routes via `route.trim() === ''` but then normalizes the **untrimmed** value. `route: '/blog '` survives validation and is stored verbatim (trailing space ≠ `/`), producing a route no normalized browser path can ever match — precisely the "silently unreachable dapp" failure mode D-06 was meant to eliminate. `route: ' blog'` becomes `'/ blog'`, equally unreachable. No `dx:error` is emitted for either.
**Fix:**
```ts
function normalizeRoute(route: string): string | null {
  const trimmed = route.trim();
  if (trimmed === '') return null;
  let normalized = trimmed;
  ...
}
```

### WR-03: Superseded mounts still initiate (and execute) dependency and entry script loads — staleness is only checked after each await

**File:** `src/lifecycle.ts:369-405`
**Issue:** `isStale()` gates run *after* each `await`, never before initiating the next load stage. A mount that became stale during its styles/template await proceeds to call `loadScript()` for every dependency (first iteration is unguarded) and for the entry script. With the default loader that means injecting `<script type="module">` into `document.head` and **executing** a dapp module for a mount that has already lost — network cost, side effects from module top-level code, and permanent pollution of the loader's `loaded` cache for a dapp the user navigated away from. The template path shows the intended discipline (re-check at line 342 "immediately before the DOM write"); the script stages lack the equivalent pre-flight check.
**Fix:** add `if (isStale()) return;` before entering the dependency loop and before `await loadScript(manifest.entry)` (and at the top of each loop iteration rather than only at the bottom).

### WR-04: registry.json tier — non-array JSON crashes `init()`; fetch/parse failures are still silent (breaks the D-07 tier-parity claim)

**File:** `src/shell.ts:231-241`, `src/shell.ts:262`, `src/shell.ts:315`
**Issue:** Two gaps in the third manifest tier:
1. `return await res.json()` is passed straight into `normalizeAndValidateManifests`, whose `for (const m of list)` throws `TypeError: list is not iterable` when registry.json contains a JSON object instead of an array (`{}` — an easy authoring mistake). The throw escapes `init()`, crashing shell startup instead of emitting `dx:error` and continuing — the opposite of the plugin-failure containment three lines below.
2. The `catch { /* No registry.json — that's fine */ }` swallows network failures **and** malformed-JSON parse failures silently, while the identical failure in the dapp-entries tier now emits `dx:error` (this phase's WR-01 work). `normalizeAndValidateManifests` is documented as "tier-uniform validation (D-07)" but the registry tier can bypass it entirely (crash) or fail invisibly.
**Fix:**
```ts
try {
  const res = await fetch(registryUrl);
  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data)) return data;
    events.emit('dx:error', {
      source: 'shell:manifest',
      error: new Error(`Registry at ${registryUrl} did not contain a JSON array — ignored`),
    });
  }
} catch (err) {
  // Distinguish "no registry" (acceptable) from malformed JSON if desired; at minimum
  // keep parse failures visible for parity with the dapp-entries tier.
}
```

### WR-05: Hash mode can emit a misattributed `dx:route:subpath` pointing at another dapp's route

**File:** `src/shell.ts:404-407`
**Issue:** The fresh-path commit trusts `router.getCurrentPath()` raw. In hash mode, `navigate('/b')` assigns `location.hash` synchronously but the `hashchange` (and therefore `mountDapp('b')` / generation supersession) fires **asynchronously**. If dapp A's in-flight mount commits inside that window, its continuation reads `freshPath = '/b'` with `getCurrentDapp() === 'a'` still true, and emits `dx:route:subpath { id: 'a', path: '/b', previousPath: '/a' }` — telling dapp A's sub-router it now owns dapp B's route. History mode is immune (navigate notifies synchronously), which is why the stress suite — deliberately history-only per its Pitfall 3 note — can't catch this.
**Fix:** only emit when the fresh path still resolves to this manifest:
```ts
if (freshPath !== path && lifecycle.getCurrentDapp() === manifest.id
    && router.resolve(freshPath)?.id === manifest.id) {
  events.emit('dx:route:subpath', { id: manifest.id, path: freshPath, previousPath: path });
}
```

### WR-06: `disableDapp()` mid-flight leaves the URL parked on the disabled dapp's dead route (committed case returns to `/`)

**File:** `src/shell.ts:126-140`, `src/shell.ts:107-113`
**Issue:** When a **committed** dapp is disabled, `rebuildRouter()` unmounts it and navigates to `/`. When an **in-flight** dapp is disabled, `invalidatePendingMount(id)` abandons the mount but `rebuildRouter()`'s recovery branch is keyed on `lifecycle.getCurrentDapp()`, which is null — so no `router.navigate('/')` happens. The app is left on a route (e.g. `/opt`) that no longer resolves to anything: blank mount container, dead URL, and `dx:route:changed` never fires to tell the host UI. The stress test for this scenario (`tests/stress.test.ts:178-205`) asserts no mount occurred but never asserts where the user ends up.
**Fix:** in `disableDapp`, when the invalidated id matches the current route's resolution (or track that `invalidatePendingMount` actually invalidated something — see also IN-02), apply the same recovery as the committed case: `router.navigate('/')`.

### WR-07: After disable→enable, re-navigating to the same dapp is silently dropped while the abandoned mount's loader is still pending

**File:** `src/shell.ts:386`, `src/shell.ts:397-411`
**Issue:** `invalidatePendingMount(id)` bumps the lifecycle generation but the shell's `pendingMountId` stays set until the abandoned `lifecycle.mount()` promise settles (up to the full load timeout for a hung loader). During that window, `enableDapp(id)` + `navigate('/<id>')` hits `if (pendingMountId === manifest.id) return;` and is dropped — but the in-flight mount it defers to has been *invalidated* and will never commit. Result: route shows the dapp's path, nothing ever mounts, and no event surfaces the drop. Nothing replays the mount when the abandoned promise finally settles (the fresh-path block runs but only emits subpath events, never re-mounts).
**Fix:** after `await lifecycle.mount(...)`, if this call did not commit (`lifecycle.getCurrentDapp() !== manifest.id`) but the current path still resolves to this manifest and the dapp is enabled, re-attempt the mount (or clear `pendingMountId` inside `disableDapp` and re-resolve the route after `rebuildRouter()`).

## Info

### IN-01: Inconsistent error wrapping in the sanitize catch

**File:** `src/lifecycle.ts:356`
**Issue:** `new Error(String(err), { cause: err })` — the only catch in the file that attaches `cause`, and it does so only on the non-`Error` branch where `String(err)` already contains everything. Sibling catches (styles, template, dependency, entry) drop the cause. Pick one convention (attaching `cause` everywhere is the better one, matching `shell.ts:212`).

### IN-02: `inFlightMountId` is left dangling after a stale mount returns

**File:** `src/lifecycle.ts:342`, `362`, `386`, `405`, `440-447`
**Issue:** Stale-return paths intentionally skip `inFlightMountId = null` (a newer mount usually owns it), but the `invalidatePendingMount()` path abandons a mount with no successor, leaving `inFlightMountId` stuck at the abandoned id until the next mount overwrites it. Today the only consumer (`invalidatePendingMount`) makes a spurious generation bump harmless (no live mount holds the old generation), but any future consumer of `inFlightMountId` inherits a stale value. Consider clearing it inside `invalidatePendingMount` when it fires, and having `invalidatePendingMount` return a boolean so the shell can tell whether anything was actually invalidated (feeds the WR-06 fix).

### IN-03: Test hygiene — `removeEventListener` called with a different function than was added; leaked `dx:error` listeners

**File:** `tests/shell.test.ts:60-64`, `tests/shell.test.ts:653-673`
**Issue:** `window.addEventListener('dx:plugin:registered', (e) => handler(...))` followed by `window.removeEventListener('dx:plugin:registered', handler)` removes nothing — the registered listener is the anonymous wrapper, not `handler`. Same pattern in the first sub-path test. Additionally ~10 tests register anonymous `dx:error` listeners that are never removed. Because each test asserts on its own closure-scoped array and leaked listeners only push into dead arrays, no assertion is currently affected — but the file relies on that accident. Either capture the wrapper (`const listener = (e) => ...; add/remove(listener)`) or move cleanup into `afterEach`.

### IN-04: `isValidManifest` accepts empty-string `id` and `entry`

**File:** `src/shell.ts:167-176`
**Issue:** `typeof m.entry === 'string'` passes for `entry: ''` (and `id: ''`), deferring the failure to a confusing script-load error at mount time (`Failed to load dapp script: `). Route emptiness got dedicated handling this phase (`normalizeRoute` → null); `id`/`entry` emptiness did not. Tightening to `m.id.length > 0 && m.entry.length > 0` keeps the failure at the validation choke point with a clear message.

---

_Reviewed: 2026-07-13T19:52:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

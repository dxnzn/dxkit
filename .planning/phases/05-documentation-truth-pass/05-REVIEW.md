---
phase: 05-documentation-truth-pass
reviewed: 2026-07-14T11:49:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lifecycle.ts
  - src/shell.ts
  - tests/lifecycle.test.ts
  - tests/router.test.ts
  - tests/shell.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-14T11:49:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the three folded fixes landed in phase 05 (plan 05-01): D-15 (registry.json
failure surfacing when `registryUrl` is explicit), D-16 (disable-mid-flight navigating to
`/`), and D-17 (`inFlightMountId` ownership-guarded clearing). All 130 tests in the three
touched test files pass.

The three core mechanisms are correctly implemented. The generation/ownership bookkeeping in
`lifecycle.ts` (D-17) is sound: the `inFlightGeneration` pairing correctly prevents a
superseded call from nulling a newer call's marker, and all exit paths route through
`clearOwnedInFlightMarker()`. The D-16 committed-vs-uncommitted branch split in `disableDapp`
correctly avoids double-navigation. The D-15 explicit/default registry gating is correct for
its stated cases.

No blockers. The findings below are: one latent robustness gap in manifest loading (a
non-array registry.json crashes `init()` with an uncaught `TypeError` instead of a clean
`dx:error` — directly at odds with this milestone's "failures are visible, never silent"
goal), one edge in the `registryUrlExplicit` heuristic, and one test that does not actually
exercise the D-17 regression it claims to guard.

No structural findings block was provided with this review.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Non-array registry.json (or inline manifests) crashes `init()` with an uncaught TypeError

**File:** `src/shell.ts:274` (produced value), consumed at `src/shell.ts:314` and `src/shell.ts:367`
**Issue:** `loadManifests()` returns `await res.json()` for the registry path without validating
that the parsed JSON is an array. `init()` feeds that value straight into
`normalizeAndValidateManifests(await loadManifests())`, whose body is `for (const m of list)`.
If registry.json is a non-array (e.g. `{}` or `{"manifests":[...]}` — a plausible
misconfiguration for the primary IPFS/static deployment target), `for...of` throws
`TypeError: list is not iterable`. That throw is **outside** `loadManifests()`'s try/catch and
outside any try/catch in `init()`, so it rejects the `init()` promise *after* plugins were
already registered — the shell never builds its router or exposes `window.__DXKIT__`. This is
exactly the silent-failure-becomes-ungraceful-crash case the phase set out to close: the D-15
work made a *non-OK* registry response emit a clean `dx:error`, but a *200-with-wrong-shape*
registry still hard-crashes. The `inlineManifests` path (line 256) has the same latent gap for
untyped IIFE consumers who pass a non-array.
**Fix:** Validate array-ness before returning, and emit `dx:error` on the registry path so a
malformed registry degrades to an empty manifest list like every other manifest-load failure:
```ts
const parsed = await res.json();
if (!Array.isArray(parsed)) {
  if (registryUrlExplicit) {
    events.emit('dx:error', {
      source: 'shell:manifest',
      error: new Error(`Registry at ${registryUrl} did not return a JSON array — ignoring`),
    });
  }
  return [];
}
return parsed;
```
(Optionally guard `inlineManifests` with `Array.isArray(inlineManifests) ? inlineManifests : []`
for the untyped-consumer case.)

### WR-02: `registryUrl: undefined` defeats the default-probe silence

**File:** `src/shell.ts:34`
**Issue:** `registryUrlExplicit = Object.hasOwn(config, 'registryUrl')` is `true` whenever the
key is present, including `createShell({ registryUrl: undefined })`. The destructure default on
line 40 (`registryUrl = '/registry.json'`) then resolves the effective URL back to the default
probe path. Result: a consumer who passes `registryUrl: undefined` (common when forwarding an
optional config value, e.g. `{ registryUrl: opts.registry }`) now emits a `dx:error` on the
*default* `/registry.json` probe — the exact spurious-error case D-15's gating comment says it
avoids ("the default probe … stays silent"). The stated intent keys on "did the caller choose a
URL", but the guard keys on "is the property present".
**Fix:** Gate on an actually-provided value rather than mere key presence:
```ts
const registryUrlExplicit = Object.hasOwn(config, 'registryUrl') && config.registryUrl !== undefined;
```

### WR-03: The D-17 regression test passes with or without the ownership guard

**File:** `tests/lifecycle.test.ts:1022-1057`
**Issue:** The test named "…leaves the in-flight marker owner-cleared … (D-17)" does not
actually exercise the D-17 regression. It serializes the operations: the first `ghost` mount is
invalidated and exits, then `invalidateAnyPendingMount()` runs, then the second `ghost` mount
starts. Trace the counter: even if the marker leaked (i.e. `clearOwnedInFlightMarker()` were
buggy / absent), `invalidateAnyPendingMount()` would only bump `mountGeneration`, and the
second `mount()` re-reads `++mountGeneration` for its own generation afterward — so
`secondCommitted === true`, `mountedHandler` called once, and `getCurrentDapp() === 'ghost'`
all hold regardless. The genuinely-fixed path (a *stale* mount exiting via a **catch** branch
while a **newer mount is still in flight**, where the old unconditional `inFlightMountId = null`
would clobber the newer call's marker) is never set up, and there is no direct assertion that
`invalidateAnyPendingMount()` was a true no-op. The test gives false coverage confidence for
the ownership guard.
**Fix:** Add a test with two concurrent same-behavior mounts where the *stale* one exits via a
failing loader (catch branch) *after* a newer mount has taken ownership, then assert that
`invalidateAnyPendingMount()` still supersedes the newer in-flight mount (proving its marker
survived the stale call's exit). For example: start mount A (held), start mount B (held), fail
A's loader so A exits via its catch, then call `invalidateAnyPendingMount()` and release B —
assert B did **not** commit (`getCurrentDapp()` null, no `dx:mount` for B).

## Info

### IN-01: `wasUncommittedMount` name is broader than its meaning

**File:** `src/shell.ts:147`
**Issue:** `wasUncommittedMount = lifecycle.getCurrentDapp() !== id` is true whenever `id` is not
the committed dapp — including when a *different* dapp is committed or nothing is committed, not
strictly "a mount for `id` was in flight but uncommitted". The paired
`routeOwnedByDisabledDapp` guard narrows the branch enough that behavior is correct, but the
name implies a stronger precondition than the expression checks.
**Fix:** Consider `idNotCommitted` / `disabledDappNotCommitted` to match the actual predicate,
or add a one-line comment noting it also covers the nothing-mounted / other-dapp-mounted cases.

### IN-02: Registry array-shape assumption is undocumented at the return site

**File:** `src/shell.ts:274`
**Issue:** `return await res.json()` silently assumes the parsed body is `DappManifest[]`. The
downstream `for...of` contract (see WR-01) is invisible here. Even if WR-01 is fixed with a
runtime guard, a short comment documenting that registry.json must deserialize to an array
would flag the implicit contract for future edits.
**Fix:** Add a one-line comment at the return, or fold into the WR-01 `Array.isArray` guard.

---

_Reviewed: 2026-07-14T11:49:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

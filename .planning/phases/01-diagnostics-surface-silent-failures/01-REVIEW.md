---
phase: 01-diagnostics-surface-silent-failures
reviewed: 2026-07-11T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - plugins/settings/src/index.ts
  - plugins/settings/tests/settings.test.ts
  - plugins/theme/src/index.ts
  - plugins/theme/tests/theme.test.ts
  - plugins/wallet/src/index.ts
  - plugins/wallet/tests/wallet.test.ts
  - src/lifecycle.ts
  - src/shell.ts
  - tests/lifecycle.test.ts
  - tests/shell.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-07-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase converts previously silent `catch {}` blocks into diagnostic `dx:error`
emissions, adds `canUseStorage()` guards so genuinely-absent storage (SSR / private mode)
does not produce false errors, and clears the mount container when a dapp fails after its
template was injected. The diff is small (5 source files, ~65 lines) and unusually
well-tested: every new emission path and the storage-unavailable no-error path has a
dedicated test.

The changed lines are correct. I traced each new emit path and confirmed `dx` is always
set before the storage functions can run (both `restore()` calls execute after
`dx = context`), and that `EventBus.emit` is a plain `dispatchEvent` — so emitting
`dx:error` with no subscriber is a safe no-op and introduces no regression against the
existing "no dx:error expected" tests.

No BLOCKER-severity defects were found in the changed lines. The findings below are, in
order of importance: silent-failure paths the phase left unaddressed that **directly
contradict its stated goal** ("failures are visible, never silent"), plus one latent
correctness bug in the wallet provider surfaced during full-file review.

## Warnings

### WR-01: `loadDappManifest` silently swallows fetch / HTTP / JSON failures

**File:** `src/shell.ts:159-180`
**Issue:** This function is the single most relevant silent-failure site to this phase, yet
it was not touched. The sibling failure path — a manifest that parses but fails
`isValidManifest` — *does* emit `dx:error` (`source: 'shell:manifest'`, lines 165-171).
But three other failure modes for the exact same manifest are swallowed with no diagnostic:
- Network / fetch rejection → outer `catch { return null; }` (lines 177-179)
- HTTP error (`!res.ok`) → `return null` (line 162)
- Malformed JSON (`res.json()` throws) → outer `catch`

The result is inconsistent and directly undercuts the phase goal: a dapp whose manifest is
missing a field is loudly reported, but a dapp whose manifest 404s or is corrupt vanishes
silently. The test `skips dapps with failed manifest fetch` (tests/shell.test.ts:308)
confirms the silent behavior and does not assert an error count, so surfacing these will
not break it.
**Fix:** Emit a `dx:error` before dropping the manifest, mirroring the validation path:
```ts
async function loadDappManifest(entry: DappEntry): Promise<DappManifest | null> {
  try {
    const res = await fetch(entry.manifest);
    if (!res.ok) {
      events.emit('dx:error', {
        source: 'shell:manifest',
        error: new Error(`Failed to fetch manifest from ${entry.manifest} (${res.status})`),
      });
      return null;
    }
    const base = await res.json();
    // ...existing isValidManifest handling...
  } catch (err) {
    events.emit('dx:error', {
      source: 'shell:manifest',
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return null;
  }
}
```

### WR-02: EIP-1193 `connect()` can report `connected: true` with an undefined address

**File:** `plugins/wallet/src/index.ts:46-50` (and coordinator emit at `214`, `218`)
**Issue:** `eth_requestAccounts` can legitimately resolve to an empty array (wallet locked,
all accounts revoked). The code does not check this:
```ts
const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
// ...
updateState({ connected: true, address: accounts[0], chainId, provider });
```
When `accounts` is `[]`, `accounts[0]` is `undefined`, so the provider enters a
`connected: true, address: undefined` state. The coordinator then emits
`dx:plugin:wallet:connected` with `address: newState.address!` (line 214) — the non-null
assertion masks the `undefined`, and every downstream subscriber of the
`{ address: string }` contract receives `undefined`. This is a latent correctness/data bug,
not merely cosmetic. (Pre-existing; surfaced during full-file review, not introduced by
this diff.)
**Fix:** Treat an empty account list as "not connected":
```ts
const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
if (!accounts.length) throw new Error('Wallet returned no accounts');
```

### WR-03: Wallet auto-reconnect failure on init is swallowed with no diagnostic

**File:** `plugins/wallet/src/index.ts:260-266`
**Issue:** In the same spirit as this phase, the restore path swallows the reconnect error:
```ts
try {
  await plugin.connect(savedId);
} catch {
  // Provider no longer available — clear persisted state
  persistProvider(null);
}
```
A restored provider that is present but fails to connect (RPC down, user rejects, chain
error) clears persisted state and reports nothing. A developer sees "my wallet didn't
auto-reconnect and I have no idea why" — the exact class of silent failure this phase
targets. The storage read/write paths in this same file were upgraded to emit `dx:error`,
so leaving this one silent is inconsistent.
**Fix:** Emit a `dx:error` (e.g. `source: 'plugin:wallet:reconnect'`) in the catch before
`persistProvider(null)`, carrying the caught error as `cause`.

## Info

### IN-01: `loadManifests` registry.json failures are silent

**File:** `src/shell.ts:193-202`
**Issue:** A missing `registry.json` is intentionally benign, but the current block also
swallows a *malformed* `registry.json` (`res.ok` true but `res.json()` throws) and a
non-OK HTTP response, returning `[]` with no signal. That is indistinguishable from "no
registry configured." Lower priority than WR-01 because the registry path is the last-resort
fallback, but it is still a silent failure of the phase's charter.
**Fix:** Distinguish "no registry (404/absent)" from "registry present but broken" and emit
`dx:error` only for the latter.

### IN-02: Mount container is cleared unconditionally, but the comment says "template HTML"

**File:** `src/lifecycle.ts:141-142` and `156-157`
**Issue:** `container.innerHTML = ''` runs on dependency/entry failure even when the manifest
declared no `template`, so nothing was injected by this mount. The comment ("clear any
template HTML so no stale dapp DOM remains addressable") slightly misdescribes the behavior:
in the no-template case it instead wipes whatever content was already in the container
(e.g. leftover DOM from a prior dapp that did not fully self-clean on `dx:unmount`). The
behavior is harmless — arguably beneficial — under the single-dapp model, but the comment
implies a narrower scope than the code has.
**Fix:** Either guard the clear with `if (manifest.template)` to match the comment, or
broaden the comment to state that the container is always reset on post-injection failure.
</content>
</invoke>

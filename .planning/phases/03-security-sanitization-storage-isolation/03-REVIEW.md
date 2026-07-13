---
phase: 03-security-sanitization-storage-isolation
reviewed: 2026-07-12T23:18:18Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/lifecycle.ts
  - src/index.ts
  - src/shell.ts
  - src/types/shell.ts
  - tests/lifecycle.test.ts
  - tests/shell.test.ts
  - plugins/wallet/src/index.ts
  - plugins/wallet/tests/wallet.test.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-07-12T23:18:18Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Phase 03 security surface: the `sanitizeTemplate` hook in `src/lifecycle.ts`, the wallet `storageKey` isolation in `plugins/wallet/src/index.ts`, and the `ShellConfig.lifecycle` restructure across `src/shell.ts` / `src/types/shell.ts` / `src/index.ts`, plus the accompanying tests. The full diff range (`b7d128f^..HEAD`, plans 03-01 through 03-03) was cross-referenced against each file.

The core sanitizer semantics are sound: fail-closed on throw/reject with a distinguishable `lifecycle:<id>:sanitize` error source, raw-only template cache (D-06), and pass-through-when-unconfigured all verified against tests. Wallet storage isolation is correct with no cross-key bleed and no silent legacy-key migration (D-10). The flat-loader runtime throw (D-05) protects untyped IIFE consumers.

However, the review found no Critical issues but five Warnings, the most significant being an unintended consequence of the config restructure: `ShellConfig.lifecycle` now exposes `hasPlugin`, and the spread order in `createShell` lets consumer config silently replace the shell's registry-backed plugin enforcement — a permission-check bypass introduced by this phase. The new async sanitizer also adds an unguarded await point that can wedge a dapp permanently (bypassing the D-03 hang-guard design) and widens a pre-existing cross-dapp mount race.

## Narrative Findings (AI reviewer)

_No `<structural_findings>` block was provided; no fallow section applies._

## Warnings

### WR-01: `ShellConfig.lifecycle` can silently override or disable the shell's `hasPlugin` enforcement

**File:** `src/shell.ts:42-45`, `src/types/shell.ts:27-28`
**Issue:** Introduced by the 03-03 restructure. `ShellConfig.lifecycle` is typed as the full `LifecycleManagerOptions`, which includes `hasPlugin?` (`src/lifecycle.ts:154`). In `createShell`, the consumer options are spread *after* the shell's own wiring:

```ts
const lifecycle = createLifecycleManager(events, {
  hasPlugin: (name: string) => registry.has(name),
  ...lifecycleOptions,
});
```

Any consumer-supplied `lifecycle.hasPlugin` silently replaces the registry-backed check. Worse, `lifecycle: { hasPlugin: undefined }` (legal TypeScript with default compiler options, trivial in untyped JS) spreads the key with value `undefined`, and `createLifecycleManager` then falls back to `options.hasPlugin ?? (() => true)` — every `requires.plugins` guard passes vacuously, and dapps mount without their required plugins. The pre-restructure `ShellConfig` only exposed the three loaders, so this enforcement was previously un-overridable from shell config. The `lifecycle` field's doc comment ("loaders, timeout, cacheTemplates, sanitizeTemplate") does not even acknowledge `hasPlugin` is accepted.
**Fix:** Exclude `hasPlugin` from the shell-facing type and make the spread order defensive:

```ts
// src/types/shell.ts
lifecycle?: Omit<LifecycleManagerOptions, 'hasPlugin'>;

// src/shell.ts — shell wiring wins regardless of what leaks through in untyped JS
const lifecycle = createLifecycleManager(events, {
  ...lifecycleOptions,
  hasPlugin: (name: string) => registry.has(name),
});
```

### WR-02: `sanitizeTemplate` has no hang guard — a never-settling sanitizer permanently wedges the dapp with zero diagnostics

**File:** `src/lifecycle.ts:288`, `src/shell.ts:295,306-312`
**Issue:** This phase's D-03 design gives every loader (script/style/template) a timeout precisely to eliminate silent hangs, but the new `await sanitizeTemplate(html, manifest)` is an unguarded await on arbitrary consumer code. If an async sanitizer never settles (e.g. a dynamically-imported DOMPurify that stalls on a dead IPFS gateway — exactly the async use case the D-01 comment advertises), `lifecycle.mount()` never resolves. In `shell.mountDapp`, `pendingMountId = manifest.id` is set before the await and only cleared in `finally` — which never runs — so *every future navigation to that dapp is silently dropped* by the `pendingMountId === manifest.id` guard, and no `dx:error` or `dx:route:changed` is ever emitted. This directly violates the milestone's "failures are visible, never silent" core value.
**Fix:** Wrap the sanitizer call with the same timeout discipline as the loaders:

```ts
const sanitizeTemplate = options.sanitizeTemplate
  ? withTimeout2(options.sanitizeTemplate, timeoutMs, 'sanitize') // 2-arg variant of withTimeout
  : undefined;
```

(or generalize `withTimeout` to `(...args) => Promise<R>`). The timeout rejection then flows into the existing `lifecycle:<id>:sanitize` fail-closed path.

### WR-03: Async sanitizer widens the unguarded cross-dapp mount race — stale sanitized HTML can clobber a newer dapp's DOM

**File:** `src/lifecycle.ts:286-298` (also `src/shell.ts:279-313`)
**Issue:** Pre-existing race, materially widened by this phase. `pendingMountId` only dedupes concurrent mounts of the *same* dapp; nothing prevents `lifecycle.mount(B)` from running while `lifecycle.mount(A)` is suspended. The sanitizer adds a new arbitrary-duration await *immediately before* `container.innerHTML = ...` with no staleness check after it resolves. Sequence: navigate to A → A's slow async sanitizer suspends → user navigates to B → B mounts fully (template injected, `currentDappId = 'b'`, `dx:mount` emitted) → A's sanitizer resolves → `container.innerHTML = sanitizedA` overwrites B's live DOM, then A's dependency/entry scripts load and `currentDappId` flips to `'a'` while the router says `/b`. In a phase whose purpose is controlling what HTML reaches the mount container, an unversioned write-after-await is a gap.
**Fix:** Capture a mount epoch before the await and bail if superseded:

```ts
const mountToken = ++mountEpoch;           // module of createLifecycleManager closure
const sanitized = await sanitizeTemplate(html, manifest);
if (mountToken !== mountEpoch) return;     // a newer mount started — drop stale HTML
container.innerHTML = sanitized;
```

Apply the same check after each subsequent `await loadScript(...)` for full coverage.

### WR-04: Wallet `connect()` failure leaves `activeProvider`/`activeUnsub` set — new auto-reconnect path surfaces the inconsistency

**File:** `plugins/wallet/src/index.ts:309-317` (exercised by the 03-02 reconnect path at `260-276`)
**Issue:** In `connect()`, `activeProvider = provider` and `activeUnsub = provider.onStateChange(...)` are assigned *before* `await provider.connect()`. If `connect()` rejects (user dismisses the MetaMask prompt — the common case for the new auto-reconnect flow), neither is rolled back. After the phase-added `init()` reconnect catch emits `plugin:wallet:reconnect` and clears the persisted key, the wallet is left half-wired: `getActiveProvider()` returns a provider that never connected (contradicting `getState().connected === false`), and the coordinator's state-change subscription to the failed provider stays live, so a later provider-side state emission fires wallet events for a connection the coordinator considers failed. The WR-03 regression test asserts `getState().connected` but never asserts `getActiveProvider()` is null — which would currently fail.
**Fix:** Roll back on failure:

```ts
activeUnsub = provider.onStateChange((s) => updateState(s));
try {
  await provider.connect();
} catch (err) {
  activeUnsub();
  activeUnsub = null;
  activeProvider = null;
  throw err;
}
```

### WR-05: “True abort (D-06)” comment overstates script timeout guarantees — a timed-out dapp entry script can still execute later

**File:** `src/lifecycle.ts:92-101` (same pattern at `132-141`)
**Issue:** Pre-existing (outside this phase's diff, but load-bearing for the file's security posture). The timeout handler nulls `onload`/`onerror` and calls `script.remove()`, and the comment claims a true abort. Nulling the handlers does prevent late promise settlement, but removing a dynamically-inserted `<script type="module">` from the DOM does not reliably cancel an in-flight fetch or its evaluation across browsers — the module can still download and *execute* after the mount was aborted. A timed-out dapp entry script may therefore run its side effects (register `dx:*` listeners, mutate `#dx-mount`, call `window.__DXKIT__` APIs) into a shell state where its mount was declared failed — or into the *next* dapp's mount. The `loaded` Set is also never updated for the timed-out src, so a retry injects a second `<script>` for the same URL, potentially double-executing the module's side effects if the first eventually ran.
**Fix:** At minimum, correct the comment to state that only promise settlement is guarded and late execution is possible (matching the honesty of the D-07 comment for opaque loaders). Substantive hardening: track an abort epoch and have `dx:mount` emission remain the only activation signal dapps act on (document that entry scripts must not self-execute side effects before `dx:mount`), since script execution itself cannot be cancelled.

## Info

### IN-01: Sanitizer return value is not validated — DOMPurify `RETURN_DOM` misuse fails open to garbage injection

**File:** `src/lifecycle.ts:288`
**Issue:** `container.innerHTML = await sanitizeTemplate(...)` trusts the return to be a string. Untyped JS/IIFE consumers (a first-class target) hitting the classic DOMPurify footgun — `DOMPurify.sanitize(html, { RETURN_DOM: true })` returns a Node — get `"[object HTMLBodyElement]"` injected with no error; a sanitizer returning `undefined` injects the literal string `"undefined"`. Neither is dangerous, but both are silent breakage.
**Fix:** `if (typeof sanitized !== 'string') throw new Error('sanitizeTemplate must return a string');` inside the existing try — it then rides the fail-closed `lifecycle:<id>:sanitize` path.

### IN-02: `storageKey: ''` is accepted and used verbatim

**File:** `plugins/wallet/src/index.ts:163`
**Issue:** `options.storageKey ?? 'dxkit:wallet'` only defaults on nullish, so an empty string becomes the actual localStorage key. Works mechanically but is almost certainly a caller bug and defeats the SEC-02 isolation intent.
**Fix:** `const storageKey = options.storageKey || 'dxkit:wallet';` or throw on empty string.

### IN-03: Connected-with-null-address state transitions emit no wallet event at all

**File:** `plugins/wallet/src/index.ts:217-224`
**Issue:** The 03-02 change (correctly) removed the `address!` assertions, but the new guards mean a provider emitting `{ connected: true, address: null }` produces *no* `connected`/`changed`/`disconnected` event — direct `onStateChange` handlers see the state but event-bus consumers silently miss the transition. A malformed provider state is swallowed rather than surfaced, at odds with the "failures visible" posture.
**Fix:** Emit `dx:error` (source `plugin:wallet:state`) when `newState.connected && !newState.address`, so the malformed provider state is visible.

### IN-04: `removeEventListener` called with the wrong function reference in shell tests — listeners leak across tests

**File:** `tests/shell.test.ts:60-64` (also unremoved `dx:error` listeners at `119-121`, `339-341`, `353-356`)
**Issue:** Test reliability. An anonymous wrapper is added (`window.addEventListener('dx:plugin:registered', (e) => { handler(...) })`) but removal passes `handler`, which is a silent no-op — the wrapper stays subscribed for the rest of the file. Several `dx:error` listeners are never removed at all. Today the leaked closures capture per-test arrays/spies so assertions don't cross-contaminate, but any future test asserting call counts on these window events inherits stale listeners — a latent flakiness source.
**Fix:** Keep a reference to the actual wrapper and remove it, or register cleanup in `afterEach`/via `beforeEach` return callback as `tests/lifecycle.test.ts` does.

---

_Reviewed: 2026-07-12T23:18:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

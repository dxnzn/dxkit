---
phase: 02-robustness-load-guards-caching-handler-cleanup
reviewed: 2026-07-11T23:55:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - plugins/settings/src/index.ts
  - plugins/settings/tests/settings.test.ts
  - src/lifecycle.ts
  - src/router.ts
  - tests/lifecycle.test.ts
  - tests/router.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-11T23:55:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the four ROB-0x changes: load-timeout abort machinery in `src/lifecycle.ts` (ROB-01/D-03/D-06/D-07), the construction-time router sort hoist in `src/router.ts` (ROB-02/D-08), settings handler cleanup on dapp disable in `plugins/settings/src/index.ts` (ROB-04), and template URL caching in `src/lifecycle.ts` (D-11/D-12). `tsc --noEmit`, `biome check`, and the full test files for all three source modules pass (84/84).

The router sort-hoist is correct and well-tested — the snapshot-at-construction semantics match the immutability contract and the regression tests genuinely exercise the "mutate original array after construction" edge case. The template cache correctly caches only successful fetches and is keyed verbatim by the manifest URL, matching its own tests.

Two real defects were found in the new code, both narrow in blast radius but genuine:

1. `withTimeout()` in `src/lifecycle.ts` never clears its internal `setTimeout` when the wrapped custom loader wins the race — a real, currently-undetected timer leak that the two default loaders (which the same commit hardens) explicitly avoid.
2. The new `cleanup()` function in `plugins/settings/src/index.ts` uses raw string-prefix matching over a colon-joined composite key. If any dapp id is itself a prefix of another dapp id followed by a colon (e.g. `foo` and `foo:bar`), disabling the shorter-named dapp silently deletes the unrelated dapp's setting-change handlers too.

Neither is exercised by the existing test suite (the sort-hoist and cache tests are solid; the timeout and cleanup tests only cover the happy paths of each new feature, not their own edge cases).

## Warnings

### WR-01: `withTimeout()` leaks a `setTimeout` handle on every settled custom-loader call

**File:** `src/lifecycle.ts:28-44`
**Issue:** When a caller supplies a custom `scriptLoader`, `styleLoader`, or `templateLoader`, `createLifecycleManager` wraps it with `withTimeout()`. That wrapper builds `Promise.race([loader(arg), new Promise((_, reject) => setTimeout(...))])` but never captures or clears the `setTimeout` id once the race settles. If `loader(arg)` resolves/rejects before the timeout fires (the common, non-timeout case — e.g. every test in `tests/lifecycle.test.ts` that passes `scriptLoader: noopLoader` or a tracking loader), the timer keeps running for the full `timeoutMs` (default 30000ms) and only then fires a no-op rejection into an already-settled `Promise.race` result.

This is a direct regression in discipline versus the two loaders hardened in the very same diff: `defaultScriptLoader`/`defaultStyleLoader` explicitly do `if (timer) clearTimeout(timer);` inside their `onload`/`onerror` handlers, and `defaultTemplateLoader` clears its timer in a `finally` block. Only the opaque-custom-loader path (`withTimeout`) omits the equivalent cleanup.

Functionally this doesn't cause incorrect mounts (the stray rejection has no observer once `Promise.race` has already settled), but in a long-lived SPA session where a user navigates between many dapps that each supply a custom loader (or where the shell wraps its own default loaders with a custom instrumentation loader), this leaves one dangling ~30s timer per load per navigation for the life of the tab.

**Fix:**
```ts
function withTimeout<R>(
  loader: (arg: string) => Promise<R>,
  timeoutMs: number,
  label: string,
): (arg: string) => Promise<R> {
  if (!isTimeoutActive(timeoutMs)) return loader;

  return (arg: string) =>
    new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out loading dapp ${label} after ${timeoutMs}ms: ${arg}`));
      }, timeoutMs);

      loader(arg).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
}
```

### WR-02: `cleanup()` can delete an unrelated dapp's handlers if one dapp id is a colon-prefix of another

**File:** `plugins/settings/src/index.ts:141-147`
**Issue:** `cleanup(dappId)` removes every `keyHandlers` entry whose key `startsWith(\`${dappId}:\`)`. Keys are built elsewhere as `\`${dappId}:${key}\`` (see `onChange` at line 215). `DappManifest.id` is typed as a bare `string` with no charset restriction (`src/types/manifest.ts:5`, doc comment only says "Unique slug, e.g. 'token-sender'" — not enforced anywhere in this codebase).

If a dapp id happens to be a string-prefix of another dapp id up to a colon boundary — concretely: dapp `foo` and dapp `foo:bar` both registered, each with settings — then disabling `foo` computes `prefix = 'foo:'`, and `'foo:bar:someKey'.startsWith('foo:')` is `true`. `cleanup('foo')` will delete `foo:bar`'s own onChange handlers even though `foo:bar` was never disabled and is a completely unrelated, still-enabled dapp. The `dappHandlers.delete(dappId)` call is exact-match and unaffected, but `keyHandlers` (the per-key subscriptions) silently lose entries for the wrong dapp.

This is a narrow edge case (it requires a dapp id containing a literal `:`), but it is a real, silent correctness bug with no diagnostic — a dapp's settings UI would simply stop reacting to changes with no error emitted, which cuts directly against this milestone's stated goal ("failures are visible, never silent").

**Fix:** Use a delimiter that cannot legally appear in a `dappId`/`key` pair, or better, avoid string-concatenated composite keys entirely and use a nested map so prefix matching isn't string-based:
```ts
// keyHandlers: Map<string, Map<string, Set<(value: unknown) => void>>>  // dappId -> key -> handlers
function cleanup(dappId: string): void {
  keyHandlers.delete(dappId);
  dappHandlers.delete(dappId);
}
```
This also removes the O(n) full-key-scan on every disable, though that's a secondary benefit (out of scope per performance exclusion).

## Info

### IN-01: Near-duplicate timeout/cleanup blocks in `defaultScriptLoader` and `defaultStyleLoader`

**File:** `src/lifecycle.ts:47-124`
**Issue:** `defaultScriptLoader` and `defaultStyleLoader` are structurally identical (create element, wire `onload`/`onerror` with `clearTimeout`, append, conditionally arm a timeout that nulls handlers and removes the node). The only differences are the tag name (`script` vs `link`), the attribute set (`type`/`src` vs `rel`/`href`), and the error-message noun. This duplication was doubled by this diff (each loader gained its own copy of the timer-arm/disarm logic).
**Fix:** Extract a shared `createElementLoader(timeoutMs, { createElement, errorNoun })` helper that both `defaultScriptLoader` and `defaultStyleLoader` call, parameterized by a small `(loaded, el) => void` setup callback. Not urgent, but worth doing before a third asset type is added with the same pattern.

---

_Reviewed: 2026-07-11T23:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

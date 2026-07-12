---
phase: 02-robustness-load-guards-caching-handler-cleanup
fixed_at: 2026-07-12T05:07:29Z
review_path: .planning/phases/02-robustness-load-guards-caching-handler-cleanup/02-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-07-12T05:07:29Z
**Source review:** .planning/phases/02-robustness-load-guards-caching-handler-cleanup/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (WR-01, WR-02 — no Critical findings; IN-01 excluded, `fix_scope: critical_warning`)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `withTimeout()` leaks a `setTimeout` handle on every settled custom-loader call

**Files modified:** `src/lifecycle.ts`, `tests/lifecycle.test.ts`
**Commit:** `b17b407`
**Applied fix:** Replaced the bare `Promise.race([loader(arg), timeoutPromise])` in `withTimeout()` with a manual `resolve`/`reject` wrapper that captures the `setTimeout` handle and calls `clearTimeout(timer)` on both the resolved and rejected branches of `loader(arg).then(...)`. This matches the clear-on-settle discipline already used by `defaultScriptLoader`, `defaultStyleLoader`, and `defaultTemplateLoader` in the same file. Updated the function's docstring to describe the settle-then-clear behavior instead of the now-inaccurate "Promise.race hang guard" phrasing. Added a fake-timer regression test (`custom loader that settles before its timeout clears the pending timer (WR-01 regression)`) asserting `vi.getTimerCount()` is `0` after a fast custom loader resolves — this test fails against the pre-fix code (timer count would be 1) and passes against the fix.

### WR-02: `cleanup()` can delete an unrelated dapp's handlers if one dapp id is a colon-prefix of another

**Files modified:** `plugins/settings/src/index.ts`, `plugins/settings/tests/settings.test.ts`
**Commit:** `2868510`
**Applied fix:** Replaced the colon-joined composite-key `keyHandlers: Map<string, Set<handler>>` (keyed `` `${dappId}:${key}` `` and pruned via `startsWith(\`${dappId}:\`)`) with a nested `Map<string, Map<string, Set<handler>>>` (`dappId -> key -> handlers`), per the REVIEW.md fix suggestion. `cleanup(dappId)` is now an exact-match `keyHandlers.delete(dappId)` with no prefix scanning, eliminating the collision surface entirely (and the O(n) full-key scan on every disable, a secondary benefit noted in the review). Updated `set()` and `onChange()` call sites to the two-level lookup/insert. Added a regression test registering sibling dapp ids `foo` and `foo:bar`, disabling `foo`, and asserting `foo:bar`'s `onChange` handler still fires — this test fails against the pre-fix prefix-matching code and passes against the fix.

## Verification

- `npx tsc --noEmit` on both modified source files: no errors.
- `npx biome check` on all 4 modified files: clean, no fixes needed.
- Targeted test run (`vitest run tests/lifecycle.test.ts plugins/settings/tests/settings.test.ts`): 71/71 passed, including the 2 new regression tests.
- Full suite (`make test` — lint + `vitest run` across all packages): 269/269 passed.

No findings were classified as logic-error-requiring-human-verification; both fixes are mechanical (timer cleanup discipline, exact-match map keying) and are exercised by targeted regression tests that fail on the pre-fix code.

---

_Fixed: 2026-07-12T05:07:29Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

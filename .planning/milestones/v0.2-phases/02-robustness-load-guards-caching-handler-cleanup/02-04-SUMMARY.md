---
phase: 02-robustness-load-guards-caching-handler-cleanup
plan: 04
subsystem: infra
tags: [lifecycle, cache, fetch, vitest]

# Dependency graph
requires:
  - phase: 02-robustness-load-guards-caching-handler-cleanup
    provides: "02-01's timeout-wrapped loadTemplate loader seam in createLifecycleManager, which this plan's cache wraps outermost"
provides:
  - "LifecycleManagerOptions.cacheTemplates — optional boolean, default true, disables template caching for dev/live-editing"
  - "LifecycleManager.clearTemplateCache() — wipes the entire per-manager template cache"
  - "LifecycleManager.invalidateTemplate(url) — drops a single cached template by URL"
  - "Closure-held Map<string, string> template cache in createLifecycleManager, wrapping the timeout-wrapped loadTemplate outermost"
affects: [04-hardening-tests, 05-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cache wraps outermost at the loader seam — a hit returns before the timeout-wrapped loader is ever invoked, so no timeout applies to a cached re-mount"
    - "Closure-held Map/Set per manager instance (no module-level singleton), same shape as the existing loaded-Set dedupe in defaultScriptLoader/defaultStyleLoader"

key-files:
  created: []
  modified:
    - src/lifecycle.ts
    - tests/lifecycle.test.ts

key-decisions:
  - "cacheTemplates defaults to true — safe for the content-addressed/immutable IPFS/static deployment target (D-09)"
  - "Cache keyed by the manifest template URL verbatim, no normalization"
  - "Only a successfully-resolved loadTemplate promise is cached; failures/timeouts reject through uncached (D-12)"
  - "clearTemplateCache()/invalidateTemplate(url) give full-reset and single-URL invalidation (D-10)"
  - "Cache is per-createLifecycleManager-instance closure state, not a module-level singleton (D-11)"

patterns-established:
  - "loadTemplate(url) wrapper function sits between the raw loadTemplateUncached (timeout-wrapped) loader and mount() — cache-check, delegate-on-miss, cache-on-success"

requirements-completed: [ROB-03]

coverage:
  - id: D1
    description: "Repeated mounts of the same dapp reuse a template cached by URL rather than re-fetching it"
    requirement: "ROB-03"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#template cache > reuses a cached template across repeated mounts of the same URL — the loader is called once"
        status: pass
    human_judgment: false
  - id: D2
    description: "clearTemplateCache() wipes all cached templates, forcing every subsequent mount to refetch"
    requirement: "ROB-03"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#template cache > clearTemplateCache() forces a refetch on the next mount"
        status: pass
    human_judgment: false
  - id: D3
    description: "invalidateTemplate(url) drops only the named URL from the cache, leaving other cached templates untouched"
    requirement: "ROB-03"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#template cache > invalidateTemplate(url) forces a refetch of only that URL — other cached templates are unaffected"
        status: pass
    human_judgment: false
  - id: D4
    description: "A failed/timed-out template fetch is never cached — a subsequent mount retries the fetch"
    requirement: "ROB-03"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#template cache > does not cache a failed template fetch — a subsequent mount calls the loader again"
        status: pass
    human_judgment: false
  - id: D5
    description: "cacheTemplates: false opts a manager instance out of caching entirely — every mount refetches"
    requirement: "ROB-03"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#template cache > cacheTemplates: false disables caching — every mount refetches the template"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-11
status: complete
---

# Phase 2 Plan 4: Lifecycle Template Cache Summary

**Per-manager `Map<url, html>` template cache wrapping the timeout-wrapped `loadTemplate` loader outermost, on by default, with `clearTemplateCache()`/`invalidateTemplate(url)` invalidation and a `cacheTemplates: false` opt-out.**

## Performance

- **Duration:** 4 min (23:44:25 → 23:45:04, plus prior read/plan time)
- **Started:** 2026-07-11T23:44:25-05:00 (first task commit)
- **Completed:** 2026-07-11T23:45:04-05:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `clearTemplateCache(): void` and `invalidateTemplate(url: string): void` to the `LifecycleManager` interface, matching the existing no-arg/single-primitive-arg, `void`-return method style of `unmount`/`getCurrentDapp`/`destroy`.
- Added `cacheTemplates?: boolean` to `LifecycleManagerOptions` (default `true`), documented as the dev/live-editing opt-out.
- In `createLifecycleManager`, renamed the existing timeout-wrapped template loader to `loadTemplateUncached` and introduced a new `loadTemplate(url)` wrapper that checks a closure-held `Map<string, string>` first: a hit returns immediately (never touching the fetch or its timeout, D-12); a miss awaits `loadTemplateUncached(url)` and, only on success, caches the result before returning it. When `cacheEnabled` is `false`, `loadTemplate` delegates straight through with no read or write.
- The cache is keyed by the manifest `template` URL exactly as given (no normalization), matches the existing `loaded`-Set dedupe shape used by `defaultScriptLoader`/`defaultStyleLoader`, and lives entirely in the `createLifecycleManager` closure — no module-level singleton (D-11).
- Both new methods (`clearTemplateCache`, `invalidateTemplate`) are returned from the manager object alongside `mount`/`unmount`/`getCurrentDapp`/`destroy`.
- Added a `describe('template cache')` block to `tests/lifecycle.test.ts` covering all five required behaviors: cache-hit (loader called once across two mounts), `clearTemplateCache()` forcing a refetch, `invalidateTemplate(url)` refetching only the named URL while a sibling URL stays cached, no-cache-on-failure (a rejecting loader is retried on the next mount), and the `cacheTemplates: false` opt-out (every mount refetches).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add per-manager template cache + invalidation API** - `adbc48f` (feat)
2. **Task 2: Tests for template caching, invalidation, and opt-out** - `028a7b7` (test)

**Plan metadata:** (pending — see final commit below)

_Note: Task 2 was tagged `tdd="true"`, but as with 02-01's precedent, the plan's own task ordering places full implementation (Task 1) before the test suite (Task 2), with Task 2's acceptance criteria expecting tests against already-implemented behavior rather than a strict RED/GREEN split. This SUMMARY follows the plan as written — see "Deviations" for the explicit call-out._

## Files Created/Modified
- `src/lifecycle.ts` - `LifecycleManager.clearTemplateCache()`/`invalidateTemplate(url)`, `LifecycleManagerOptions.cacheTemplates`, closure-held `templateCache` Map, and the `loadTemplate` cache-wrapper function sitting above `loadTemplateUncached`
- `tests/lifecycle.test.ts` - new `describe('template cache')` block covering all 5 behaviors from the plan

## Decisions Made
- Followed the plan's decision set (D-09 through D-12) exactly as documented in `02-CONTEXT.md` — no new architectural decisions were needed during implementation.
- Named the raw timeout-wrapped loader `loadTemplateUncached` and the cache-wrapping function `loadTemplate` (matching the existing local variable name `mount()` already calls), so the cache seam is a pure wrapper with no change to `mount()`'s call site.
- Used `cached !== undefined` (rather than `.has()`) as the cache-hit check since the cached value type is always a `string`, keeping the check a single `Map.get()` call.

## Deviations from Plan

**1. [Clarification, not a Rule 1-4 deviation] Task 2 executed as "tests against already-implemented code" rather than strict TDD RED/GREEN**
- **Found during:** Task 2
- **Context:** Task 2 carries `tdd="true"`, but the plan's own task sequencing has Task 1 fully implement the cache before Task 2 writes tests, and Task 2's acceptance criteria expects passing tests locking in already-shipped behavior (matching 02-01's identical precedent for the same file).
- **Action:** Followed the plan's explicit task/commit structure as written — one `test(lifecycle):` commit for Task 2 containing the new cache test suite.
- **Files modified:** tests/lifecycle.test.ts
- **Committed in:** `028a7b7`

---

**Total deviations:** 1 clarification (no rule triggered).
**Impact on plan:** None on scope or behavior — process/authoring note only, not a functional change to what shipped.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ROB-03 (lifecycle template cache) is fully shipped: `src/lifecycle.ts` exports `cacheTemplates`, `clearTemplateCache()`, and `invalidateTemplate(url)`, and `tests/lifecycle.test.ts` proves every documented behavior.
- Full test suite (`pnpm exec vitest run`) passes at 267/267 tests; `pnpm run lint` is clean.
- This was the last plan in Phase 02 (robustness-load-guards-caching-handler-cleanup) — all four ROB-0x plans (timeout, router sort cache, handler cleanup, template cache) are complete. Phase 02 is ready to close out.

---
*Phase: 02-robustness-load-guards-caching-handler-cleanup*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: src/lifecycle.ts
- FOUND: tests/lifecycle.test.ts
- FOUND commit: adbc48f
- FOUND commit: 028a7b7

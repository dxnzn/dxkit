---
phase: 04-testing-stress-edge-case-regression-coverage
plan: 02
subsystem: testing
tags: [manifest-validation, routing, dx-error, vitest, no-silent-failures]

# Dependency graph
requires:
  - phase: 04-01
    provides: mount-generation guard (last-navigation-wins), invalidatePendingMount hook
provides:
  - "Shell-owned normalizeAndValidateManifests() choke point: route normalization + reject-unfixable (D-06), tier-uniform isValidManifest (D-07), duplicate-route dx:error (D-08)"
  - "WR-01 fix: loadDappManifest emits dx:error on non-2xx response and on catch (network throw / JSON parse failure), wrapping the caught error with cause"
  - "Router-level regression test locking exact-duplicate-route first-registered-wins resolution"
affects: [05-docs-truth-pass]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single choke-point manifest post-processing: normalizeAndValidateManifests() runs once in init() after loadManifests(), not per rebuildRouter() — enable/disable never re-runs it"
    - "dx:error emit-and-continue for manifest-list problems: discard/flag + emit, never throw out of init()"

key-files:
  created: []
  modified:
    - src/shell.ts
    - tests/shell.test.ts
    - tests/router.test.ts

key-decisions:
  - "normalizeAndValidateManifests() runs once per shell lifetime in init(), right after loadManifests() resolves and before initEnabledState()/createRouter() — matches RESEARCH.md's shape-2 recommendation and keeps router.ts free of an EventBus dependency"
  - "Reject-unfixable boundary: route.trim() === '' (empty or whitespace-only) — anything else normalizes successfully via the leading-slash/trailing-slash subset of router.ts's normalizePath"
  - "shell:route is a new dx:error source for the reject-unfixable path; WR-01 and duplicate-route emits reuse shell:manifest (per RESEARCH.md Open Question 1 recommendation)"
  - "Duplicate-route manifests are kept in the list (not discarded) — first-registered-wins resolution is already guaranteed by router.ts's stable construction-time sort; only the collision itself is surfaced via dx:error naming both ids"
  - "loadDappManifest's existing per-entry isValidManifest check is left in place (gives 'from {url}' context); normalizeAndValidateManifests re-validates uniformly across all three tiers, which is redundant-but-harmless for the dapp-entries tier and closes the gap for inline/registry.json tiers"
  - "BREAKING CHANGE footer placed on the Task 1 commit: inline/registry.json manifests missing required fields are now discarded with dx:error instead of silently accepted unvalidated"

requirements-completed: [TEST-02]

coverage:
  - id: D1
    description: "Route normalization (D-06): manifest route 'blog' resolves at '/blog' after normalization"
    requirement: TEST-02
    verification:
      - kind: integration
        ref: "tests/shell.test.ts#normalizes a route missing a leading slash so it becomes reachable"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reject-unfixable (D-06): empty/whitespace-only route discarded with shell:route dx:error"
    requirement: TEST-02
    verification:
      - kind: integration
        ref: "tests/shell.test.ts#discards a manifest with an empty/whitespace-only route and emits a shell:route dx:error"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tier-uniform validation (D-07): inline and registry.json tiers now validate identically to dapp-entries tier"
    requirement: TEST-02
    verification:
      - kind: integration
        ref: "tests/shell.test.ts#discards an invalid inline manifest and emits a shell:manifest dx:error (tier parity)"
        status: pass
      - kind: integration
        ref: "tests/shell.test.ts#discards an invalid registry.json manifest and emits a shell:manifest dx:error (tier parity)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Duplicate-route detection (D-08): dx:error naming both conflicting ids; first-registered manifest wins at mount; router-level resolution locked in both insertion orders"
    requirement: TEST-02
    verification:
      - kind: integration
        ref: "tests/shell.test.ts#emits a shell:manifest dx:error naming both ids on duplicate exact routes; first-registered wins at mount"
        status: pass
      - kind: unit
        ref: "tests/router.test.ts#duplicate exact routes > resolve() returns the first-registered manifest when two share an identical exact route"
        status: pass
      - kind: unit
        ref: "tests/router.test.ts#duplicate exact routes > resolve() still returns the first-registered manifest when input order is reversed"
        status: pass
    human_judgment: false
  - id: D5
    description: "WR-01: loadDappManifest emits dx:error on non-2xx response, network-throw, and JSON-parse-failure instead of silently returning null"
    requirement: TEST-02
    verification:
      - kind: integration
        ref: "tests/shell.test.ts#skips dapps with failed manifest fetch and emits a dx:error (WR-01)"
        status: pass
      - kind: integration
        ref: "tests/shell.test.ts#emits a dx:error when the manifest fetch itself rejects (WR-01 network-throw mode)"
        status: pass
      - kind: integration
        ref: "tests/shell.test.ts#emits a dx:error when manifest fetch resolves but JSON parsing throws (WR-01 parse-failure mode)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-07-13
status: complete
---

# Phase 4 Plan 2: Manifest & Route Validation Hardening Summary

**Shell-owned normalize+validate+dedupe choke point closes route-normalization, tier-parity, duplicate-route, and WR-01 silent-swallow gaps, with full regression coverage in shell.test.ts and router.test.ts.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-13T19:38:00Z (approx.)
- **Completed:** 2026-07-13T19:40:51Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `src/shell.ts` gained `normalizeAndValidateManifests()` — a single choke point run once in `init()` after `loadManifests()` resolves, closing D-06 (route normalization + reject-unfixable), D-07 (tier-uniform `isValidManifest`), and D-08 (duplicate-route `dx:error` visibility) in one pass.
- `loadDappManifest`'s WR-01 silent swallow is closed: both the `!res.ok` early-return and the `catch` block now emit `dx:error` (source `shell:manifest`), the catch wrapping the caught error with `cause` and a message covering both network-throw and JSON-parse-failure modes.
- `tests/router.test.ts` locks the pure-resolution half of D-08 (exact-duplicate routes resolve first-registered-wins, in both insertion orders) — no `router.ts` code change was needed; this is a direct consequence of `Array.prototype.sort`'s stability guarantee already exploited by the construction-time length-sort.
- `tests/shell.test.ts` gained a new `manifest & route validation (D-06/D-07/D-08)` describe block plus updated/added WR-01 cases; the pre-existing `skips dapps with failed manifest fetch` test's assertion was changed (not just supplemented) to also require a `dx:error`.
- Full suite ships green: 308 tests across 12 files, `make test` (lint + vitest) passes with no `test.fails`/`.skip`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shell-owned manifest normalize + validate + dedupe + WR-01 emits (src/shell.ts)** - `b3d0e8c` (feat)
2. **Task 2: Router-level multi-match + exact-duplicate resolution tests (tests/router.test.ts)** - `44aeb20` (test)
3. **Task 3: Shell-level normalization / reject / tier-parity / duplicate / WR-01 tests (tests/shell.test.ts)** - `f02fdd7` (test)

_No TDD tasks in this plan — all three are `type="auto"`._

## Files Created/Modified
- `src/shell.ts` - New `normalizeAndValidateManifests()` + `normalizeRoute()` helpers wired into `init()`; WR-01 emits added to `loadDappManifest`'s `!res.ok` branch and `catch` block
- `tests/router.test.ts` - New `duplicate exact routes` describe block (2 tests) locking first-registered-wins resolution in both insertion orders
- `tests/shell.test.ts` - New `manifest & route validation (D-06/D-07/D-08)` describe block (5 tests: normalization, reject-unfixable, inline tier-parity, registry.json tier-parity, duplicate-route); WR-01 anchor test assertion updated + 2 new sibling WR-01 cases (network-throw, JSON-parse-failure)

## Decisions Made
- `normalizeAndValidateManifests()` runs once per shell lifetime in `init()`, immediately after `loadManifests()` resolves and before `initEnabledState()`/`createRouter()` — matches RESEARCH.md's shape-2 recommendation (shell-owned, keeps `router.ts` free of an `EventBus` dependency) and is correct because enable/disable never changes the manifest list, only which subset is active.
- Reject-unfixable boundary: `route.trim() === ''` (empty or whitespace-only) is the only unfixable case; every other non-empty string normalizes successfully via the leading-slash/trailing-slash subset of `router.ts`'s `normalizePath` (basePath-stripping omitted since manifest routes are declared without a basePath prefix).
- New `shell:route` `dx:error` source for the reject-unfixable path; WR-01 and duplicate-route emits reuse the existing `shell:manifest` source, per RESEARCH.md's Open Question 1 recommendation (manifest-content conflicts vs. a distinct routing-table construction problem).
- Duplicate-route manifests are kept in the returned list, not discarded — first-registered-wins resolution is already guaranteed by `router.ts`'s stable construction-time sort (ES2019+ `Array.prototype.sort` stability); the fix's job is purely to surface the collision via `dx:error` naming both conflicting ids.
- `loadDappManifest`'s existing per-entry `isValidManifest` check was left in place (it gives useful `from {url}` context in its error message); `normalizeAndValidateManifests` re-validates uniformly across the aggregated list from all three tiers — redundant-but-harmless for the already-validated dapp-entries tier, and the actual fix for the previously-unvalidated inline and registry.json tiers.
- `BREAKING CHANGE:` footer placed on the Task 1 commit (not Tasks 2/3): tier-uniform validation means inline/registry.json manifests missing required fields are now discarded with `dx:error` instead of being silently accepted unvalidated — a genuine behavior change for any consumer relying on that gap, per the milestone's "breaking changes allowed but justified + migration-documented" constraint. Route normalization, duplicate-route, and WR-01 emits are additive (no footer).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Biome formatting flagged two lines in `tests/shell.test.ts` (long chained `.toBe(true)` calls and a multi-line arrow-function predicate) after the Task 3 edit — resolved via `make lint-fix` before the final `make test` run. Not a deviation from plan content, just a formatting pass required by the project's `npx biome check` pre-commit-adjacent gate.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST-02 fully satisfied: normalization, tier parity, duplicate-route visibility, and WR-01 fetch/parse visibility are implemented in `src/shell.ts` and locked by tests in `tests/shell.test.ts` and `tests/router.test.ts`.
- Full suite green (308 tests, 12 files) — no known-failing assertions carried forward.
- Deep-merge override semantics (D-09) were covered in plan 03 (already-existing `tests/utils.test.ts` coverage verified, per RESEARCH.md's "already largely satisfied" note) — this plan did not duplicate that work.
- Ready for phase-level `/gsd-verify-work` once the remaining phase-04 plans (if any) complete; TEST-02 requirement should be marked complete in REQUIREMENTS.md as part of this plan's metadata update (a prior executor had prematurely marked it complete and it was reverted — this plan is the actual TEST-02 completion point).

## Self-Check: PASSED

- `src/shell.ts` exists and contains `normalizeAndValidateManifests` — FOUND
- `tests/router.test.ts` contains the `duplicate exact routes` describe block — FOUND
- `tests/shell.test.ts` contains the `manifest & route validation (D-06/D-07/D-08)` describe block — FOUND
- Commit `b3d0e8c` (Task 1) — FOUND in `git log --oneline --all`
- Commit `44aeb20` (Task 2) — FOUND in `git log --oneline --all`
- Commit `f02fdd7` (Task 3) — FOUND in `git log --oneline --all`
- `git grep -n "source: 'shell:route'" src/shell.ts` returns 1 hit — CONFIRMED
- `pnpm vitest run tests/router.test.ts tests/shell.test.ts` — 74/74 tests pass
- `make test` (lint + full suite) — 308/308 tests pass, 0 lint errors

---
*Phase: 04-testing-stress-edge-case-regression-coverage*
*Completed: 2026-07-13*

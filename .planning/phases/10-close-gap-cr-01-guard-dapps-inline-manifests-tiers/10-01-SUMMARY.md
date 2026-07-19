---
phase: 10-close-gap-cr-01-guard-dapps-inline-manifests-tiers
plan: 01
subsystem: infra
tags: [shell, validation, input-validation, robustness, typescript, vitest]

# Dependency graph
requires:
  - phase: 09-continuous-debt-guardrails-registry-robustness
    provides: ROB-05's registry-tier Array.isArray() guard pattern (dx:error source shell:manifest, fail-closed to [])
provides:
  - "coerceManifestArray<T>() closure-local helper in src/shell.ts — single emission point for wrong-top-level-shape config errors"
  - "loadManifests() restructured so all three tiers (dapps/manifests/registry) share the same fail-closed array-shape guard"
  - "ROB-06 requirement (dapps/manifests tier parity with ROB-05's registry guard) satisfied and traced"
affects: [shell.ts, any future loadManifests() tier work, docs-update (events-reference.md shell:manifest catalog)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closure-local coercion helper pattern: shape-validate untyped/external input via Array.isArray() before any .map()/for...of touches it, sharing one dx:error emission point across multiple call sites"
    - "Fail-closed sentinel branching: distinguish 'wrong shape' (null) from 'valid but empty' ([]) by branching on `=== null`, never `.length`, to avoid collapsing two different states"

key-files:
  created: []
  modified:
    - src/shell.ts
    - tests/shell.test.ts

key-decisions:
  - "coerceManifestArray() is closure-local inside createShell() (not module-level) — matches the file's existing factory-closure convention (isValidManifest, normalizeRoute, normalizeAndValidateManifests all need events.emit from closure)"
  - "Fail-closed (A1): a wrong-shape dapps/manifests value returns [] immediately and does NOT fall through to the next tier — falling through would silently swap manifest sources, violating the project's 'never silent' core value"
  - "Registry tier passes a fully-formed description (\`Failed to load registry from ${registryUrl}\`) as the tierLabel so the 3 existing ROB-05 /custom-registry.json substring assertions keep passing verbatim"
  - "Tier-asymmetric fallthrough preserved deliberately: dapps: [] still falls through to the next tier; manifests: [] still stops there without probing registryUrl — only the Array.isArray shape check is new/shared, each tier's own emptiness semantics are untouched"

patterns-established:
  - "Shape-then-emptiness two-phase tier check: coerce the raw value's shape first (Array.isArray, shared), then apply the tier's own pre-existing emptiness/fallthrough rule to the coerced (guaranteed-array) value"

requirements-completed: [ROB-06]

coverage:
  - id: D1
    description: "dapps: <string> (truthy .length, no .map) emits exactly one dx:error (source shell:manifest); init() resolves without throwing; getManifests() is empty"
    requirement: "ROB-06"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#ROB-06: dapps as a truthy-length non-array (string) emits exactly one shell:manifest dx:error and does not throw"
        status: pass
    human_judgment: false
  - id: D2
    description: "dapps: <plain object> (falsy .length, non-array) fails closed — emits dx:error and does not fall through to probe registryUrl"
    requirement: "ROB-06"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#ROB-06: dapps as a falsy-length non-array (plain object) fails closed — emits dx:error and never probes the registry"
        status: pass
    human_judgment: false
  - id: D3
    description: "manifests: <plain object> (non-iterable, non-array) emits dx:error; init() resolves without throwing"
    requirement: "ROB-06"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#ROB-06: manifests as a non-iterable non-array (plain object) emits a shell:manifest dx:error and does not throw"
        status: pass
    human_judgment: false
  - id: D4
    description: "manifests: <string> (iterable-but-wrong-shape) emits exactly ONE dx:error for the top-level shape, not N per-character validation errors"
    requirement: "ROB-06"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#ROB-06: manifests as an iterable-but-wrong-shape value (string) emits exactly ONE shell:manifest dx:error, not one per character"
        status: pass
    human_judgment: false
  - id: D5
    description: "window.__DXKIT__ is still defined after init() for a wrong-shape dapps config (pre-exposure ordering preserved)"
    requirement: "ROB-06"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#ROB-06: still exposes window.__DXKIT__ after init() for a wrong-shape dapps config (pre-exposure ordering)"
        status: pass
    human_judgment: false
  - id: D6
    description: "manifests: [] (valid, empty) stops at that tier and does not trigger a fetch() to registryUrl (tier-asymmetric fallthrough preserved, closes a pre-existing coverage gap)"
    requirement: "ROB-06"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#ROB-06: manifests: [] (valid, empty) stops at that tier and does not probe registryUrl"
        status: pass
    human_judgment: false
  - id: D7
    description: "The 3 pre-existing ROB-05 registry tests keep passing — registry tier's error message still contains the /custom-registry.json substring; full suite (410 tests) green via make test (lint + typecheck + vitest)"
    requirement: "ROB-06"
    verification:
      - kind: unit
        ref: "make test (410 tests passed, 15 files)"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-07-19
status: complete
---

# Phase 10 Plan 01: Guard dapps/inline-manifests tiers Summary

**Extended ROB-05's registry-tier `Array.isArray()` guard to `loadManifests()`'s `dapps` and inline `manifests` tiers via a shared closure-local `coerceManifestArray()` helper — closes v1.1 milestone-audit CR-01.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-19T16:04:12Z
- **Completed:** 2026-07-19T16:06:06Z
- **Tasks:** 2
- **Files modified:** 2 (`src/shell.ts`, `tests/shell.test.ts`)

## Accomplishments
- Added `coerceManifestArray<T>(value, tierLabel): T[] | null` — a closure-local helper inside `createShell()` that is the single emission point for "wrong top-level shape" `dx:error` events (source `shell:manifest`) across all three `loadManifests()` tiers
- Restructured `loadManifests()` so `dapps`, inline `manifests`, and the registry-fetch tier all route through the shared helper, branching on `coerced === null` (fail-closed) rather than `.length` (which would conflate a malformed value with a valid empty array)
- Removed ROB-05's old inline `Array.isArray(parsed)` block from the registry tier — no double-emit, single source of truth for the shape guard
- Preserved the pre-existing tier-asymmetric fallthrough: `dapps: []` still falls through to try the next configured tier; `manifests: []` still stops there without probing `registryUrl`
- Added 6 new regression tests (`tests/shell.test.ts`) covering all 7 ROB-06 behaviors from the plan's `must_haves`, following TDD (RED in Task 1, GREEN in Task 2)
- `make test` green: lint (Biome), standalone typecheck (5 packages), and the full 410-test vitest suite (up from 404 pre-phase)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the failing regression suite for both new tiers, fail-closed, and the manifests:[] no-fetch gap** - `cb09506` (test)
2. **Task 2: Extract coerceManifestArray() and restructure loadManifests() so the suite goes green** - `9cb5675` (feat)

_TDD gate compliance: `test(10-01)` commit (RED) landed before `feat(10-01)` commit (GREEN) — verified via `git log --oneline`._

## Files Created/Modified
- `src/shell.ts` - Added `coerceManifestArray<T>()` closure-local helper; restructured `loadManifests()`'s three tiers to route through it with `coerced === null` fail-closed branching; removed ROB-05's inline registry `Array.isArray` check (now routed through the shared helper)
- `tests/shell.test.ts` - Added 6 new `it(...)` regression tests for ROB-06 (wrong-shape `dapps` string/object, wrong-shape `manifests` object/string, pre-exposure `window.__DXKIT__` ordering, `manifests: []` no-fetch coverage gap)

## Decisions Made
- **A1 (fail closed):** confirmed and implemented as locked — a wrong-shape `dapps`/`manifests` value returns `[]` immediately, no fallthrough to the next tier
- **A2 (ROB-06 requirement ID):** confirmed and already registered in `.planning/REQUIREMENTS.md` at plan-authoring time; this plan run marked it complete via `requirements mark-complete`
- Registry tier's `tierLabel` argument is the fully-formed description string (`Failed to load registry from ${registryUrl}`), not a bare `'registry'` label — preserves the exact substring the 3 pre-existing ROB-05 tests assert on, at the cost of a slightly awkward combined message ("Invalid Failed to load registry from ... config — expected an array..."). This tradeoff was explicit in the plan's locked decisions and research (Pitfall 1) and was not revisited.

## Deviations from Plan

None - plan executed exactly as written. All locked decisions (A1 fail-closed, A2 ROB-06 ID), all 7 `must_haves.truths`, and all `key_links` ordering/emission-point constraints were satisfied without needing any Rule 1-4 deviation.

## Issues Encountered
None. The plan's TDD task split (RED in Task 1, GREEN in Task 2) worked cleanly: 5 of the 7 new/rewritten test cases failed as predicted against the unguarded code (dapps string → uncaught TypeError; dapps object → silent tier-swap allowed by the old logic, now blocked; manifests object → "list is not iterable" TypeError; manifests string → 8 per-character errors instead of 1; pre-exposure ordering case crashed before `window.__DXKIT__` was ever set). The `manifests: []` no-fetch case passed even pre-implementation (existing behavior was already correct there — it was a coverage gap, not a bug), exactly as research predicted.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ROB-06 satisfied; v1.1 milestone-audit CR-01 gap closed. No further code changes required for this phase's scope.
- `docs/events-reference.md`'s `shell:manifest` error catalog was flagged by research as needing a doc-gate pass (new/changed wording is now shape-checked for `dapps`/`manifests` too) — owned by `/gsd-docs-update`, not this plan; noted for the phase's doc-gate step before ship.
- No blockers.

## Self-Check: PASSED

- FOUND: src/shell.ts
- FOUND: tests/shell.test.ts
- FOUND: .planning/phases/10-close-gap-cr-01-guard-dapps-inline-manifests-tiers/10-01-SUMMARY.md
- FOUND: cb09506 (test commit)
- FOUND: 9cb5675 (feat commit)

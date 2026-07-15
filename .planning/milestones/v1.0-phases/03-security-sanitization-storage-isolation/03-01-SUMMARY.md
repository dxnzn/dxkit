---
phase: 03-security-sanitization-storage-isolation
plan: 01
subsystem: security
tags: [xss, sanitization, lifecycle, dompurify, innerHTML]

# Dependency graph
requires:
  - phase: 02-robustness-caching
    provides: "loadTemplate() cache-aware fetch wrapper and the emit-and-return blocking-failure pattern in mount()"
provides:
  - "TemplateSanitizer type + sanitizeTemplate hook on LifecycleManagerOptions"
  - "Fail-closed sanitize step in mount() with distinct lifecycle:<id>:sanitize dx:error source"
  - "Sanitizer test coverage (plumbing, async, unchanged-default XSS passthrough, fail-closed, cache-raw ordering)"
affects: [03-02, docs-phase-5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bring-your-own security hook: optional field on options, no bundled implementation, undefined = pass-through unchanged"
    - "Per-stage try/catch with distinct dx:error source suffix (mirrors existing :styles/:template/:dependency stages)"

key-files:
  created: []
  modified:
    - src/lifecycle.ts
    - src/index.ts
    - tests/lifecycle.test.ts

key-decisions:
  - "TemplateSanitizer signature (html, manifest) => string | Promise<string>, captured once at construction with no ?? default — undefined means pass through unchanged (D-01)"
  - "Sanitize step lives in its own try/catch nested inside the template block, after the fetch try/catch resolves — keeps the :sanitize error source distinguishable from :template (D-08)"
  - "Sanitizer runs after loadTemplate() on every mount including cache hits; templateCache is untouched and still stores only raw HTML (D-06)"

patterns-established:
  - "Sanitize-then-inject slot pattern: fetch (own try/catch) -> optional sanitize (own try/catch) -> innerHTML assignment, only on the success path of the fetch"

requirements-completed: [SEC-01]

coverage:
  - id: D1
    description: "Configured sanitizeTemplate runs on fetched HTML with (html, manifest) and its awaited result is what reaches container.innerHTML"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#sanitizeTemplate > is called with (html, manifest) and its returned value is injected instead of the raw HTML"
        status: pass
      - kind: unit
        ref: "tests/lifecycle.test.ts#sanitizeTemplate > awaits an async sanitizeTemplate before injecting the resolved value"
        status: pass
    human_judgment: false
  - id: D2
    description: "With no sanitizeTemplate configured, template injection is byte-for-byte unchanged from 0.1.5 (XSS-shaped payload reaches innerHTML verbatim)"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#sanitizeTemplate > injects an XSS-shaped payload verbatim when no sanitizeTemplate is configured (unchanged 0.1.5 default)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A sanitizeTemplate throw or rejection aborts the mount fail-closed, emitting dx:error with source lifecycle:<id>:sanitize and never injecting the unsanitized HTML"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#sanitizeTemplate > fail-closed: a sanitizeTemplate that throws emits dx:error with source lifecycle:<id>:sanitize and does not inject"
        status: pass
      - kind: unit
        ref: "tests/lifecycle.test.ts#sanitizeTemplate > fail-closed: a sanitizeTemplate that rejects emits dx:error with source lifecycle:<id>:sanitize and does not inject"
        status: pass
    human_judgment: false
  - id: D4
    description: "The template cache stores raw fetched HTML only; sanitizeTemplate re-runs on every mount including cache hits"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#sanitizeTemplate > re-runs the sanitizer on every mount while the template cache stores only raw HTML (D-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No sanitizer library is imported; zero-runtime-deps posture preserved"
    requirement: "SEC-01"
    verification:
      - kind: other
        ref: "grep -L dompurify package.json (no match); pnpm exec tsc --noEmit clean with no new imports"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-07-12
status: complete
---

# Phase 3 Plan 1: Template Sanitizer Hook Summary

**Optional bring-your-own `sanitizeTemplate` hook on `LifecycleManagerOptions`, fail-closed on sanitizer failure, byte-for-byte unchanged when unconfigured.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-12T22:51:00Z (approx)
- **Completed:** 2026-07-12T22:59:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added the `TemplateSanitizer` type alias (`(html, manifest) => string | Promise<string>`) and the optional `sanitizeTemplate` field on `LifecycleManagerOptions`, re-exported from the public barrel (`src/index.ts`).
- Slotted the sanitize call into `mount()` in its own try/catch, between the cache-aware `loadTemplate()` fetch and the `container.innerHTML` assignment — a throw or rejection emits `dx:error` with a distinct `lifecycle:<id>:sanitize` source and aborts the mount before injecting anything.
- Left `loadTemplate`/`templateCache` untouched: the cache still stores only raw fetched HTML, and the sanitizer re-runs on every mount including cache hits.
- Added 6 tests covering plumbing (sync + async), the unchanged-default XSS-passthrough regression, fail-closed abort for both throw and rejected-Promise sanitizers, and cache-raw ordering (single `LifecycleManager`, sanitizer behavior toggled between two mounts of the same manifest, proving the cache never held sanitized output).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TemplateSanitizer type + sanitizeTemplate hook and slot it into mount()** - `b7d128f` (feat)
2. **Task 2: Sanitizer test coverage in tests/lifecycle.test.ts** - `9d2dd26` (test)

**Plan metadata:** _pending — recorded in the final metadata commit_

## Files Created/Modified
- `src/lifecycle.ts` - `TemplateSanitizer` type, `sanitizeTemplate` option on `LifecycleManagerOptions`, sanitize step slotted into `mount()`'s template block with its own try/catch and `:sanitize` error source
- `src/index.ts` - `TemplateSanitizer` added to the barrel's lifecycle type re-export
- `tests/lifecycle.test.ts` - new `describe('sanitizeTemplate', ...)` block: 6 tests (plumbing, async, unchanged-default XSS passthrough, fail-closed throw, fail-closed reject, cache-raw ordering)

## Decisions Made
- Captured `sanitizeTemplate` once at `createLifecycleManager` construction with no `??` default (undefined intentionally means "pass through unchanged"), matching the plan's D-01/D-06 guidance and the file's existing additive-option-resolution convention.
- The sanitize step is nested as its own try/catch inside the `if (manifest.template)` block, after the fetch try/catch has already resolved successfully — this keeps `:template` (fetch failure) and `:sanitize` (sanitizer failure) sources unambiguous per D-08, and avoids the Pitfall 1 trap of reusing one shared catch for two failure classes.
- The cache-raw ordering test uses a single `LifecycleManager` instance with a sanitizer function that reads a mutable outer variable to change behavior between calls — this proves cache-raw-vs-sanitize-per-mount without contradicting the "capture the hook once at construction" design (the function reference is fixed; its behavior is externally toggled), which is the correct way to test D-06 given the locked construction-time-capture decision.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SEC-01 is fully satisfied: hook plumbing, unconfigured-default parity with 0.1.5, and fail-closed abort are all implemented and test-covered.
- `pnpm exec tsc --noEmit`, `pnpm exec vitest run tests/lifecycle.test.ts` (44/44 passing), and `make lint` are all clean on the touched files.
- Ready for 03-02 (storage key isolation / remaining Phase 3 work) — no blockers.

---
*Phase: 03-security-sanitization-storage-isolation*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: src/lifecycle.ts
- FOUND: src/index.ts
- FOUND: tests/lifecycle.test.ts
- FOUND: SUMMARY.md
- FOUND commit: b7d128f
- FOUND commit: 9d2dd26
- FOUND commit: 0d4fb97

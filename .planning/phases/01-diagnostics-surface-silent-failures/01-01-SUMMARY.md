---
phase: 01-diagnostics-surface-silent-failures
plan: 01
subsystem: infra
tags: [event-bus, dx-error, lifecycle, shell, diagnostics]

# Dependency graph
requires: []
provides:
  - "dx:error (source shell:mount) emitted when #dx-mount cannot be resolved at mount time"
  - "Mount container cleared (container.innerHTML = '') on post-injection entry-script and dependency-script load failure"
affects: [01-02, phase-02-robustness-guards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Emit-then-return control flow for previously-silent no-op branches (no throw, no dedupe, D-04/D-05)"
    - "Post-injection failure catches clear container.innerHTML before returning to guarantee no stale dapp DOM (D-11/D-12)"

key-files:
  created: []
  modified:
    - src/shell.ts
    - src/lifecycle.ts
    - tests/shell.test.ts
    - tests/lifecycle.test.ts

key-decisions:
  - "Error message follows the existing shell:manifest wrapped-message convention: new Error(`Mount failed for \"${manifest.id}\" — #dx-mount container not found in the DOM`)"
  - "Container clear applied only to the two post-injection catches (dependency-loop, entry-script) — template-catch left untouched since it returns before/at injection, per D-12 scope boundary"

patterns-established:
  - "Post-injection failure catches clear container.innerHTML before returning"

requirements-completed: [DIAG-01, DIAG-03]

coverage:
  - id: D1
    description: "Navigating to a dapp with #dx-mount absent emits dx:error (source shell:mount) instead of silently no-op'ing; no throw, currentDapp stays null"
    requirement: "DIAG-01"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#emits dx:error (source shell:mount) when #dx-mount is absent, without throwing"
        status: pass
    human_judgment: false
  - id: D2
    description: "Failed entry-script load clears the mount container and still emits dx:error (source lifecycle:<id>)"
    requirement: "DIAG-03"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#clears the mount container when entry script fails after a template was injected"
        status: pass
    human_judgment: false
  - id: D3
    description: "Failed dependency-script load clears the mount container and still emits dx:error (source lifecycle:<id>:dependency)"
    requirement: "DIAG-03"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#clears the mount container when a dependency fails after a template was injected"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-11
status: complete
---

# Phase 01 Plan 01: Diagnostics — Shell Mount + Lifecycle Container Clear Summary

**Missing `#dx-mount` and post-injection load failures now surface via `dx:error` (source `shell:mount`) and clear stale template DOM instead of failing silently.**

## Performance

- **Duration:** ~4 min (commit-to-commit)
- **Started:** 2026-07-11T17:05:43-05:00
- **Completed:** 2026-07-11T17:06:37-05:00
- **Tasks:** 2 completed (both TDD: RED → GREEN)
- **Files modified:** 4

## Accomplishments
- `mountDapp()` in `src/shell.ts` now emits `dx:error` (source `shell:mount`) when `getMountContainer()` resolves to `null`, replacing the silent `if (!container) return;` no-op — mount still returns without throwing and `currentDapp` stays `null`.
- `mount()` in `src/lifecycle.ts` now clears `container.innerHTML = ''` in both post-injection catch blocks (dependency-loop and entry-script) before returning, so a failed mount never leaves a previously-injected template's stale DOM addressable. Existing `dx:error` emits (`lifecycle:<id>` and `lifecycle:<id>:dependency`) are unchanged.
- Regression tests added for both new-observable behaviors; full existing suite (238 tests across 10 files) still passes with no regressions.

## Task Commits

Each task followed the TDD RED → GREEN cycle with separate commits:

1. **Task 1: Emit dx:error when #dx-mount cannot be resolved (DIAG-01)**
   - `f0144f1` (test) — add failing test asserting `dx:error` source `shell:mount`
   - `488f04f` (feat) — implement emit-then-return in `mountDapp`
2. **Task 2: Clear mount container on post-injection load failure (DIAG-03)**
   - `7770836` (test) — add failing tests for container clear on entry/dependency failure
   - `a567a7c` (feat) — implement `container.innerHTML = ''` in both post-injection catches

_TDD gate compliance: both tasks show a `test(...)` commit (RED) immediately followed by a `feat(...)` commit (GREEN); no refactor commit was needed._

## Files Created/Modified
- `src/shell.ts` — `mountDapp()` missing-container branch now emits `dx:error` (source `shell:mount`) before returning; `getMountContainer()` lazy resolution untouched.
- `src/lifecycle.ts` — `mount()` dependency-loop and entry-script catch blocks now clear `container.innerHTML` before returning; template-catch and missing-plugin catch untouched.
- `tests/shell.test.ts` — new case: `#dx-mount` absent → `dx:error` with `source === 'shell:mount'`, no throw.
- `tests/lifecycle.test.ts` — two new cases: entry-script failure and dependency failure, each after a template injection, asserting `container.innerHTML === ''` and the existing `dx:error` source is preserved.

## Decisions Made
- Followed the plan's specified error message convention exactly (`Mount failed for "${manifest.id}" — #dx-mount container not found in the DOM`), matching the tone of the existing `shell:manifest` emit site.
- Left the template-catch in `lifecycle.ts` unmodified per D-12 — it returns at/before `container.innerHTML = html`, so no stale DOM exists there and clearing would be a no-op scope expansion.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. One commit message (`488f04f`) lost its inline backtick-quoted code fragment due to a shell command-substitution quirk when the `-m` string contained literal backticks; the resulting message is still accurate and does not affect the commit's content or correctness. Not re-committed per the "never amend" rule.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- DIAG-01 and DIAG-03 are complete; the `dx:error` payload shape is unchanged (`{ source, error }`), so no consumer-facing API impact.
- Plan 01-02 (wallet/theme/settings `localStorage` diagnostics, DIAG-02) is independent of this plan's changes and can proceed without additional context from here.
- No blockers for subsequent phases.

---
*Phase: 01-diagnostics-surface-silent-failures*
*Completed: 2026-07-11*

## Self-Check: PASSED

All modified/created files and commit hashes verified present on disk and in git history.

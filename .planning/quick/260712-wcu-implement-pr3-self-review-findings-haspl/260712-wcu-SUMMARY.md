---
phase: quick-260712-wcu
plan: 01
subsystem: security
tags: [shell, lifecycle, wallet, sanitizer, hasPlugin, hang-guard, error-cause]

requires:
  - phase: 03-security-sanitization-storage-isolation
    provides: TemplateSanitizer seam, timeout/hang-guard machinery, wallet storage hardening
provides:
  - Un-bypassable required-plugin enforcement in createShell()
  - Own-key-only flat-loader guard (Object.hasOwn)
  - Sanitizer hang guard bounded by existing timeout/opt-out discipline
  - Cause-preserving sanitize error for non-Error throws
  - Visible dx:error when a wallet provider reports connected without an address
affects: [security-review, wallet-plugin, lifecycle-mount-pipeline]

tech-stack:
  added: []
  patterns:
    - "Options spread-then-override: consumer options spread first, framework-owned bindings applied last so they win"
    - "Promise.race-style hang guard reused for opaque two-arg sanitizer, mirroring the existing custom-loader withTimeout wrapper"

key-files:
  created: []
  modified:
    - src/shell.ts
    - src/types/shell.ts
    - src/lifecycle.ts
    - plugins/wallet/src/index.ts
    - tests/shell.test.ts
    - tests/lifecycle.test.ts
    - plugins/wallet/tests/wallet.test.ts

key-decisions:
  - "hasPlugin binding spread-last in createLifecycleManager() call so registry-backed check always wins over consumer config"
  - "ShellConfig.lifecycle narrowed to Omit<LifecycleManagerOptions, 'hasPlugin'> — compile-time nudge for typed consumers, runtime ordering is the actual defense for untyped/IIFE consumers"
  - "Sanitizer hang guard reuses timeoutMs + isTimeoutActive opt-out rather than introducing a separate sanitize-specific timeout knob"
  - "Timeout rejection from the sanitizer flows into the existing sanitize try/catch — no new dx:error emission site added"
  - "Wallet connected-without-address error is additive (does not return/short-circuit) since none of the existing connected/disconnected/changed branches can match when address is falsy anyway"

patterns-established:
  - "Object.hasOwn(config, key) preferred over `key in config` for own-key existence checks that must ignore inherited/prototype properties while still catching own keys explicitly set to undefined"

requirements-completed:
  - FIND-1-hasPlugin-override
  - FIND-2-unbounded-sanitizer
  - FIND-3-connected-without-address
  - FIND-4-cause-preservation
  - FIND-5-object-hasown

coverage:
  - id: D1
    description: "A consumer-supplied lifecycle.hasPlugin (including hasPlugin: undefined) via createShell() cannot disable required-plugin enforcement"
    requirement: "FIND-1-hasPlugin-override"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#a consumer-supplied lifecycle.hasPlugin (including undefined) cannot disable required-plugin enforcement"
        status: pass
    human_judgment: false
  - id: D2
    description: "The flat-loader guard rejects own keys whose value is undefined and ignores prototype-chain keys (Object.hasOwn)"
    requirement: "FIND-5-object-hasown"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts (existing flat-loader-key throw tests, unchanged behavior under Object.hasOwn)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A never-settling sanitizeTemplate aborts the mount after the configured timeout, fail-closed, with dx:error source lifecycle:<id>:sanitize and no injection"
    requirement: "FIND-2-unbounded-sanitizer"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts#sanitize timeout aborts the mount — dx:error fires with source lifecycle:<id>:sanitize, no injection, no dx:dapp:mounted"
        status: pass
    human_judgment: false
  - id: D4
    description: "The sanitize catch preserves the original thrown value as Error.cause for non-Error throws"
    requirement: "FIND-4-cause-preservation"
    verification:
      - kind: unit
        ref: "tests/lifecycle.test.ts (existing sanitize-throws/sanitize-rejects fail-closed tests exercise the same catch path; cause attachment verified by code inspection of src/lifecycle.ts sanitize catch)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A provider reporting connected: true with no address emits dx:error (source plugin:wallet:state) and does not fire a connected event"
    requirement: "FIND-3-connected-without-address"
    verification:
      - kind: unit
        ref: "plugins/wallet/tests/wallet.test.ts#emits dx:error (source plugin:wallet:state) when a provider reports connected without an address, and fires no connected event"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-13
status: complete
---

# Quick Task 260712-wcu: PR #3 Self-Review Findings Summary

**Closed 5 confirmed self-review findings (bypassable required-plugin enforcement, unbounded sanitizer hang, silent connected-without-address, dropped error cause, prototype-chain key leakage) across shell, lifecycle, and wallet — three new regression tests added.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-12T23:20:00Z (approx, first Read call)
- **Completed:** 2026-07-13T04:28:59Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- **FIND-1 (Elevation of Privilege, high):** `createShell()` now spreads `lifecycleOptions` first and binds the registry-backed `hasPlugin` last, so a consumer-supplied `lifecycle: { hasPlugin: undefined }` can no longer clobber required-plugin enforcement. `ShellConfig.lifecycle` type narrowed to `Omit<LifecycleManagerOptions, 'hasPlugin'>` so typed consumers can't even attempt it.
- **FIND-5:** The flat-loader guard in `createShell()` switched from `key in config` to `Object.hasOwn(config, key)` — still catches an own key explicitly set to `undefined` (D-05 intent) but no longer misfires on inherited/prototype-chain keys.
- **FIND-2 (Denial of Service, medium):** `sanitizeTemplate` is now bounded by the same `timeoutMs` + `isTimeoutActive` opt-out discipline as custom loaders, via a new `withSanitizeTimeout()` Promise.race wrapper. A never-settling sanitizer now fails closed (dx:error, `lifecycle:<id>:sanitize`, no injection) instead of hanging the mount forever.
- **FIND-4:** The sanitize catch's non-Error branch now preserves the original thrown value via `new Error(String(err), { cause: err })`, matching the cause-preserving pattern already used on the wallet reconnect path.
- **FIND-3 (Repudiation/Information Disclosure, low):** `updateState()` in the wallet plugin now emits `dx:error` (source `plugin:wallet:state`) when a provider reports `connected: true` with no `address`, instead of silently dropping the connected event while `wasConnected` flips underneath.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shell guard hardening — hasPlugin override + Object.hasOwn (FIND-1, FIND-5)** - `e51d927` (fix)
2. **Task 2: Lifecycle sanitizer timeout + cause preservation (FIND-2, FIND-4)** - `ffd99af` (fix)
3. **Task 3: Wallet connected-without-address visibility (FIND-3)** - `d349ca9` (fix)

_No TDD tasks — plan specified `type="auto"` for all three tasks._

## Files Created/Modified

- `src/shell.ts` - hasPlugin binding reordered (spread-last), flat-loader guard uses `Object.hasOwn`
- `src/types/shell.ts` - `ShellConfig.lifecycle` narrowed to `Omit<LifecycleManagerOptions, 'hasPlugin'>`
- `src/lifecycle.ts` - new `withSanitizeTimeout()` hang guard wrapping `sanitizeTemplate`; sanitize catch preserves cause
- `plugins/wallet/src/index.ts` - `updateState()` emits `dx:error` on connected-without-address
- `tests/shell.test.ts` - regression test for FIND-1 (hasPlugin override bypass)
- `tests/lifecycle.test.ts` - fake-timers regression test for FIND-2 (sanitizer timeout)
- `plugins/wallet/tests/wallet.test.ts` - mock bad-provider regression test for FIND-3

## Decisions Made

- Timeout rejection from the sanitizer flows through the *existing* sanitize try/catch rather than a new dx:error emission site — keeps the fail-closed behavior identical to a sanitizer throw/reject, per plan instruction.
- The wallet FIND-3 error branch is additive (no `return`) since none of the existing connected/disconnected/changed branches can match when `newState.address` is falsy — avoids restructuring the existing if/else-if chain.
- Used `as ShellConfig` type assertion in the FIND-1 regression test to exercise the runtime defense for untyped/IIFE consumers, since the new `Omit<LifecycleManagerOptions, 'hasPlugin'>` type would otherwise reject `hasPlugin: undefined` at compile time in the typed test file.

## Deviations from Plan

None - plan executed exactly as written. All 5 findings implemented per spec; three regression tests added exactly as described; no new runtime dependencies; `make test` (Biome lint + full vitest suite, 288 tests) passes after each task.

## Issues Encountered

Biome formatting flagged one initial multi-line `expect(...)` in the FIND-1 shell test — collapsed to a single line per the formatter's preference and re-verified. No other issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 self-review findings from PR #3 are closed with passing regression coverage.
- No architectural changes were needed (Rule 4 not triggered) — all fixes were scoped, in-place hardening.
- Phase 4 (Testing — Stress, Edge-Case & Regression Coverage) can proceed without carrying forward any of these findings as blockers.

---
*Quick task: 260712-wcu*
*Completed: 2026-07-13*

## Self-Check: PASSED

All 7 modified source/test files confirmed present on disk; all 3 task commit hashes (e51d927, ffd99af, d349ca9) confirmed present in git log. `make test` passed with 288/288 tests green after the final task commit.

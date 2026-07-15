---
phase: 01-diagnostics-surface-silent-failures
plan: 02
subsystem: diagnostics
tags: [dx-error, localStorage, settings, theme, wallet, event-bus]

# Dependency graph
requires:
  - phase: 01-diagnostics-surface-silent-failures (plan 01)
    provides: shell/lifecycle dx:error emit conventions (wrapped-error-message pattern, container-clear on failure)
provides:
  - "dx:error emits for settings/theme/wallet localStorage read+write failures, sourced plugin:<name>:storage:<op>"
  - "wallet canUseStorage() guard bringing it in line with settings/theme's available-vs-failed split"
affects: [phase-02-robustness, phase-03-security, phase-05-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Storage-failure dx:error emit: catch (err) { dx?.events.emit('dx:error', { source: 'plugin:<name>:storage:<op>', error: new Error('<Action> failed: ' + err.message, { cause: err }) }) } — fresh wrapped Error with `cause`, distinct from the existing shell/lifecycle convention of re-deriving/passing the caught error directly."

key-files:
  created: []
  modified:
    - plugins/settings/src/index.ts
    - plugins/settings/tests/settings.test.ts
    - plugins/theme/src/index.ts
    - plugins/theme/tests/theme.test.ts
    - plugins/wallet/src/index.ts
    - plugins/wallet/tests/wallet.test.ts

key-decisions:
  - "Added canUseStorage() to wallet (copied verbatim from settings/theme) so it gains the same available-vs-failed split, preserving D-07 silence on genuinely unavailable storage."
  - "New emit sites construct a fresh descriptive Error with `cause: err` rather than re-deriving/passing the caught error directly (the pre-existing shell/lifecycle convention) — kept consistent across all three plugins per the plan's explicit instruction."

patterns-established:
  - "plugin:<name>:storage:<op> (op = read|write) source taxonomy for storage-layer dx:error emits, matching D-02's colon-hierarchical scheme."

requirements-completed: [DIAG-02]

coverage:
  - id: D1
    description: "settings persist()/restore() emit dx:error (plugin:settings:storage:write/:read) on genuine localStorage failure; storage-unavailable stays silent; corrupted restore falls back to defaults"
    requirement: "DIAG-02"
    verification:
      - kind: unit
        ref: "plugins/settings/tests/settings.test.ts#storage failure diagnostics"
        status: pass
    human_judgment: false
  - id: D2
    description: "theme persist()/restore() emit dx:error (plugin:theme:storage:write/:read) on genuine localStorage failure; storage-unavailable stays silent; corrupted restore falls back to theme/mode defaults; syncing flag untouched"
    requirement: "DIAG-02"
    verification:
      - kind: unit
        ref: "plugins/theme/tests/theme.test.ts#storage failure diagnostics"
        status: pass
    human_judgment: false
  - id: D3
    description: "wallet gains canUseStorage() guard; persistProvider()/getPersistedProvider() emit dx:error (plugin:wallet:storage:write/:read) on genuine failure; storage-unavailable stays silent; STORAGE_KEY unchanged"
    requirement: "DIAG-02"
    verification:
      - kind: unit
        ref: "plugins/wallet/tests/wallet.test.ts#storage failure diagnostics"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-11
status: complete
---

# Phase 01 Plan 02: Storage Diagnostics Summary

**Settings, theme, and wallet plugins now emit `dx:error` (source `plugin:<name>:storage:<op>`) on genuine localStorage read/write failures, while staying silent when storage is entirely unavailable — wallet gained a `canUseStorage()` guard it previously lacked.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-11T22:14:07Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- `plugins/settings/src/index.ts` persist()/restore() now emit `plugin:settings:storage:write` / `:read` on genuine failure; unavailable storage stays silent; corrupted restore still falls back to defaults.
- `plugins/theme/src/index.ts` persist()/restore() now emit `plugin:theme:storage:write` / `:read`, mirroring settings exactly; the `syncing` re-entrancy flag is untouched.
- `plugins/wallet/src/index.ts` gained a `canUseStorage()` guard (copied verbatim from settings/theme) so `persistProvider()`/`getPersistedProvider()` can distinguish "unavailable" (silent) from "failed" (emits `plugin:wallet:storage:write` / `:read`); `STORAGE_KEY` untouched.
- 9 new regression tests (3 per plugin) covering write-failure emit, read-failure/corrupted-restore emit + defaults fallback, and silent-when-unavailable.

## Task Commits

Each task was committed atomically:

1. **Task 1: Emit dx:error on settings storage read/write failure** - `5caec8c` (feat)
2. **Task 2: Emit dx:error on theme storage read/write failure** - `3755d86` (feat)
3. **Task 3: Add storage-availability guard + emit dx:error on wallet storage failure** - `ba49fd5` (feat)

**Plan metadata:** (pending — final docs commit follows this summary)

## Files Created/Modified

- `plugins/settings/src/index.ts` - persist()/restore() catch blocks emit `plugin:settings:storage:write` / `:read`
- `plugins/settings/tests/settings.test.ts` - 3 new tests under "storage failure diagnostics"
- `plugins/theme/src/index.ts` - persist()/restore() catch blocks emit `plugin:theme:storage:write` / `:read`
- `plugins/theme/tests/theme.test.ts` - 3 new tests under "storage failure diagnostics"
- `plugins/wallet/src/index.ts` - added `canUseStorage()`; persistProvider()/getPersistedProvider() catch blocks emit `plugin:wallet:storage:write` / `:read`
- `plugins/wallet/tests/wallet.test.ts` - 3 new tests under "storage failure diagnostics"

## Decisions Made

- Wallet's `canUseStorage()` guard is copied verbatim from settings/theme (not exported) rather than refactored into a shared utility — this milestone stays additive/local-change-only per the plan's explicit instruction and the "no new exported public symbols" constraint.
- All three plugins use the fresh-Error-with-`cause` pattern for new emit sites (`new Error('<Action> failed: ' + err.message, { cause: err })`), a new sub-pattern distinct from the pre-existing shell/lifecycle convention (re-deriving/passing the caught error directly) — kept intentionally consistent across settings/theme/wallet per plan direction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched from `vi.spyOn(Storage.prototype, 'setItem')` to `vi.spyOn(localStorage, 'setItem')` in test mocking**
- **Found during:** Task 1 (settings write-failure test)
- **Issue:** happy-dom's `localStorage` is not a plain `Storage.prototype`-backed instance in this test environment; spying on `Storage.prototype` did not intercept calls made through the global `localStorage` object, so the write-failure assertion never fired.
- **Fix:** Spy directly on the `localStorage` instance (`vi.spyOn(localStorage, 'setItem')`) and explicitly `mockRestore()` in a `finally` block rather than relying on a describe-level `afterEach(() => vi.restoreAllMocks())`, which was observed to leak the mocked implementation into the next test (happy-dom's `localStorage` appears to be Proxy-backed, and `restoreAllMocks()` timing across the parent/inner describe boundary didn't reliably restore it).
- **Files modified:** plugins/settings/tests/settings.test.ts (pattern then replicated in theme.test.ts and wallet.test.ts)
- **Verification:** All 3 storage-failure tests pass in each plugin's suite (111 tests total across the three files); full `make test` (247 tests) passes.
- **Committed in:** 5caec8c (Task 1 commit) — pattern reused as-is in 3755d86 and ba49fd5.

---

**Total deviations:** 1 auto-fixed (1 bug — test-infrastructure mocking quirk, not a production code issue).
**Impact on plan:** No impact on shipped behavior; only affected how the tests simulate storage failure. No scope creep.

## Issues Encountered

- **TDD commit granularity:** Tasks are marked `tdd="true"`, but the plan's `type` is `execute` (not `type: tdd`), so the strict plan-level RED→GREEN gate enforcement did not apply. Each task was committed as a single `feat` commit containing both the source change and its tests together, rather than a separate failing-test (`test:`) commit followed by an implementation (`feat:`) commit. Functionally equivalent — every new test was verified against the modified source before commit — but the commit history does not show a discrete RED phase. Noting this for consistency with future `tdd="true"` tasks.

## TDD Gate Compliance

- No `test(...)`-prefixed commit precedes the `feat(...)` commits for Tasks 1–3; each task's tests and implementation landed together in one `feat` commit (see "Issues Encountered" above). All tests pass and were run against the modified source before commit, so behavior is verified, but the RED/GREEN commit split described in the TDD execution flow was not followed literally.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 (diagnostics-surface-silent-failures) is now fully executed: Plan 01 (shell:mount + lifecycle container-clear) and Plan 02 (storage diagnostics) both complete.
- `dx:error` now covers manifest validation, plugin-init failure, mount-container-missing, lifecycle dependency/entry-script/template failures, and localStorage read/write failures across settings/theme/wallet — the source taxonomy (`plugin:<name>:storage:<op>`, `shell:mount`, `lifecycle:<dappId>[:suffix]`) is consistent and ready for the Phase 5 docs pass to document verbatim.
- No blockers for Phase 2 (robustness) or Phase 3 (security) — wallet's `STORAGE_KEY` remains untouched and available for Phase 3's SEC-02 work.

---
*Phase: 01-diagnostics-surface-silent-failures*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 6 modified files and the SUMMARY.md exist on disk; all 3 task commit hashes (5caec8c, 3755d86, ba49fd5) verified present in git log.

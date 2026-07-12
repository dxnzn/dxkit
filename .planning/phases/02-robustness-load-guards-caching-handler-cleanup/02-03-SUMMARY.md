---
phase: 02-robustness-load-guards-caching-handler-cleanup
plan: 03
subsystem: settings-plugin
tags: [event-bus, plugin-lifecycle, cleanup, dapp-disable]

requires:
  - phase: 02-robustness-load-guards-caching-handler-cleanup
    provides: "dx:dapp:disabled shell event already emitted by disableDapp() (src/shell.ts:120), consumed here without any shell API change"
provides:
  - "Settings plugin cleanup(dappId) helper that prunes a disabled dapp's onChange/onAnyChange handlers"
  - "Subscribe-in-init / unsubscribe-in-destroy lifecycle for dx:dapp:disabled in plugins/settings/src/index.ts"
  - "Regression coverage locking in _shell toggle-bridge survival and dx:unmount non-interference"
affects: [settings-plugin, plugin-lifecycle-tests]

tech-stack:
  added: []
  patterns:
    - "Subscribe-to-shell-event-in-init, unsubscribe-in-destroy (mirrors plugins/auth/src/index.ts walletUnsub pattern)"

key-files:
  created: []
  modified:
    - plugins/settings/src/index.ts
    - plugins/settings/tests/settings.test.ts

key-decisions:
  - "cleanup(dappId) matches keyHandlers entries by ${dappId}: prefix, which naturally excludes _shell:* bridge handlers without any special-case check (D-14)"
  - "Subscription stored as a Listener (from context.events.on()), not a bare unsubscribe function — matches EventBus.on()'s actual return type, distinct from auth plugin's walletUnsub which stores a () => void from a different API"
  - "No subscription to dx:unmount — cleanup fires only on dx:dapp:disabled, so handlers survive normal navigation-away (D-15)"

patterns-established:
  - "Plugin init/destroy subscribe lifecycle for shell events: store the Listener in closure state at init, call .off() in destroy"

requirements-completed: [ROB-04]

coverage:
  - id: D1
    description: "Settings handlers registered via onChange()/onAnyChange() are pruned when their dapp is disabled via disableDapp() (consumed as dx:dapp:disabled)"
    requirement: "ROB-04"
    verification:
      - kind: unit
        ref: "plugins/settings/tests/settings.test.ts#removes onChange and onAnyChange handlers for a dapp once it is disabled"
        status: pass
    human_judgment: false
  - id: D2
    description: "The _shell toggle-bridge handler survives cleanup of a disabled dapp's own handlers, so re-enable still works"
    requirement: "ROB-04"
    verification:
      - kind: unit
        ref: "plugins/settings/tests/settings.test.ts#preserves the _shell toggle-bridge handler after the disabled dapp is cleaned up"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cleanup does not fire on dx:unmount — handlers survive normal navigation-away"
    requirement: "ROB-04"
    verification:
      - kind: unit
        ref: "plugins/settings/tests/settings.test.ts#does not clean up handlers on dx:unmount — handlers survive normal navigation-away"
        status: pass
    human_judgment: false
  - id: D4
    description: "destroy() unsubscribes the dx:dapp:disabled listener; a post-destroy emit is a no-op and does not throw"
    requirement: "ROB-04"
    verification:
      - kind: unit
        ref: "plugins/settings/tests/settings.test.ts#unsubscribes on destroy — dx:dapp:disabled after destroy does not throw"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-12
status: complete
---

# Phase 2 Plan 3: Settings Handler Cleanup on Disable Summary

**Settings plugin now prunes a disabled dapp's onChange/onAnyChange handlers via a dx:dapp:disabled subscription, leaving the `_shell` toggle-bridge intact.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-07-12T04:40:29Z
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments
- Added a `cleanup(dappId)` helper to `plugins/settings/src/index.ts` that prunes `keyHandlers` entries prefixed `${dappId}:` and deletes the dapp's `dappHandlers` entry.
- Wired a `dx:dapp:disabled` subscription in `init()` (stored as a `Listener`) and torn it down via `.off()` in `destroy()`, mirroring the auth plugin's subscribe/unsubscribe lifecycle.
- Added 4 regression tests locking in: handlers stop firing after disable, the `_shell:X` toggle-bridge survives cleanup, `dx:unmount` does not trigger cleanup, and `destroy()` unsubscribes cleanly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add cleanup(dappId) helper + dx:dapp:disabled subscribe/unsubscribe** - `454d268` (feat)
2. **Task 2: Regression tests for handler cleanup on disable** - `7311f71` (test)

**Plan metadata:** (to be committed after this SUMMARY)

## Files Created/Modified
- `plugins/settings/src/index.ts` - Added `disabledListener` closure var, `cleanup(dappId)` helper, `dx:dapp:disabled` subscribe (init) / unsubscribe (destroy)
- `plugins/settings/tests/settings.test.ts` - Added `describe('handler cleanup on disable (ROB-04)')` block with 4 regression tests

## Decisions Made
- `cleanup(dappId)` iterates `keyHandlers.keys()` and deletes entries starting with `${dappId}:`, then deletes `dappHandlers.get(dappId)` — the same map shapes `onChange`/`onAnyChange` already use, so no new data structures were needed.
- Stored the subscription as the `Listener` object returned by `context.events.on()` (per `src/types/events.ts:46-55`) rather than a bare `() => void`, since that is the actual return type of `EventBus.on()` — distinct from the auth plugin's `walletUnsub`, which stores a `() => void` returned by `wallet.onStateChange()`, a different API.
- Test coverage drives cleanup by emitting `dx:dapp:disabled` directly on the context's event bus (`ctx.events.emit(...)`), since the test harness's `mockContext.disableDapp` only flips an internal `enabledState` map and does not itself emit the shell event — matching how `shell.ts:120` actually triggers this in production.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

ROB-04 is fully implemented and covered. Plan 02-04 (or subsequent wave) can proceed independently — this plan had no dependencies and introduced no new shell API or cross-plugin coupling.

---
*Phase: 02-robustness-load-guards-caching-handler-cleanup*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: plugins/settings/src/index.ts
- FOUND: plugins/settings/tests/settings.test.ts
- FOUND: commit 454d268
- FOUND: commit 7311f71

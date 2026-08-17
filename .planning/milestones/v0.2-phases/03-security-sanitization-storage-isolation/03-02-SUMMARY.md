---
phase: 03-security-sanitization-storage-isolation
plan: 02
subsystem: wallet
tags: [wallet, localStorage, eip1193, sec-02, wr-02, wr-03]

# Dependency graph
requires:
  - phase: 01-diagnostics-surface-silent-failures
    provides: canUseStorage()/storage-failure dx:error emit pattern (plugin:wallet:storage:write/read) that the reconnect emit reuses
provides:
  - "WalletOptions.storageKey — configurable localStorage key for provider-selection persistence, per-instance closure variable, default 'dxkit:wallet'"
  - "Reconnect-failure visibility — init() auto-reconnect rejection now emits dx:error (source plugin:wallet:reconnect) before clearing the persisted provider"
  - "Empty-accounts throw — createEIP1193Provider.connect() rejects immediately when eth_requestAccounts returns []"
  - "Contract-safe connected/changed emits — updateState no longer uses address! non-null assertions, guards on a truthy address instead"
affects: [wallet-plugin, security-hardening, docs-truth-pass]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closure-scoped per-instance config resolved once at construction (storageKey = options.storageKey ?? 'dxkit:wallet'), mirroring the timeout/cacheTemplates additive-default convention"
    - "Wrapped-Error-with-cause dx:error emit reused verbatim for a third site (plugin:wallet:reconnect), matching storage:write/storage:read shape"

key-files:
  created: []
  modified:
    - plugins/wallet/src/index.ts
    - plugins/wallet/tests/wallet.test.ts

key-decisions:
  - "storageKey used verbatim, no auto-derived prefixing (D-09) — consumer owns the full literal key string"
  - "No migration from the legacy 'dxkit:wallet' key when a custom key is set (D-10) — a custom-key instance neither reads nor clears the legacy entry"
  - "Reconnect failure clears the persisted provider AFTER emitting dx:error, preserving the prior clear-on-failure behavior while adding visibility (D-12)"
  - "address! assertions replaced with truthy guards rather than re-asserted, since connect() now guarantees a non-empty address before updateState is ever called with connected:true (D-11)"

patterns-established:
  - "Third dx:error emit site (plugin:wallet:reconnect) reusing the storage:write/storage:read wrapped-Error-with-cause shape — establishes this as the standard error-surfacing template for the wallet plugin"

requirements-completed: [SEC-02]

coverage:
  - id: D1
    description: "WalletOptions.storageKey isolates persisted provider selection per DxKit app instance on a shared origin (SEC-02/D-09)"
    requirement: "SEC-02"
    verification:
      - kind: unit
        ref: "plugins/wallet/tests/wallet.test.ts#storageKey (SEC-02) > isolates persistence per storageKey with no cross-key bleed"
        status: pass
      - kind: unit
        ref: "plugins/wallet/tests/wallet.test.ts#storageKey (SEC-02) > defaults to dxkit:wallet when storageKey is not provided"
        status: pass
    human_judgment: false
  - id: D2
    description: "A custom storageKey does not read or migrate the legacy 'dxkit:wallet' entry (D-10)"
    requirement: "SEC-02"
    verification:
      - kind: unit
        ref: "plugins/wallet/tests/wallet.test.ts#storageKey (SEC-02) > does not read or migrate the legacy dxkit:wallet key when a custom storageKey is set (D-10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "createEIP1193Provider.connect() throws on empty eth_requestAccounts response instead of emitting a malformed connected state (WR-02/D-11)"
    verification:
      - kind: unit
        ref: "plugins/wallet/tests/wallet.test.ts#createEIP1193Provider > connect() throws when eth_requestAccounts returns an empty array (WR-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "updateState's connected/changed emits are guarded by a truthy address check instead of a non-null assertion, enforcing the { address: string } contract via the type system"
    verification:
      - kind: unit
        ref: "pnpm exec tsc --noEmit (strict mode, no address! assertions remain)"
        status: pass
      - kind: unit
        ref: "plugins/wallet/tests/wallet.test.ts (full suite, existing connected/changed event assertions still pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "init() auto-reconnect failure emits dx:error (source plugin:wallet:reconnect, error with cause) and still clears the persisted provider (WR-03/D-12)"
    verification:
      - kind: unit
        ref: "plugins/wallet/tests/wallet.test.ts#createWallet > emits dx:error with source plugin:wallet:reconnect and clears the persisted key when auto-reconnect fails (WR-03)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-12
status: complete
---

# Phase 3 Plan 2: Wallet Storage Key Isolation Summary

**Configurable `WalletOptions.storageKey` (default `'dxkit:wallet'`) isolates provider-selection persistence per app, plus two folded correctness fixes: empty-accounts throws instead of emitting a malformed connected state, and silent auto-reconnect failure now surfaces via `dx:error`.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-12
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `WalletOptions.storageKey?: string` added, resolved once per `createWallet()` instance as a closure variable (`options.storageKey ?? 'dxkit:wallet'`); the module-level `STORAGE_KEY` constant is removed and `persistProvider`/`getPersistedProvider` reference the closure variable instead.
- Two DxKit apps on the same origin with distinct `storageKey` values now persist provider selection independently with no cross-key bleed; a custom-key instance neither reads nor migrates the legacy `'dxkit:wallet'` entry (D-10).
- `init()`'s auto-reconnect catch now emits `dx:error` (source `plugin:wallet:reconnect`, error wrapped with `cause`) before clearing the persisted provider, reusing the existing storage:write/storage:read emit shape — a failed reconnect is no longer silent (WR-03).
- `createEIP1193Provider.connect()` throws immediately when `eth_requestAccounts` resolves to an empty array, before any `eth_chainId` call or state mutation (WR-02).
- The coordinator's `updateState` no longer uses `address!` non-null assertions on the connected/changed emits — replaced with a truthy guard on `newState.address` so the `{ address: string }` event contract is enforced structurally.
- 5 new tests added covering storageKey isolation, default-key preservation, no-legacy-migration, empty-accounts throw, and reconnect-failure emission. Full wallet suite: 57/57 passing (52 pre-existing + 5 new).

## Task Commits

Each task was committed atomically:

1. **Task 1: Configurable storageKey (SEC-02) + reconnect dx:error (WR-03)** - `3363bf5` (feat)
2. **Task 2: Empty-accounts throw (WR-02) + remove address! assertions (D-11)** - `f63b383` (fix)
3. **Task 3: Wallet regression + isolation tests** - `d163720` (test)

**Plan metadata:** committed separately after this SUMMARY.

## Files Created/Modified

- `plugins/wallet/src/index.ts` - `WalletOptions.storageKey` field, closure-scoped `storageKey`, removed module-level `STORAGE_KEY` constant, reconnect `dx:error` emit, empty-accounts throw in `createEIP1193Provider.connect()`, guarded (not asserted) `updateState` emits.
- `plugins/wallet/tests/wallet.test.ts` - storageKey isolation tests, default-key preservation test, no-legacy-migration test (D-10), empty-accounts throw test (WR-02), reconnect-failure regression test (WR-03).

## Decisions Made

- `storageKey` is used verbatim with no auto-derived namespace/prefix logic (D-09) — consumers own the full literal key.
- No data migration path from the legacy `'dxkit:wallet'` key when a custom key is configured (D-10) — a custom-key instance treats the legacy entry as belonging to a different app and leaves it untouched.
- Reconnect-failure `dx:error` emission happens before `persistProvider(null)` in the catch block, preserving the existing clear-on-failure behavior while adding the missing visibility (D-12).
- `address!` assertions were replaced with `newState.address` truthy guards rather than removed outright, since `connect()`'s empty-accounts throw (Task 2) guarantees `updateState` is never called with `connected: true` and an empty address — the guard makes that invariant explicit in the type system instead of relying on caller discipline (D-11).

## Deviations from Plan

None - plan executed exactly as written. Both `tdd="true"` source tasks (Task 1, Task 2) and the standalone test task (Task 3) matched the plan's literal task breakdown — the plan intentionally deferred all new test-writing to Task 3 rather than the conventional single-task RED/GREEN/REFACTOR cycle, and that structure was followed as authored.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SEC-02, WR-02, and WR-03 are resolved; the two Phase 1 pending todos (WR-02, WR-03) tagged `resolves_phase: 3` are now closed.
- `pnpm exec tsc --noEmit` clean, `pnpm exec vitest run plugins/wallet/tests/wallet.test.ts` green (57/57), Biome clean on both modified files.
- Ready for 03-03-PLAN.md (remaining Phase 3 security work).

---
*Phase: 03-security-sanitization-storage-isolation*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: plugins/wallet/src/index.ts
- FOUND: plugins/wallet/tests/wallet.test.ts
- FOUND: .planning/phases/03-security-sanitization-storage-isolation/03-02-SUMMARY.md
- FOUND commit: 3363bf5 (feat: configurable storageKey + reconnect dx:error)
- FOUND commit: f63b383 (fix: empty-accounts throw + remove address! assertions)
- FOUND commit: d163720 (test: storageKey isolation + regression tests)
- FOUND commit: d5a0fe5 (docs: add plan summary)

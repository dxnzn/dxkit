---
phase: 05-documentation-truth-pass
plan: 05
subsystem: docs
tags: [markdown, plugins, wallet, auth, theme, settings, storageKey, dx-error]

requires:
  - phase: 05-documentation-truth-pass
    provides: "Plan 01's D-15/D-16/D-17 fixed source (this plan's verification target); the RESEARCH.md Code Truth tables (Config Defaults, Event Catalog)"
provides:
  - "docs/plugin-development.md verified — duck-typing attribution bug fixed, plugin init-order/registration-order truth corrected"
  - "docs/plugins/wallet.md verified — storageKey option documented (was entirely absent), WR-02/WR-03 behavior, four dx:error sources, deprecated createEthereumWallet() note"
  - "docs/plugins/auth.md verified — graceful-degradation-without-wallet behavior documented"
  - "docs/plugins/theme.md verified — init-sync ordering caveat, same-value no-ops, two dx:error sources, storageKey collision gap stated"
  - "docs/plugins/settings.md verified — handler-cleanup-on-disable behavior documented (previously entirely absent), register-order truth corrected, two dx:error sources, storageKey collision gap stated"
  - "drift/05-plugins.md — before/after record for all five docs"
affects: [05-08]

tech-stack:
  added: []
  patterns:
    - "Plugin registration order truth: every plugin registers before any plugin's init() runs, so settings-array/manifest discovery is order-independent — only init-time cross-plugin API access (auth reading wallet.getState(), theme writing dx.settings) is order-dependent"
    - "Per-plugin 'Error Handling' subsection under Events, cataloging that plugin's dx:error sources with a link to events-reference.md for the full catalog — established this plan for wallet/theme/settings, matches the events-reference.md doc's own table format"

key-files:
  created:
    - .planning/phases/05-documentation-truth-pass/drift/05-plugins.md
  modified:
    - docs/plugin-development.md
    - docs/plugins/wallet.md
    - docs/plugins/auth.md
    - docs/plugins/theme.md
    - docs/plugins/settings.md

key-decisions:
  - "Corrected the Duck-typing Patterns section in plugin-development.md, which had backwards attribution (said 'the settings plugin checks other plugins' when it's actually the shell checking the settings plugin) — the code sample was already correct, only the prose was inverted"
  - "Traced the 'settings should be registered last' claim (present in both plugin-development.md and settings.md) to src/shell.ts's two-loop init() structure and found it false: every plugin registers before any init() runs, so settings-array discovery is order-independent. Corrected both docs and reordered their canonical examples to 'settings before theme' — the real constraint, since theme writes to dx.settings during its own init()"
  - "Added an 'Error Handling' subsection to wallet.md/theme.md/settings.md cataloging each plugin's dx:error sources — none of the three plugin docs previously mentioned their own storage-failure/reconnect-failure/state-contract-violation dx:error emissions at all, despite RESEARCH.md's Event Catalog listing all of them"
  - "Stated the theme/settings storageKey collision gap factually in both docs (per plan's threat-model T-05-05a) without overselling a mitigation that doesn't exist — pointed to docs/security.md (Plan 05-07, not yet written) for the full inventory rather than duplicating it"
  - "Added the previously entirely-undocumented settings handler-cleanup-on-disable behavior (ROB-04, validated Phase 2) to settings.md as a new 'Handler Cleanup' subsection"

requirements-completed: [DOC-01, DOC-02]

coverage:
  - id: D1
    description: "docs/plugin-development.md verified against src/types/interfaces.ts, src/types/context.ts, src/events.ts, src/shell.ts; duck-typing attribution bug fixed; init/registration-order guidance corrected and example reordered"
    requirement: "DOC-01"
    verification:
      - kind: other
        ref: "bash -c \"! grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' docs/plugin-development.md\""
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/plugins/wallet.md verified against plugins/wallet/src/index.ts; storageKey option (previously entirely undocumented) added, WR-02/WR-03 behavior documented, four dx:error sources cataloged, createEthereumWallet() marked deprecated"
    requirement: "DOC-01"
    verification:
      - kind: other
        ref: "bash -c \"grep -q 'storageKey' docs/plugins/wallet.md && grep -qi 'deprecat' docs/plugins/wallet.md && ! grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' docs/plugins/wallet.md\""
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/plugins/auth.md verified against plugins/auth/src/index.ts; graceful-degradation-without-wallet behavior added"
    requirement: "DOC-01"
    verification:
      - kind: other
        ref: "bash -c \"! grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' docs/plugins/auth.md\""
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/plugins/theme.md verified against plugins/theme/src/index.ts; already-accurate defaults/events confirmed, init-sync ordering caveat and dx:error sources added, storageKey collision gap stated"
    requirement: "DOC-01"
    verification:
      - kind: other
        ref: "bash -c \"grep -q 'storageKey' docs/plugins/theme.md && ! grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' docs/plugins/theme.md\""
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/plugins/settings.md verified against plugins/settings/src/index.ts; handler-cleanup-on-disable behavior added (previously undocumented), register-order truth corrected, dx:error sources added, storageKey collision gap stated"
    requirement: "DOC-01"
    verification:
      - kind: other
        ref: "bash -c \"grep -q 'storageKey' docs/plugins/settings.md && ! grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' docs/plugins/settings.md\""
        status: pass
    human_judgment: false
  - id: D6
    description: "drift/05-plugins.md records all five docs' before/after changes with source citations"
    verification:
      - kind: other
        ref: "test -f .planning/phases/05-documentation-truth-pass/drift/05-plugins.md"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-07-14
status: complete
---

# Phase 05 Plan 05: Plugin Docs (plugin-development.md, wallet.md, auth.md, theme.md, settings.md) Truth Pass Summary

**Verified all five plugin docs against source (src/types/interfaces.ts, src/events.ts, src/shell.ts, plugins/{wallet,auth,theme,settings}/src/index.ts) — filled the SEC-02 storageKey gap that made wallet.md's Setup section entirely omit its own primary option, added the settings handler-cleanup behavior that was undocumented since ROB-04 shipped in Phase 2, and fixed a backwards duck-typing attribution and a false "register settings last" claim repeated in two docs.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-14T16:20:00Z
- **Tasks:** 2
- **Files modified:** 6 (5 docs + 1 new drift log)

## Accomplishments

- Fixed `plugin-development.md`'s Duck-typing Patterns section, which attributed the `getSettingsAPI()` duck-check to "the settings plugin checking other plugins" when the code (and `src/shell.ts:85-89`) shows the shell checking the settings plugin — the prose was inverted, the code sample wasn't.
- Traced the "settings plugin should be registered last" claim (present verbatim in both `plugin-development.md` and `settings.md`) to `src/shell.ts`'s `init()` and found it false: every plugin is registered in a single loop before any plugin's `init()` runs, so settings-array/manifest discovery never depends on declaration order. Corrected both docs with the real constraint — settings must be registered *before* plugins that write to `dx.settings` during their own `init()` (theme) — and reordered both canonical examples accordingly.
- Filled `wallet.md`'s single largest gap: the `WalletOptions` interface/table showed only `providers`, omitting `storageKey` (the Phase 3 SEC-02 hardening) entirely. Added the option, rewrote Persistence to describe the configurable key + no-migration-from-old-key behavior + WR-03's reconnect-failure `dx:error`, added the WR-02 empty-accounts throw to the `createEIP1193Provider()` description, and added a deprecated-status note for `createEthereumWallet()` (previously unmentioned in any doc).
- Added "Error Handling" subsections to `wallet.md`, `theme.md`, and `settings.md` cataloging each plugin's `dx:error` sources (8 total across the three docs) — none of the three previously documented their own storage-failure/reconnect-failure/state-contract-violation emissions, despite RESEARCH.md's Event Catalog listing all of them against `docs/events-reference.md:163`'s known drift.
- Added `settings.md`'s entirely-missing "Handler Cleanup" section: `onChange()`/`onAnyChange()` handlers are pruned on `dx:dapp:disabled` (disable-only, survives navigation-away), stored in a nested `Map` structure so colon-prefix dapp ids can't collide, with the `_shell` toggle-bridge handlers explicitly untouched by other dapps' cleanup — this is the ROB-04 behavior validated in Phase 2 and never documented since.
- Added `auth.md`'s missing graceful-degradation note: when `walletPlugin` doesn't resolve, `authenticate()` throws but the rest of the API (`getState`/`isAuthenticated`/`onStateChange`/`deauthenticate`) stays functional.
- Stated the theme/settings `storageKey` collision gap factually in both docs (per this plan's threat-model item T-05-05a) — neither plugin has wallet's SEC-02 per-app isolation treatment; pointed to `docs/security.md` (Plan 05-07, not yet authored) for the full inventory instead of duplicating it.
- Confirmed `theme.md`'s option defaults (`themes: ['default']`, `defaultMode: 'system'`, `storageKey: 'dxkit:theme'`), event payload, and Settings-declaration behavior were already accurate — no drift found there; added minor same-value no-op clarifications to `setMode()`/`setTheme()`.

## Task Commits

Each task was committed atomically, plus a small structural follow-up and two drift-log commits:

1. **Task 1: Verify plugin-development.md + wallet.md + auth.md**
   - `7912fee` — docs(plugin-development): fix duck-typing attribution + init-order truth
   - `ab8d03d` — docs(wallet): document storageKey, WR-02/WR-03 behavior, dx:error sources
   - `689c6b3` — docs(auth): document graceful degradation when wallet plugin is missing
   - `e82bc61` — docs(05-05): log drift for plugin-development, wallet, auth
2. **Task 2: Verify theme.md + settings.md**
   - `326222f` — docs(theme): document init-sync ordering, dx:error sources, storageKey gap
   - `f890c72` — docs(settings): document handler cleanup, dx:error sources, register-order truth, storageKey gap
   - `e4043c5` — docs(05-05): log drift for theme, settings
   - `662a591` — docs(wallet): move deprecated createEthereumWallet() note after both providers (structural fix — the deprecated-status subsection had split the Built-in Providers list in half; moved after both providers)

_Note: the drift log file `drift/05-plugins.md` was created with Task 1's three doc sections and appended with Task 2's two doc sections, matching the plan's "log all three... append" instruction._

## Files Created/Modified

- `docs/plugin-development.md` - Fixed Duck-typing Patterns attribution bug; corrected plugin registration/init-order guidance and reordered the "Registering a Plugin" example.
- `docs/plugins/wallet.md` - Added `storageKey` option (was entirely absent), rewrote Persistence for WR-03 reconnect-failure behavior + no-migration, added WR-02 note, added Error Handling subsection (4 sources), added deprecated `createEthereumWallet()` note.
- `docs/plugins/auth.md` - Added graceful-degradation-without-wallet-plugin note.
- `docs/plugins/theme.md` - Added init-sync ordering caveat, same-value no-op clarifications, Error Handling subsection (2 sources), storageKey collision-gap note.
- `docs/plugins/settings.md` - Corrected register-order guidance + reordered Quick Start; added Handler Cleanup section (previously absent), Error Handling subsection (2 sources), storageKey collision-gap note.
- `.planning/phases/05-documentation-truth-pass/drift/05-plugins.md` - Before/after record for all five docs, citing source line numbers.

## Decisions Made

- Corrected the "register settings last" claim in both docs it appeared in (rather than just one) since the same false claim was duplicated verbatim — fixing only `plugin-development.md` would have left `settings.md` contradicting it.
- Chose "settings before theme" as the corrected canonical ordering (not "settings last") because that's the actual constraint traced from source: theme's `init()` writes to `dx.settings`, which doesn't exist until settings' own `init()` has run.
- Kept the storageKey-collision notes in theme.md/settings.md factual and brief (pointing to the not-yet-written `docs/security.md`) rather than writing the full inventory here — that's explicitly Plan 05-07's scope per this plan's own instructions ("full treatment in docs/security.md, Plan 07").
- Added a small structural follow-up commit to move the deprecated `createEthereumWallet()` note in wallet.md after both Built-in Providers bullets, rather than leaving it wedged between them from the initial edit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed inverted duck-typing attribution in plugin-development.md**
- **Found during:** Task 1
- **Issue:** The Duck-typing Patterns section said "the settings plugin, for example, checks whether other plugins expose a `getSettingsAPI()` method" — backwards from what the code sample (and `src/shell.ts:85-89`) actually shows: the shell checks the settings plugin for `getSettingsAPI()`.
- **Fix:** Corrected the prose to attribute the check to the shell; corrected the inline comment above the code sample.
- **Files modified:** `docs/plugin-development.md`
- **Commit:** `7912fee`

**2. [Rule 1 - Bug] Fixed false "register settings last" claim in two docs**
- **Found during:** Task 1 (plugin-development.md), confirmed also present in settings.md during Task 2
- **Issue:** Both docs claimed settings must be registered last or "won't have their settings discovered." Traced to `src/shell.ts:361-382`: every plugin registers (added to the registry) in one loop before any plugin's `init()` runs in the next loop, so settings' `dx.getPlugins()` call during its own `init()` always sees every plugin's static `settings` array regardless of declaration order — the claim was unverified and wrong.
- **Fix:** Replaced with the real constraint (settings must be registered before plugins that write to `dx.settings` during their own `init()`, i.e. theme) in both docs, and reordered both canonical examples from "theme, settings" to "settings, theme."
- **Files modified:** `docs/plugin-development.md`, `docs/plugins/settings.md`
- **Commit:** `7912fee`, `f890c72`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bug fixes)
**Impact on plan:** Both fixes are within the plan's explicit "verify every claim against source" mandate — neither reopens shipped code (D-03), both are doc-only corrections of claims that didn't match `src/shell.ts`.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All five plugin docs are source-accurate against current 0.2.0 code and slop-clean; every automated verify grep in the plan passes.
- Both cross-references to `docs/security.md` (theme.md, settings.md storageKey-gap notes) point at a doc that doesn't exist yet — Plan 05-07 creates it. The links are plain code-span text (`` `docs/security.md` ``), not markdown links, so nothing is broken in the interim; Plan 05-08's cross-doc consistency sweep should confirm the eventual `docs/security.md` actually covers what these two docs promise.
- The plugin-registration-order correction (settings-before-theme) changes the canonical example shown in three places now (`plugin-development.md`, `settings.md`'s Quick Start) — Plan 05-08 should spot-check `examples/getting-started/` and any other doc that shows a combined plugin registration list for the same stale ordering.
- `docs/events-reference.md` (Plan 05-02) already carries the full `dx:error` catalog; the per-plugin "Error Handling" subsections added this plan are deliberately short (source + trigger only) and link out rather than duplicating payload/message details.

---
*Phase: 05-documentation-truth-pass*
*Completed: 2026-07-14*

## Self-Check: PASSED

- FOUND: docs/plugin-development.md
- FOUND: docs/plugins/wallet.md
- FOUND: docs/plugins/auth.md
- FOUND: docs/plugins/theme.md
- FOUND: docs/plugins/settings.md
- FOUND: .planning/phases/05-documentation-truth-pass/drift/05-plugins.md
- FOUND: 7912fee (docs(plugin-development) commit)
- FOUND: ab8d03d (docs(wallet) commit)
- FOUND: 689c6b3 (docs(auth) commit)
- FOUND: e82bc61 (drift log — Task 1)
- FOUND: 326222f (docs(theme) commit)
- FOUND: f890c72 (docs(settings) commit)
- FOUND: e4043c5 (drift log — Task 2)
- FOUND: 662a591 (docs(wallet) structural follow-up)

---
phase: 05-documentation-truth-pass
plan: 02
subsystem: docs
tags: [events-reference, api-reference, dx-error, event-catalog, type-surface, drift]

# Dependency graph
requires:
  - phase: 05-documentation-truth-pass
    plan: 01
    provides: "final 0.2.0 code shape for D-15/D-16/D-17 — docs now describe as-shipped behavior without hedging"
provides:
  - "docs/events-reference.md's dx:error section as the complete, source-traced 23-row source catalog"
  - "docs/api-reference.md verified line-for-line against the 0.2.0 public type surface (ShellConfig.lifecycle Omit, LifecycleManager's 4 cache/invalidation methods, EventMap['dx:ready'] type)"
  - "drift/02-reference.md — the phase's per-doc before/after audit trail for both reference docs"
affects: [05-documentation-truth-pass later plans — configuration.md/getting-started.md/plugin docs quote events and types from these two corrected docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wholesale table replacement over incremental patching for a table with concentrated drift (D-13/Pitfall 1) — the dx:error catalog was rebuilt from a fresh grep of every emit site rather than diffed against the stale 4-row version"
    - "Doc-truth verification method: read the doc's claim, then read the exact source file/line making that claim true or false, one claim at a time — no claim accepted from memory of 'what DxKit usually does'"

key-files:
  created:
    - .planning/phases/05-documentation-truth-pass/drift/02-reference.md
  modified:
    - docs/events-reference.md
    - docs/api-reference.md

key-decisions:
  - "dx:error catalog presented as 23 rows (one per distinct source+trigger pair, not collapsed to unique literal strings) — chosen over a lower row count because every distinct trigger is independently useful to a consumer building a dx:error handler, and the plan's must_haves explicitly required 'every source string ... including the D-15 registry emit'"
  - "createEthereumWallet()'s @deprecated status was checked (RESEARCH item) but produced no api-reference.md edit — that doc's Factory Functions section only covers core (@dnzn/dxkit) factories; plugin factories including createEthereumWallet() belong to docs/plugins/wallet.md, out of this plan's files_modified scope"
  - "disableDapp()'s method-table description updated to reflect the D-16 navigate-to-/ fix (landed Plan 01) even though Task 2's action list didn't name this line explicitly — Rule 1/D-01 scope: the existing sentence was accurate-but-incomplete about current shell.ts behavior, which this plan's mandate to verify every claim covers"

requirements-completed: [DOC-01, DOC-02]

coverage:
  - id: T1
    description: "docs/events-reference.md's dx:error section lists every distinct source+trigger pair from RESEARCH's Event Catalog (23 rows), including the D-15 registry emit, replacing the prior 4-example parenthetical"
    requirement: "DOC-01"
    verification:
      - kind: automated
        ref: "grep 'shell:manifest', 'shell:mount', ':sanitize', 'plugin:wallet:reconnect', 'plugin:theme:storage:read' in docs/events-reference.md"
        status: pass
    human_judgment: false
  - id: T2
    description: "docs/api-reference.md matches the 0.2.0 public type surface: ShellConfig.lifecycle is Omit<LifecycleManagerOptions,'hasPlugin'>, LifecycleManager's 4 cache/invalidation methods are documented, EventMap['dx:ready'] is Record<string, never>, no D-13 booster/hedge words in either doc"
    requirement: "DOC-01/DOC-02"
    verification:
      - kind: automated
        ref: "grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' (negated) across both docs; grep 'lifecycle' and 'sanitizeTemplate' in docs/api-reference.md"
        status: pass
      - kind: manual
        ref: "Field-by-field read-through of every interface/type in api-reference.md against src/types/*.ts, src/router.ts, src/registry.ts, src/lifecycle.ts, src/utils.ts, plugins/settings/src/index.ts"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-07-14
status: complete
---

# Phase 05 Plan 02: Reference Docs — Truth Pass Summary

**Rewrote `docs/events-reference.md`'s `dx:error` catalog wholesale against a fresh source grep (4 examples -> 23 traced source+trigger rows) and verified `docs/api-reference.md` field-for-field against the 0.2.0 public type surface, correcting the `ShellConfig.lifecycle` Omit drift, four undocumented `LifecycleManager` methods, and two wrong package names.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-14
- **Tasks:** 2
- **Files modified:** 2 docs + 1 new drift log

## Accomplishments
- `docs/events-reference.md`'s `dx:error` section now enumerates all 23 distinct `source`+trigger pairs emitted across `src/shell.ts`, `src/lifecycle.ts`, and the wallet/theme/settings plugins (including the D-15 registry-failure emit that landed in Plan 01), replacing a stale 4-example parenthetical.
- Documented the wrapped-Error-with-`cause` convention accurately — which sites set `cause` and which construct a fresh `Error` with nothing to wrap.
- Fixed a real bug affecting TypeScript consumers copy-pasting doc examples: both `events-reference.md` and `api-reference.md` had module-augmentation snippets using `declare module 'dxkit'` instead of the actual published package name `'@dnzn/dxkit'` — this would silently fail to augment the real `EventMap` interface.
- `docs/api-reference.md`'s `ShellConfig.lifecycle` type corrected from the full `LifecycleManagerOptions` to `Omit<LifecycleManagerOptions, 'hasPlugin'>`, matching `src/types/shell.ts:32` and closing RESEARCH's Pitfall 2 (a doc example passing `hasPlugin` through `createShell()` would compile-fail).
- `LifecycleManager`'s interface and method table gained the 4 methods that existed in source but were undocumented: `clearTemplateCache()`, `invalidateTemplate(url)`, `invalidatePendingMount(id)`, `invalidateAnyPendingMount()`.
- Smaller corrections: `EventMap['dx:ready']` type (`{}` -> `Record<string, never>`), `Context.settings` package-name comment (`@dxkit/settings` -> `@dnzn/dxkit-settings`), `deepMerge`'s undocumented null-replaces behavior, `disableDapp()`'s method-table description now reflects the D-16 navigate-to-`/` fix.
- All corrections logged with before/after + source citation in `.planning/phases/05-documentation-truth-pass/drift/02-reference.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite docs/events-reference.md against the code-truth Event Catalog** - `253f57c` (docs)
2. **Task 2: Verify docs/api-reference.md against the 0.2.0 public type surface** - `2adde92` (docs)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `docs/events-reference.md` - `dx:error` section rewritten wholesale (23-row catalog); `dx:mount`, `dx:dapp:disabled`, `dx:event:registered` sections gained accuracy clauses; module-augmentation package-name fix
- `docs/api-reference.md` - `ShellConfig.lifecycle` Omit fix; `LifecycleManager` interface + table gained 4 methods; `EventMap['dx:ready']` type fix; two package-name fixes; `deepMerge` and `disableDapp()` description fixes
- `.planning/phases/05-documentation-truth-pass/drift/02-reference.md` (new) - per-doc before/after audit trail, source-cited, for both docs in this plan

## Decisions Made
- Presented the `dx:error` catalog as 23 rows (one per distinct source+trigger pair) rather than collapsing rows that share a literal `source` string (`shell:manifest` appears 6 times, `` `lifecycle:${id}` `` appears twice) — every distinct trigger is independently actionable for a consumer's error handler, and the plan's must_haves required "every source string... including the D-15 registry emit" be listed.
- Skipped adding `createEthereumWallet()`'s `@deprecated` status to `api-reference.md` — verified it's genuinely out of that doc's scope (Factory Functions section only covers core `@dnzn/dxkit` factories; plugin factories are documented in `docs/plugins/wallet.md`, a different plan's file scope per `05-02-PLAN.md`'s `files_modified`).
- Updated `disableDapp()`'s one-line method-table description to mention the D-16 navigate-to-`/` behavior even though Task 2's `<action>` didn't name that specific line — the plan's DOC-01 mandate ("verify every claim") covers it, and the prior text was accurate-but-incomplete about the now-final 0.2.0 behavior Plan 01 shipped.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' verify greps and acceptance criteria were met on first pass; no auto-fixes, blockers, or architectural questions arose.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `docs/events-reference.md` and `docs/api-reference.md` are now source-accurate for the 0.2.0 type/event surface and can be cited as ground truth by later sweep plans (`configuration.md`, `getting-started.md`, `dapp-development.md`, `system-internals.md`, plugin docs) per the RESEARCH sweep order.
- `make lint` is green (Biome check, 31 files, no fixes needed) at HEAD (`2adde92`).
- No blockers for subsequent plans in this phase.

---
*Phase: 05-documentation-truth-pass*
*Completed: 2026-07-14*

## Self-Check: PASSED

All modified files (`docs/events-reference.md`, `docs/api-reference.md`, `.planning/phases/05-documentation-truth-pass/drift/02-reference.md`) and both task commits (`253f57c`, `2adde92`) verified present in the working tree and git log.

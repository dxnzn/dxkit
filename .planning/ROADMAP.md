# Roadmap: DxKit 0.2.0 Hardening

## Overview

This milestone hardens DxKit 0.1.5 toward a more trustworthy 0.2.0 without expanding its
feature surface. Diagnostics work lands first, making previously silent failures (missing
mount container, storage errors, entry-load failures) visible via `dx:error`. Robustness work
follows — load timeouts, manifest-sort caching, template caching, and settings-handler cleanup
— so the shell can't hang, redo unnecessary work, or leak state across disabled dapps. Security
work adds an optional template sanitizer hook and a configurable wallet storage key, addressing
the two concrete risks the concerns audit flagged. Once the underlying behavior is in its final
0.2.0 shape, a dedicated testing phase adds the stress, edge-case, and regression coverage the
audit found missing. The milestone closes with a full documentation truth pass — every framework
and plugin doc verified against the now-final code, slop removed, and the CSP/security gaps the
audit surfaced filled in.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Diagnostics — Surface Silent Failures** - `dx:error` fires for every previously-silent failure path (missing mount, storage errors, entry-load failures) (completed 2026-07-11)
- [x] **Phase 2: Robustness — Load Guards, Caching & Handler Cleanup** - Mounts can't hang, router/template work isn't repeated, and disabled dapps stop leaking settings handlers (completed 2026-07-12)
- [x] **Phase 3: Security — Sanitization & Storage Isolation** - Templates can be sanitized before injection and wallet storage keys no longer collide across apps (completed 2026-07-12)
- [x] **Phase 4: Testing — Stress, Edge-Case & Regression Coverage** - Concurrent-navigation, manifest-validation, and settings-cleanup behavior gets dedicated test coverage (completed 2026-07-14)
- [ ] **Phase 5: Documentation — Truth Pass** - Every doc and the README are verified against 0.2.0 code, slop is removed, and CSP/security gaps are filled

## Phase Details

### Phase 1: Diagnostics — Surface Silent Failures

**Goal**: Failures that were previously silent are now visible to developers via `dx:error` events.
**Depends on**: Nothing (first phase)
**Requirements**: DIAG-01, DIAG-02, DIAG-03
**Success Criteria** (what must be TRUE):

  1. A `dx:error` event fires (with a descriptive payload) when the shell can't resolve `#dx-mount`, instead of the mount silently no-op'ing.
  2. A `dx:error` event fires — identifying the plugin and the failed operation — when a `localStorage` read or write fails in the wallet, theme, or settings plugin.
  3. A `dx:error` event fires and the mount container is cleared/restored (no stale dapp DOM left visible) when an entry-script fails to load.

**Plans**: 2/2 plans complete

- [x] 01-01-PLAN.md — Shell/lifecycle mount diagnostics: emit `dx:error` on missing `#dx-mount` (DIAG-01) + clear container on entry/dependency load failure (DIAG-03)
- [x] 01-02-PLAN.md — Plugin storage diagnostics: emit `dx:error` on localStorage read/write failure in settings, theme, wallet (DIAG-02)

### Phase 2: Robustness — Load Guards, Caching & Handler Cleanup

**Goal**: Mounts can't hang indefinitely, redundant router/template work is eliminated, and settings handlers don't leak across a disabled dapp.
**Depends on**: Nothing (independent hardening track; sequenced after Phase 1)
**Requirements**: ROB-01, ROB-02, ROB-03, ROB-04
**Success Criteria** (what must be TRUE):

  1. A lifecycle manager configured with a load timeout aborts and emits `dx:error` for a script/style/template fetch that exceeds it, instead of hanging the mount indefinitely.
  2. `Router.resolve()` reuses a cached, length-sorted manifest list across repeated navigations, re-sorting only when manifests change.
  3. Repeated mounts of the same dapp reuse a template cached by URL rather than re-fetching it, with an explicit invalidation path.
  4. Handlers a dapp registered via `onChange()`/`onAnyChange()` stop firing and are removed once that dapp is disabled via `disableDapp()`.

**Plans**: 4/4 plans complete
**Wave 1**

- [x] 02-01-PLAN.md — ROB-01 lifecycle per-fetch load timeout + true abort (30s default, `timeout: 0`/`Infinity` opt-out) [wave 1]
- [x] 02-02-PLAN.md — ROB-02 router length-sort cache hoisted to construction [wave 1]
- [x] 02-03-PLAN.md — ROB-04 settings handler cleanup on `dx:dapp:disabled` [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-04-PLAN.md — ROB-03 template-by-URL cache + `clearTemplateCache`/`invalidateTemplate` [wave 2, depends 02-01]

### Phase 3: Security — Sanitization & Storage Isolation

**Goal**: Injected templates can be sanitized before DOM insertion, and multiple DxKit apps on one origin no longer collide over wallet storage.
**Depends on**: Nothing (independent hardening track; sequenced after Phase 2)
**Requirements**: SEC-01, SEC-02
**Success Criteria** (what must be TRUE):

  1. A template sanitizer hook, when configured on the lifecycle manager, runs on fetched template HTML before `innerHTML` injection.
  2. With no sanitizer configured, template injection behavior is unchanged from 0.1.5 (backward-compatible default).
  3. The wallet plugin's storage key is configurable via options, so two DxKit apps on the same origin persist wallet selection independently.

**Plans**: 3/3 plans complete
**Wave 1**

- [x] 03-01-PLAN.md — SEC-01 sanitizer hook: `TemplateSanitizer` + `sanitizeTemplate` on `LifecycleManagerOptions`, fail-closed slot before `innerHTML` [wave 1]
- [x] 03-02-PLAN.md — SEC-02 wallet `storageKey` isolation + folded WR-02 empty-accounts throw / WR-03 reconnect `dx:error` [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-03-PLAN.md — D-04/D-05 `ShellConfig.lifecycle` nested group (BREAKING) + flat-loader runtime throw + shell test migration [wave 2, depends 03-01]

### Phase 4: Testing — Stress, Edge-Case & Regression Coverage

**Goal**: The test suite covers the concurrency, validation-edge-case, and cleanup scenarios the concerns audit called out as missing.
**Depends on**: Phase 2 (TEST-03 verifies the ROB-04 settings-cleanup fix; stress/timeout tests build on Phase 2's load-guard work)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):

  1. A stress-test suite drives rapid A→B→A navigation with slow loaders and asserts no double-mount and no lost-unmount occurs.
  2. Manifest-validation tests cover invalid route formats, deep-merge override behavior, and multi-match routes, each asserting the correct accept/reject/merge outcome.
  3. A regression test verifies settings handlers registered by a dapp do not fire after that dapp is disabled via `disableDapp()`.

**Plans**: 6/6 plans complete

**Wave 1**

- [x] 04-01-PLAN.md — TEST-01: mount-generation guard (last-navigation-wins fix) + `invalidatePendingMount` hook + dedicated stress suite covering the full D-03 race matrix [wave 1]
- [x] 04-03-PLAN.md — TEST-03: full-shell settings-cleanup integration regression (real `createShell`→`disableDapp`) + D-09 deepMerge assertions & JSDoc reconcile [wave 1]

**Wave 2** *(blocked on Wave 1 — shares `src/shell.ts` with 04-01)*

- [x] 04-02-PLAN.md — TEST-02 + WR-01: shell-owned manifest normalize/reject/tier-validate/duplicate-route `dx:error` + fetch/parse failure emits, with router- and shell-level edge-case tests [wave 2, depends 04-01]

**Gap closure** *(CR-01 from 04-VERIFICATION.md — Truth #4 failed)*

- [x] 04-04-PLAN.md — TEST-01: close D-01 hole for the dapp→unmatched-route transition — `handleRouteChange`'s null-manifest branch invalidates the in-flight pending mount, plus a stress regression scenario [wave 1, no deps]
- [x] 04-05-PLAN.md — TEST-01: close D-01 hole reopened by the `pendingMountId` clobber — guard `mountDapp`'s finally + add `lifecycle.invalidateAnyPendingMount()` (shell-independent), wire it into `handleRouteChange`'s null branch, plus an A→B-overlap-then-unmatched-route stress regression scenario [wave 1, no deps]
- [x] 04-06-PLAN.md — TEST-01: close the third D-01 instance (CR-01) — make the shell dedupe slot call-scoped (`pendingMountToken`) and free it on invalidation at both call sites (`handleRouteChange` null branch, `disableDapp`) so a re-navigation to an invalidated dapp mounts fresh, plus A→unmatched→A (WR-11) and disableDapp→enableDapp→re-navigate stress regression scenarios [wave 1, no deps]

### Phase 5: Documentation — Truth Pass

**Goal**: Every framework and plugin doc, plus the README, accurately reflects 0.2.0 code behavior, is free of AI-generated filler, and fills the gaps the concerns audit identified.
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4 (docs must describe final 0.2.0 behavior, including new events, config, and test-surfaced guarantees)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):

  1. Every event name, config option, and behavior claim in `docs/` and `README.md` is checked against the 0.2.0 code, with drift corrected (new `dx:error` payloads, timeout config, sanitizer hook, storage key option, etc. documented).
  2. No filler, hedging, restated-obviousness, or invented/unverifiable detail remains in the docs — every technical claim traces to source.
  3. A CSP guidance section (covering `innerHTML` template injection and external script loading) and a security/limitations note exist in the docs.

**Plans**: 4/8 plans executed

**Wave 1** *(folded code fixes land first — docs then describe post-fix behavior)*

- [x] 05-01-PLAN.md — Folded fixes: D-15 registry.json failure `dx:error` (explicit `registryUrl`), D-16 disable-mid-flight navigates to `/`, D-17 `inFlightMountId` ownership guard + test nits [wave 1]

**Wave 2** *(doc-by-doc sweep + new security.md; all depend on 05-01)*

- [x] 05-02-PLAN.md — Reference docs: events-reference.md (`dx:error` catalog rewrite) + api-reference.md [wave 2]
- [x] 05-03-PLAN.md — configuration.md + getting-started.md (+ 0.1.5→0.2.0 migration section, D-05) [wave 2]
- [x] 05-04-PLAN.md — Behavior docs: dapp-development.md + system-internals.md (single disable rule, D-16) [wave 2]
- [ ] 05-05-PLAN.md — Plugin docs: plugin-development.md + wallet/auth/theme/settings [wave 2]
- [ ] 05-06-PLAN.md — cookbook.md + development.md + testing.md [wave 2]
- [ ] 05-07-PLAN.md — New docs/security.md: CSP guidance + DOMPurify recipes + limitations inventory (DOC-03) [wave 2]

**Wave 3** *(close-out; depends on all wave-2)*

- [ ] 05-08-PLAN.md — D-04 compile-check harness + README index reconciliation (D-12) + example spot-check + cross-doc consistency + drift-log assembly (D-01) [wave 3]

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Diagnostics — Surface Silent Failures | 2/2 | Complete    | 2026-07-11 |
| 2. Robustness — Load Guards, Caching & Handler Cleanup | 4/4 | Complete    | 2026-07-12 |
| 3. Security — Sanitization & Storage Isolation | 3/3 | Complete    | 2026-07-12 |
| 4. Testing — Stress, Edge-Case & Regression Coverage | 6/6 | Complete    | 2026-07-14 |
| 5. Documentation — Truth Pass | 4/8 | In Progress|  |

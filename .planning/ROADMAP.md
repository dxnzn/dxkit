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

- [ ] **Phase 1: Diagnostics — Surface Silent Failures** - `dx:error` fires for every previously-silent failure path (missing mount, storage errors, entry-load failures)
- [ ] **Phase 2: Robustness — Load Guards, Caching & Handler Cleanup** - Mounts can't hang, router/template work isn't repeated, and disabled dapps stop leaking settings handlers
- [ ] **Phase 3: Security — Sanitization & Storage Isolation** - Templates can be sanitized before injection and wallet storage keys no longer collide across apps
- [ ] **Phase 4: Testing — Stress, Edge-Case & Regression Coverage** - Concurrent-navigation, manifest-validation, and settings-cleanup behavior gets dedicated test coverage
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

**Plans**: 1/2 plans executed

- [x] 01-01-PLAN.md — Shell/lifecycle mount diagnostics: emit `dx:error` on missing `#dx-mount` (DIAG-01) + clear container on entry/dependency load failure (DIAG-03)
- [ ] 01-02-PLAN.md — Plugin storage diagnostics: emit `dx:error` on localStorage read/write failure in settings, theme, wallet (DIAG-02)

### Phase 2: Robustness — Load Guards, Caching & Handler Cleanup

**Goal**: Mounts can't hang indefinitely, redundant router/template work is eliminated, and settings handlers don't leak across a disabled dapp.
**Depends on**: Nothing (independent hardening track; sequenced after Phase 1)
**Requirements**: ROB-01, ROB-02, ROB-03, ROB-04
**Success Criteria** (what must be TRUE):

  1. A lifecycle manager configured with a load timeout aborts and emits `dx:error` for a script/style/template fetch that exceeds it, instead of hanging the mount indefinitely.
  2. `Router.resolve()` reuses a cached, length-sorted manifest list across repeated navigations, re-sorting only when manifests change.
  3. Repeated mounts of the same dapp reuse a template cached by URL rather than re-fetching it, with an explicit invalidation path.
  4. Handlers a dapp registered via `onChange()`/`onAnyChange()` stop firing and are removed once that dapp is disabled via `disableDapp()`.

**Plans**: TBD

### Phase 3: Security — Sanitization & Storage Isolation

**Goal**: Injected templates can be sanitized before DOM insertion, and multiple DxKit apps on one origin no longer collide over wallet storage.
**Depends on**: Nothing (independent hardening track; sequenced after Phase 2)
**Requirements**: SEC-01, SEC-02
**Success Criteria** (what must be TRUE):

  1. A template sanitizer hook, when configured on the lifecycle manager, runs on fetched template HTML before `innerHTML` injection.
  2. With no sanitizer configured, template injection behavior is unchanged from 0.1.5 (backward-compatible default).
  3. The wallet plugin's storage key is configurable via options, so two DxKit apps on the same origin persist wallet selection independently.

**Plans**: TBD

### Phase 4: Testing — Stress, Edge-Case & Regression Coverage

**Goal**: The test suite covers the concurrency, validation-edge-case, and cleanup scenarios the concerns audit called out as missing.
**Depends on**: Phase 2 (TEST-03 verifies the ROB-04 settings-cleanup fix; stress/timeout tests build on Phase 2's load-guard work)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):

  1. A stress-test suite drives rapid A→B→A navigation with slow loaders and asserts no double-mount and no lost-unmount occurs.
  2. Manifest-validation tests cover invalid route formats, deep-merge override behavior, and multi-match routes, each asserting the correct accept/reject/merge outcome.
  3. A regression test verifies settings handlers registered by a dapp do not fire after that dapp is disabled via `disableDapp()`.

**Plans**: TBD

### Phase 5: Documentation — Truth Pass

**Goal**: Every framework and plugin doc, plus the README, accurately reflects 0.2.0 code behavior, is free of AI-generated filler, and fills the gaps the concerns audit identified.
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4 (docs must describe final 0.2.0 behavior, including new events, config, and test-surfaced guarantees)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):

  1. Every event name, config option, and behavior claim in `docs/` and `README.md` is checked against the 0.2.0 code, with drift corrected (new `dx:error` payloads, timeout config, sanitizer hook, storage key option, etc. documented).
  2. No filler, hedging, restated-obviousness, or invented/unverifiable detail remains in the docs — every technical claim traces to source.
  3. A CSP guidance section (covering `innerHTML` template injection and external script loading) and a security/limitations note exist in the docs.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Diagnostics — Surface Silent Failures | 1/2 | In Progress|  |
| 2. Robustness — Load Guards, Caching & Handler Cleanup | 0/TBD | Not started | - |
| 3. Security — Sanitization & Storage Isolation | 0/TBD | Not started | - |
| 4. Testing — Stress, Edge-Case & Regression Coverage | 0/TBD | Not started | - |
| 5. Documentation — Truth Pass | 0/TBD | Not started | - |

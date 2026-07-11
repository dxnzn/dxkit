# Requirements: DxKit — 0.2.0 Hardening

**Defined:** 2026-07-11
**Core Value:** DxKit stays trustworthy for real use — failures are visible, documented behavior matches actual behavior, and the alpha is stable enough to build on.

## v1 Requirements

Requirements for the 0.2.0 hardening milestone. Each maps to a roadmap phase.

### Diagnostics — surface silent failures

- [x] **DIAG-01**: Shell emits `dx:error` when the `#dx-mount` container can't be resolved (instead of silently skipping the mount)
- [ ] **DIAG-02**: Plugins emit `dx:error` when a `localStorage` read/write fails (wallet, theme, settings) rather than swallowing it
- [x] **DIAG-03**: On entry-script load failure, the shell emits `dx:error` and clears/restores the mount container so stale dapp DOM is not left visible

### Robustness

- [ ] **ROB-01**: Lifecycle manager accepts an optional load timeout for script/style/template fetches so a hung URL can't freeze a mount indefinitely
- [ ] **ROB-02**: Router caches its length-sorted manifests so `resolve()` does not re-sort on every navigation
- [ ] **ROB-03**: Templates are cached by URL with explicit invalidation, avoiding re-fetch on repeated mounts of the same dapp
- [ ] **ROB-04**: Settings handlers registered by a dapp are cleaned up when that dapp is disabled via `disableDapp()` (no leaked handlers, no firing on disabled dapps)

### Security

- [ ] **SEC-01**: Lifecycle manager exposes an optional template sanitizer hook applied before `innerHTML` injection
- [ ] **SEC-02**: Wallet plugin storage key is configurable via options so two DxKit apps on the same origin don't collide

### Testing

- [ ] **TEST-01**: Stress tests cover concurrent navigation and mount races (rapid A→B→A with slow loaders) without double-mount or lost-unmount
- [ ] **TEST-02**: Manifest-validation edge cases are tested (invalid route formats, deep-merge overrides, multi-match routes)
- [ ] **TEST-03**: Tests verify settings-handler cleanup on `disableDapp()` (handlers do not fire after disable)

### Documentation

- [ ] **DOC-01**: Every framework and plugin doc plus README is verified against the code (code is truth) and drift is corrected
- [ ] **DOC-02**: "AI tells" / slop is removed from docs (filler, hedging, restated obviousness, invented or unverifiable detail)
- [ ] **DOC-03**: Documentation gaps surfaced by the concerns audit are filled — CSP guidance for `innerHTML` templates + external scripts, and a security/limitations note

## v2 Requirements

Acknowledged and deferred to future milestones. Not in this roadmap.

### Platform

- **PLAT-01**: Migrate the toolchain to TypeScript 6 (tracked separately in docs/plans TODO)

### Routing

- **ROUTE-01**: Support wildcard / regex / `:param` routes (e.g. `/user/:id`)

### Storage

- **STOR-01**: Optional encryption layer for persisted settings and wallet state

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Built-in cross-dapp state sharing | Conflicts with the headless, event-only design — dapps coordinate via the event bus by intent |
| Reshaping the public API for its own sake | Milestone hardens behavior; breaking changes must clearly improve the API and carry migration notes |
| Feature additions beyond hardening | This milestone raises robustness/trust, not surface area |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIAG-01 | Phase 1 | Complete |
| DIAG-02 | Phase 1 | Pending |
| DIAG-03 | Phase 1 | Complete |
| ROB-01 | Phase 2 | Pending |
| ROB-02 | Phase 2 | Pending |
| ROB-03 | Phase 2 | Pending |
| ROB-04 | Phase 2 | Pending |
| SEC-01 | Phase 3 | Pending |
| SEC-02 | Phase 3 | Pending |
| TEST-01 | Phase 4 | Pending |
| TEST-02 | Phase 4 | Pending |
| TEST-03 | Phase 4 | Pending |
| DOC-01 | Phase 5 | Pending |
| DOC-02 | Phase 5 | Pending |
| DOC-03 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 15 total
- Mapped to phases: 15/15 ✓
- Unmapped: 0

---
*Requirements defined: 2026-07-11*
*Last updated: 2026-07-11 after roadmap creation*

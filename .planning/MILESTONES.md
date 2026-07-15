# Milestones

## v1.0 Beta Hardening (Shipped: 2026-07-15)

**Phases completed:** 5 phases, 23 plans, 51 tasks

**Key accomplishments:**

- Missing `#dx-mount` and post-injection load failures now surface via `dx:error` (source `shell:mount`) and clear stale template DOM instead of failing silently.
- Settings, theme, and wallet plugins now emit `dx:error` (source `plugin:<name>:storage:<op>`) on genuine localStorage read/write failures, while staying silent when storage is entirely unavailable — wallet gained a `canUseStorage()` guard it previously lacked.
- Per-fetch load timeout (30000ms default) with true-abort machinery for built-in script/style/template loaders and a Promise.race hang guard for custom loaders, shipped as a documented breaking change.
- Hoisted the per-call length-sort out of `Router.resolve()` into the `createRouter` closure — resolve() now iterates a construction-time snapshot instead of re-sorting the manifest list on every navigation.
- Settings plugin now prunes a disabled dapp's onChange/onAnyChange handlers via a dx:dapp:disabled subscription, leaving the `_shell` toggle-bridge intact.
- Per-manager `Map<url, html>` template cache wrapping the timeout-wrapped `loadTemplate` loader outermost, on by default, with `clearTemplateCache()`/`invalidateTemplate(url)` invalidation and a `cacheTemplates: false` opt-out.
- Optional bring-your-own `sanitizeTemplate` hook on `LifecycleManagerOptions`, fail-closed on sanitizer failure, byte-for-byte unchanged when unconfigured.
- Configurable `WalletOptions.storageKey` (default `'dxkit:wallet'`) isolates provider-selection persistence per app, plus two folded correctness fixes: empty-accounts throws instead of emitting a malformed connected state, and silent auto-reconnect failure now surfaces via `dx:error`.
- Nested `ShellConfig.lifecycle?: LifecycleManagerOptions` group replaces the flat scriptLoader/styleLoader/templateLoader fields, with a runtime throw guarding untyped consumers — closing the path for SEC-01's sanitizer (and Phase 2's timeout/cacheTemplates) to reach `createShell()`.
- Closure-scoped mount-generation guard fixes last-navigation-wins in lifecycle.mount(), plus a dedicated tests/stress.test.ts proving the full D-03 concurrency matrix — suite ships green.
- Shell-owned normalize+validate+dedupe choke point closes route-normalization, tier-parity, duplicate-route, and WR-01 silent-swallow gaps, with full regression coverage in shell.test.ts and router.test.ts.
- Full-shell `disableDapp()` → settings-handler-cleanup regression through real wiring, plus deepMerge's nested array/pollution-guard semantics locked and its JSDoc corrected to code truth.
- Closed CR-01 — `handleRouteChange`'s null-manifest branch now invalidates an in-flight pending mount before unmounting, so navigating to an unmatched route can no longer let a stale dapp's mount commit under the new URL.
- Closed the reopened D-01 gap (CR-01) by guarding mountDapp's finally and adding a lifecycle-truth invalidateAnyPendingMount() entry point that handleRouteChange's null branch now calls, so an A->B overlapping mount can no longer commit a stale B under an unmatched route.
- Made the shell's mount dedupe slot call-scoped (pendingMountToken) and liveness-aware (releasePendingMount() at both invalidation sites), so a re-navigation to a dapp whose in-flight mount was invalidated by an unmatched route or disableDapp() mounts fresh instead of being silently dropped for up to the 30s loader timeout.
- Registry-failure visibility (D-15), disable-mid-flight navigate-to-/ (D-16), and inFlightMountId ownership hygiene (D-17) land with regression tests before the phase 5 doc sweep, so the docs describe final 0.2.0 behavior.
- Rewrote `docs/events-reference.md`'s `dx:error` catalog wholesale against a fresh source grep (4 examples -> 23 traced source+trigger rows) and verified `docs/api-reference.md` field-for-field against the 0.2.0 public type surface, correcting the `ShellConfig.lifecycle` Omit drift, four undocumented `LifecycleManager` methods, and two wrong package names.
- Verified configuration.md and getting-started.md against construction-time config defaults (already accurate); added getting-started.md's "Migrating to 0.2.0" section covering the three 0.2.0 breaking changes with before/after snippets.
- Verified dapp-development.md and system-internals.md against post-D-16 source (src/shell.ts, src/lifecycle.ts, src/router.ts, src/events.ts, src/registry.ts) — both docs now state the single converged disable-while-active outcome rule and fill six previously-undocumented internal-behavior gaps in system-internals.md.
- Verified all five plugin docs against source (src/types/interfaces.ts, src/events.ts, src/shell.ts, plugins/{wallet,auth,theme,settings}/src/index.ts) — filled the SEC-02 storageKey gap that made wallet.md's Setup section entirely omit its own primary option, added the settings handler-cleanup behavior that was undocumented since ROB-04 shipped in Phase 2, and fixed a backwards duck-typing attribution and a false "register settings last" claim repeated in two docs.
- Verified docs/cookbook.md's 13 recipes, docs/development.md's build/toolchain claims, and docs/testing.md's Vitest/happy-dom setup against source and the built dist/ artifacts — fixed a stale module-augmentation package name shared with two already-corrected docs, a plugin IIFE bundling claim that didn't match the compiled output, and a make audit scope overclaim.
- Authored the phase's one net-new doc: CSP policies for three deployment shapes reasoned against `src/lifecycle.ts`'s actual loaders, both DOMPurify consumption-mode sanitizer recipes with an explicit scope limit, and a seven-item honest limitations inventory traced to `CONCERNS.md`.
- Mechanical `tsc`-based compile-check harness across every doc TS snippet caught 2 real package-name/config-shape bugs; README doc index reconciled with 4 new rows; a cross-doc nav-bar gap spanning all 11 docs fixed; canonical 05-DRIFT-LOG.md assembled as DOC-01's auditable proof.

---

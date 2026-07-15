# Phase 5 Drift Log — Documentation Truth Pass

**Assembled:** 2026-07-14 (Plan 05-08, Task 3)
**Source:** per-plan fragments in `drift/*.md` (Plans 05-02 through 05-08)

This is DOC-01's verifiable proof: every framework doc, plugin doc, README, and the executable
example was read against current source (0.2.0) and corrected where it drifted. Per D-01, this
assembles those per-plan fragments into one auditable record — a per-doc entry (what was wrong,
what changed) plus the completion checklist required by D-02.

<domain-source>
Fragments assembled, in sweep order:
- `drift/02-reference.md` — Plan 05-02 (events-reference.md, api-reference.md)
- `drift/03-config-getting-started.md` — Plan 05-03 (configuration.md, getting-started.md)
- `drift/04-behavior-docs.md` — Plan 05-04 (dapp-development.md, system-internals.md)
- `drift/05-plugins.md` — Plan 05-05 (plugin-development.md, docs/plugins/{wallet,auth,theme,settings}.md)
- `drift/06-low-fanout.md` — Plan 05-06 (cookbook.md, development.md, testing.md)
- `drift/07-security.md` — Plan 05-07 (docs/security.md — net-new, D-08)
- `drift/08-closeout.md` — Plan 05-08 (mechanical compile-check pass, README index, cross-doc sweep)
</domain-source>

---

## docs/events-reference.md

Verified against `src/shell.ts`, `src/lifecycle.ts`, `src/events.ts`, `plugins/*/src/index.ts`.

8 fixes: `dx:error` source-string table replaced with a complete 23-row catalog (was a 4-example
parenthetical); intro rewritten to name all four error origins (shell, lifecycle, plugin `init()`,
plugin storage) and the wrapped-`cause` convention (incl. which sites omit `cause`); handler
example updated to show `error.cause`; the D-15 registry-fallback failure added as a new catalog
row; `declare module 'dxkit'` → `'@dnzn/dxkit'`; `dx:mount` payload's `path` fallback documented;
`dx:dapp:disabled` unconditional-fire clause added; `dx:event:registered` no-op-on-re-registration
clause added. Full detail: `drift/02-reference.md`.

## docs/api-reference.md

Verified against `src/types/*.ts`, `src/lifecycle.ts`, `src/utils.ts`, `src/shell.ts`, plus a
mechanical `tsc --noEmit --strict` pass in Plan 05-08 asserting every hand-copied interface is
mutually assignable with the real exported 0.2.0 type.

7 fixes (Plan 05-02): `ShellConfig.lifecycle` corrected to `Omit<LifecycleManagerOptions,
'hasPlugin'>` (was bare `LifecycleManagerOptions`, implying `hasPlugin` was consumer-configurable —
RESEARCH Pitfall 2); `LifecycleManager` interface completed with 4 missing methods
(`clearTemplateCache`, `invalidateTemplate`, `invalidatePendingMount`, `invalidateAnyPendingMount`);
`EventMap['dx:ready']` corrected to `Record<string, never>`; `declare module 'dxkit'` →
`'@dnzn/dxkit'`; `Context.settings` package reference corrected to `@dnzn/dxkit-settings`;
`deepMerge` doc'd null-replaces behavior; `disableDapp(id)` doc'd the D-16 navigate-to-`/` outcome.
Plan 05-08's compile-check harness (33 TS snippets, every interface) ran clean — no further drift.
Full detail: `drift/02-reference.md`, `drift/08-closeout.md`.

## docs/configuration.md

Verified against `src/shell.ts`, `src/lifecycle.ts`, `plugins/*/src/index.ts`; config defaults were
already accurate going in. 2 fixes (Plan 05-03): breaking-change callout rewritten to timeless
present (D-07) with a pointer to the new migration section; added the custom-loader
`Promise.race`-guard-vs-true-abort distinction. Compile-check harness (Plan 05-08) confirmed both
TS snippets (`ShellConfig`, `LifecycleManagerOptions`) mutually assignable with real types. Full
detail: `drift/03-config-getting-started.md`, `drift/08-closeout.md`.

## docs/getting-started.md

2 fixes (Plan 05-03): added a dedicated "Migrating to 0.2.0" section covering all three breaking
changes (30s default timeout + escape hatch, nested `lifecycle` loaders, route
normalization/rejection) with before/after snippets, per D-05; trimmed the old inline
breaking-change mention to timeless present and added the TOC link. `examples/getting-started`
spot-check (Plan 05-08) confirmed the linked sample project matches the final `ShellConfig` shape.
Full detail: `drift/03-config-getting-started.md`.

## docs/dapp-development.md

2 fixes (Plan 05-04): added a "Disabling the Active Dapp" section stating the single post-D-16
outcome rule (disabling the dapp whose route is active — mounted or still loading — returns the
browser to `/`); fixed a broken TOC anchor (`Permission Gating` → `Requirement Gating`). Full
detail: `drift/04-behavior-docs.md`.

## docs/system-internals.md

8 fixes (Plan 05-04) + 1 fix (Plan 05-08): added "Manifest Route Normalization" as a distinct
once-at-load-time function (separate from the router's per-navigation normalizer); added
"Duplicate Routes" (stable-sort first-wins + `dx:error`); split "Mount de-duplication" into the
lifecycle-level generation guard (general last-navigation-wins) and the shell-level same-dapp
dedupe (narrower, additional guard); corrected the Navigation Sequence diagram (`unmount()` happens
*inside* `mount()`, not before it); added "Template Loading & Container Clearing" (pre- vs.
post-injection failure handling); added "Template Caching"; added the missing
`normalizeAndValidateManifests()` step to the Init Sequence diagram; rewrote the Optional Dapp
State Machine's disable-outcome step to the single post-D-16 rule. Plan 05-08 additionally caught a
stale flat-field reference (`ShellConfig.scriptLoader` → `ShellConfig.lifecycle.scriptLoader`)
missed by the fenced-snippet harness because it was prose, found via the same flat-loader grep
sweep. Full detail: `drift/04-behavior-docs.md`, `drift/08-closeout.md`.

## docs/plugin-development.md

2 fixes (Plan 05-05) + 2 fixes (Plan 05-08): corrected the duck-typing attribution (it's the
**shell** that checks the **settings** plugin for `getSettingsAPI()`, not the reverse); corrected
the false "settings must be registered last" claim — registration always completes before any
`init()` runs, so declaration order doesn't gate settings' discovery; reordered the example to
`wallet, auth, settings, theme` with rationale. Plan 05-08's compile-check harness caught two
package-name bugs the earlier plan missed: `declare module 'dxkit'` → `'@dnzn/dxkit'`, and
`import '@dxkit/settings'` → `import '@dnzn/dxkit-settings'`. Full detail: `drift/05-plugins.md`,
`drift/08-closeout.md`.

## docs/cookbook.md

2 fixes (Plan 05-06): `declare module 'dxkit'` → `'@dnzn/dxkit'` (same bug class as
events-reference.md/api-reference.md, independently present here); added `deepMerge`'s
null-replaces behavior to the "Remote Manifests with Overrides" recipe. Compile-check harness
(Plan 05-08) confirmed the corrected module-augmentation snippet is valid. Full detail:
`drift/06-low-fanout.md`, `drift/08-closeout.md`.

## docs/development.md

3 fixes (Plan 05-06): corrected the monorepo layout tree (all four plugins have `src/`+`tests/`,
not just the last one shown); corrected the plugin-IIFE-bundling claim (no plugin bundles a
sibling plugin package — verified against compiled `dist/index.global.js` output, not just
`tsup.config.ts` intent); corrected `make audit`'s tool-scope attribution (only `semgrep` scopes to
`src/ plugins/`; `pnpm audit` and `gitleaks` don't take that path arg). Full detail:
`drift/06-low-fanout.md`.

## docs/testing.md

1 fix (Plan 05-06): reworded a D-13-slop-bar false positive ("not just ones that..." →
"not only ones that..."). Full detail: `drift/06-low-fanout.md`.

## docs/security.md (net-new, D-08)

Net-new doc — no prior version to diff. Content sourced from `src/lifecycle.ts` (CSP directive
mapping, `innerHTML` execution semantics), `.planning/codebase/CONCERNS.md` (the limitations
inventory), and 05-RESEARCH.md's CSP research (meta-vs-header directive support, IPFS gateway
origin-isolation caveat — both flagged MEDIUM-confidence/directional in the Assumptions Log).
Covers: CSP directive mapping + three deployment-shape policy examples (same-origin, IPFS gateway,
cross-origin assets); the `innerHTML`-doesn't-execute-`<script>` reasoning for why `script-src`
still matters; DOMPurify recipes for both ESM/bundler and IIFE/static consumption; the full
limitations inventory (template/entry trust, sanitizer scope, localStorage plaintext, `storageKey`
collision risk, IIFE global collision, `shell.destroy()` requirement, single-dapp-at-a-time). Full
detail: `drift/07-security.md`.

## docs/plugins/wallet.md

6 fixes (Plan 05-05): added the undocumented `storageKey` option (SEC-02) to the interface and
options table; rewrote Persistence to cover the configurable key, no-migration behavior, and the
WR-03 reconnect-failure handling; documented the WR-02 empty-accounts guard on
`createEIP1193Provider()`; split `connect(providerId?)`'s throw conditions into the two precise
code branches; added the previously-undocumented `createEthereumWallet()` deprecated shim; added an
Error Handling subsection cataloging all four wallet `dx:error` sources. Full detail:
`drift/05-plugins.md`.

## docs/plugins/auth.md

1 fix (Plan 05-05): documented the unresolved-`walletPlugin`-plugin graceful-degradation behavior
(stays permanently unauthenticated; only `authenticate()` throws). Full detail:
`drift/05-plugins.md`.

## docs/plugins/theme.md

4 fixes (Plan 05-05): noted the init-time settings-sync push requires `settings` to already be
registered; added the same-value no-op clause to both `setMode()`/`setTheme()`; added an Error
Handling subsection cataloging both theme `dx:error` sources; added the `storageKey`
collision-risk note (no SEC-02-equivalent isolation), pointing to `docs/security.md`. Full detail:
`drift/05-plugins.md`.

## docs/plugins/settings.md

4 fixes (Plan 05-05): corrected the same false "register settings last" claim independently present
here (registration order doesn't gate discovery; settings must instead precede plugins whose
`init()` *writes* to `dx.settings`, i.e. theme); added the previously-undocumented ROB-04
handler-cleanup-on-disable behavior; added an Error Handling subsection cataloging both settings
`dx:error` sources; added the `storageKey` collision-risk note. Full detail: `drift/05-plugins.md`.

## README.md

Doc-index reconciliation (D-12) + verification (D-06) (Plan 05-08): added 4 table rows
(`configuration.md`, `development.md`, `testing.md`, `security.md`) in the existing terse register;
verified the audit link, install commands (all 5 package names), the `make` helper table (matches
`Makefile` targets 1:1), and the Build System section (ESM/CJS/IIFE, `exports` field, IIFE globals,
`noExternal`) against the repo — all accurate, no drift beyond the missing rows; version cell
(`0.1.5`) and status (`vibe/alpha`) left untouched per D-06. Full detail: `drift/08-closeout.md`.

## examples/getting-started (executable documentation)

Spot-checked (Plan 05-08) against the final `ShellConfig` shape: `createShell({ plugins, dapps,
mode })` — no `lifecycle`/loader config used, so no flat-vs-nested question to get wrong. No drift
found; already constructs a valid 0.2.0 shell. Full detail: `drift/08-closeout.md`.

## Cross-doc consistency sweep (Plan 05-08)

- **Navigation gap:** all 11 `docs/*.md` files' internal top-of-file nav bars only ever listed the
  original 7 framework docs — `Configuration`/`Development`/`Testing`/`Security` were unreachable
  from any doc's own nav, including from each other. Fixed: all 11 nav bars rewritten to a
  consistent 11-doc list, each doc bolding itself. A leftover `<!-- generated-by: gsd-doc-writer
  -->` artifact comment (present in 4 of the 11 docs, absent from the other 7) was removed for the
  same consistency reason.
- **D-16 disable-mid-flight rule:** confirmed identically stated (single navigate-to-`/` outcome,
  no committed-vs-in-flight divergence) across `docs/api-reference.md`, `docs/dapp-development.md`,
  and `docs/system-internals.md`.
- **Package-name shorthand:** confirmed `@dxkit/<plugin>` (README table + doc titles/prose) vs.
  `@dnzn/dxkit-<plugin>` (real npm package, used in every actual install/import snippet) is a
  consistent, intentional convention — not drift.
- No contradicting event names, config defaults, or behavior descriptions found across the corpus.

## D-04 mechanical compile-check (Plan 05-08)

Every ` ```ts `/` ```typescript ` fenced block across all 15 `docs/` files was mirrored into a
throwaway `tsc --noEmit --strict` harness (not committed) and checked for mutual type-assignability
against the real exported 0.2.0 types (`src/index.ts` barrel + all four plugin barrels). Harness
ran clean after fixing 2 bugs (`docs/plugin-development.md`'s wrong package specifiers — see that
doc's entry above). No `hasPlugin`-through-`createShell` or flat-loader snippet remains anywhere in
the corpus outside the two clearly-labeled "0.1.5 // 0.2.0" before/after blocks in
`getting-started.md`'s migration section.

---

## Completion Checklist (D-02)

All 14 pre-existing `docs/` files + 1 net-new (`security.md`, D-08) + README + the executable
example — every unit in the phase's verification surface — checked:

**Framework docs (10):**
- [x] `docs/getting-started.md`
- [x] `docs/dapp-development.md`
- [x] `docs/plugin-development.md`
- [x] `docs/system-internals.md`
- [x] `docs/events-reference.md`
- [x] `docs/api-reference.md`
- [x] `docs/cookbook.md`
- [x] `docs/configuration.md`
- [x] `docs/development.md`
- [x] `docs/testing.md`

**Plugin docs (4):**
- [x] `docs/plugins/wallet.md`
- [x] `docs/plugins/auth.md`
- [x] `docs/plugins/theme.md`
- [x] `docs/plugins/settings.md`

**Net-new (1, D-08):**
- [x] `docs/security.md`

**Index + executable doc:**
- [x] `README.md`
- [x] `examples/getting-started/` (main.js + index.html)

**Phase-level passes:**
- [x] Cross-doc consistency sweep (event names, config defaults, disable-rule wording, navigation)
- [x] D-04 mechanical compile-check harness (every TS snippet, all 15 docs)

17/17 units checked. Phase 5 documentation truth pass complete.

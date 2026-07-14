# Drift Log — Plan 05-08 (Closeout: compile-check harness, README index, cross-doc sweep)

## Task 1 — D-04 compile-check harness

**Method:** every ` ```ts `/` ```typescript ` fenced block across all 15 docs (`docs/*.md`,
`docs/plugins/*.md`) was mechanically extracted into a scratch TS mirror (`tmp/doc-compile-check/`,
gitignored) and compiled with `tsc --noEmit --strict` against a throwaway `tsconfig.scratch.json`
(not committed) whose `paths` map mirrors `vitest.config.ts`'s alias table (`@dnzn/dxkit*` →
`src/index.ts` / `plugins/*/src/index.ts`) — the same resolution real consumers get. Each per-doc
mirror is its own module (`export {}`) so same-named doc interfaces across different docs (e.g.
`ShellConfig` in both `api-reference.md` and `configuration.md`) don't declaration-merge into one
global type and mask a divergence. A dedicated `_equivalence-checks.ts` additionally asserts every
hand-copied interface in `api-reference.md`/`configuration.md`/`docs/plugins/*.md` (`ShellConfig`,
`LifecycleManagerOptions` — both the full shape and the `Omit<..., 'hasPlugin'>` shape used under
`ShellConfig.lifecycle` — `DappManifest`, `DappEntry`, `Shell`, `Context`, `EventBus`, `Listener`,
`EventRegistry`, `EventRegistration`, `RegisteredEvent`, `Settings`, `SettingsSection`,
`SettingDefinition`, `Plugin`, `Wallet`, `WalletState`, `WalletProvider`, `Auth`, `AuthState`,
`Theme`, `ThemeMode`, `EventMap`, and the four plugin options interfaces) is mutually assignable
with the real exported 0.2.0 type — not just internally self-consistent. Bare method-signature
fragments and object-literal-property fragments (a doc convention: one API member documented per
fenced block, e.g. `docs/plugins/wallet.md`'s per-method sections) are wrapped in a stub
`interface`/`const` for parseability only — this doesn't change what the doc displays.

**Result:** harness runs clean (`tsc --noEmit -p tsconfig.scratch.json` exits 0) after two fixes.
HTML/IIFE snippets (` ```js `/` ```html `) were eyeball-verified: every `DxKit.`/`DxWallet.`/
`DxAuth.`/`DxTheme.`/`DxSettings.` factory call across all docs was cross-checked against the real
exported factory names (`createShell`, `createEventBus`, `createEventRegistry`,
`createPluginRegistry`, `createRouter`, `createLifecycleManager`, `createCSSTheme`,
`createLocalWalletProvider`, `createWallet`, `createEIP1193Provider`, `createSettings`,
`createPassthroughAuth`); all match. A grep sweep for `scriptLoader`/`styleLoader`/`templateLoader`
and `hasPlugin` across every doc confirmed no other flat-shape or `hasPlugin`-through-`createShell`
snippets remain outside the two intentionally-marked "0.1.5 // 0.2.0" before/after blocks in
`getting-started.md`'s migration section (correctly labeled, not presented as current API).

### Snippet drift found + fixed

| # | Doc | Was | Now | Source |
|---|-----|-----|-----|--------|
| 1 | `docs/plugin-development.md:150` | `declare module 'dxkit' { interface EventMap {...} }` — wrong package specifier in the "Typing Plugin Events" module-augmentation example | `declare module '@dnzn/dxkit' { ... }` | `package.json` (`"name": "@dnzn/dxkit"`); identical bug already fixed in `events-reference.md`/`api-reference.md`/`cookbook.md` by earlier plans — this doc had the same defect, unfixed until the compile-check harness parsed it and TS reported the module specifier resolved to nothing |
| 2 | `docs/plugin-development.md:163` | `import '@dxkit/settings'; // brings settings event types into scope` — wrong package name | `import '@dnzn/dxkit-settings'; ...` | `plugins/settings/package.json` (`"name": "@dnzn/dxkit-settings"`) |
| 3 | `docs/system-internals.md:208` | "Custom loaders can be passed via `ShellConfig.scriptLoader`" — stale flat-field reference, found while auditing the doc corpus for the same flat-loader pattern the harness targets | "...via `ShellConfig.lifecycle.scriptLoader`" | `src/types/shell.ts:27-30` (`ShellConfig.lifecycle` nests loader options — Phase 3 D-04/D-05 breaking change); this is prose, not a fenced snippet, so outside the harness's direct reach, but the same drift class the harness pass was auditing for |

**Everything else checked and found already correct:** all 33 TS snippets in `api-reference.md`
(factory signatures + every interface — `Shell`, `Context`, `EventBus`, `Listener`,
`EventRegistry`, `EventRegistration`, `RegisteredEvent`, `Router`/`RouterConfig`,
`LifecycleManager`/`LifecycleManagerOptions`, `PluginRegistry`, `Settings`/`SettingsSection`/
`SettingDefinition`, `ShellConfig`/`DappEntry`/`DappManifest`, `Plugin`, `Wallet`/`WalletState`/
`WalletProvider`, `Auth`/`AuthState`, `Theme`/`ThemeMode`, `EventMap`) — all mutually assignable
with real 0.2.0 exported types; `configuration.md`'s `ShellConfig`/`LifecycleManagerOptions`
snippets; all plugin-doc option interfaces (`PassthroughAuthOptions`, `SettingsPluginOptions`,
`CSSThemeOptions`, `WalletOptions`, `LocalWalletProviderOptions`) and per-method signature
fragments across `docs/plugins/{auth,settings,theme,wallet}.md`; `events-reference.md`'s and
`cookbook.md`'s module-augmentation examples (already correct `@dnzn/dxkit` specifier);
`docs/testing.md`'s `vitest.config.ts` excerpt (verbatim match against the real file);
`docs/development.md`'s `vitest.config.ts` `include` fragment. No `hasPlugin`-through-`createShell`
or flat-loader snippet presented as current (non-migration) API anywhere in the corpus.

Scratch harness (`tsconfig.scratch.json`, `tmp/doc-compile-check/`) is not committed — removed
after the pass; `tmp/` is gitignored.

---

## Task 2 — README index reconciliation + example spot-check + cross-doc consistency sweep

### README.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | Framework doc table indexed 7 of 11 framework docs — `configuration.md`, `development.md`, `testing.md`, `security.md` (D-08) were unindexed | Added 4 rows in the same terse register as existing rows | D-12, D-08 |
| 2 | Audit link (`audit/self/dxkit-0.1.0.md`) | Verified — file exists, unchanged | `audit/self/dxkit-0.1.0.md` |
| 3 | Install commands (`npm install @dnzn/dxkit`, `@dnzn/dxkit-auth/-wallet/-settings/-theme`) | Verified against each `package.json`'s `"name"` field — all match | `package.json`, `plugins/*/package.json` |
| 4 | `make` helper table (setup/build/test/test-watch/lint/lint-fix/lint-format/clean/superclean/audit) | Verified against `Makefile` target names — all match, none missing | `Makefile` |
| 5 | Build System section (ESM/CJS/IIFE, `exports` field, IIFE globals, `noExternal: ['@dnzn/dxkit']`) | Verified against `package.json` `exports`, `tsup.config.ts` — accurate | `package.json`, `tsup.config.ts` |
| 6 | Version cell (`0.1.5`) / status (`vibe/alpha`) | Left unchanged per D-06 — release tooling (`commit-and-tag-version`) owns the bump | D-06 |

`@dxkit/wallet`-style shorthand names in the README's plugin table (distinct from the real
`@dnzn/dxkit-wallet` npm package name) are an existing, consistent convention used identically in
every doc's prose/headings (`docs/plugins/wallet.md` titles itself `# @dxkit/wallet`,
`getting-started.md`'s architecture diagram and plugin list use the same shorthand) — not drift,
left as-is.

### examples/getting-started

Spot-checked `main.js` + `index.html` against the final `ShellConfig` shape: `createShell({
plugins, dapps, mode })` — no `lifecycle`/loader config at all, so there's no flat-vs-nested
question to get wrong. No drift found; matches 0.2.0 as-is.

### Cross-doc consistency sweep

| # | Finding | Fix | Scope |
|---|---|---|---|
| 1 | All 11 docs' internal top-of-file nav bars (`[Getting Started] \| [Dapp Development] \| ...`) listed only the original 7 framework docs — `Configuration`, `Development`, `Testing`, `Security` were unreachable from every doc's own nav, including from each other and from themselves (none of the 4 newer docs bolded their own name or linked back to the other 3) | Rewrote all 11 nav bars to a consistent 11-doc list, each doc bolding itself | `docs/*.md` (all 11) |
| 2 | 4 docs (`configuration.md`, `development.md`, `testing.md`, `security.md`) carried a leading `<!-- generated-by: gsd-doc-writer -->` HTML comment not present in any of the other 7 docs — inconsistent, informs nobody (D-13) | Removed | `docs/configuration.md`, `docs/development.md`, `docs/testing.md`, `docs/security.md` |
| 3 | Disable-mid-flight-navigates-to-`/` rule (D-16) | Confirmed identical single-outcome statement across `api-reference.md:131`, `dapp-development.md:114-119`, `system-internals.md:346-349` — no divergence | verified only, no edit |
| 4 | Package-name shorthand (`@dxkit/<plugin>` display name vs. `@dnzn/dxkit-<plugin>` real package) | Confirmed consistent across README and all docs (prose/headings only, never in an actual import/install snippet) | verified only, no edit |

No D-13 booster/hedge words introduced by any edit in this plan.

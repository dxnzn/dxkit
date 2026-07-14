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

<!-- gsd:write-continue -->

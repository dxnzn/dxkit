# Drift Log — Plan 05-05 (Plugin Docs)

Per-doc record of what was wrong and what changed, verified against source read this plan
(`src/types/interfaces.ts`, `src/types/context.ts`, `src/events.ts`, `src/shell.ts`,
`src/registry.ts`, `plugins/wallet/src/index.ts`, `plugins/auth/src/index.ts`,
`plugins/theme/src/index.ts`, `plugins/settings/src/index.ts`).

## docs/plugin-development.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | Duck-typing Patterns section: "The settings plugin, for example, checks whether other plugins expose a `getSettingsAPI()` method" and "In the settings plugin source, it checks:" above the code sample — attribution was backwards. The code sample itself (`registry.get('settings')` + `'getSettingsAPI' in settingsPlugin`) was already correct | Corrected the prose: it's the **shell** that duck-checks the registered **settings plugin** for `getSettingsAPI()`, while restoring persisted enable/disable state for optional dapps — not settings checking other plugins | `src/shell.ts:85-89` (`initEnabledState()`) |
| 2 | "The `settings` plugin should be registered last — it reads setting definitions from all other plugins during its `init()`." — unverified claim implying registration order controls whether settings discovers other plugins' `settings` arrays | Corrected: every plugin is registered (added to the registry) before any plugin's `init()` runs, so settings discovers every plugin's static `settings` array regardless of declaration order. What order actually controls is init-time access to another plugin's *live* state/API — `auth` needs `wallet` first (reads `wallet.getState()` in its own `init()`), `theme` needs `settings` first (writes to `context.settings` in its own `init()`). Reordered the "Registering a Plugin" example to `wallet, auth, settings, theme` with a comment explaining why theme comes after settings | `src/shell.ts:361-382` (`init()` — register-all loop, then init-all loop, in that order); `plugins/auth/src/index.ts:64-65` (`wallet.getState()` in `init()`); `plugins/theme/src/index.ts:108-114,191` (`syncToSettings()` guarded on `dx?.settings`, called from `init()`) |

**Everything else checked and found already correct:** `Plugin` base interface (`name`,
`init?`, `destroy?`, `settings?`) — matches `src/types/interfaces.ts:9-21`; Context surface
list (`events`, `eventRegistry`, `router`, `getPlugin`, `getPlugins`, `getManifests`,
`getEnabledManifests`, `enableDapp`/`disableDapp`/`isDappEnabled`, `settings?`) — matches
`src/types/context.ts:7-43`; custom-event namespace rules (`dx:plugin:<name>:<action>`,
segment-count-4, segment[2]-must-equal-source, built-in shell events rejected, same-source
re-registration is a no-op, different-source conflict throws) — matches
`src/events.ts:93-132`; module-augmentation typing pattern — matches the
`declare module '@dnzn/dxkit'` blocks actually present in all four plugin sources; no D-13
booster/hedge words present.

## docs/plugins/wallet.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | `WalletOptions` interface/table showed only `providers` — `storageKey` (SEC-02) was entirely undocumented | Added `storageKey?: string` to the interface and options table: default `'dxkit:wallet'`, full literal key (no prefixing), no migration from a previously-persisted selection | `plugins/wallet/src/index.ts:153-163` (`options.storageKey ?? 'dxkit:wallet'`) |
| 2 | Persistence section said only "saved to `localStorage` under the key `dxkit:wallet`. On init, the plugin attempts to reconnect" — no mention of the configurable key, no-migration behavior, or reconnect-failure handling | Rewrote: default key stated as configurable via `storageKey`; added the WR-03 reconnect-failure behavior (`dx:error` source `plugin:wallet:reconnect`, then persisted id cleared); added the no-migration note | `plugins/wallet/src/index.ts:270-285` (`init()` reconnect block) |
| 3 | `createEIP1193Provider()` bullet didn't mention the WR-02 empty-accounts guard | Added: "Throws if `eth_requestAccounts` resolves with zero accounts, rather than connecting with a null/undefined address" | `plugins/wallet/src/index.ts:46-49` |
| 4 | `connect(providerId?)` API doc said only "Throws if the provider is not found or not available" — didn't distinguish the with-id vs. without-id throw conditions | Split into two precise sentences matching the two code branches (`providerId` given and no match/unavailable; no `providerId` given and nothing `available()`) | `plugins/wallet/src/index.ts:307-316` |
| 5 | No mention anywhere in the doc of `createEthereumWallet()` or its deprecated status | Added a "`createEthereumWallet()` (deprecated)" subsection under Setup: backward-compat shim for `createWallet({ providers: [createEIP1193Provider()] })`, not first-class API | `plugins/wallet/src/index.ts:388-393` (`@deprecated` JSDoc) |
| 6 | No documentation of wallet's `dx:error` emissions at all | Added an "Error Handling" subsection under Events cataloging all four wallet `dx:error` sources (`plugin:wallet:storage:write`, `plugin:wallet:storage:read`, `plugin:wallet:state`, `plugin:wallet:reconnect`) with their triggers, linking to Events Reference for the full catalog | `plugins/wallet/src/index.ts:186-210` (storage read/write), `:220-226` (state contract violation), `:277-283` (reconnect) |

**Everything else checked and found already correct:** `createWallet(options)` return type and
`providers` option semantics; `connect()`/`disconnect()`/`getState()`/`sign()`/
`onStateChange()`/`getProviders()`/`getActiveProvider()` signatures and behavior descriptions;
`disconnect()`'s `revokeOnDisconnect` (EIP-1193-only, `wallet_revokePermissions`, best-effort
try/catch) description; `WalletState` shape and field table; the three
`dx:plugin:wallet:*` custom events and payloads; `revokeOnDisconnect` setting default `true`;
`LocalWalletProviderOptions.address` default; Writing a Custom Provider section (matches the
`WalletProvider` interface); no D-13 booster/hedge words present.

## docs/plugins/auth.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | No mention of what happens when `walletPlugin` doesn't resolve to a registered plugin — only `authenticate()`'s throw was documented | Added a note under Setup: auth degrades gracefully (stays permanently unauthenticated; `getState`/`isAuthenticated`/`onStateChange`/`deauthenticate` all still work), only `authenticate()` throws | `plugins/auth/src/index.ts:60-71` (`init()` — `wallet = context.getPlugin(...) ?? null`, no throw/error emit if `null`), `:84-92` (`authenticate()` throw), `:94-102` (`deauthenticate()`'s no-wallet fallback branch) |

**Everything else checked and found already correct:** `createPassthroughAuth(options?)`
signature and `walletPlugin` default `'wallet'`; `authenticate()`/`deauthenticate()`/
`getState()`/`isAuthenticated()`/`onStateChange()` behavior descriptions (delegate to wallet,
state syncs via `onStateChange`); `AuthState` shape and field table (`token`/`expiresAt`
always `null` in passthrough); the two `dx:plugin:auth:*` custom events and payloads (auth has
no `dx:error` emit sites — nothing to add there); no D-13 booster/hedge words present.

## docs/plugins/theme.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | "The theme plugin syncs bidirectionally with the settings plugin — changes from either side stay in sync" — didn't note that the one-time init-time push into `dx.settings` only fires if `settings` is already registered | Appended a clause noting the init-time push requires `settings` to be registered before `theme`, cross-referencing the plugin-development.md ordering fix made this plan | `plugins/theme/src/index.ts:108-114` (`syncToSettings()` guarded on `dx?.settings`), `:191` (called from `init()`) |
| 2 | `setMode()`/`setTheme()` API doc only noted the invalid-theme no-op (`setTheme(theme: string): void // set theme (no-op if not in themes list)`) — didn't mention the same-value no-op that applies to both setters | Added "(no-op if already the current mode)" / "(no-op if already current, or not in themes list)" | `plugins/theme/src/index.ts:212-213` (`setMode`'s `if (currentMode === mode) return;`), `:240-242` (`setTheme`'s two guards) |
| 3 | No documentation of theme's `dx:error` emissions anywhere in the doc | Added an "Error Handling" subsection under Events cataloging both theme `dx:error` sources (`plugin:theme:storage:write`, `plugin:theme:storage:read`) | `plugins/theme/src/index.ts:78-104` (`persist()`/`restore()`) |
| 4 | No mention of the theme `storageKey` collision risk (no SEC-02-equivalent per-app isolation) | Added a factual note under Persistence: unlike wallet, theme's `storageKey` has no per-app isolation guidance behind it, pointing to `docs/security.md` (Plan 05-07) for the full inventory | RESEARCH.md §Code Truth: Config Defaults — `CSSThemeOptions.storageKey` row ("theme has NOT been given the SEC-02 treatment") |

**Everything else checked and found already correct:** `createCSSTheme(options?)` options
table (`themes` default `['default']`, `defaultMode` default `'system'`, `storageKey` default
`'dxkit:theme'`, `onApply`); `onApply` hook firing conditions (init, mode change, theme
change, system-preference change); `getMode`/`toggleMode`/`getResolvedMode`/`onModeChange`/
`getTheme`/`getAvailableThemes`/`onThemeChange` signatures; `dx:plugin:theme:changed` payload
and firing conditions (both mode-change and theme-change paths); Settings section (`mode`
select default `'system'`, `theme` select shown only when `themes.length > 1`, default first
theme); Persistence restore-before-first-DOM-update ordering; CSS Authoring attribute names;
System Mode `prefers-color-scheme` listener description; no D-13 booster/hedge words present.

## docs/plugins/settings.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | "**Register last.** ... Plugins registered after it won't have their settings discovered." — same unverified claim corrected in plugin-development.md this plan | Corrected: registration order doesn't gate settings' discovery of other plugins' `settings` arrays (registration always completes before any `init()` runs); settings must instead be registered *before* plugins whose own `init()` writes to `dx.settings` (theme). Reordered the Quick Start example to `settings, theme` | `src/shell.ts:361-382` (register-all-then-init-all loops); `plugins/theme/src/index.ts:108-114,191` |
| 2 | No documentation anywhere of the `onChange()`/`onAnyChange()` handler-cleanup-on-disable behavior (ROB-04, validated Phase 2) | Added a "Handler Cleanup" subsection: handlers pruned on `dx:dapp:disabled` (not `dx:unmount` — survives normal navigation), nested `Map<dappId, Map<key, Set<handler>>>` structure so colon-prefix dapp ids can't collide, `_shell` toggle-bridge handlers untouched by other dapps' cleanup | `plugins/settings/src/index.ts:140-145` (`cleanup()`), `:242` (`dx:dapp:disabled` subscription, disable-only) |
| 3 | No documentation of settings' `dx:error` emissions anywhere in the doc | Added an "Error Handling" subsection under Events cataloging both settings `dx:error` sources (`plugin:settings:storage:write`, `plugin:settings:storage:read`) | `plugins/settings/src/index.ts:49-88` (`persist()`/`restore()`) |
| 4 | No mention of the settings `storageKey` collision risk | Added a factual note under Persistence, alongside the existing plaintext-storage security note: settings hasn't been given wallet's SEC-02 per-app-isolation treatment either, pointing to `docs/security.md` (Plan 05-07) for the full inventory | RESEARCH.md §Code Truth: Config Defaults — `SettingsPluginOptions.storageKey` row ("Same collision-risk note as theme") |

**Everything else checked and found already correct:** `createSettings(options?)` options
table (`storageKey` default `'dxkit:settings'`); `get`/`set`/`getAll`/`getSections` API
signatures and behavior (defaults-merged-with-stored, disabled-dapps-hidden-but-values-kept);
`dx:plugin:settings:changed` payload; existing plaintext-storage security note; Optional Dapp
Toggles synthesis (`_shell` section, `boolean` type, `m.enabled !== false` default, bridged to
`enableDapp`/`disableDapp`); `SettingDefinition`/`dependsOn` shape; Duck-typing section
(already correctly attributed — "the shell checks for this method," matching
`src/shell.ts:85-89`, unlike the equivalent section in plugin-development.md that needed
fixing this plan); no D-13 booster/hedge words present.

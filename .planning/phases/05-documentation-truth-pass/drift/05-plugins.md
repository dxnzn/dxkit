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

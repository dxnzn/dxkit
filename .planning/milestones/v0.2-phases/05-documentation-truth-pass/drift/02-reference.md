# Drift Log — Plan 05-02 (Reference Docs)

Per-doc record of what was wrong and what changed, verified against source read this plan
(`src/shell.ts`, `src/lifecycle.ts`, `src/events.ts`, `src/router.ts`, `src/types/*`,
`plugins/*/src/index.ts`, `package.json`).

## docs/events-reference.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | `dx:error` table listed 4 illustrative `source` examples (`'lifecycle:my-dapp'`, `:styles`, `:template`, `:dependency`) in a parenthetical | Replaced wholesale with a 23-row complete catalog covering every `shell:*`, `plugin:${name}`, `lifecycle:${id}[:stage]`, and plugin-storage/state/reconnect source string, one row per distinct trigger | `src/shell.ts`, `src/lifecycle.ts`, `plugins/wallet\|theme\|settings/src/index.ts` — every `events.emit('dx:error', …)` call site grepped and read |
| 2 | `dx:error` intro said "An error occurred in the shell or lifecycle" — omitted plugin `init()` failures and plugin storage-layer failures | Rewrote to name all four origins (shell, lifecycle, plugin `init()`, plugin storage) and stated the wrapped-Error-with-`cause` convention, including which sites do NOT set `cause` | `src/shell.ts:376-379` (`plugin:${name}` wraps non-Error, no cause); wallet/theme/settings storage sites (`{ cause: err }`) vs. manifest/route sites (fresh `Error`, no original to wrap) |
| 3 | `dx:error` handler example didn't show `error.cause` | Added `if (error.cause) console.warn('caused by:', error.cause);` to the example, matching the convention now documented above it | `src/types/events.ts` (`error.cause` is a real, populated field on several emit sites) |
| 4 | Registry-fallback failure (D-15, landed in Plan 01) wasn't documented at all — the doc predates the fix | Added as its own `shell:manifest` catalog row with the explicit-`registryUrl`-only gating condition stated | `src/shell.ts:260-287` (`loadManifests()`, post-D-15) |
| 5 | Module augmentation example used `declare module 'dxkit'` | Corrected package name to `declare module '@dnzn/dxkit'` | `package.json` (`"name": "@dnzn/dxkit"`) |
| 6 | `dx:mount` payload table didn't document the `path` fallback | Added "falls back to `manifest.route` if none was passed" | `src/lifecycle.ts:453` (`path: path ?? manifest.route`) |
| 7 | `dx:dapp:disabled` description didn't note it fires even with no active/pending mount | Added that clause | `src/shell.ts:134-168` (`disableDapp()` always emits at the end, regardless of the two invalidation branches above it) |
| 8 | `dx:event:registered` description didn't state the no-op-on-re-registration behavior | Added "Fires once per call with at least one newly registered name — a no-op re-registration by the same source does not re-fire" | `src/events.ts:129-131` (`if (newlyRegistered.length) bus.emit(...)`) |

## docs/api-reference.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | `ShellConfig.lifecycle?: LifecycleManagerOptions;` — implied `hasPlugin` is consumer-configurable from `createShell()` | Corrected to `lifecycle?: Omit<LifecycleManagerOptions, 'hasPlugin'>;` with a note that `hasPlugin` is shell-owned and cannot be overridden | `src/types/shell.ts:32` (`Omit<LifecycleManagerOptions, 'hasPlugin'>`); RESEARCH Pitfall 2 |
| 2 | `LifecycleManager` interface listed only 4 methods (`mount`, `unmount`, `getCurrentDapp`, `destroy`) | Added the 4 missing methods: `clearTemplateCache()`, `invalidateTemplate(url)`, `invalidatePendingMount(id)`, `invalidateAnyPendingMount()`, with one-line descriptions | `src/lifecycle.ts:3-27` (`LifecycleManager` interface, current shape) |
| 3 | `EventMap['dx:ready']` typed as `{}` in the Type Reference section | Corrected to `Record<string, never>` | `src/types/events.ts:11` |
| 4 | Module augmentation example used `declare module 'dxkit'` | Corrected to `declare module '@dnzn/dxkit'` | `package.json` |
| 5 | `Context.settings` comment said "injected by `@dxkit/settings`" | Corrected package name to `@dnzn/dxkit-settings` | `package.json` (workspace plugin package is `@dnzn/dxkit-settings`) |
| 6 | `deepMerge` description omitted null-replaces behavior | Added "`null` replaces `a`'s value" | `src/utils.ts:1` (JSDoc + implementation: `val !== undefined && val !== null` gates the recursive-merge branch, so `null` falls through to the plain-overwrite branch) |
| 7 | `disableDapp(id)` method table said only "Unmounts if currently mounted" | Added "or navigates to `/` if its route is active but the mount hasn't committed yet" reflecting the D-16 fix (landed Plan 01) | `src/shell.ts:134-168` |

**`createEthereumWallet()` deprecated-status check (RESEARCH item):** not applicable to this
doc — `docs/api-reference.md`'s Factory Functions section covers only core (`@dnzn/dxkit`)
factories; plugin factories including `createEthereumWallet()` are documented in
`docs/plugins/wallet.md`, which is out of this plan's file scope (see `05-02-PLAN.md`
`files_modified`). No drift entry needed here — flagged for the plugin-docs sweep plan.

**Everything else checked and found already correct:** `createShell`/`createEventBus`/
`createEventRegistry`/`createPluginRegistry`/`createRouter`/`createLifecycleManager` signatures;
`LifecycleManagerOptions` field shapes/defaults (`timeout` 30000, `cacheTemplates` true,
`sanitizeTemplate` undefined-pass-through, `scriptLoader`/`styleLoader`/`templateLoader`
signatures); `Shell`, `Context`, `EventBus`, `Listener`, `EventRegistry`, `EventRegistration`,
`RegisteredEvent`, `Router`, `PluginRegistry`, `Settings`, `ShellConfig` (registryUrl/basePath/mode
defaults), `DappEntry`, `DappManifest`, `Plugin`, `Wallet`, `WalletState`, `WalletProvider`,
`Auth`, `AuthState`, `Theme`, `ThemeMode`, `SettingDefinition`, `SettingsSection` — all verified
field-for-field against `src/types/*.ts`, `src/router.ts`, `src/registry.ts`,
`plugins/settings/src/index.ts`.

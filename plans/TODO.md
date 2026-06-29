# TODO — DxKit

## Shell-Level Storage Interface

Add a `Storage` interface and `StorageProvider` to the shell, following the same pattern as `Wallet` / `WalletProvider`. A simple key-value store for framework, plugin, and dapp runtime state — not for application data).

Today `@dxkit/settings`, `@dxkit/theme`, and `@dxkit/wallet` all access `localStorage` directly with `dxkit:{name}` keys. This should go through `dx.storage` instead.

### Current localStorage Usage

| Plugin | Key | Value |
|--------|-----|-------|
| Wallet | `dxkit:wallet` | `string` (provider ID) |
| Settings | `dxkit:settings` | JSON `{ dappId: { key: value } }` |
| Theme | `dxkit:theme` | JSON `{ theme, mode }` |

### Requirements

- [ ] `Storage` interface + `StorageProvider` interface in core types
- [ ] `createLocalStorageProvider()` — wraps localStorage (default, local dev)
- [ ] `createMemoryStorageProvider()` — in-memory (tests, non-browser)
- [ ] `createShell({ storage: createLocalStorageProvider() })` — shell config
- [ ] Expose via `dx.storage` on context
- [ ] Refactor `@dxkit/settings` to use `dx.storage`
- [ ] Refactor `@dxkit/theme` to use `dx.storage`
- [ ] Refactor `@dxkit/wallet` to use `dx.storage`
- [ ] Update docs and README

## TypeScript 6 Upgrade

Bump `typescript` from `^5.8.3` to `^6.x`. Held back during the 2026-06 dependency refresh because it's a major with potential type-checking breaks and fixes no security advisory.

### Requirements

- [ ] Bump `typescript` to `^6.x` in root `package.json`
- [ ] `pnpm -r build` clean (tsup + DTS emit for core and all plugins)
- [ ] `pnpm test` and `pnpm lint` clean
- [ ] Review TS 6 breaking changes / new strictness against `tsconfig.json` and fix any surfaced type errors

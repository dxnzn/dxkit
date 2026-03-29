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

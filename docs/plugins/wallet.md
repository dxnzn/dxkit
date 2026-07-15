[Getting Started](../getting-started.md) | [Dapp Development](../dapp-development.md) | [Plugin Development](../plugin-development.md) | [System Internals](../system-internals.md) | [Events Reference](../events-reference.md) | [API Reference](../api-reference.md) | [Cookbook](../cookbook.md)

---

# @dxkit/wallet

Wallet connectivity with pluggable providers. Coordinates browser wallets (EIP-1193), local dev wallets, and custom providers through a unified interface.

[Quick Start](#quick-start) | [Installation](#installation) | [Setup](#setup) | [API](#api) | [State](#state) | [Events](#events) | [Settings](#settings) | [Persistence](#persistence) | [Writing a Custom Provider](#writing-a-custom-provider)

---

## Quick Start

```js
const wallet = DxWallet.createWallet({
  providers: [DxWallet.createEIP1193Provider()],
});

const shell = DxKit.createShell({
  plugins: { wallet },
  manifests: [/* ... */],
});
await shell.init();
```

## Installation

**IIFE (script tag):**
```html
<script src="https://unpkg.com/@dnzn/dxkit-wallet/dist/index.global.js"></script>
<!-- Exposes global: DxWallet -->
```

**ESM:**
```js
import { createWallet, createEIP1193Provider, createLocalWalletProvider } from '@dnzn/dxkit-wallet';
```

## Setup

### `createWallet(options)`

```ts
function createWallet(options: WalletOptions): Wallet

interface WalletOptions {
  providers: WalletProvider[];
  storageKey?: string;  // default: 'dxkit:wallet'
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `providers` | `WalletProvider[]` | — | Available providers. First available is used by default on `connect()`. |
| `storageKey` | `string` | `'dxkit:wallet'` | `localStorage` key for the persisted provider selection — a full literal key, not a prefix. Changing it does not migrate a previously-persisted selection from the old key. |

### Built-in Providers

**`createEIP1193Provider()`** — Browser injected wallets (MetaMask, Brave, Coinbase). Uses `window.ethereum` directly — no ethers.js or viem dependency. Listens to `accountsChanged` and `chainChanged` events. Throws if `eth_requestAccounts` resolves with zero accounts, rather than connecting with a null/undefined address.

**`createLocalWalletProvider(options?)`** — Instant-connect dev wallet. Deterministic address, no external dependencies.

```ts
interface LocalWalletProviderOptions {
  address?: string;  // default: '0x0000000000000000000000000000000001'
}
```

### `createEthereumWallet()` (deprecated)

Backward-compat shim: `createEthereumWallet()` returns `createWallet({ providers: [createEIP1193Provider()] })`. Use `createWallet()` directly — it is not first-class API surface.

### Registration

```js
DxKit.createShell({
  plugins: {
    wallet: DxWallet.createWallet({
      providers: [
        DxWallet.createEIP1193Provider(),
        DxWallet.createLocalWalletProvider(),
      ],
    }),
  },
});
```

## API

### `connect(providerId?)`

Connect a wallet. Without an argument, uses the first available provider.

```ts
connect(providerId?: string): Promise<WalletState>
```

```js
await wallet.connect();           // first available
await wallet.connect('eip1193');   // specific provider
await wallet.connect('local');
```

Throws if a `providerId` is given and no provider matches it or the match isn't `available()`. Throws if no `providerId` is given and no registered provider is `available()`.

### `disconnect()`

Disconnect the active wallet. If `revokeOnDisconnect` is enabled (default) and the active provider is EIP-1193, revokes wallet permissions via `wallet_revokePermissions`.

```ts
disconnect(): Promise<void>
```

### `getState()`

Returns the current wallet state (defensive copy).

```ts
getState(): WalletState
```

### `sign(message)`

Sign a message with the connected wallet. Throws if not connected.

```ts
sign(message: string): Promise<string>
```

- EIP-1193: uses `personal_sign`
- Local: returns hex-encoded message (`0x...`)

### `onStateChange(handler)`

Subscribe to state changes. Returns unsubscribe function.

```ts
onStateChange(handler: (state: WalletState) => void): () => void
```

### `getProviders()`

Returns all registered providers (defensive copy).

```ts
getProviders(): WalletProvider[]
```

### `getActiveProvider()`

Returns the currently connected provider, or `null`.

```ts
getActiveProvider(): WalletProvider | null
```

## State

```ts
interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  provider: unknown;       // raw provider reference (e.g. window.ethereum)
}
```

| Field | Description |
|-------|-------------|
| `connected` | Whether a wallet is currently connected |
| `address` | Connected account address, or `null` |
| `chainId` | Connected chain ID (decimal), or `null` |
| `provider` | Raw provider reference — intentionally untyped |

## Events

| Event | Payload | When |
|-------|---------|------|
| `dx:plugin:wallet:connected` | `{ address: string, chainId: number }` | Wallet connected |
| `dx:plugin:wallet:disconnected` | `{}` | Wallet disconnected |
| `dx:plugin:wallet:changed` | `{ address: string, chainId: number }` | Account or chain switched while connected |

```js
dx.events.on('dx:plugin:wallet:connected', ({ address }) => {
  showUser(address);
});
```

### Error Handling

Wallet also emits `dx:error` for failures that don't reject a promise the caller is awaiting — see [Events Reference](../events-reference.md) for the full catalog.

| `source` | Trigger |
|----------|---------|
| `plugin:wallet:storage:write` | `localStorage.setItem`/`removeItem` threw while persisting the provider selection |
| `plugin:wallet:storage:read` | `localStorage.getItem` threw while restoring the persisted provider selection |
| `plugin:wallet:state` | A provider reported `connected: true` with no `address` — a provider-contract violation, surfaced rather than silently dropped |
| `plugin:wallet:reconnect` | Auto-reconnect on init failed (provider unavailable or `connect()` rejected) — the persisted provider id is cleared after this fires |

## Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `revokeOnDisconnect` | `boolean` | `true` | Revoke wallet permissions on disconnect (EIP-1193 only). Reconnecting requires explicit approval. |

## Persistence

The selected provider ID is saved to `localStorage` under `storageKey` (default `'dxkit:wallet'`). On init, the plugin attempts to reconnect using the persisted provider.

If reconnect fails — the provider is no longer available, or `connect()` rejects — the plugin emits `dx:error` (source `plugin:wallet:reconnect`), then clears the persisted provider id.

Setting a custom `storageKey` selects a full, literal key with no prefixing. It does not migrate a selection already persisted under the previous key — two DxKit apps on the same origin using different `storageKey` values keep independent wallet selections.

## Writing a Custom Provider

Implement the `WalletProvider` interface:

```js
function createMyProvider() {
  let state = { connected: false, address: null, chainId: null, provider: null };
  const handlers = new Set();

  function updateState(updates) {
    state = { ...state, ...updates };
    for (const handler of handlers) handler(state);
  }

  return {
    id: 'my-provider',
    name: 'My Wallet',

    available() {
      return !!window.myWalletSDK;  // environment check
    },

    async connect() {
      const sdk = window.myWalletSDK;
      const account = await sdk.requestAccount();
      updateState({
        connected: true,
        address: account.address,
        chainId: account.chainId,
        provider: sdk,
      });
      return state;
    },

    async disconnect() {
      updateState({ connected: false, address: null, chainId: null, provider: null });
    },

    async sign(message) {
      if (!state.connected) throw new Error('Not connected');
      return window.myWalletSDK.sign(message);
    },

    onStateChange(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}
```

Register it alongside built-in providers:

```js
DxWallet.createWallet({
  providers: [
    createMyProvider(),
    DxWallet.createEIP1193Provider(),
  ],
});
```

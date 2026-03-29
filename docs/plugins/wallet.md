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
<script src="https://unpkg.com/@dxkit/wallet/dist/index.global.js"></script>
<!-- Exposes global: DxWallet -->
```

**ESM:**
```js
import { createWallet, createEIP1193Provider, createLocalWalletProvider } from '@dxkit/wallet';
```

## Setup

### `createWallet(options)`

```ts
function createWallet(options: WalletOptions): Wallet

interface WalletOptions {
  providers: WalletProvider[];
}
```

| Option | Type | Description |
|--------|------|-------------|
| `providers` | `WalletProvider[]` | Available providers. First available is used by default on `connect()`. |

### Built-in Providers

**`createEIP1193Provider()`** — Browser injected wallets (MetaMask, Brave, Coinbase). Uses `window.ethereum` directly — no ethers.js or viem dependency. Listens to `accountsChanged` and `chainChanged` events.

**`createLocalWalletProvider(options?)`** — Instant-connect dev wallet. Deterministic address, no external dependencies.

```ts
interface LocalWalletProviderOptions {
  address?: string;  // default: '0x0000000000000000000000000000000001'
}
```

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

Throws if the provider is not found or not available.

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

## Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `revokeOnDisconnect` | `boolean` | `true` | Revoke wallet permissions on disconnect (EIP-1193 only). Reconnecting requires explicit approval. |

## Persistence

The selected provider ID is saved to `localStorage` under the key `dxkit:wallet`. On init, the plugin attempts to reconnect using the persisted provider.

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

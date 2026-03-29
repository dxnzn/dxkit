[Getting Started](../getting-started.md) | [Dapp Development](../dapp-development.md) | [Plugin Development](../plugin-development.md) | [System Internals](../system-internals.md) | [Events Reference](../events-reference.md) | [API Reference](../api-reference.md) | [Cookbook](../cookbook.md)

---

# @dxkit/auth

Passthrough authentication — wallet connected equals authenticated. No tokens, no sessions, no server round-trips.

[Quick Start](#quick-start) | [Installation](#installation) | [Setup](#setup) | [API](#api) | [State](#state) | [Events](#events)

---

## Quick Start

```js
const shell = DxKit.createShell({
  plugins: {
    wallet: DxWallet.createWallet({ providers: [DxWallet.createLocalWalletProvider()] }),
    auth: DxAuth.createPassthroughAuth(),
  },
});
await shell.init();
```

## Installation

**IIFE (script tag):**
```html
<script src="https://unpkg.com/@dxkit/auth/dist/index.global.js"></script>
<!-- Exposes global: DxAuth -->
```

**ESM:**
```js
import { createPassthroughAuth } from '@dxkit/auth';
```

## Setup

### `createPassthroughAuth(options?)`

```ts
function createPassthroughAuth(options?: PassthroughAuthOptions): Auth

interface PassthroughAuthOptions {
  walletPlugin?: string;  // default: 'wallet'
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `walletPlugin` | `string` | `'wallet'` | Name of the wallet plugin to sync from |

Register **after** the wallet plugin:

```js
plugins: {
  wallet: DxWallet.createWallet({ providers: [...] }),
  auth: DxAuth.createPassthroughAuth(),
}
```

## API

### `authenticate()`

Delegates to `wallet.connect()`. Auth state updates automatically via wallet state sync.

```ts
authenticate(): Promise<AuthState>
```

Throws if no wallet plugin is registered.

### `deauthenticate()`

Delegates to `wallet.disconnect()`. Auth state clears automatically.

```ts
deauthenticate(): Promise<void>
```

### `getState()`

Returns the current auth state (defensive copy).

```ts
getState(): AuthState
```

### `isAuthenticated()`

Convenience check — equivalent to `getState().authenticated`.

```ts
isAuthenticated(): boolean
```

### `onStateChange(handler)`

Subscribe to auth state changes. Returns unsubscribe function.

```ts
onStateChange(handler: (state: AuthState) => void): () => void
```

## State

```ts
interface AuthState {
  authenticated: boolean;
  address: string | null;
  token: string | null;     // reserved for SIWE/JWT — always null in passthrough
  expiresAt: number | null; // reserved — always null in passthrough
}
```

| Field | Description |
|-------|-------------|
| `authenticated` | `true` when the wallet is connected |
| `address` | Connected wallet address, mirrored from wallet state |
| `token` | Always `null` in passthrough mode |
| `expiresAt` | Always `null` in passthrough mode |

## Events

| Event | Payload | When |
|-------|---------|------|
| `dx:plugin:auth:authenticated` | `{ address: string }` | Wallet connected (auth state synced) |
| `dx:plugin:auth:deauthenticated` | `{}` | Wallet disconnected (auth state cleared) |

```js
dx.events.on('dx:plugin:auth:authenticated', ({ address }) => {
  loadUserProfile(address);
});
```

<!-- generated-by: gsd-doc-writer -->
# @dnzn/dxkit-wallet

Wallet connectivity for [DxKit](../../README.md) — pluggable providers (injected EIP-1193
wallets, a local dev wallet, or your own), connect/disconnect/sign, and persisted
reconnection across page loads.

Part of the **DNZN // DxKit** monorepo.

## Installation

```
npm install @dnzn/dxkit-wallet
```

## Usage

```js
import { createShell } from '@dnzn/dxkit';
import { createWallet, createEIP1193Provider, createLocalWalletProvider } from '@dnzn/dxkit-wallet';

const shell = createShell({
  plugins: {
    wallet: createWallet({
      providers: [createEIP1193Provider(), createLocalWalletProvider()],
      storageKey: 'dxkit:wallet', // optional, this is the default
    }),
  },
  manifests: [/* ... */],
});
await shell.init();

const dx = window.__DXKIT__;
const wallet = dx.getPlugin('wallet');

await wallet.connect(); // uses the first available provider
const state = wallet.getState(); // { connected, address, chainId, provider }
```

`createWallet(options)` takes a `providers` array — the first available provider is used
by default, or pass a provider `id` to `connect(id)` explicitly. The active provider
selection is persisted to `localStorage` under `storageKey` (default `'dxkit:wallet'`) and
restored automatically on the next `shell.init()`.

For a static `<script>` include, the IIFE build exposes a `DxWallet` global.

## Documentation

See the [Wallet plugin guide](../../docs/plugins/wallet.md) for the full API
(`connect`, `disconnect`, `sign`, `getState`, `onStateChange`, `getProviders`), the
`EIP-1193` and local dev providers, writing a custom provider, event reference, and
settings integration.

## License

MIT — see [LICENSE](../../LICENSE).

<!-- generated-by: gsd-doc-writer -->
# @dnzn/dxkit-auth

Passthrough authentication for [DxKit](../../README.md) — wallet connected equals authenticated. No tokens, no sessions, no server round-trips.

Part of the DNZN // DxKit monorepo.

## Installation

```
npm install @dnzn/dxkit-auth
```

Requires `@dnzn/dxkit` and `@dnzn/dxkit-wallet` (peer plugins registered alongside it).

## Usage

Register the wallet plugin first, then auth — it syncs off the wallet's connection state.

```js
import { createShell } from '@dnzn/dxkit';
import { createWallet, createLocalWalletProvider } from '@dnzn/dxkit-wallet';
import { createPassthroughAuth } from '@dnzn/dxkit-auth';

const shell = createShell({
  plugins: {
    wallet: createWallet({ providers: [createLocalWalletProvider()] }),
    auth: createPassthroughAuth(),
  },
});
await shell.init();

const auth = shell.getPlugin('auth');
await auth.authenticate(); // delegates to wallet.connect()
auth.isAuthenticated();    // true once wallet is connected
```

## Documentation

Full plugin guide — options, API, state shape, events: [docs/plugins/auth.md](../../docs/plugins/auth.md)

See also: [DxKit root README](../../README.md)

## License

MIT — see [LICENSE](LICENSE).

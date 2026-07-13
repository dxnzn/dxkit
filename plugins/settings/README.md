<!-- generated-by: gsd-doc-writer -->
# @dnzn/dxkit-settings

Per-dapp settings for [DxKit](../../README.md) — a key-value store with localStorage
persistence, setting definitions sourced from dapp manifests and plugins, and
auto-generated enable/disable toggles for optional dapps.

Part of the **DNZN // DxKit** monorepo.

## Installation

```
npm install @dnzn/dxkit-settings
```

## Usage

Register the plugin last so it can discover settings from every other plugin and manifest
during `init()`:

```js
import { createShell } from '@dnzn/dxkit';
import { createSettings } from '@dnzn/dxkit-settings';

const shell = createShell({
  plugins: {
    settings: createSettings(), // register last
  },
  manifests: [/* ... */],
});
await shell.init();

const dx = window.__DXKIT__;

dx.settings.set('my-dapp', 'refreshInterval', 5000);
const value = dx.settings.get('my-dapp', 'refreshInterval');

dx.settings.onChange('my-dapp', 'refreshInterval', (next) => {
  console.log('refreshInterval changed:', next);
});
```

`createSettings(options?)` accepts an optional `storageKey` (default `'dxkit:settings'`) for
the localStorage key used to persist values.

For a static `<script>` include, the IIFE build exposes a `DxSettings` global.

## Documentation

See the [Settings plugin guide](../../docs/plugins/settings.md) for the full API
(`get`, `set`, `getAll`, `getSections`, `onChange`, `onAnyChange`), event reference,
persistence behavior, optional dapp toggles, and building a settings UI.

## License

MIT — see [LICENSE](LICENSE).

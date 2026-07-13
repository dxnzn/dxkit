<!-- generated-by: gsd-doc-writer -->
# @dnzn/dxkit-theme

CSS theme plugin for [DxKit](../../README.md) — light/dark/system mode, multi-theme support, zero DOM ownership.

by **Denizen.** // dnzn.wei

Part of the DxKit monorepo.

## Installation

```
npm install @dnzn/dxkit-theme
```

## Usage

```js
import { createShell } from '@dnzn/dxkit';
import { createCSSTheme } from '@dnzn/dxkit-theme';

const shell = createShell({
  plugins: {
    theme: createCSSTheme({ themes: ['default', 'midnight'] }),
  },
});

await shell.init();
```

Sets `data-theme` and `data-mode` attributes on `<html>`, persists the selection to `localStorage`, and resolves `'system'` mode against `prefers-color-scheme`.

## Documentation

See the [Theme Plugin Guide](../../docs/plugins/theme.md) for setup options, the API surface, event payloads, settings integration, and CSS authoring patterns.

## License

MIT — see [LICENSE](../../LICENSE).

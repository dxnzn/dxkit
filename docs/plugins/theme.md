[Getting Started](../getting-started.md) | [Dapp Development](../dapp-development.md) | [Plugin Development](../plugin-development.md) | [System Internals](../system-internals.md) | [Events Reference](../events-reference.md) | [API Reference](../api-reference.md) | [Cookbook](../cookbook.md)

---

# @dxkit/theme

CSS theming with light/dark/system mode support. Sets `data-theme` and `data-mode` attributes on `<html>`. Persists to localStorage. Respects `prefers-color-scheme` when mode is `'system'`.

[Quick Start](#quick-start) | [Installation](#installation) | [Setup](#setup) | [API](#api) | [Events](#events) | [Settings](#settings) | [Persistence](#persistence) | [CSS Authoring](#css-authoring)

---

## Quick Start

```js
const shell = DxKit.createShell({
  plugins: {
    theme: DxTheme.createCSSTheme({ themes: ['default', 'midnight'] }),
  },
});
await shell.init();
```

## Installation

**IIFE (script tag):**
```html
<script src="https://unpkg.com/@dxkit/theme/dist/index.global.js"></script>
<!-- Exposes global: DxTheme -->
```

**ESM:**
```js
import { createCSSTheme } from '@dxkit/theme';
```

## Setup

### `createCSSTheme(options?)`

```ts
function createCSSTheme(options?: CSSThemeOptions): Theme

interface CSSThemeOptions {
  themes?: string[];        // default: ['default']
  defaultMode?: ThemeMode;  // default: 'system'
  storageKey?: string;      // default: 'dxkit:theme'
  onApply?: (state: { theme: string; mode: ThemeMode; resolved: 'light' | 'dark' }) => void;
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `themes` | `string[]` | `['default']` | Available theme names. First is the initial theme. |
| `defaultMode` | `ThemeMode` | `'system'` | Initial mode: `'light'`, `'dark'`, or `'system'` |
| `storageKey` | `string` | `'dxkit:theme'` | localStorage key for persistence |
| `onApply` | `function` | — | Called after DOM attributes are set — use for side-effects like favicon/meta-color updates |

### `onApply` Hook

Use `onApply` for DOM side-effects that go beyond `data-theme`/`data-mode` attributes:

```js
const theme = createCSSTheme({
  themes: ['default', 'midnight'],
  onApply({ theme, mode, resolved }) {
    // Update favicon per theme
    document.querySelector('link[rel="icon"]').href = `/favicon-${theme}.svg`;
    // Update meta theme-color
    document.querySelector('meta[name="theme-color"]').content =
      resolved === 'dark' ? '#0d0d0d' : '#ffffff';
  },
});
```

`onApply` fires on init, mode changes, theme changes, and system preference changes.

## API

### Mode

```ts
getMode(): ThemeMode                    // current mode setting ('light', 'dark', or 'system')
setMode(mode: ThemeMode): void          // set mode
toggleMode(): void                      // cycle: system → light → dark → system
getResolvedMode(): 'light' | 'dark'     // actual applied mode
onModeChange(handler: (mode: ThemeMode, resolved: 'light' | 'dark') => void): () => void
```

`getResolvedMode()` resolves `'system'` to the actual value based on `prefers-color-scheme`. Use this when you need the concrete mode.

### Theme

```ts
getTheme(): string                      // current theme name
setTheme(theme: string): void           // set theme (no-op if not in themes list)
getAvailableThemes(): string[]          // all theme names
onThemeChange(handler: (theme: string) => void): () => void
```

## Events

| Event | Payload | When |
|-------|---------|------|
| `dx:plugin:theme:changed` | `{ theme: string, mode: ThemeMode, resolved: 'light' \| 'dark' }` | Theme or mode changed |

Emitted on any change — theme switch, mode switch, or system preference change (when in system mode).

```js
dx.events.on('dx:plugin:theme:changed', ({ resolved }) => {
  updateChartColors(resolved);
});
```

## Settings

When the settings plugin is registered, theme declares these settings:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `mode` | `select` | `'system'` | Light / Dark / System |
| `theme` | `select` | First theme | Color palette (only shown if multiple themes configured) |

The theme plugin syncs bidirectionally with the settings plugin — changes from either side stay in sync.

## Persistence

Theme and mode are saved to localStorage under the configured `storageKey` (default: `dxkit:theme`) as JSON:

```json
{ "theme": "midnight", "mode": "dark" }
```

Restored on init, before the first DOM update.

## CSS Authoring

The plugin sets two attributes on `<html>`:

```html
<html data-theme="midnight" data-mode="dark">
```

### Mode-based Styles

```css
/* Light mode (default) */
body { background: #ffffff; color: #1a1a1a; }

/* Dark mode */
[data-mode="dark"] body { background: #0d0d0d; color: #e5e5e5; }
```

### Theme-based Styles

```css
/* Default theme */
[data-theme="default"] { --accent: #3b82f6; --surface: #f8fafc; }

/* Midnight theme */
[data-theme="midnight"] { --accent: #818cf8; --surface: #0f172a; }
```

### Combined

```css
[data-theme="midnight"][data-mode="dark"] {
  --accent: #a5b4fc;
}
```

### System Mode

When mode is `'system'`, the plugin resolves to `'light'` or `'dark'` based on the user's OS preference (`prefers-color-scheme`). It listens for live changes — if the user switches their OS from light to dark, `data-mode` updates immediately and `dx:plugin:theme:changed` fires.

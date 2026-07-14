[Getting Started](../getting-started.md) | [Dapp Development](../dapp-development.md) | [Plugin Development](../plugin-development.md) | [System Internals](../system-internals.md) | [Events Reference](../events-reference.md) | [API Reference](../api-reference.md) | [Cookbook](../cookbook.md)

---

# @dxkit/settings

Per-dapp configuration with localStorage persistence. Reads setting definitions from dapp manifests and plugins, provides a key-value API, and synthesizes enable/disable toggles for optional dapps.

[Quick Start](#quick-start) | [Installation](#installation) | [Setup](#setup) | [API](#api) | [Events](#events) | [Persistence](#persistence) | [Optional Dapp Toggles](#optional-dapp-toggles) | [Setting Definitions](#setting-definitions) | [Building a Settings UI](#building-a-settings-ui) | [Duck-typing](#duck-typing)

---

## Quick Start

```js
const shell = DxKit.createShell({
  plugins: {
    settings: DxSettings.createSettings(),
    theme: DxTheme.createCSSTheme(), // after settings — its init() writes to dx.settings
  },
  manifests: [/* ... */],
});
await shell.init();

const dx = window.__DXKIT__;
const value = dx.settings.get('my-dapp', 'refreshInterval');
```

## Installation

**IIFE (script tag):**
```html
<script src="https://unpkg.com/@dnzn/dxkit-settings/dist/index.global.js"></script>
<!-- Exposes global: DxSettings -->
```

**ESM:**
```js
import { createSettings } from '@dnzn/dxkit-settings';
```

## Setup

### `createSettings(options?)`

```ts
function createSettings(options?: SettingsPluginOptions): Plugin

interface SettingsPluginOptions {
  storageKey?: string;  // default: 'dxkit:settings'
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storageKey` | `string` | `'dxkit:settings'` | localStorage key for persistence |

Every plugin is registered before any plugin's `init()` runs, so `settings` discovers every other plugin's `settings` array and every dapp manifest's settings regardless of where it's declared in `plugins` — registration order doesn't gate that discovery. It does matter for the reverse direction: register `settings` before any plugin whose own `init()` writes to `dx.settings` (the theme plugin's startup sync, for example) — `context.settings` doesn't exist until settings' `init()` has run.

## API

Accessible via `dx.settings` (where `const dx = window.__DXKIT__`) or `context.settings` in plugin init.

### `get(dappId, key)`

Get a setting value. Returns the default from the manifest/plugin definition if not explicitly set.

```ts
get<T = unknown>(dappId: string, key: string): T | undefined
```

### `set(dappId, key, value)`

Set a value. Persists immediately and emits `dx:plugin:settings:changed`.

```ts
set(dappId: string, key: string, value: unknown): void
```

### `getAll(dappId)`

All settings for a dapp as a key-value map. Defaults merged with stored values.

```ts
getAll(dappId: string): Record<string, unknown>
```

### `getSections()`

All setting sections for UI generation. Each section has an ID, label, and array of definitions.

```ts
getSections(): SettingsSection[]
```

Sections come from three sources:
1. **`_shell`** — auto-generated toggles for optional dapps (labeled "Dapps")
2. **Dapp manifests** — from `manifest.settings`
3. **Plugins** — from `plugin.settings`

Disabled dapps' settings are hidden from sections (but values are preserved).

### `onChange(dappId, key, handler)`

Subscribe to a specific setting. Returns unsubscribe function.

```ts
onChange(dappId: string, key: string, handler: (value: unknown) => void): () => void
```

### `onAnyChange(dappId, handler)`

Subscribe to any setting change for a dapp. Returns unsubscribe function.

```ts
onAnyChange(dappId: string, handler: (key: string, value: unknown) => void): () => void
```

### Handler Cleanup

Handlers registered via `onChange()`/`onAnyChange()` for a given `dappId` are pruned when that dapp is disabled — the plugin listens for `dx:dapp:disabled` and deletes that `dappId`'s entries from its internal handler maps. Cleanup is disable-only: it does not fire on `dx:unmount`, so handlers survive ordinary navigation away from and back to a dapp — only an explicit `disableDapp()` call prunes them.

Handlers are stored in a nested `Map<dappId, Map<key, Set<handler>>>` (not a colon-joined composite key), so a dapp id that is itself a colon-prefix of another (`'foo'` vs. `'foo:bar'`) can't collide during cleanup. The `_shell` toggle-bridge handlers (settings-UI toggle → `enableDapp`/`disableDapp`) live under their own `'_shell'` section entry and are untouched by any other dapp's cleanup.

## Events

| Event | Payload | When |
|-------|---------|------|
| `dx:plugin:settings:changed` | `{ dappId: string, key: string, value: unknown }` | Any setting value changed via `set()` |

```js
dx.events.on('dx:plugin:settings:changed', ({ dappId, key, value }) => {
  if (dappId === 'my-dapp') {
    console.log(`${key} changed to`, value);
  }
});
```

### Error Handling

Settings also emits `dx:error` if a localStorage read or write throws — see [Events Reference](../events-reference.md) for the full catalog.

| `source` | Trigger |
|----------|---------|
| `plugin:settings:storage:write` | `localStorage.setItem` threw while persisting the store |
| `plugin:settings:storage:read` | `localStorage.getItem`/`JSON.parse` threw while restoring the store — falls back to manifest/plugin defaults |

## Persistence

All settings are persisted to localStorage under the configured key (default: `dxkit:settings`) as a nested JSON object:

```json
{
  "my-dapp": { "refreshInterval": 60 },
  "theme": { "mode": "dark" },
  "_shell": { "analytics": false }
}
```

Restored on init, before definitions are loaded.

**Security note**: Settings are stored as plaintext JSON in localStorage. Do not store secrets, API keys, tokens, or any sensitive data via the settings API. localStorage is readable by any script running on the same origin.

The localStorage implementation is intended for local development, or where the application use case does not require portable settings or application state persistence (e.g., light/dark theme preference). Future versions will implement backend storage features (TBD).

Like theme, settings has not been given the wallet plugin's SEC-02 per-app-isolation treatment — `storageKey` is a full literal key with no default prefixing, so two DxKit apps on the same origin using the default key share settings state. See `docs/security.md` for the full inventory.

## Optional Dapp Toggles

For manifests with `optional: true`, the settings plugin synthesizes boolean toggle definitions under the `_shell` section (labeled "Dapps"). Changing these toggles calls `shell.enableDapp()` / `shell.disableDapp()`, keeping the router in sync.

```text
Manifest: { id: 'analytics', name: 'Analytics', optional: true, enabled: false }

Synthesized setting:
  section: '_shell' (label: 'Dapps')
  key: 'analytics'
  label: 'Analytics'
  type: 'boolean'
  default: false
```

## Setting Definitions

Settings are declared in dapp manifests or on plugin objects:

```ts
interface SettingDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect';
  default: unknown;
  description?: string;
  options?: { label: string; value: string }[];
  validation?: { required?: boolean; min?: number; max?: number; pattern?: string };
  dependsOn?: string;
}
```

### `dependsOn`

Links a setting to a boolean toggle in the same section. When the referenced setting is falsy, this setting is logically disabled:

```json
[
  {
    "key": "autoRefresh",
    "label": "Auto Refresh",
    "type": "boolean",
    "default": false
  },
  {
    "key": "interval",
    "label": "Interval (s)",
    "type": "number",
    "default": 30,
    "dependsOn": "autoRefresh"
  }
]
```

## Building a Settings UI

Use `getSections()` to generate a form — see the [Cookbook](../cookbook.md#building-a-settings-ui) for a full example.

```js
const sections = dx.settings.getSections();
for (const section of sections) {
  // section.id — e.g. '_shell', 'my-dapp', 'theme'
  // section.label — e.g. 'Dapps', 'My App', 'Theme'
  // section.definitions — SettingDefinition[]
}
```

## Duck-typing

The shell and settings plugin use duck-typing for interop. The settings plugin exposes `getSettingsAPI()`:

```js
const settingsPlugin = registry.get('settings');
if (settingsPlugin && 'getSettingsAPI' in settingsPlugin) {
  const api = settingsPlugin.getSettingsAPI();
}
```

The shell checks for this method when restoring enabled/disabled state for optional dapps from persisted settings.

[Getting Started](getting-started.md) | **Dapp Development** | [Plugin Development](plugin-development.md) | [System Internals](system-internals.md) | [Events Reference](events-reference.md) | [API Reference](api-reference.md) | [Cookbook](cookbook.md)

---

# Dapp Development

Building self-contained applications that mount and unmount inside the shell.

[Dapp Anatomy](#dapp-anatomy) | [The Manifest](#the-manifest) | [Lifecycle Events](#lifecycle-events) | [Accessing the Context](#accessing-the-context) | [Using Plugins from a Dapp](#using-plugins-from-a-dapp) | [Dapp Settings](#dapp-settings) | [Sub-path Routing](#sub-path-routing) | [Standalone Mode](#standalone-mode) | [Permission Gating](#permission-gating) | [Per-Dapp Styles](#per-dapp-styles)

---

## Dapp Anatomy

A dapp is a self-contained application that mounts and unmounts inside the shell. It consists of:

- **Manifest** — JSON declaring identity, route, entry point, and capabilities
- **Entry script** — JS file that listens for `dx:mount` and `dx:unmount`
- **Styles** — optional CSS, lazy-loaded on first mount

Dapps are framework-agnostic. The entry script receives a DOM container and renders into it however it wants — vanilla JS, React, Svelte, or anything else.

## The Manifest

Every dapp declares a `DappManifest`. Here's the full shape:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `string` | yes | — | Unique slug (e.g. `'token-sender'`) |
| `name` | `string` | yes | — | Display name |
| `description` | `string` | no | — | Short description |
| `version` | `string` | yes | — | Semver string |
| `route` | `string` | yes | — | Path prefix (e.g. `'/tools/sender'`) |
| `entry` | `string` | yes | — | JS entry point path |
| `styles` | `string` | no | — | CSS path, lazy-loaded on first mount |
| `nav.label` | `string` | yes | — | Menu text |
| `nav.icon` | `string` | no | — | SVG name, URL, or inline SVG |
| `nav.group` | `string` | no | — | Nav grouping (e.g. `'tools'`) |
| `nav.order` | `number` | no | — | Sort order within group |
| `nav.hidden` | `boolean` | no | `false` | Registered but not shown in nav |
| `requires` | `object` | no | — | Dapp requirements (see below) |
| `requires.plugins` | `string[]` | no | — | Required plugin names |
| `settings` | `SettingDefinition[]` | no | — | Configurable settings |
| `optional` | `boolean` | no | `false` | User can toggle this dapp on/off |
| `enabled` | `boolean` | no | `true` | Initial state (only when `optional: true`) |
| `standalone` | `boolean` | no | `true` | Can run outside the shell |

## Lifecycle Events

Dapps interact with the shell through two events: `dx:mount` (render) and `dx:unmount` (cleanup).

```js
let cleanup = null;

window.addEventListener('dx:mount', (e) => {
  if (e.detail.id !== 'my-dapp') return; // filter by your dapp ID

  const container = e.detail.container;  // DOM element to render into
  const path = e.detail.path;            // full path (e.g. '/my-dapp/sub/page')

  container.innerHTML = '<h1>Hello</h1>';

  cleanup = () => { container.innerHTML = ''; };
});

window.addEventListener('dx:unmount', (e) => {
  if (e.detail.id !== 'my-dapp') return;
  cleanup?.();
  cleanup = null;
});
```

**Why `window.addEventListener` instead of `dx.events.on()`?** Lifecycle events use `window.addEventListener` because the dapp script must register its mount handler immediately on load — before `dx:mount` fires and before `window.__DXKIT__` is available. The shell dispatches lifecycle events as `CustomEvent`s on `window`, so raw listeners are the only option at this point. Once inside the mount handler, use the context (`dx.events.on()`) for all other event subscriptions.

**Key behaviors:**
- Scripts are loaded once and cached — `dx:mount`/`dx:unmount` can fire multiple times
- Always filter by `e.detail.id` — all dapps share the same event bus
- `dx:mount` fires after the script loads; `dx:unmount` fires before the next dapp mounts

## Accessing the Context

Dapps access the shell through `window.__DXKIT__`:

```js
const dx = window.__DXKIT__;

// Events (plugin events are typed when the plugin package is installed)
dx.events.on('dx:plugin:wallet:connected', ({ address, chainId }) => { /* ... */ });
dx.events.emit('myapp:data:loaded', { count: 42 });

// Router
dx.router.navigate('/other-dapp');
const currentPath = dx.router.getCurrentPath();

// Manifests
const allManifests = dx.getManifests();
const enabledManifests = dx.getEnabledManifests();

// Plugin access
const wallet = dx.getPlugin('wallet');
const theme = dx.getPlugin('theme');

// Settings (if settings plugin registered)
const value = dx.settings?.get('my-dapp', 'refreshInterval');

// Dapp state
dx.enableDapp('optional-dapp');
dx.disableDapp('optional-dapp');
dx.isDappEnabled('optional-dapp');
```

## Using Plugins from a Dapp

Retrieve plugins by name. The return type is `Plugin | undefined` — always check before using.

```js
const dx = window.__DXKIT__;
const wallet = dx?.getPlugin('wallet');

if (wallet) {
  const state = wallet.getState();
  if (state.connected) {
    console.log('Connected:', state.address);
  } else {
    await wallet.connect();
  }
}
```

## Dapp Settings

Dapps declare settings in their manifest. The [settings plugin](plugins/settings.md) reads these definitions, provides defaults, and persists user changes.

**In the manifest:**
```json
{
  "settings": [
    {
      "key": "refreshInterval",
      "label": "Refresh Interval",
      "type": "number",
      "default": 30,
      "description": "How often to refresh data (seconds)",
      "validation": { "min": 5, "max": 300 }
    },
    {
      "key": "showAdvanced",
      "label": "Show Advanced Options",
      "type": "boolean",
      "default": false
    }
  ]
}
```

**In the dapp:**
```js
const dx = window.__DXKIT__;
const interval = dx.settings?.get('my-dapp', 'refreshInterval') ?? 30;

// React to changes
dx.settings?.onChange('my-dapp', 'refreshInterval', (value) => {
  restartPolling(value);
});
```

### Setting Types

| Type | Input | Value |
|------|-------|-------|
| `text` | Text input | `string` |
| `number` | Number input | `number` |
| `boolean` | Checkbox | `boolean` |
| `select` | Dropdown | `string` |
| `multiselect` | Multi-select | `string[]` |

### Conditional Settings

Use `dependsOn` to link a setting to a boolean toggle:

```json
{
  "settings": [
    {
      "key": "autoRefresh",
      "label": "Auto Refresh",
      "type": "boolean",
      "default": false
    },
    {
      "key": "refreshInterval",
      "label": "Interval (s)",
      "type": "number",
      "default": 30,
      "dependsOn": "autoRefresh"
    }
  ]
}
```

When `autoRefresh` is false, `refreshInterval` is logically disabled.

## Sub-path Routing

The shell routes based on prefix matching. A dapp at `/dashboard` receives all paths that start with `/dashboard`. The full path is passed in `e.detail.path`.

```js
window.addEventListener('dx:mount', (e) => {
  if (e.detail.id !== 'dashboard') return;

  const subPath = e.detail.path.replace('/dashboard', '') || '/';

  switch (subPath) {
    case '/':
      renderOverview(e.detail.container);
      break;
    case '/analytics':
      renderAnalytics(e.detail.container);
      break;
    default:
      render404(e.detail.container);
  }
});
```

To navigate between sub-paths from within the dapp:

```js
const dx = window.__DXKIT__;
dx.router.navigate('/dashboard/analytics');
```

## Standalone Mode

Dapps can detect whether they're running inside the shell and fall back to standalone behavior:

```js
if (window.__DXKIT__) {
  // Running inside the shell — listen for lifecycle events
  window.addEventListener('dx:mount', onMount);
  window.addEventListener('dx:unmount', onUnmount);
} else {
  // Standalone mode — render directly
  const root = document.getElementById('app');
  root.innerHTML = '<h1>Running standalone</h1>';
}
```

Set `standalone: true` in the manifest (the default) to signal that the dapp supports this.

## Requirement Gating

If a dapp declares `requires.plugins`, the shell checks that all listed plugins are registered before mounting. Missing plugins emit a `dx:error` and the dapp does not mount.

```json
{
  "requires": { "plugins": ["wallet", "auth"] }
}
```

If the `wallet` plugin isn't registered, the dapp won't mount and the shell emits:
```js
// dx:error { source: 'lifecycle:my-dapp', error: Error('Missing required plugin(s): wallet') }
```

Listen for these errors in your shell UI to show feedback:

```js
const dx = window.__DXKIT__;
dx.events.on('dx:error', ({ source, error }) => {
  console.warn(`[${source}]`, error.message);
});
```

## Per-Dapp Styles

Declare a `styles` path in the manifest. The shell injects a `<link>` tag on first mount. Styles load once and stay in the DOM.

```json
{
  "styles": "/my-dapp/style.css"
}
```

CSS loading is non-blocking — if the stylesheet fails to load, the shell emits `dx:error` but continues mounting the script. This prevents a missing CSS file from breaking the dapp entirely.

To avoid style collisions between dapps, scope your selectors:

```css
/* Scope to the mount container */
#dx-mount .my-dapp-widget {
  /* ... */
}
```

Or use a wrapping element inside your dapp:

```js
window.addEventListener('dx:mount', (e) => {
  if (e.detail.id !== 'my-dapp') return;
  const wrapper = document.createElement('div');
  wrapper.className = 'my-dapp';
  e.detail.container.appendChild(wrapper);
  // render into wrapper
});
```

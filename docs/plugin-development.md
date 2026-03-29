[Getting Started](getting-started.md) | [Dapp Development](dapp-development.md) | **Plugin Development** | [System Internals](system-internals.md) | [Events Reference](events-reference.md) | [API Reference](api-reference.md) | [Cookbook](cookbook.md)

---

# Plugin Development

Building plugins that extend the shell with new capabilities.

[Plugin Interface](#plugin-interface) | [Registering a Plugin](#registering-a-plugin) | [The Init Lifecycle](#the-init-lifecycle) | [Declaring Settings](#declaring-settings) | [Custom Events](#custom-events) | [Duck-typing Patterns](#duck-typing-patterns) | [Destroy / Cleanup](#destroy-cleanup) | [Example: Building a Notifications Plugin](#example-building-a-notifications-plugin)

---

## Plugin Interface

Every plugin implements the `Plugin` base:

```ts
interface Plugin {
  readonly name: string;
  init?(context: Context): Promise<void>;
  destroy?(): Promise<void>;
  settings?: SettingDefinition[];
}
```

- **`name`** — unique identifier, used as the registry key
- **`init(context)`** — called once during `shell.init()`, after manifests are loaded
- **`destroy()`** — called during `shell.destroy()` for cleanup
- **`settings`** — optional setting definitions exposed via the [settings plugin](plugins/settings.md)

## Registering a Plugin

Plugins are registered through `ShellConfig.plugins`:

```js
const shell = DxKit.createShell({
  plugins: {
    wallet: DxWallet.createWallet({ providers: [DxWallet.createEIP1193Provider()] }),
    auth: DxAuth.createPassthroughAuth(),
    theme: DxTheme.createCSSTheme(),
    settings: DxSettings.createSettings(), // should be last
  },
});
```

**Init order matters.** Plugins are initialized in config object order. Plugins that depend on other plugins should come after their dependencies. The `settings` plugin should be registered last — it reads setting definitions from all other plugins during its `init()`.

## The Init Lifecycle

During `init()`, your plugin receives the full `Context`:

```js
async init(context) {
  // Register custom events
  context.eventRegistry.registerEvent('my-plugin', [
    { name: 'dx:plugin:my-plugin:activated', description: 'Plugin activated' },
    { name: 'dx:plugin:my-plugin:deactivated' },
  ]);

  // Subscribe to events
  context.events.on('dx:plugin:wallet:connected', ({ address }) => {
    // react to wallet connect
  });

  // Access other plugins
  const wallet = context.getPlugin('wallet');

  // Read manifests
  const manifests = context.getManifests();

  // Read/write settings
  const value = context.settings?.get('my-plugin', 'enabled');
}
```

**What's available on Context:**
- `events` — the event bus (`emit`, `on`, `once`, `off`)
- `eventRegistry` — register custom events
- `router` — `navigate(path)`, `getCurrentPath()`
- `getPlugin(name)` — access other plugins
- `getPlugins()` — all plugins as `{ name: plugin }`
- `getManifests()` / `getEnabledManifests()`
- `enableDapp(id)` / `disableDapp(id)` / `isDappEnabled(id)`
- `settings` — injected by settings plugin (may be `undefined`)

## Declaring Settings

Plugins can declare settings that surface in the settings UI:

```js
const plugin = {
  name: 'analytics',

  settings: [
    { key: 'enabled', label: 'Enable Analytics', type: 'boolean', default: true },
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      type: 'text',
      default: 'https://analytics.example.com',
      dependsOn: 'enabled', // disabled when 'enabled' is false
    },
  ],

  async init(context) {
    const enabled = context.settings?.get('analytics', 'enabled') ?? true;
    // ...
  },
};
```

The settings plugin uses `plugin.name` as the section ID. Setting definitions follow the same `SettingDefinition` type as dapp manifest settings — see [Dapp Settings](dapp-development.md#dapp-settings).

## Custom Events

Plugins register events through the event registry during `init()`:

```js
context.eventRegistry.registerEvent('my-plugin', [
  { name: 'dx:plugin:my-plugin:started' },
  { name: 'dx:plugin:my-plugin:stopped' },
]);
```

**Naming rules:**
- Plugin events must use the format `dx:plugin:<name>:<action>`
- The `<name>` segment must match the `source` parameter (your plugin name)
- Events without the `dx:` prefix are for dapps/developers, not plugins
- Built-in shell events (`dx:ready`, `dx:mount`, etc.) cannot be re-registered
- Re-registering from the same source is a no-op; a different source for the same event name throws

After registering, emit events through the bus:

```js
context.events.emit('dx:plugin:my-plugin:started', { timestamp: Date.now() });
```

### Typing Plugin Events

Use module augmentation to add your event payloads to `EventMap`. This gives consumers full type safety and autocomplete when listening to your events:

```ts
declare module 'dxkit' {
  interface EventMap {
    'dx:plugin:my-plugin:started': { timestamp: number };
    'dx:plugin:my-plugin:stopped': Record<string, never>;
  }
}
```

Place this at the top level of your plugin source (after imports). When a consumer adds your plugin as a dependency, TypeScript merges the declaration — handlers receive typed payloads instead of `unknown`.

Dapp developers get typed events automatically — installing a plugin package brings its type augmentations into scope. This import is only needed for **plugin-to-plugin** dependencies where one plugin listens to another's events without importing any of its runtime code:

```ts
import '@dxkit/settings'; // brings settings event types into scope
```

## Duck-typing Patterns

DxKit uses duck-typing for plugin interop. The settings plugin, for example, checks whether other plugins expose a `getSettingsAPI()` method — it doesn't enforce a TypeScript interface at runtime.

This pattern is useful when building plugins that extend other plugins:

```js
// In the settings plugin source, it checks:
const settingsPlugin = registry.get('settings');
if (settingsPlugin && 'getSettingsAPI' in settingsPlugin) {
  const api = settingsPlugin.getSettingsAPI();
  // ...
}
```

If you're building a plugin that other plugins should discover, document the convention. Expose a method with a clear name and check for it with `'methodName' in plugin`.

## Destroy / Cleanup

Clean up subscriptions, timers, and DOM changes in `destroy()`:

```js
async destroy() {
  if (this._unsub) this._unsub();
  if (this._interval) clearInterval(this._interval);
  this._handlers.clear();
}
```

The shell calls `destroy()` on all plugins during `shell.destroy()`.

## Example: Building a Notifications Plugin

A complete plugin that displays toast notifications for events.

```js
function createNotifications(options = {}) {
  const { maxVisible = 3, duration = 5000 } = options;

  let dx = null;
  const listeners = [];
  const queue = [];
  let containerEl = null;

  function show(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `dx-toast dx-toast--${type}`;
    toast.textContent = message;
    containerEl?.appendChild(toast);

    setTimeout(() => toast.remove(), duration);
  }

  return {
    name: 'notifications',

    settings: [
      {
        key: 'enabled',
        label: 'Show Notifications',
        type: 'boolean',
        default: true,
      },
      {
        key: 'duration',
        label: 'Duration (ms)',
        type: 'number',
        default: duration,
        dependsOn: 'enabled',
      },
    ],

    async init(context) {
      dx = context;

      context.eventRegistry.registerEvent('notifications', [
        { name: 'dx:plugin:notifications:shown' },
      ]);

      // Create toast container
      containerEl = document.createElement('div');
      containerEl.id = 'dx-toasts';
      document.body.appendChild(containerEl);

      // Listen for interesting events
      listeners.push(
        context.events.on('dx:error', ({ source, error }) => {
          show(`Error: ${error.message}`, 'error');
        }),
        context.events.on('dx:plugin:wallet:connected', ({ address }) => {
          show(`Wallet connected: ${address.slice(0, 8)}...`);
        }),
      );
    },

    async destroy() {
      for (const listener of listeners) listener.off();
      listeners.length = 0;
      containerEl?.remove();
      containerEl = null;
      dx = null;
    },

    // Public API — dapps can call this directly
    notify(message, type) {
      show(message, type);
      dx?.events.emit('dx:plugin:notifications:shown', { message, type });
    },
  };
}
```

Usage:

```js
const shell = DxKit.createShell({
  plugins: {
    notifications: createNotifications({ duration: 3000 }),
    settings: DxSettings.createSettings(),
  },
  // ...
});
```

From a dapp:

```js
const dx = window.__DXKIT__;
const notifications = dx?.getPlugin('notifications');
notifications?.notify('Data saved successfully', 'success');
```

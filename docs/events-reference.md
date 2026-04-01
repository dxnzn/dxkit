[Getting Started](getting-started.md) | [Dapp Development](dapp-development.md) | [Plugin Development](plugin-development.md) | [System Internals](system-internals.md) | **Events Reference** | [API Reference](api-reference.md) | [Cookbook](cookbook.md)

---

# Events Reference

Complete event catalog with payloads, organized by source.

[Overview](#overview) | [Shell Events](#shell-events) | [Plugin Events](#plugin-events) | [Custom Events](#custom-events) | [Event Namespacing Rules](#event-namespacing-rules) | [Introspection](#introspection)

---

## Overview

DxKit uses a typed event bus for all inter-component communication. Events are dispatched as `CustomEvent` on `window` by default.

**Three categories of events:**

| Category | Prefix | Registered by |
|----------|--------|---------------|
| Shell events | `dx:` | Built-in, always available |
| Plugin events | `dx:plugin:<name>:<action>` | Plugins, via `eventRegistry.registerEvent()` |
| Custom events | No `dx:` prefix | Dapps/developers, via `eventRegistry.registerEvent()` |

**Subscribing to events:**

```js
const dx = window.__DXKIT__;

// Subscribe — returns a Listener object
const listener = dx.events.on('dx:ready', (detail) => { /* ... */ });

// Pause/resume without unsubscribing
listener.pause();
listener.resume();

// Unsubscribe
listener.off();

// One-shot listener
dx.events.once('dx:ready', (detail) => { /* fires once */ });

// Direct unsubscribe by handler reference
dx.events.off('dx:ready', myHandler);
```

---

## Shell Events

These are always available — they cannot be re-registered.

### `dx:ready`

Shell initialization complete.

| Field | Type |
|-------|------|
| *(none)* | `{}` |

```js
dx.events.on('dx:ready', () => {
  console.log('Shell is ready');
});
```

### `dx:route:changed`

Navigation occurred. Emitted after mount/unmount completes.

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Normalized path |
| `manifest` | `DappManifest \| undefined` | Matched manifest, or undefined if no match |

```js
dx.events.on('dx:route:changed', ({ path, manifest }) => {
  updateBreadcrumb(path);
  highlightNav(manifest?.id);
});
```

### `dx:mount`

Tells a dapp to render. Dispatched after the dapp's script loads.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Dapp ID |
| `container` | `HTMLElement` | DOM element to render into |
| `path` | `string` | Full matched path |

```js
window.addEventListener('dx:mount', (e) => {
  if (e.detail.id !== 'my-dapp') return;
  e.detail.container.innerHTML = '<h1>Mounted</h1>';
});
```

### `dx:unmount`

Tells a dapp to clean up. Dispatched before the next dapp mounts.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Dapp ID |

### `dx:route:subpath`

Fired when the path changes within an already-mounted dapp (e.g. `/tools/cic` → `/tools/cic/report`). The dapp is **not** re-mounted — use this event to update internal view state.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Dapp ID |
| `path` | `string` | New full path |
| `previousPath` | `string` | Previous full path |

```js
dx.events.on('dx:route:subpath', ({ id, path, previousPath }) => {
  if (id !== 'my-dapp') return;
  updateView(path);
});
```

### `dx:dapp:mounted`

Broadcast after a dapp has been mounted. Distinct from `dx:mount` — this is for observers, not the dapp itself.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Dapp ID |

### `dx:dapp:unmounted`

Broadcast after a dapp has been unmounted.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Dapp ID |

### `dx:dapp:enabled`

An optional dapp was enabled.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Dapp ID |

### `dx:dapp:disabled`

An optional dapp was disabled.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Dapp ID |

### `dx:error`

An error occurred in the shell or lifecycle.

| Field | Type | Description |
|-------|------|-------------|
| `source` | `string` | Origin (e.g. `'lifecycle:my-dapp'`, `'lifecycle:my-dapp:styles'`, `'lifecycle:my-dapp:template'`, `'lifecycle:my-dapp:dependency'`) |
| `error` | `Error` | The error object |

```js
dx.events.on('dx:error', ({ source, error }) => {
  console.warn(`[${source}]`, error.message);
});
```

### `dx:plugin:registered`

A plugin was added to the registry.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Plugin name |

### `dx:event:registered`

Custom events were registered via the event registry.

| Field | Type | Description |
|-------|------|-------------|
| `source` | `string` | Registrant (plugin name or dapp ID) |
| `events` | `string[]` | Newly registered event names |

---

## Plugin Events

Registered by plugins during `init()`. Only available when the corresponding plugin is loaded.

### Wallet

| Event | Payload | When |
|-------|---------|------|
| `dx:plugin:wallet:connected` | `{ address: string, chainId: number }` | Wallet connected |
| `dx:plugin:wallet:disconnected` | `{}` | Wallet disconnected |
| `dx:plugin:wallet:changed` | `{ address: string, chainId: number }` | Account or chain changed while connected |

```js
dx.events.on('dx:plugin:wallet:connected', ({ address, chainId }) => {
  console.log(`Connected: ${address} on chain ${chainId}`);
});
```

### Auth

| Event | Payload | When |
|-------|---------|------|
| `dx:plugin:auth:authenticated` | `{ address: string }` | User authenticated (wallet connected) |
| `dx:plugin:auth:deauthenticated` | `{}` | User deauthenticated (wallet disconnected) |

### Theme

| Event | Payload | When |
|-------|---------|------|
| `dx:plugin:theme:changed` | `{ theme: string, mode: ThemeMode, resolved: 'light' \| 'dark' }` | Theme or mode changed |

```js
dx.events.on('dx:plugin:theme:changed', ({ theme, mode, resolved }) => {
  // resolved is the actual applied mode ('light' or 'dark')
  // mode may be 'system' — resolved tells you what that means right now
});
```

### Settings

| Event | Payload | When |
|-------|---------|------|
| `dx:plugin:settings:changed` | `{ dappId: string, key: string, value: unknown }` | Any setting value changed |

```js
dx.events.on('dx:plugin:settings:changed', ({ dappId, key, value }) => {
  if (dappId === 'my-dapp' && key === 'refreshInterval') {
    restartPolling(value);
  }
});
```

---

## Custom Events

Dapps and developers can register their own events. Custom event names must not start with `dx:`.

```js
// Register (typically during dapp mount)
const dx = window.__DXKIT__;
dx.eventRegistry.registerEvent('my-dapp', [
  { name: 'myapp:data:loaded', description: 'Data finished loading' },
  { name: 'myapp:item:selected' },
]);

// Emit
dx.events.emit('myapp:data:loaded', { count: 42 });

// Listen (from another dapp or the shell)
dx.events.on('myapp:data:loaded', ({ count }) => {
  console.log(`Loaded ${count} items`);
});
```

### Typing Custom Events

By default, custom event payloads are `unknown`. Use module augmentation to add type safety:

```ts
declare module 'dxkit' {
  interface EventMap {
    'myapp:data:loaded': { count: number };
    'myapp:item:selected': { itemId: string };
  }
}
```

With this declaration, `emit()` validates the payload shape and `on()` handlers receive typed parameters — no casts needed. The types are only available when your package is in the consumer's dependency tree, which matches runtime behavior: if the plugin or dapp isn't loaded, the events don't exist.

## Event Namespacing Rules

| Pattern | Who | Example |
|---------|-----|---------|
| `dx:ready`, `dx:mount`, etc. | Shell (built-in, cannot register) | `dx:dapp:mounted` |
| `dx:plugin:<name>:<action>` | Plugins (name must match source) | `dx:plugin:wallet:connected` |
| Anything without `dx:` | Dapps/developers | `myapp:data:loaded` |
| `dx:*` (without `dx:plugin:`) | Reserved — rejected | `dx:custom:thing` |

**Conflict rules:**
- Re-registering from the same source is a silent no-op
- Registering an event already owned by a different source throws
- Registering a built-in shell event throws

## Introspection

```js
// List all registered custom events
const events = dx.eventRegistry.getRegisteredEvents();
// [{ name: 'dx:plugin:wallet:connected', source: 'wallet', description: undefined }, ...]

// Check if an event is registered
dx.eventRegistry.isRegistered('dx:plugin:wallet:connected'); // true
```

[Getting Started](getting-started.md) | [Dapp Development](dapp-development.md) | [Plugin Development](plugin-development.md) | [System Internals](system-internals.md) | [Events Reference](events-reference.md) | **API Reference** | [Cookbook](cookbook.md)

---

# API Reference

All factory functions, interfaces, and type definitions.

[Factory Functions](#factory-functions) | [Shell](#shell) | [Context](#context) | [EventBus](#eventbus) | [EventRegistry](#eventregistry) | [Router](#router) | [LifecycleManager](#lifecyclemanager) | [PluginRegistry](#pluginregistry) | [Settings](#settings) | [Type Reference](#type-reference)

---

## Factory Functions

### `createShell(config?)`

Creates a shell instance.

```ts
function createShell(config?: ShellConfig): Shell
```

```js
const shell = DxKit.createShell({
  plugins: { theme: DxTheme.createCSSTheme() },
  manifests: [{
    id: 'hello',
    name: 'Hello',
    version: '1.0.0',
    route: '/hello',
    entry: '/hello/dapp.js',
    nav: { label: 'Hello' },
  }],
});
await shell.init();
```

### `createEventBus(target?)`

Creates a typed event bus. Events dispatched on the provided `EventTarget` (defaults to `window`).

```ts
function createEventBus(target?: EventTarget): EventBus
```

### `createEventRegistry(bus)`

Creates an event registry for runtime event registration.

```ts
function createEventRegistry(bus: EventBus): EventRegistry
```

### `createPluginRegistry()`

Creates a plugin registry (Map-backed).

```ts
function createPluginRegistry(): PluginRegistry
```

### `createRouter(config)`

Creates a router instance.

```ts
function createRouter(config: RouterConfig): Router

interface RouterConfig {
  mode: 'history' | 'hash';
  basePath: string;
  manifests: DappManifest[];
}
```

### `createLifecycleManager(events, options?)`

Creates a lifecycle manager for dapp mount/unmount orchestration.

```ts
function createLifecycleManager(
  events: EventBus,
  options?: LifecycleManagerOptions,
): LifecycleManager

interface LifecycleManagerOptions {
  scriptLoader?: (src: string) => Promise<void>;
  styleLoader?: (href: string) => Promise<void>;
  hasPlugin?: (name: string) => boolean;
}
```

### `deepMerge(a, b)`

Recursively merges `b` into `a`. Arrays are replaced, not concatenated. `undefined` values in `b` are skipped.

```ts
function deepMerge<T extends Record<string, any>>(a: T, b: Partial<T>): T
```

---

## Shell

```ts
interface Shell {
  init(): Promise<void>;
  getPlugin<T extends Plugin>(name: string): T | undefined;
  getManifests(): DappManifest[];
  getEnabledManifests(): DappManifest[];
  enableDapp(id: string): void;
  disableDapp(id: string): void;
  isDappEnabled(id: string): boolean;
  navigate(path: string): void;
  getCurrentRoute(): string;
  destroy(): void;
}
```

| Method | Description |
|--------|-------------|
| `init()` | Initialize plugins, load manifests, resolve initial route. Call once. |
| `getPlugin(name)` | Retrieve a registered plugin by name. Returns `undefined` if not found. |
| `getManifests()` | All loaded manifests (including disabled optional dapps). |
| `getEnabledManifests()` | Only enabled manifests (optional dapps filtered by state). |
| `enableDapp(id)` | Enable an optional dapp. No-op if already enabled or not optional. |
| `disableDapp(id)` | Disable an optional dapp. Unmounts if currently mounted. |
| `isDappEnabled(id)` | Check enabled state. Non-optional dapps always return `true`. |
| `navigate(path)` | Navigate to a path. Triggers route resolution and mount/unmount. |
| `getCurrentRoute()` | Current normalized path. |
| `destroy()` | Tear down — unmount, destroy plugins, remove `window.__DXKIT__`. |

---

## Context

The public surface exposed to dapps via `window.__DXKIT__`.

```ts
interface Context {
  events: EventBus;
  eventRegistry: EventRegistry;
  router: {
    navigate: (path: string) => void;
    getCurrentPath: () => string;
  };
  getPlugin: <T extends Plugin>(name: string) => T | undefined;
  getPlugins: () => Record<string, Plugin>;
  getManifests: () => DappManifest[];
  getEnabledManifests: () => DappManifest[];
  enableDapp: (id: string) => void;
  disableDapp: (id: string) => void;
  isDappEnabled: (id: string) => boolean;
  settings?: Settings;    // injected by @dxkit/settings
}
```

---

## EventBus

```ts
interface EventBus {
  emit<K extends keyof EventMap>(event: K, detail: EventMap[K]): void;
  on<K extends keyof EventMap>(event: K, handler: (detail: EventMap[K]) => void): Listener;
  once<K extends keyof EventMap>(event: K, handler: (detail: EventMap[K]) => void): void;
  off<K extends keyof EventMap>(event: K, handler: (detail: EventMap[K]) => void): void;
}
```

| Method | Description |
|--------|-------------|
| `emit(event, detail)` | Dispatch an event with a typed payload. |
| `on(event, handler)` | Subscribe. Returns a `Listener` with `off()`, `pause()`, `resume()`. |
| `once(event, handler)` | Subscribe for a single event, then auto-unsubscribe. |
| `off(event, handler)` | Unsubscribe by handler reference. |

### Listener

```ts
interface Listener {
  off(): void;
  readonly paused: boolean;
  pause(): void;
  resume(): void;
}
```

| Property/Method | Description |
|-----------------|-------------|
| `off()` | Permanently remove this listener. |
| `paused` | Whether the listener is currently paused. |
| `pause()` | Stop delivering events (subscription stays active). |
| `resume()` | Resume delivering events after a pause. |

---

## EventRegistry

```ts
interface EventRegistry {
  registerEvent(source: string, events: EventRegistration[]): void;
  getRegisteredEvents(): RegisteredEvent[];
  isRegistered(event: string): boolean;
}
```

| Method | Description |
|--------|-------------|
| `registerEvent(source, events)` | Register custom events. See [naming rules](events-reference.md#event-namespacing-rules). |
| `getRegisteredEvents()` | All registered custom events (excludes built-in shell events). |
| `isRegistered(event)` | Check if an event name has been registered. |

### EventRegistration

```ts
interface EventRegistration {
  name: string;
  description?: string;
}
```

### RegisteredEvent

```ts
interface RegisteredEvent {
  name: string;
  source: string;
  description?: string;
}
```

---

## Router

```ts
interface Router {
  resolve(path: string): DappManifest | null;
  navigate(path: string): void;
  getCurrentPath(): string;
  onRouteChange(handler: (manifest: DappManifest | null) => void): () => void;
  destroy(): void;
}
```

| Method | Description |
|--------|-------------|
| `resolve(path)` | Find the matching manifest for a path (longest prefix match). |
| `navigate(path)` | Push a new path. Triggers `onRouteChange` handlers. |
| `getCurrentPath()` | Normalized current path. |
| `onRouteChange(handler)` | Subscribe to route changes. Returns unsubscribe function. |
| `destroy()` | Remove event listeners and clear handlers. |

> **Note:** The router exposed on `Context` is a narrow wrapper — only `navigate()` and `getCurrentPath()` are available to dapps. `resolve()`, `onRouteChange()`, and `destroy()` are internal.

---

## LifecycleManager

```ts
interface LifecycleManager {
  mount(manifest: DappManifest, container: HTMLElement, path?: string): Promise<void>;
  unmount(): void;
  getCurrentDapp(): string | null;
  destroy(): void;
}
```

| Method | Description |
|--------|-------------|
| `mount(manifest, container, path?)` | Load script/styles, emit `dx:mount`, track as current dapp. |
| `unmount()` | Emit `dx:unmount` for the current dapp. No-op if nothing mounted. |
| `getCurrentDapp()` | ID of the currently mounted dapp, or `null`. |
| `destroy()` | Unmount current dapp if any. |

---

## PluginRegistry

```ts
interface PluginRegistry {
  register(name: string, plugin: Plugin): void;
  get<T extends Plugin>(name: string): T | undefined;
  has(name: string): boolean;
  getAll(): Record<string, Plugin>;
}
```

| Method | Description |
|--------|-------------|
| `register(name, plugin)` | Add a plugin to the registry. |
| `get(name)` | Retrieve by name (typed). Returns `undefined` if not found. |
| `has(name)` | Check existence. |
| `getAll()` | Snapshot of all plugins (defensive copy). |

---

## Settings

Injected on `Context.settings` by the settings plugin. See [`@dxkit/settings`](plugins/settings.md).

```ts
interface Settings {
  get<T = unknown>(dappId: string, key: string): T | undefined;
  set(dappId: string, key: string, value: unknown): void;
  getAll(dappId: string): Record<string, unknown>;
  getSections(): SettingsSection[];
  onChange(dappId: string, key: string, handler: (value: unknown) => void): () => void;
  onAnyChange(dappId: string, handler: (key: string, value: unknown) => void): () => void;
}
```

| Method | Description |
|--------|-------------|
| `get(dappId, key)` | Get a setting value. Returns manifest default if not explicitly set. |
| `set(dappId, key, value)` | Set a value. Persists to localStorage, emits `dx:plugin:settings:changed`. |
| `getAll(dappId)` | All settings for a dapp as key-value map (defaults merged with stored). |
| `getSections()` | All setting sections for UI generation. Hides disabled dapps. |
| `onChange(dappId, key, handler)` | Subscribe to a specific setting. Returns unsubscribe function. |
| `onAnyChange(dappId, handler)` | Subscribe to any setting change for a dapp. Returns unsubscribe function. |

---

## Type Reference

### ShellConfig

```ts
interface ShellConfig {
  plugins?: Record<string, Plugin>;
  dapps?: DappEntry[];
  manifests?: DappManifest[];
  registryUrl?: string;     // default: '/registry.json'
  basePath?: string;        // default: '/'
  mode?: 'history' | 'hash'; // default: 'history'
  scriptLoader?: (src: string) => Promise<void>;
  styleLoader?: (href: string) => Promise<void>;
}
```

### DappEntry

```ts
interface DappEntry {
  manifest: string;
  overrides?: Partial<DappManifest>;
}
```

### DappManifest

```ts
interface DappManifest {
  id: string;
  name: string;
  description?: string;
  version: string;
  route: string;
  entry: string;
  styles?: string;
  nav: {
    label: string;
    icon?: string;
    group?: string;
    order?: number;
    hidden?: boolean;
  };
  requires?: {
    plugins?: string[];
  };
  settings?: SettingDefinition[];
  optional?: boolean;    // default: false
  enabled?: boolean;     // default: true
  standalone?: boolean;  // default: true
}
```

### Plugin

```ts
interface Plugin {
  readonly name: string;
  init?(context: Context): Promise<void>;
  destroy?(): Promise<void>;
  settings?: SettingDefinition[];
}
```

### Wallet

```ts
interface Wallet extends Plugin {
  connect(providerId?: string): Promise<WalletState>;
  disconnect(): Promise<void>;
  getState(): WalletState;
  sign(message: string): Promise<string>;
  onStateChange(handler: (state: WalletState) => void): () => void;
  getProviders(): WalletProvider[];
  getActiveProvider(): WalletProvider | null;
}
```

### WalletState

```ts
interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  provider: unknown;
}
```

### WalletProvider

```ts
interface WalletProvider {
  readonly id: string;
  readonly name: string;
  available(): boolean;
  connect(): Promise<WalletState>;
  disconnect(): Promise<void>;
  sign(message: string): Promise<string>;
  onStateChange(handler: (state: WalletState) => void): () => void;
}
```

### Auth

```ts
interface Auth extends Plugin {
  authenticate(): Promise<AuthState>;
  deauthenticate(): Promise<void>;
  getState(): AuthState;
  isAuthenticated(): boolean;
  onStateChange(handler: (state: AuthState) => void): () => void;
}
```

### AuthState

```ts
interface AuthState {
  authenticated: boolean;
  address: string | null;
  token: string | null;
  expiresAt: number | null;
}
```

### Theme

```ts
interface Theme extends Plugin {
  getMode(): ThemeMode;
  setMode(mode: ThemeMode): void;
  toggleMode(): void;
  getResolvedMode(): 'light' | 'dark';
  onModeChange(handler: (mode: ThemeMode, resolved: 'light' | 'dark') => void): () => void;
  getTheme(): string;
  setTheme(theme: string): void;
  getAvailableThemes(): string[];
  onThemeChange(handler: (theme: string) => void): () => void;
}
```

### ThemeMode

```ts
type ThemeMode = 'light' | 'dark' | 'system';
```

### EventMap

Built-in shell events are typed in core. The index signature allows custom events registered at runtime — these default to `unknown` unless a plugin or dapp augments the interface.

```ts
interface EventMap {
  'dx:ready': {};
  'dx:route:changed': { path: string; manifest?: DappManifest };
  'dx:dapp:mounted': { id: string };
  'dx:dapp:unmounted': { id: string };
  'dx:dapp:enabled': { id: string };
  'dx:dapp:disabled': { id: string };
  'dx:mount': { id: string; container: HTMLElement; path: string };
  'dx:unmount': { id: string };
  'dx:error': { source: string; error: Error };
  'dx:plugin:registered': { name: string };
  'dx:event:registered': { source: string; events: string[] };
  [event: string]: unknown;  // fallback for untyped custom events
}
```

Plugins and dapps extend `EventMap` via module augmentation to type their own events:

```ts
declare module 'dxkit' {
  interface EventMap {
    'dx:plugin:wallet:connected': { address: string; chainId: number };
  }
}
```

When the augmenting package is installed, `emit()` validates payloads and `on()` handlers receive typed parameters automatically.

### SettingDefinition

```ts
interface SettingDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect';
  default: unknown;
  description?: string;
  options?: { label: string; value: string }[];
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  dependsOn?: string;
}
```

### SettingsSection

```ts
interface SettingsSection {
  id: string;
  label: string;
  definitions: SettingDefinition[];
}
```

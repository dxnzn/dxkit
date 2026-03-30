import { createEventBus, createEventRegistry } from './events.js';
import { createLifecycleManager } from './lifecycle.js';
import { createPluginRegistry } from './registry.js';
import { createRouter } from './router.js';
import type { Context, DappEntry, DappManifest, Plugin, Settings, Shell, ShellConfig } from './types/index.js';
import { deepMerge } from './utils.js';

/**
 * Creates a shell instance for composable dapp development.
 *
 * The shell manages routing, plugin lifecycle, event bus, and dapp
 * mount/unmount orchestration. It owns zero DOM — the developer provides
 * the layout and mount container.
 */
export function createShell(config: ShellConfig = {}): Shell {
  const {
    plugins = {},
    dapps: dappEntries,
    manifests: inlineManifests,
    registryUrl = '/registry.json',
    basePath = '/',
    mode = 'history',
    scriptLoader,
    styleLoader,
  } = config;

  const events = createEventBus();
  const eventRegistry = createEventRegistry(events);
  const registry = createPluginRegistry();
  const lifecycle = createLifecycleManager(events, {
    hasPlugin: (name: string) => registry.has(name),
    scriptLoader,
    styleLoader,
  });
  let manifests: DappManifest[] = [];
  let router = createRouter({ mode, basePath, manifests: [] });
  let mountContainer: HTMLElement | null = null;
  let routeUnsub: (() => void) | null = null;
  let initialized = false;
  const enabledState = new Map<string, boolean>();

  function getEnabledManifests(): DappManifest[] {
    return manifests.filter((m) => {
      if (!m.optional) return true;
      return enabledState.get(m.id) ?? true;
    });
  }

  function initEnabledState(): void {
    // Start with manifest defaults
    for (const m of manifests) {
      if (m.optional) {
        enabledState.set(m.id, m.enabled !== false);
      }
    }

    // Override with persisted values from settings plugin (if available)
    // Duck-type check — settings plugin exposes getSettingsAPI() by convention
    const settingsPlugin = registry.get<Plugin>('settings');
    if (!settingsPlugin || !('getSettingsAPI' in settingsPlugin)) return;

    const api = (settingsPlugin as any).getSettingsAPI() as Settings;
    // Persisted values override manifest defaults for optional dapps
    for (const m of manifests) {
      if (m.optional) {
        const persisted = api.get<boolean>('_shell', m.id);
        if (persisted !== undefined) {
          enabledState.set(m.id, persisted);
        }
      }
    }
  }

  // Full rebuild required — router is immutable once created
  function rebuildRouter(): void {
    const currentDapp = lifecycle.getCurrentDapp();

    if (routeUnsub) {
      routeUnsub();
      routeUnsub = null;
    }
    router.destroy();

    router = createRouter({ mode, basePath, manifests: getEnabledManifests() });
    routeUnsub = router.onRouteChange(handleRouteChange);

    // If the current dapp was disabled, unmount and return to root
    if (currentDapp) {
      const stillEnabled = getEnabledManifests().some((m) => m.id === currentDapp);
      if (!stillEnabled) {
        lifecycle.unmount();
        router.navigate('/');
      }
    }
  }

  function enableDapp(id: string): void {
    const manifest = manifests.find((m) => m.id === id);
    if (!manifest?.optional) return;
    if (enabledState.get(id) === true) return;

    enabledState.set(id, true);
    if (initialized) rebuildRouter();
    events.emit('dx:dapp:enabled', { id });
  }

  function disableDapp(id: string): void {
    const manifest = manifests.find((m) => m.id === id);
    if (!manifest?.optional) return;
    if (enabledState.get(id) === false) return;

    enabledState.set(id, false);
    if (initialized) rebuildRouter();
    events.emit('dx:dapp:disabled', { id });
  }

  function isDappEnabled(id: string): boolean {
    const manifest = manifests.find((m) => m.id === id);
    if (!manifest) return false;
    if (!manifest.optional) return true;
    return enabledState.get(id) ?? true;
  }

  // Build the context that plugins and dapps see
  const context: Context = {
    events,
    eventRegistry,
    router: {
      navigate: (path: string) => router.navigate(path),
      getCurrentPath: () => router.getCurrentPath(),
    },
    getPlugin: <T extends Plugin>(name: string) => registry.get<T>(name),
    getPlugins: () => registry.getAll(),
    getManifests: () => [...manifests],
    getEnabledManifests: () => getEnabledManifests(),
    enableDapp,
    disableDapp,
    isDappEnabled,
  };

  /** Rejects manifests missing fields that would cause silent downstream failures. */
  function isValidManifest(m: any): m is DappManifest {
    return (
      m &&
      typeof m.id === 'string' &&
      typeof m.route === 'string' &&
      typeof m.entry === 'string' &&
      m.nav &&
      typeof m.nav.label === 'string'
    );
  }

  async function loadDappManifest(entry: DappEntry): Promise<DappManifest | null> {
    try {
      const res = await fetch(entry.manifest);
      if (!res.ok) return null;
      const base = await res.json();
      if (!isValidManifest(base)) {
        events.emit('dx:error', {
          source: 'shell:manifest',
          error: new Error(
            `Invalid manifest from ${entry.manifest} — missing required fields (id, route, entry, nav.label)`,
          ),
        });
        return null;
      }
      if (entry.overrides) {
        return deepMerge(base, entry.overrides);
      }
      return base;
    } catch {
      return null;
    }
  }

  // Three-tier fallback: dapp entries → inline manifests → registry.json
  async function loadManifests(): Promise<DappManifest[]> {
    if (dappEntries?.length) {
      const results = await Promise.all(dappEntries.map(loadDappManifest));
      return results.filter((m): m is DappManifest => m !== null);
    }

    if (inlineManifests) {
      return inlineManifests;
    }

    try {
      const res = await fetch(registryUrl);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // No registry.json — that's fine
    }

    return [];
  }

  async function init(): Promise<void> {
    if (initialized) return;

    // Register plugins
    for (const [name, plugin] of Object.entries(plugins)) {
      registry.register(name, plugin);
      events.emit('dx:plugin:registered', { name });
    }

    // Manifests load before plugin init so plugins can read them during init()
    manifests = await loadManifests();

    // Initialize plugins (after manifests are loaded)
    // Failures are contained — a bad plugin emits dx:error but doesn't crash the shell
    for (const [name, plugin] of Object.entries(plugins)) {
      if (plugin.init) {
        try {
          await plugin.init(context);
        } catch (err) {
          events.emit('dx:error', {
            source: `plugin:${name}`,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    }

    // Initialize enabled state from manifest defaults + persisted settings
    initEnabledState();

    // Rebuild router with enabled manifests only
    router.destroy();
    router = createRouter({ mode, basePath, manifests: getEnabledManifests() });

    // Listen for route changes
    routeUnsub = router.onRouteChange(handleRouteChange);

    // Global context bridge — dapps access plugins/events via window.__DXKIT__
    // Frozen to prevent mutation by dapp scripts or third-party code
    Object.freeze(context);
    window.__DXKIT__ = context;

    initialized = true;

    // Resolve initial route
    const initial = router.resolve(router.getCurrentPath());
    if (initial) {
      await mountDapp(initial);
    }

    events.emit('dx:ready', {});
  }

  async function handleRouteChange(manifest: DappManifest | null): Promise<void> {
    if (manifest) {
      await mountDapp(manifest);
    } else {
      lifecycle.unmount();
    }
    events.emit('dx:route:changed', {
      path: router.getCurrentPath(),
      manifest: manifest ?? undefined,
    });
  }

  async function mountDapp(manifest: DappManifest): Promise<void> {
    // Skip if already mounted
    if (lifecycle.getCurrentDapp() === manifest.id) return;

    const container = getMountContainer();
    if (!container) return;

    await lifecycle.mount(manifest, container, router.getCurrentPath());
  }

  // Lazily resolved — developer must provide <div id="dx-mount"> in their layout
  function getMountContainer(): HTMLElement | null {
    if (mountContainer) return mountContainer;
    mountContainer = document.getElementById('dx-mount');
    return mountContainer;
  }

  function getPlugin<T extends Plugin>(name: string): T | undefined {
    return registry.get<T>(name);
  }

  function getManifests(): DappManifest[] {
    return [...manifests];
  }

  function navigate(path: string): void {
    router.navigate(path);
  }

  function getCurrentRoute(): string {
    return router.getCurrentPath();
  }

  function destroy(): void {
    lifecycle.destroy();

    if (routeUnsub) {
      routeUnsub();
      routeUnsub = null;
    }

    router.destroy();

    for (const plugin of Object.values(registry.getAll())) {
      if (plugin.destroy) {
        plugin.destroy();
      }
    }

    if (window.__DXKIT__ === context) {
      delete window.__DXKIT__;
    }

    mountContainer = null;
    initialized = false;
  }

  return {
    init,
    getPlugin,
    getManifests,
    getEnabledManifests,
    enableDapp,
    disableDapp,
    isDappEnabled,
    navigate,
    getCurrentRoute,
    destroy,
  };
}

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
  // D-05: the flat scriptLoader/styleLoader/templateLoader fields were removed from ShellConfig
  // in favor of the nested `lifecycle` group. TypeScript catches this for typed consumers at
  // compile time; untyped JS/IIFE consumers bypass that check, so this runtime guard throws
  // loudly instead of silently constructing a shell with unconfigured loaders.
  const flatLoaderKeys = ['scriptLoader', 'styleLoader', 'templateLoader'] as const;
  // Object.hasOwn (not `in`) so only own keys trip the guard — `in` also matches
  // prototype-chain keys, which would misfire on config objects with a non-null prototype.
  const presentFlatKeys = flatLoaderKeys.filter((key) => Object.hasOwn(config, key));
  if (presentFlatKeys.length > 0) {
    throw new Error(
      `ShellConfig.${presentFlatKeys.join('/')} ${presentFlatKeys.length > 1 ? 'are' : 'is'} no longer supported — ` +
        `move to config.lifecycle.${presentFlatKeys.join('/')}.`,
    );
  }

  const {
    plugins = {},
    dapps: dappEntries,
    manifests: inlineManifests,
    registryUrl = '/registry.json',
    basePath = '/',
    mode = 'history',
    lifecycle: lifecycleOptions = {},
  } = config;

  const events = createEventBus();
  const eventRegistry = createEventRegistry(events);
  const registry = createPluginRegistry();
  const lifecycle = createLifecycleManager(events, {
    ...lifecycleOptions,
    // Bound last so a consumer-supplied hasPlugin (including `hasPlugin: undefined`) can't
    // clobber the registry-backed check and disable required-plugin enforcement.
    hasPlugin: (name: string) => registry.has(name),
  });
  let manifests: DappManifest[] = [];
  let router = createRouter({ mode, basePath, manifests: [] });
  let mountContainer: HTMLElement | null = null;
  let routeUnsub: (() => void) | null = null;
  let initialized = false;
  let currentPath: string | null = null;
  // Set synchronously before mountDapp's first await so concurrent calls for the
  // same dapp (e.g. a duplicate route notification) can't both pass the mount guard.
  let pendingMountId: string | null = null;
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
    if (initialized) {
      // rebuildRouter() only acts on lifecycle.getCurrentDapp(), which is null for a mount
      // still in flight — this closes that gap so a disabled dapp's not-yet-committed mount
      // is abandoned too (D-03 scenario 1).
      lifecycle.invalidatePendingMount(id);
      rebuildRouter();
    }
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
    const path = router.getCurrentPath();

    // Already mounted — same dapp, different sub-path → notify without re-mounting
    if (lifecycle.getCurrentDapp() === manifest.id) {
      if (currentPath !== null && currentPath !== path) {
        const previousPath = currentPath;
        currentPath = path;
        events.emit('dx:route:subpath', { id: manifest.id, path, previousPath });
      }
      return;
    }

    // A mount for this same dapp is already in flight — drop the duplicate. The in-flight
    // call sets currentDappId/currentPath when it finishes; re-running here would emit a
    // second dx:mount. (Not a sub-path: the duplicate resolves to the same path.)
    if (pendingMountId === manifest.id) return;

    const container = getMountContainer();
    if (!container) {
      events.emit('dx:error', {
        source: 'shell:mount',
        error: new Error(`Mount failed for "${manifest.id}" — #dx-mount container not found in the DOM`),
      });
      return;
    }

    pendingMountId = manifest.id;
    try {
      await lifecycle.mount(manifest, container, path);
      // Fresh-path commit (D-03 scenario 3): a sub-path navigation that arrived while this
      // mount was still in flight was silently dropped by the pendingMountId dedupe above —
      // re-read the browser's actual current path now instead of trusting the value captured
      // when this call started, and catch up with a dx:route:subpath event if it moved.
      const freshPath = router.getCurrentPath();
      if (freshPath !== path && lifecycle.getCurrentDapp() === manifest.id) {
        events.emit('dx:route:subpath', { id: manifest.id, path: freshPath, previousPath: path });
      }
      currentPath = freshPath;
    } finally {
      pendingMountId = null;
    }
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

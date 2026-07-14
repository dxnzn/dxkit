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

  // D-15: captured before the destructure default below erases whether the caller actually
  // passed registryUrl — gates the registry-failure dx:error emit so the default /registry.json
  // probe (an expected absence for dapps/manifests-only consumers) stays silent.
  const registryUrlExplicit = Object.hasOwn(config, 'registryUrl');

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
  // Makes slot ownership call-scoped so a stale/invalidated call can't clear a newer
  // attempt's slot and a re-navigation isn't dropped after invalidation (D-01, CR-01).
  let pendingMountToken = 0;
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
      // Mirrors the null-branch fix so enableDapp + re-navigate to a mid-mount-disabled dapp
      // mounts fresh instead of being dropped by the stale dedupe slot (D-01, CR-01).
      if (pendingMountId === id) releasePendingMount();
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
      if (!res.ok) {
        // WR-01: non-2xx was previously a silent `return null` — surface it like every other
        // manifest-load failure below so a misconfigured/unreachable manifest host isn't invisible.
        const statusInfo = typeof res.status === 'number' ? ` (status ${res.status})` : '';
        events.emit('dx:error', {
          source: 'shell:manifest',
          error: new Error(`Failed to fetch manifest from ${entry.manifest}${statusInfo} — non-OK response`),
        });
        return null;
      }
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
    } catch (err) {
      // WR-01: this catch covers both a network-level fetch throw and a res.json() parse
      // failure indiscriminately — the message says so rather than pretending to distinguish
      // them, and `cause` preserves the original error for anyone inspecting dx:error detail.
      events.emit('dx:error', {
        source: 'shell:manifest',
        error: new Error(
          `Failed to load manifest from ${entry.manifest} — request failed or response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        ),
      });
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
      if (!res.ok) {
        // D-15: explicit registryUrl is a deliberate config choice — a non-OK response is
        // surfaced like every other manifest-load failure. The default probe path (registryUrl
        // omitted) stays silent below — absence of /registry.json is an expected state.
        if (registryUrlExplicit) {
          const statusInfo = typeof res.status === 'number' ? ` (status ${res.status})` : '';
          events.emit('dx:error', {
            source: 'shell:manifest',
            error: new Error(`Failed to fetch registry from ${registryUrl}${statusInfo} — non-OK response`),
          });
        }
        return [];
      }
      return await res.json();
    } catch (err) {
      // D-15: mirrors loadDappManifest()'s unified network/parse-failure message — covers both
      // a fetch throw and a res.json() parse failure indiscriminately.
      if (registryUrlExplicit) {
        events.emit('dx:error', {
          source: 'shell:manifest',
          error: new Error(
            `Failed to load registry from ${registryUrl} — request failed or response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
            { cause: err },
          ),
        });
      }
    }

    return [];
  }

  /** Leading-slash/trailing-slash subset of router.ts's normalizePath (no basePath stripping —
   * manifest routes are declared without a basePath prefix). Trims surrounding whitespace before
   * normalizing (D-06) — otherwise ' /a' would become '/ /a' via the leading-slash prepend, and
   * '/a ' would keep an unreachable trailing space. Returns null for the unfixable case
   * (empty/whitespace-only route). */
  function normalizeRoute(route: string): string | null {
    const trimmed = route.trim();
    if (trimmed === '') return null;
    let normalized = trimmed;
    if (!normalized.startsWith('/')) normalized = `/${normalized}`;
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  /** Single choke point run once per shell lifetime (not per rebuildRouter — enable/disable
   * doesn't change the manifest list): tier-uniform validation (D-07), route normalization +
   * reject-unfixable (D-06), and duplicate-route visibility (D-08). */
  function normalizeAndValidateManifests(list: DappManifest[]): DappManifest[] {
    const validated: DappManifest[] = [];

    for (const m of list) {
      if (!isValidManifest(m)) {
        events.emit('dx:error', {
          source: 'shell:manifest',
          error: new Error(
            `Invalid manifest "${(m as any)?.id ?? 'unknown'}" — missing required fields (id, route, entry, nav.label)`,
          ),
        });
        continue;
      }

      const normalizedRoute = normalizeRoute(m.route);
      if (normalizedRoute === null) {
        events.emit('dx:error', {
          source: 'shell:route',
          error: new Error(`Manifest "${m.id}" has an empty or whitespace-only route — discarded`),
        });
        continue;
      }

      validated.push(normalizedRoute === m.route ? m : { ...m, route: normalizedRoute });
    }

    // D-08: first-registered-wins resolution is already guaranteed by router.ts's stable
    // construction-time sort — the duplicate manifest is kept, only the collision is surfaced.
    const seenRoutes = new Map<string, string>();
    for (const m of validated) {
      const firstId = seenRoutes.get(m.route);
      if (firstId) {
        events.emit('dx:error', {
          source: 'shell:manifest',
          error: new Error(
            `Duplicate route "${m.route}" declared by manifests "${firstId}" and "${m.id}" — "${firstId}" wins (first registered)`,
          ),
        });
      } else {
        seenRoutes.set(m.route, m.id);
      }
    }

    return validated;
  }

  async function init(): Promise<void> {
    if (initialized) return;

    // Register plugins
    for (const [name, plugin] of Object.entries(plugins)) {
      registry.register(name, plugin);
      events.emit('dx:plugin:registered', { name });
    }

    // Manifests load before plugin init so plugins can read them during init()
    manifests = normalizeAndValidateManifests(await loadManifests());

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
      // An unmatched route must supersede an in-flight mount too, not just a dapp->dapp
      // transition — otherwise a stale dapp can still commit its DOM under the new URL (D-01).
      // Reads lifecycle's own in-flight mount (inFlightMountId), not the corruptible shell-level
      // pendingMountId — an overlapping A->B race that has already cleared/rewritten
      // pendingMountId (via mountDapp's guarded finally) cannot defeat this invalidation.
      lifecycle.invalidateAnyPendingMount();
      // Frees the shell dedupe slot too, so a re-navigation to the just-invalidated dapp is
      // not dropped by the same-id dedupe (D-01, CR-01).
      releasePendingMount();
      lifecycle.unmount();
    }
    events.emit('dx:route:changed', {
      path: router.getCurrentPath(),
      manifest: manifest ?? undefined,
    });
  }

  // Frees the dedupe slot after an in-flight mount is invalidated so a re-navigation to the
  // same dapp starts fresh, and the token bump stops the invalidated call's finally from later
  // clearing a newer attempt's slot (D-01, CR-01).
  function releasePendingMount(): void {
    pendingMountToken++;
    pendingMountId = null;
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
    const myToken = ++pendingMountToken;
    try {
      const committed = await lifecycle.mount(manifest, container, path);
      // Epilogue only runs when THIS call committed (lifecycle.mount's own isStale() gate is
      // the sole source of truth) — a stale/superseded call's continuation must never pre-write
      // currentPath (which would swallow a later same-dapp sub-path nav) or emit a spurious
      // dx:route:subpath. getCurrentDapp() === manifest.id can't distinguish two same-id calls,
      // so it's dropped from this condition entirely.
      if (committed) {
        // Fresh-path commit (D-03 scenario 3): a sub-path navigation that arrived while this
        // mount was still in flight was silently dropped by the pendingMountId dedupe above —
        // re-read the browser's actual current path now instead of trusting the value captured
        // when this call started, and catch up with a dx:route:subpath event if it moved.
        const freshPath = router.getCurrentPath();
        if (freshPath !== path) {
          events.emit('dx:route:subpath', { id: manifest.id, path: freshPath, previousPath: path });
        }
        currentPath = freshPath;
      }
    } finally {
      // Call-scoped: only the call that currently owns the token may clear the slot — a stale
      // or invalidated call (whose token was superseded by a newer mount or by
      // releasePendingMount) must never clear a newer attempt's slot (D-01, CR-01).
      if (pendingMountToken === myToken) {
        pendingMountId = null;
      }
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

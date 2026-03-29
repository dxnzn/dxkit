import type { Context, Plugin, SettingDefinition, Settings, SettingsSection } from 'dxkit';

declare module 'dxkit' {
  interface EventMap {
    'dx:plugin:settings:changed': { dappId: string; key: string; value: unknown };
  }
}

export interface SettingsPluginOptions {
  /** localStorage key prefix. Default: 'dxkit:settings'. */
  storageKey?: string;
}

/**
 * Creates a settings plugin that provides the Settings API on dx.settings.
 *
 * Stores values in memory with localStorage persistence. Reads defaults from
 * dapp manifests. Emits 'dx:plugin:settings:changed' on every write.
 */
export function createSettings(options: SettingsPluginOptions = {}): Plugin & { getSettingsAPI(): Settings } {
  const { storageKey = 'dxkit:settings' } = options;

  // In-memory store: dappId -> key -> value
  const store = new Map<string, Map<string, unknown>>();

  // Manifest defaults: sectionId -> SettingDefinition[]
  const definitions = new Map<string, SettingDefinition[]>();
  // Section labels: sectionId -> human-readable label
  const sectionLabels = new Map<string, string>();

  // Change handlers: 'dappId:key' -> Set<handler>
  const keyHandlers = new Map<string, Set<(value: unknown) => void>>();
  // Any-change handlers: dappId -> Set<handler>
  const dappHandlers = new Map<string, Set<(key: string, value: unknown) => void>>();

  let dx: Context | null = null;

  function canUseStorage(): boolean {
    try {
      return typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function';
    } catch {
      return false;
    }
  }

  function persist(): void {
    if (!canUseStorage()) return;
    try {
      const data: Record<string, Record<string, unknown>> = {};
      for (const [dappId, values] of store) {
        data[dappId] = Object.fromEntries(values);
      }
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      /* storage full or blocked */
    }
  }

  function restore(): void {
    if (!canUseStorage()) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const data = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      for (const [dappId, values] of Object.entries(data)) {
        const map = new Map<string, unknown>();
        for (const [key, value] of Object.entries(values)) {
          map.set(key, value);
        }
        store.set(dappId, map);
      }
    } catch {
      /* corrupted — use defaults */
    }
  }

  function getDefault(dappId: string, key: string): unknown {
    const defs = definitions.get(dappId);
    if (!defs) return undefined;
    const def = defs.find((d) => d.key === key);
    return def?.default;
  }

  function loadDefinitions(dx: Context): void {
    // Synthesize enable/disable toggles for optional dapps under reserved '_shell' section
    const optionalDapps = dx.getManifests().filter((m) => m.optional);
    if (optionalDapps.length > 0) {
      const dappToggleDefs: SettingDefinition[] = optionalDapps.map((m) => ({
        key: m.id,
        label: m.name,
        type: 'boolean' as const,
        default: m.enabled !== false,
        description: m.description,
      }));
      definitions.set('_shell', dappToggleDefs);
      sectionLabels.set('_shell', 'Dapps');

      // Bridge: settings toggle → shell enable/disable so router stays in sync
      for (const m of optionalDapps) {
        settingsAPI.onChange('_shell', m.id, (value) => {
          if (value) {
            dx.enableDapp(m.id);
          } else {
            dx.disableDapp(m.id);
          }
        });
      }
    }

    // From dapp manifests
    for (const m of dx.getManifests()) {
      if (m.settings?.length) {
        definitions.set(m.id, m.settings);
        sectionLabels.set(m.id, m.name);
      }
    }
    // From plugins (plugin.name is the namespace, like a dappId)
    for (const [name, plugin] of Object.entries(dx.getPlugins())) {
      if (plugin.settings?.length) {
        definitions.set(name, plugin.settings);
        sectionLabels.set(name, name.charAt(0).toUpperCase() + name.slice(1));
      }
    }
  }

  const settingsAPI: Settings = {
    get<T = unknown>(dappId: string, key: string): T | undefined {
      const dappStore = store.get(dappId);
      if (dappStore?.has(key)) return dappStore.get(key) as T;
      return getDefault(dappId, key) as T | undefined;
    },

    set(dappId: string, key: string, value: unknown): void {
      if (!store.has(dappId)) store.set(dappId, new Map());
      store.get(dappId)!.set(key, value);
      persist();

      // Notify key-specific handlers
      const kHandlers = keyHandlers.get(`${dappId}:${key}`);
      if (kHandlers) {
        for (const handler of kHandlers) handler(value);
      }

      // Notify dapp-level handlers
      const dHandlers = dappHandlers.get(dappId);
      if (dHandlers) {
        for (const handler of dHandlers) handler(key, value);
      }

      // Emit event
      dx?.events.emit('dx:plugin:settings:changed', { dappId, key, value });
    },

    getAll(dappId: string): Record<string, unknown> {
      const result: Record<string, unknown> = {};

      // Start with defaults
      const defs = definitions.get(dappId);
      if (defs) {
        for (const def of defs) {
          result[def.key] = def.default;
        }
      }

      // Override with stored values
      const dappStore = store.get(dappId);
      if (dappStore) {
        for (const [key, value] of dappStore) {
          result[key] = value;
        }
      }

      return result;
    },

    getSections(): SettingsSection[] {
      const sections: SettingsSection[] = [];
      const manifests = dx ? new Set(dx.getManifests().map((m) => m.id)) : new Set<string>();
      for (const [id, defs] of definitions) {
        // Hide settings for disabled dapps (but keep plugin and _shell sections visible)
        if (id !== '_shell' && manifests.has(id) && dx && !dx.isDappEnabled(id)) continue;
        sections.push({
          id,
          label: sectionLabels.get(id) ?? id,
          definitions: defs,
        });
      }
      return sections;
    },

    onChange(dappId: string, key: string, handler: (value: unknown) => void): () => void {
      const mapKey = `${dappId}:${key}`;
      if (!keyHandlers.has(mapKey)) keyHandlers.set(mapKey, new Set());
      keyHandlers.get(mapKey)!.add(handler);
      return () => keyHandlers.get(mapKey)?.delete(handler);
    },

    onAnyChange(dappId: string, handler: (key: string, value: unknown) => void): () => void {
      if (!dappHandlers.has(dappId)) dappHandlers.set(dappId, new Set());
      dappHandlers.get(dappId)!.add(handler);
      return () => dappHandlers.get(dappId)?.delete(handler);
    },
  };

  const plugin: Plugin & { getSettingsAPI(): Settings } = {
    name: 'settings',

    async init(context: Context): Promise<void> {
      dx = context;

      context.eventRegistry.registerEvent('settings', [{ name: 'dx:plugin:settings:changed' }]);

      restore();

      // Load setting definitions from manifests and plugins
      loadDefinitions(context);

      // Inject onto context — dapps access via dx.settings
      (context as any).settings = settingsAPI;
    },

    async destroy(): Promise<void> {
      keyHandlers.clear();
      dappHandlers.clear();
      dx = null;
    },

    getSettingsAPI(): Settings {
      return settingsAPI;
    },
  };

  return plugin;
}

export type { SettingDefinition, Settings, SettingsSection } from 'dxkit';

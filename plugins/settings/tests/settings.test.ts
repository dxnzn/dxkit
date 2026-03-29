import { createSettings } from '@dxkit/settings';
import type { Context, DappManifest, Plugin } from 'dxkit';
import { createEventBus } from 'dxkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let testCounter = 0;

function uniqueStorageKey(): string {
  return `dxkit:settings:test:${++testCounter}`;
}

function mockContext(manifests: DappManifest[] = [], plugins: Record<string, Plugin> = {}): Context {
  const events = createEventBus();
  const enabledState = new Map<string, boolean>();
  return {
    events,
    eventRegistry: {
      registerEvent: vi.fn(),
      getRegisteredEvents: () => [],
      isRegistered: () => false,
    },
    router: { navigate: vi.fn(), getCurrentPath: () => '/' },
    getPlugin: () => undefined,
    getPlugins: () => ({ ...plugins }),
    getManifests: () => manifests,
    getEnabledManifests: () =>
      manifests.filter((m) => {
        if (!m.optional) return true;
        return enabledState.get(m.id) ?? m.enabled !== false;
      }),
    enableDapp: vi.fn((id: string) => {
      enabledState.set(id, true);
    }),
    disableDapp: vi.fn((id: string) => {
      enabledState.set(id, false);
    }),
    isDappEnabled: (id: string) => {
      const m = manifests.find((m) => m.id === id);
      if (!m) return false;
      if (!m.optional) return true;
      return enabledState.get(id) ?? m.enabled !== false;
    },
  };
}

function blogManifest(): DappManifest {
  return {
    id: 'blog',
    name: 'Blog',
    version: '0.0.1',
    route: '/blog',
    entry: 'blog/app.js',
    nav: { label: 'Blog' },
    settings: [
      {
        key: 'defaultCategory',
        label: 'Default Category',
        type: 'select',
        default: 'all',
        options: [
          { label: 'All', value: 'all' },
          { label: 'Tech', value: 'tech' },
        ],
      },
      { key: 'postsPerPage', label: 'Posts Per Page', type: 'number', default: 10 },
      { key: 'showDrafts', label: 'Show Drafts', type: 'boolean', default: false },
    ],
  };
}

describe('createSettings', () => {
  let plugin: ReturnType<typeof createSettings>;
  let ctx: Context;

  beforeEach(() => {
    ctx = mockContext([blogManifest()]);
  });

  afterEach(async () => {
    if (plugin) await plugin.destroy?.();
  });

  it('reads defaults from manifest settings', async () => {
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctx);
    const api = plugin.getSettingsAPI();

    expect(api.get('blog', 'defaultCategory')).toBe('all');
    expect(api.get('blog', 'postsPerPage')).toBe(10);
    expect(api.get('blog', 'showDrafts')).toBe(false);
  });

  it('returns undefined for unknown dapp/key', async () => {
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctx);
    const api = plugin.getSettingsAPI();

    expect(api.get('nonexistent', 'key')).toBeUndefined();
    expect(api.get('blog', 'nonexistent')).toBeUndefined();
  });

  it('set() overrides the default', async () => {
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctx);
    const api = plugin.getSettingsAPI();

    api.set('blog', 'defaultCategory', 'tech');

    expect(api.get('blog', 'defaultCategory')).toBe('tech');
  });

  it('getAll() merges defaults and overrides', async () => {
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctx);
    const api = plugin.getSettingsAPI();

    api.set('blog', 'postsPerPage', 25);

    const all = api.getAll('blog');
    expect(all).toEqual({
      defaultCategory: 'all',
      postsPerPage: 25,
      showDrafts: false,
    });
  });

  it('getAll() returns empty object for unknown dapp', async () => {
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctx);
    const api = plugin.getSettingsAPI();

    expect(api.getAll('unknown')).toEqual({});
  });

  it('onChange() notifies on specific key change', async () => {
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctx);
    const api = plugin.getSettingsAPI();

    const handler = vi.fn();
    api.onChange('blog', 'postsPerPage', handler);

    api.set('blog', 'postsPerPage', 20);
    api.set('blog', 'defaultCategory', 'tech'); // different key — no notify

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(20);
  });

  it('onChange() returns unsubscribe', async () => {
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctx);
    const api = plugin.getSettingsAPI();

    const handler = vi.fn();
    const unsub = api.onChange('blog', 'postsPerPage', handler);
    unsub();

    api.set('blog', 'postsPerPage', 20);

    expect(handler).not.toHaveBeenCalled();
  });

  it('onAnyChange() notifies on any key change for a dapp', async () => {
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctx);
    const api = plugin.getSettingsAPI();

    const handler = vi.fn();
    api.onAnyChange('blog', handler);

    api.set('blog', 'postsPerPage', 20);
    api.set('blog', 'defaultCategory', 'tech');

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0]).toEqual(['postsPerPage', 20]);
    expect(handler.mock.calls[1]).toEqual(['defaultCategory', 'tech']);
  });

  it('onAnyChange() returns unsubscribe', async () => {
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctx);
    const api = plugin.getSettingsAPI();

    const handler = vi.fn();
    const unsub = api.onAnyChange('blog', handler);
    unsub();

    api.set('blog', 'postsPerPage', 20);

    expect(handler).not.toHaveBeenCalled();
  });

  it('emits dx:plugin:settings:changed event', async () => {
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctx);
    const api = plugin.getSettingsAPI();

    const handler = vi.fn();
    ctx.events.on('dx:plugin:settings:changed', handler);

    api.set('blog', 'showDrafts', true);

    expect(handler).toHaveBeenCalledWith({
      dappId: 'blog',
      key: 'showDrafts',
      value: true,
    });
  });

  it('exposes settings on ctx.settings after init', async () => {
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctx);

    expect(ctx.settings).toBeDefined();
    expect(ctx.settings!.get('blog', 'postsPerPage')).toBe(10);
  });

  it('works with dapps that have no settings', async () => {
    const noSettingsCtx = mockContext([
      {
        id: 'simple',
        name: 'Simple',
        version: '0.0.1',
        route: '/simple',
        entry: 'simple/app.js',
        nav: { label: 'Simple' },
      },
    ]);

    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(noSettingsCtx);
    const api = plugin.getSettingsAPI();

    expect(api.getAll('simple')).toEqual({});
    // Can still set values for dapps without definitions
    api.set('simple', 'custom', 'value');
    expect(api.get('simple', 'custom')).toBe('value');
  });

  it('plugin name is "settings"', () => {
    plugin = createSettings();
    expect(plugin.name).toBe('settings');
  });

  it('collects settings definitions from plugins', async () => {
    const themePlugin: Plugin = {
      name: 'theme',
      settings: [
        {
          key: 'mode',
          label: 'Mode',
          type: 'select',
          default: 'system',
          options: [
            { label: 'System', value: 'system' },
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
          ],
        },
      ],
    };

    const ctxWithPlugin = mockContext([], { theme: themePlugin });
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctxWithPlugin);
    const api = plugin.getSettingsAPI();

    expect(api.get('theme', 'mode')).toBe('system');
  });

  it('collects settings from both manifests and plugins', async () => {
    const themePlugin: Plugin = {
      name: 'theme',
      settings: [{ key: 'mode', label: 'Mode', type: 'select', default: 'system' }],
    };

    const ctxBoth = mockContext([blogManifest()], { theme: themePlugin });
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctxBoth);
    const api = plugin.getSettingsAPI();

    // Dapp settings
    expect(api.get('blog', 'defaultCategory')).toBe('all');
    // Plugin settings
    expect(api.get('theme', 'mode')).toBe('system');
  });

  it('ignores plugins without settings', async () => {
    const barePlugin: Plugin = { name: 'bare' };

    const ctxBare = mockContext([], { bare: barePlugin });
    plugin = createSettings({ storageKey: uniqueStorageKey() });
    await plugin.init!(ctxBare);
    const api = plugin.getSettingsAPI();

    expect(api.getAll('bare')).toEqual({});
  });

  describe('getSections()', () => {
    it('returns sections from manifests with labels', async () => {
      plugin = createSettings({ storageKey: uniqueStorageKey() });
      await plugin.init!(ctx);
      const api = plugin.getSettingsAPI();

      const sections = api.getSections();
      const blogSection = sections.find((s) => s.id === 'blog');
      expect(blogSection).toBeDefined();
      expect(blogSection!.label).toBe('Blog');
      expect(blogSection!.definitions).toHaveLength(3);
    });

    it('returns sections from plugins with capitalized labels', async () => {
      const themePlugin: Plugin = {
        name: 'theme',
        settings: [{ key: 'mode', label: 'Mode', type: 'select', default: 'system' }],
      };

      const ctxWithPlugin = mockContext([], { theme: themePlugin });
      plugin = createSettings({ storageKey: uniqueStorageKey() });
      await plugin.init!(ctxWithPlugin);
      const api = plugin.getSettingsAPI();

      const sections = api.getSections();
      const themeSection = sections.find((s) => s.id === 'theme');
      expect(themeSection).toBeDefined();
      expect(themeSection!.label).toBe('Theme');
    });

    it('synthesizes _shell section for optional dapps', async () => {
      const optionalManifests: DappManifest[] = [
        {
          id: 'hello',
          name: 'Hello',
          version: '0.0.1',
          route: '/hello',
          entry: 'hello/app.js',
          nav: { label: 'Hello' },
          optional: true,
        },
        {
          id: 'api',
          name: 'API Explorer',
          version: '0.0.1',
          route: '/api',
          entry: 'api/app.js',
          nav: { label: 'API' },
          optional: true,
          enabled: false,
        },
      ];

      const ctxOptional = mockContext(optionalManifests);
      plugin = createSettings({ storageKey: uniqueStorageKey() });
      await plugin.init!(ctxOptional);
      const api = plugin.getSettingsAPI();

      const sections = api.getSections();
      const shellSection = sections.find((s) => s.id === '_shell');
      expect(shellSection).toBeDefined();
      expect(shellSection!.label).toBe('Dapps');
      expect(shellSection!.definitions).toHaveLength(2);

      const helloDef = shellSection!.definitions.find((d) => d.key === 'hello');
      expect(helloDef!.label).toBe('Hello');
      expect(helloDef!.type).toBe('boolean');
      expect(helloDef!.default).toBe(true);

      const apiDef = shellSection!.definitions.find((d) => d.key === 'api');
      expect(apiDef!.label).toBe('API Explorer');
      expect(apiDef!.default).toBe(false);
    });

    it('does not create _shell section when no optional dapps', async () => {
      plugin = createSettings({ storageKey: uniqueStorageKey() });
      await plugin.init!(ctx); // blogManifest is not optional

      const api = plugin.getSettingsAPI();
      const sections = api.getSections();
      expect(sections.find((s) => s.id === '_shell')).toBeUndefined();
    });

    it('returns empty array when no definitions', async () => {
      const emptyCtx = mockContext([]);
      plugin = createSettings({ storageKey: uniqueStorageKey() });
      await plugin.init!(emptyCtx);
      const api = plugin.getSettingsAPI();

      expect(api.getSections()).toEqual([]);
    });

    it('excludes settings for disabled dapps', async () => {
      const manifests: DappManifest[] = [
        {
          id: 'hello',
          name: 'Hello',
          version: '0.0.1',
          route: '/hello',
          entry: 'hello/app.js',
          nav: { label: 'Hello' },
          optional: true,
          enabled: false,
          settings: [{ key: 'greeting', label: 'Greeting', type: 'text', default: 'Hi' }],
        },
        {
          id: 'blog',
          name: 'Blog',
          version: '0.0.1',
          route: '/blog',
          entry: 'blog/app.js',
          nav: { label: 'Blog' },
          settings: [{ key: 'postsPerPage', label: 'Posts', type: 'number', default: 10 }],
        },
      ];

      const ctxMixed = mockContext(manifests);
      plugin = createSettings({ storageKey: uniqueStorageKey() });
      await plugin.init!(ctxMixed);
      const api = plugin.getSettingsAPI();

      const sections = api.getSections();
      const ids = sections.map((s) => s.id);

      // _shell (dapp toggles) and blog (enabled) should appear, hello (disabled) should not
      expect(ids).toContain('_shell');
      expect(ids).toContain('blog');
      expect(ids).not.toContain('hello');
    });

    it('still shows plugin settings regardless of dapp state', async () => {
      const themePlugin: Plugin = {
        name: 'theme',
        settings: [{ key: 'mode', label: 'Mode', type: 'select', default: 'system' }],
      };

      const manifests: DappManifest[] = [
        {
          id: 'hello',
          name: 'Hello',
          version: '0.0.1',
          route: '/hello',
          entry: 'hello/app.js',
          nav: { label: 'Hello' },
          optional: true,
          enabled: false,
        },
      ];

      const ctxWithPlugin = mockContext(manifests, { theme: themePlugin });
      plugin = createSettings({ storageKey: uniqueStorageKey() });
      await plugin.init!(ctxWithPlugin);
      const api = plugin.getSettingsAPI();

      const sections = api.getSections();
      const ids = sections.map((s) => s.id);

      expect(ids).toContain('theme');
      expect(ids).toContain('_shell');
    });
  });

  describe('dapp toggle wiring', () => {
    it('calls ctx.enableDapp when toggle set to true', async () => {
      const manifests: DappManifest[] = [
        {
          id: 'hello',
          name: 'Hello',
          version: '0.0.1',
          route: '/hello',
          entry: 'hello/app.js',
          nav: { label: 'Hello' },
          optional: true,
          enabled: false,
        },
      ];

      const ctxOptional = mockContext(manifests);
      plugin = createSettings({ storageKey: uniqueStorageKey() });
      await plugin.init!(ctxOptional);
      const api = plugin.getSettingsAPI();

      api.set('_shell', 'hello', true);

      expect(ctxOptional.enableDapp).toHaveBeenCalledWith('hello');
    });

    it('calls ctx.disableDapp when toggle set to false', async () => {
      const manifests: DappManifest[] = [
        {
          id: 'hello',
          name: 'Hello',
          version: '0.0.1',
          route: '/hello',
          entry: 'hello/app.js',
          nav: { label: 'Hello' },
          optional: true,
        },
      ];

      const ctxOptional = mockContext(manifests);
      plugin = createSettings({ storageKey: uniqueStorageKey() });
      await plugin.init!(ctxOptional);
      const api = plugin.getSettingsAPI();

      api.set('_shell', 'hello', false);

      expect(ctxOptional.disableDapp).toHaveBeenCalledWith('hello');
    });
  });
});

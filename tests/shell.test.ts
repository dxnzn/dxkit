import type { DappManifest, Plugin, Shell, ShellConfig } from 'dxkit';
import { createShell } from 'dxkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** No-op loaders — avoids happy-dom DOMException on module script injection. */
const testLoaders: Pick<ShellConfig, 'scriptLoader' | 'styleLoader'> = {
  scriptLoader: async () => {},
  styleLoader: async () => {},
};

describe('createShell', () => {
  let shell: Shell;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'dx-mount';
    document.body.appendChild(container);
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    if (shell) shell.destroy();
    container.remove();
    delete window.__DXKIT__;
  });

  it('init() exposes context on window.__DXKIT__', async () => {
    shell = createShell({ ...testLoaders, manifests: [] });
    await shell.init();

    expect(window.__DXKIT__).toBeDefined();
    expect(window.__DXKIT__?.events).toBeDefined();
    expect(window.__DXKIT__?.eventRegistry).toBeDefined();
    expect(window.__DXKIT__?.router).toBeDefined();
    expect(window.__DXKIT__?.getPlugin).toBeDefined();
  });

  it('init() emits dx:ready', async () => {
    shell = createShell({ ...testLoaders, manifests: [] });
    const handler = vi.fn();

    // Listen on window since the bus dispatches CustomEvents there
    window.addEventListener('dx:ready', handler);
    await shell.init();
    window.removeEventListener('dx:ready', handler);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('init() emits dx:plugin:registered for each plugin', async () => {
    const pluginA: Plugin = { name: 'a' };
    const pluginB: Plugin = { name: 'b' };

    shell = createShell({ ...testLoaders, plugins: { a: pluginA, b: pluginB }, manifests: [] });

    const handler = vi.fn();
    window.addEventListener('dx:plugin:registered', (e) => {
      handler((e as CustomEvent).detail);
    });
    await shell.init();
    window.removeEventListener('dx:plugin:registered', handler);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith({ name: 'a' });
    expect(handler).toHaveBeenCalledWith({ name: 'b' });
  });

  it('registers and exposes plugins', async () => {
    const plugin: Plugin = {
      name: 'test',
      init: vi.fn(),
    };

    shell = createShell({ ...testLoaders, plugins: { test: plugin }, manifests: [] });

    await shell.init();

    expect(shell.getPlugin('test')).toBe(plugin);
    expect(plugin.init).toHaveBeenCalledOnce();
  });

  it('calls plugin init() with context during init', async () => {
    const initFn = vi.fn();
    const plugin: Plugin = { name: 'test', init: initFn };

    shell = createShell({ ...testLoaders, plugins: { test: plugin }, manifests: [] });

    await shell.init();

    expect(initFn).toHaveBeenCalledOnce();
    const ctx = initFn.mock.calls[0][0];
    expect(ctx.events).toBeDefined();
    expect(ctx.router).toBeDefined();
    expect(ctx.getPlugin).toBeDefined();
  });

  it('accepts inline manifests', async () => {
    shell = createShell({
      ...testLoaders,
      manifests: [
        {
          id: 'hello',
          name: 'Hello',
          version: '0.0.1',
          route: '/hello',
          entry: '/dapps/hello/app.js',
          nav: { label: 'Hello' },
        },
      ],
    });

    await shell.init();

    expect(shell.getManifests()).toHaveLength(1);
    expect(shell.getManifests()[0].id).toBe('hello');
  });

  it('getManifests() returns a copy', async () => {
    shell = createShell({
      ...testLoaders,
      manifests: [
        {
          id: 'hello',
          name: 'Hello',
          version: '0.0.1',
          route: '/hello',
          entry: '/dapps/hello/app.js',
          nav: { label: 'Hello' },
        },
      ],
    });

    await shell.init();

    const a = shell.getManifests();
    const b = shell.getManifests();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('navigate() updates current route', async () => {
    shell = createShell({
      ...testLoaders,
      manifests: [
        {
          id: 'blog',
          name: 'Blog',
          version: '0.0.1',
          route: '/blog',
          entry: 'data:text/javascript,',
          nav: { label: 'Blog' },
        },
      ],
    });

    await shell.init();

    shell.navigate('/blog');
    expect(shell.getCurrentRoute()).toBe('/blog');
  });

  it('destroy() cleans up window.__DXKIT__', async () => {
    shell = createShell({ ...testLoaders, manifests: [] });
    await shell.init();

    expect(window.__DXKIT__).toBeDefined();

    shell.destroy();

    expect(window.__DXKIT__).toBeUndefined();
  });

  it('destroy() calls plugin destroy()', async () => {
    const destroyFn = vi.fn();
    const plugin: Plugin = { name: 'test', destroy: destroyFn };

    shell = createShell({ ...testLoaders, plugins: { test: plugin }, manifests: [] });

    await shell.init();
    shell.destroy();

    expect(destroyFn).toHaveBeenCalledOnce();
  });

  it('double init() is a no-op', async () => {
    const initFn = vi.fn();
    const plugin: Plugin = { name: 'test', init: initFn };

    shell = createShell({ ...testLoaders, plugins: { test: plugin }, manifests: [] });

    await shell.init();
    await shell.init();

    expect(initFn).toHaveBeenCalledOnce();
  });

  it('works with zero config', async () => {
    shell = createShell({ ...testLoaders, manifests: [] });
    await shell.init();

    expect(window.__DXKIT__).toBeDefined();
    expect(shell.getManifests()).toEqual([]);
  });

  it('loads manifests from dapps entries via fetch', async () => {
    const manifest = {
      id: 'test-dapp',
      name: 'Test',
      version: '1.0.0',
      route: '/test',
      entry: 'test/app.js',
      nav: { label: 'Test' },
    };

    // Mock fetch for manifest.json
    const originalFetch = window.fetch;
    window.fetch = vi.fn(async (url: string) => {
      if (url === 'test/manifest.json') {
        return { ok: true, json: async () => manifest } as Response;
      }
      return { ok: false } as Response;
    }) as any;

    shell = createShell({ ...testLoaders, dapps: [{ manifest: 'test/manifest.json' }] });

    await shell.init();

    expect(shell.getManifests()).toHaveLength(1);
    expect(shell.getManifests()[0].id).toBe('test-dapp');

    window.fetch = originalFetch;
  });

  it('deep-merges dapp overrides onto fetched manifest', async () => {
    const manifest = {
      id: 'test-dapp',
      name: 'Test',
      version: '1.0.0',
      route: '/test',
      entry: 'test/app.js',
      nav: { label: 'Test', order: 0 },
    };

    const originalFetch = window.fetch;
    window.fetch = vi.fn(async (url: string) => {
      if (url === 'test/manifest.json') {
        return { ok: true, json: async () => manifest } as Response;
      }
      return { ok: false } as Response;
    }) as any;

    shell = createShell({
      ...testLoaders,
      dapps: [
        {
          manifest: 'test/manifest.json',
          overrides: { nav: { order: 5 } },
        },
      ],
    });

    await shell.init();

    const loaded = shell.getManifests()[0];
    expect(loaded.nav.label).toBe('Test'); // preserved from manifest
    expect(loaded.nav.order).toBe(5); // overridden
    expect(loaded.id).toBe('test-dapp'); // preserved

    window.fetch = originalFetch;
  });

  it('skips dapps with failed manifest fetch', async () => {
    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => ({ ok: false }) as Response) as any;

    shell = createShell({ ...testLoaders, dapps: [{ manifest: 'missing/manifest.json' }] });

    await shell.init();

    expect(shell.getManifests()).toHaveLength(0);

    window.fetch = originalFetch;
  });

  it('exposes getManifests() on context for plugins', async () => {
    const initFn = vi.fn();
    const plugin: Plugin = { name: 'test', init: initFn };

    shell = createShell({
      ...testLoaders,
      plugins: { test: plugin },
      manifests: [
        {
          id: 'hello',
          name: 'Hello',
          version: '0.0.1',
          route: '/hello',
          entry: 'hello/app.js',
          nav: { label: 'Hello' },
        },
      ],
    });

    await shell.init();

    const ctx = initFn.mock.calls[0][0];
    expect(ctx.getManifests()).toHaveLength(1);
    expect(ctx.getManifests()[0].id).toBe('hello');
  });

  it('exposes getPlugins() on context', async () => {
    const initFn = vi.fn();
    const plugin: Plugin = { name: 'test', init: initFn };

    shell = createShell({ ...testLoaders, plugins: { test: plugin }, manifests: [] });

    await shell.init();

    const ctx = initFn.mock.calls[0][0];
    const plugins = ctx.getPlugins();
    expect(plugins.test).toBe(plugin);
  });

  describe('enable/disable dapps', () => {
    const required: DappManifest = {
      id: 'home',
      name: 'Home',
      version: '0.0.1',
      route: '/',
      entry: 'data:text/javascript,',
      nav: { label: 'Home' },
    };

    const optionalEnabled: DappManifest = {
      id: 'hello',
      name: 'Hello',
      version: '0.0.1',
      route: '/hello',
      entry: 'data:text/javascript,',
      nav: { label: 'Hello' },
      optional: true,
    };

    const optionalDisabled: DappManifest = {
      id: 'api',
      name: 'API',
      version: '0.0.1',
      route: '/api',
      entry: 'data:text/javascript,',
      nav: { label: 'API' },
      optional: true,
      enabled: false,
    };

    it('getEnabledManifests() returns all manifests when none are optional', async () => {
      shell = createShell({ ...testLoaders, manifests: [required] });
      await shell.init();

      expect(shell.getManifests()).toHaveLength(1);
      expect(shell.getEnabledManifests()).toHaveLength(1);
    });

    it('getEnabledManifests() excludes optional dapps with enabled: false', async () => {
      shell = createShell({ ...testLoaders, manifests: [required, optionalEnabled, optionalDisabled] });
      await shell.init();

      expect(shell.getManifests()).toHaveLength(3);
      expect(shell.getEnabledManifests()).toHaveLength(2);
      expect(shell.getEnabledManifests().map((m) => m.id)).toEqual(['home', 'hello']);
    });

    it('isDappEnabled() returns true for non-optional dapps', async () => {
      shell = createShell({ ...testLoaders, manifests: [required] });
      await shell.init();

      expect(shell.isDappEnabled('home')).toBe(true);
    });

    it('isDappEnabled() returns false for unknown dapp IDs', async () => {
      shell = createShell({ ...testLoaders, manifests: [required] });
      await shell.init();

      expect(shell.isDappEnabled('nonexistent')).toBe(false);
    });

    it('isDappEnabled() reflects optional dapp default state', async () => {
      shell = createShell({ ...testLoaders, manifests: [optionalEnabled, optionalDisabled] });
      await shell.init();

      expect(shell.isDappEnabled('hello')).toBe(true);
      expect(shell.isDappEnabled('api')).toBe(false);
    });

    it('enableDapp() enables a disabled optional dapp', async () => {
      shell = createShell({ ...testLoaders, manifests: [required, optionalDisabled] });
      await shell.init();

      expect(shell.isDappEnabled('api')).toBe(false);
      expect(shell.getEnabledManifests()).toHaveLength(1);

      shell.enableDapp('api');

      expect(shell.isDappEnabled('api')).toBe(true);
      expect(shell.getEnabledManifests()).toHaveLength(2);
    });

    it('disableDapp() disables an enabled optional dapp', async () => {
      shell = createShell({ ...testLoaders, manifests: [required, optionalEnabled] });
      await shell.init();

      expect(shell.isDappEnabled('hello')).toBe(true);

      shell.disableDapp('hello');

      expect(shell.isDappEnabled('hello')).toBe(false);
      expect(shell.getEnabledManifests()).toHaveLength(1);
    });

    it('enableDapp() is no-op for non-optional dapps', async () => {
      shell = createShell({ ...testLoaders, manifests: [required] });
      await shell.init();

      const handler = vi.fn();
      window.addEventListener('dx:dapp:enabled', handler);

      shell.enableDapp('home');

      expect(handler).not.toHaveBeenCalled();
      window.removeEventListener('dx:dapp:enabled', handler);
    });

    it('disableDapp() is no-op for non-optional dapps', async () => {
      shell = createShell({ ...testLoaders, manifests: [required] });
      await shell.init();

      const handler = vi.fn();
      window.addEventListener('dx:dapp:disabled', handler);

      shell.disableDapp('home');

      expect(handler).not.toHaveBeenCalled();
      window.removeEventListener('dx:dapp:disabled', handler);
    });

    it('emits dx:dapp:enabled event', async () => {
      shell = createShell({ ...testLoaders, manifests: [optionalDisabled] });
      await shell.init();

      const handler = vi.fn();
      window.addEventListener('dx:dapp:enabled', handler);

      shell.enableDapp('api');

      expect(handler).toHaveBeenCalledOnce();
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ id: 'api' });

      window.removeEventListener('dx:dapp:enabled', handler);
    });

    it('emits dx:dapp:disabled event', async () => {
      shell = createShell({ ...testLoaders, manifests: [optionalEnabled] });
      await shell.init();

      const handler = vi.fn();
      window.addEventListener('dx:dapp:disabled', handler);

      shell.disableDapp('hello');

      expect(handler).toHaveBeenCalledOnce();
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ id: 'hello' });

      window.removeEventListener('dx:dapp:disabled', handler);
    });

    it('double enable is a no-op (no duplicate event)', async () => {
      shell = createShell({ ...testLoaders, manifests: [optionalEnabled] });
      await shell.init();

      const handler = vi.fn();
      window.addEventListener('dx:dapp:enabled', handler);

      shell.enableDapp('hello');

      expect(handler).not.toHaveBeenCalled();
      window.removeEventListener('dx:dapp:enabled', handler);
    });

    it('double disable is a no-op (no duplicate event)', async () => {
      shell = createShell({ ...testLoaders, manifests: [optionalDisabled] });
      await shell.init();

      const handler = vi.fn();
      window.addEventListener('dx:dapp:disabled', handler);

      shell.disableDapp('api');

      expect(handler).not.toHaveBeenCalled();
      window.removeEventListener('dx:dapp:disabled', handler);
    });

    it('disabled dapps are excluded from routing', async () => {
      shell = createShell({ ...testLoaders, manifests: [required, optionalDisabled] });
      await shell.init();

      shell.navigate('/api');

      // Should not route to disabled dapp — stays at current route
      expect(shell.getCurrentRoute()).toBe('/api');
      // But the route doesn't resolve to a dapp, so nothing mounts
    });

    it('getEnabledManifests() and isDappEnabled() exposed on context', async () => {
      const initFn = vi.fn();
      const plugin: Plugin = { name: 'test', init: initFn };

      shell = createShell({
        ...testLoaders,
        plugins: { test: plugin },
        manifests: [required, optionalEnabled, optionalDisabled],
      });

      await shell.init();

      const ctx = initFn.mock.calls[0][0];
      expect(ctx.getEnabledManifests()).toHaveLength(2);
      expect(ctx.isDappEnabled('hello')).toBe(true);
      expect(ctx.isDappEnabled('api')).toBe(false);
      expect(typeof ctx.enableDapp).toBe('function');
      expect(typeof ctx.disableDapp).toBe('function');
    });

    it('getManifests() still returns all manifests including disabled', async () => {
      shell = createShell({ ...testLoaders, manifests: [required, optionalEnabled, optionalDisabled] });
      await shell.init();

      expect(shell.getManifests()).toHaveLength(3);
      expect(shell.getEnabledManifests()).toHaveLength(2);
    });
  });
});

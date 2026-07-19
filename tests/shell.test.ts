import type { DappManifest, Plugin, ScriptLoader, Shell, ShellConfig } from '@dnzn/dxkit';
import { createShell } from '@dnzn/dxkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** No-op loaders — avoids happy-dom DOMException on module script injection. */
const testLoaders: Pick<ShellConfig, 'lifecycle'> = {
  lifecycle: {
    scriptLoader: async () => {},
    styleLoader: async () => {},
  },
};

describe('createShell', () => {
  let shell: Shell;
  let container: HTMLElement;
  // D-17 test nit: several tests below register a dx:error listener to capture emitted errors
  // and previously never removed it. Registering through this helper guarantees removal in
  // afterEach without repeating the add/remove pairing at every call site.
  const dxErrorListeners: EventListener[] = [];

  function onDxError(handler: EventListener): void {
    window.addEventListener('dx:error', handler);
    dxErrorListeners.push(handler);
  }

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
    for (const handler of dxErrorListeners) {
      window.removeEventListener('dx:error', handler);
    }
    dxErrorListeners.length = 0;
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

  it('contains plugin init failure and continues initialization', async () => {
    const errors: { source: string; error: Error }[] = [];
    const goodInit = vi.fn();

    const badPlugin: Plugin = {
      name: 'bad',
      init: () => {
        throw new Error('plugin exploded');
      },
    };
    const goodPlugin: Plugin = { name: 'good', init: goodInit };

    shell = createShell({
      ...testLoaders,
      plugins: { bad: badPlugin, good: goodPlugin },
      manifests: [],
    });

    // Listen for dx:error before init
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    await shell.init();

    // Bad plugin error was emitted, not thrown
    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe('plugin:bad');
    expect(errors[0].error.message).toBe('plugin exploded');

    // Good plugin still initialized, shell is functional
    expect(goodInit).toHaveBeenCalledOnce();
    expect(window.__DXKIT__).toBeDefined();
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

  it('skips dapps with failed manifest fetch and emits a dx:error (WR-01)', async () => {
    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    const originalFetch = window.fetch;
    // Non-OK response is no longer a silent skip — it now surfaces the same way a validation
    // failure or a thrown fetch would (WR-01).
    window.fetch = vi.fn(async () => ({ ok: false }) as Response) as any;

    shell = createShell({ ...testLoaders, dapps: [{ manifest: 'missing/manifest.json' }] });

    await shell.init();

    expect(shell.getManifests()).toHaveLength(0);
    expect(errors.some((e) => e.source === 'shell:manifest')).toBe(true);

    window.fetch = originalFetch;
  });

  it('emits a dx:error when the manifest fetch itself rejects (WR-01 network-throw mode)', async () => {
    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as any;

    shell = createShell({ ...testLoaders, dapps: [{ manifest: 'unreachable/manifest.json' }] });
    await shell.init();

    expect(shell.getManifests()).toHaveLength(0);
    expect(errors.some((e) => e.source === 'shell:manifest' && e.error.message.includes('network down'))).toBe(true);

    window.fetch = originalFetch;
  });

  it('emits a dx:error when manifest fetch resolves but JSON parsing throws (WR-01 parse-failure mode)', async () => {
    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new Error('Unexpected token in JSON');
      },
    })) as any;

    shell = createShell({ ...testLoaders, dapps: [{ manifest: 'bad-json/manifest.json' }] });
    await shell.init();

    expect(shell.getManifests()).toHaveLength(0);
    expect(errors.some((e) => e.source === 'shell:manifest')).toBe(true);

    window.fetch = originalFetch;
  });

  it('emits a dx:error when an explicit registryUrl returns a non-OK response (D-15)', async () => {
    const errors: { source: string; error: Error }[] = [];
    const handler = ((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener;
    window.addEventListener('dx:error', handler);

    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => ({ ok: false, status: 404 }) as Response) as any;

    shell = createShell({ ...testLoaders, registryUrl: '/custom-registry.json' });
    await shell.init();

    expect(shell.getManifests()).toHaveLength(0);
    expect(errors.some((e) => e.source === 'shell:manifest' && e.error.message.includes('/custom-registry.json'))).toBe(
      true,
    );

    window.fetch = originalFetch;
    window.removeEventListener('dx:error', handler);
  });

  it('emits a dx:error when an explicit registryUrl fetch rejects (D-15)', async () => {
    const errors: { source: string; error: Error }[] = [];
    const handler = ((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener;
    window.addEventListener('dx:error', handler);

    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => {
      throw new Error('registry host unreachable');
    }) as any;

    shell = createShell({ ...testLoaders, registryUrl: '/custom-registry.json' });
    await shell.init();

    expect(shell.getManifests()).toHaveLength(0);
    expect(
      errors.some(
        (e) => e.source === 'shell:manifest' && e.error.message.includes('registry host unreachable') && e.error.cause,
      ),
    ).toBe(true);

    window.fetch = originalFetch;
    window.removeEventListener('dx:error', handler);
  });

  it('emits a dx:error when an explicit registryUrl resolves but JSON parsing throws (D-15)', async () => {
    const errors: { source: string; error: Error }[] = [];
    const handler = ((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener;
    window.addEventListener('dx:error', handler);

    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new Error('Unexpected token in JSON');
      },
    })) as any;

    shell = createShell({ ...testLoaders, registryUrl: '/custom-registry.json' });
    await shell.init();

    expect(shell.getManifests()).toHaveLength(0);
    expect(errors.some((e) => e.source === 'shell:manifest')).toBe(true);

    window.fetch = originalFetch;
    window.removeEventListener('dx:error', handler);
  });

  it('stays silent on the default registryUrl probe failure — no dx:error, empty manifests (D-15)', async () => {
    const errors: { source: string; error: Error }[] = [];
    const handler = ((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener;
    window.addEventListener('dx:error', handler);

    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => ({ ok: false, status: 404 }) as Response) as any;

    // registryUrl omitted entirely — this is the default /registry.json probe.
    shell = createShell({ ...testLoaders });
    await shell.init();

    expect(shell.getManifests()).toEqual([]);
    expect(errors.some((e) => e.source === 'shell:manifest')).toBe(false);

    window.fetch = originalFetch;
    window.removeEventListener('dx:error', handler);
  });

  it('emits a dx:error and fail-closes to [] when an explicit registryUrl 200 body is not an array (ROB-05)', async () => {
    const errors: { source: string; error: Error }[] = [];
    const handler = ((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener;
    window.addEventListener('dx:error', handler);

    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ not: 'an array' }),
    })) as any;

    shell = createShell({ ...testLoaders, registryUrl: '/custom-registry.json' });
    await expect(shell.init()).resolves.not.toThrow();

    expect(shell.getManifests()).toHaveLength(0);
    expect(errors.some((e) => e.source === 'shell:manifest' && e.error.message.includes('/custom-registry.json'))).toBe(
      true,
    );

    window.fetch = originalFetch;
    window.removeEventListener('dx:error', handler);
  });

  it('emits a dx:error on the default registryUrl probe when the 200 body is not an array — ungated (ROB-05, D-10)', async () => {
    const errors: { source: string; error: Error }[] = [];
    const handler = ((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener;
    window.addEventListener('dx:error', handler);

    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ not: 'an array' }),
    })) as any;

    // registryUrl omitted entirely — this is the default /registry.json probe. Unlike the
    // silent-404 default-probe test above (D-15), a wrong-shape 200 body is NOT gated by
    // registryUrlExplicit — it must still emit (D-10 / P2, the one deliberate exception).
    shell = createShell({ ...testLoaders });
    await expect(shell.init()).resolves.not.toThrow();

    expect(shell.getManifests()).toHaveLength(0);
    expect(errors.some((e) => e.source === 'shell:manifest')).toBe(true);

    window.fetch = originalFetch;
    window.removeEventListener('dx:error', handler);
  });

  it('still exposes window.__DXKIT__ after init() when the registry 200 body is not an array (ROB-05)', async () => {
    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ not: 'an array' }),
    })) as any;

    shell = createShell({ ...testLoaders, registryUrl: '/custom-registry.json' });
    await shell.init();

    expect(window.__DXKIT__).toBeDefined();
    expect(window.__DXKIT__?.getManifests()).toHaveLength(0);

    window.fetch = originalFetch;
  });

  it('a well-formed array 200 registry body still flows through unchanged (ROB-05 happy path)', async () => {
    const errors: { source: string; error: Error }[] = [];
    const handler = ((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener;
    window.addEventListener('dx:error', handler);

    const validManifest: DappManifest = {
      id: 'rob05-happy',
      name: 'Rob05Happy',
      version: '0.0.1',
      route: '/rob05-happy',
      entry: 'data:text/javascript,',
      nav: { label: 'Rob05Happy' },
    };

    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [validManifest],
    })) as any;

    shell = createShell({ ...testLoaders, registryUrl: '/custom-registry.json' });
    await shell.init();

    expect(shell.getManifests()).toHaveLength(1);
    expect(shell.getManifests()[0]?.id).toBe('rob05-happy');
    expect(errors.some((e) => e.source === 'shell:manifest')).toBe(false);

    window.fetch = originalFetch;
    window.removeEventListener('dx:error', handler);
  });

  it('ROB-06: dapps as a truthy-length non-array (string) emits exactly one shell:manifest dx:error and does not throw', async () => {
    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    shell = createShell({ ...testLoaders, dapps: 'a-string' as any });
    await expect(shell.init()).resolves.not.toThrow();

    expect(errors.filter((e) => e.source === 'shell:manifest')).toHaveLength(1);
    expect(shell.getManifests()).toHaveLength(0);
  });

  it('ROB-06: dapps as a falsy-length non-array (plain object) fails closed — emits dx:error and never probes the registry', async () => {
    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    const originalFetch = window.fetch;
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => [] }) as unknown as Response);
    window.fetch = fetchSpy as any;

    shell = createShell({ ...testLoaders, dapps: { not: 'array' } as any });
    await expect(shell.init()).resolves.not.toThrow();

    expect(errors.some((e) => e.source === 'shell:manifest')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(shell.getManifests()).toHaveLength(0);

    window.fetch = originalFetch;
  });

  it('ROB-06: manifests as a non-iterable non-array (plain object) emits a shell:manifest dx:error and does not throw', async () => {
    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    shell = createShell({ ...testLoaders, manifests: { not: 'array' } as any });
    await expect(shell.init()).resolves.not.toThrow();

    expect(errors.some((e) => e.source === 'shell:manifest')).toBe(true);
    expect(shell.getManifests()).toHaveLength(0);
  });

  it('ROB-06: manifests as an iterable-but-wrong-shape value (string) emits exactly ONE shell:manifest dx:error, not one per character', async () => {
    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    shell = createShell({ ...testLoaders, manifests: 'a-string' as any });
    await expect(shell.init()).resolves.not.toThrow();

    expect(errors.filter((e) => e.source === 'shell:manifest')).toHaveLength(1);
    expect(shell.getManifests()).toHaveLength(0);
  });

  it('ROB-06: still exposes window.__DXKIT__ after init() for a wrong-shape dapps config (pre-exposure ordering)', async () => {
    shell = createShell({ ...testLoaders, dapps: 'x' as any });
    await shell.init();

    expect(window.__DXKIT__).toBeDefined();
    expect(window.__DXKIT__?.getManifests()).toHaveLength(0);
  });

  it('ROB-06: manifests: [] (valid, empty) stops at that tier and does not probe registryUrl', async () => {
    const originalFetch = window.fetch;
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => [] }) as unknown as Response);
    window.fetch = fetchSpy as any;

    shell = createShell({ ...testLoaders, manifests: [] });
    await shell.init();

    expect(shell.getManifests()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();

    window.fetch = originalFetch;
  });

  it('ROB-06: dapps: [] (valid, empty) falls through to the next tier (loads inline manifests)', async () => {
    // Asymmetry counterpart to the manifests: [] test above — a genuinely empty dapps array is
    // NOT a wrong-shape failure, so it must fall through to the manifests tier rather than stop.
    shell = createShell({
      ...testLoaders,
      dapps: [],
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

  it('ROB-06: dapps: null is treated as unset (nullish) — falls through, no dx:error', async () => {
    // Nullish (null/undefined) means "tier not configured", not "wrong shape". `dapps: cond ? [...] : null`
    // is a plausible untyped-consumer idiom that must keep its pre-ROB-06 fall-through, NOT fail closed.
    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    shell = createShell({
      ...testLoaders,
      dapps: null as any,
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

    expect(errors.filter((e) => e.source === 'shell:manifest')).toHaveLength(0);
    expect(shell.getManifests()).toHaveLength(1);
    expect(shell.getManifests()[0].id).toBe('hello');
  });

  it('ROB-06: manifests: null is treated as unset (nullish) — falls through to probe registryUrl, no dx:error', async () => {
    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    const originalFetch = window.fetch;
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => [] }) as unknown as Response);
    window.fetch = fetchSpy as any;

    shell = createShell({ ...testLoaders, manifests: null as any });
    await shell.init();

    expect(fetchSpy).toHaveBeenCalled();
    expect(errors.filter((e) => e.source === 'shell:manifest')).toHaveLength(0);

    window.fetch = originalFetch;
  });

  it('emits dx:error (source shell:mount) when #dx-mount is absent, without throwing', async () => {
    // No <div id="dx-mount"> in the DOM at all — exercises lazy getMountContainer() returning null.
    container.remove();

    const dapp: DappManifest = {
      id: 'nomount',
      name: 'NoMount',
      version: '0.0.1',
      route: '/nomount',
      entry: 'data:text/javascript,',
      nav: { label: 'NoMount' },
    };

    shell = createShell({ ...testLoaders, manifests: [dapp] });

    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    await shell.init();
    shell.navigate('/nomount');
    await new Promise((r) => setTimeout(r, 0));

    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe('shell:mount');
    expect(errors[0].error.message).toContain('nomount');
  });

  it('rejects manifests missing required fields and emits dx:error', async () => {
    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);

    const originalFetch = window.fetch;
    window.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'broken', name: 'Broken' }),
    })) as any;

    shell = createShell({ ...testLoaders, dapps: [{ manifest: '/broken/manifest.json' }] });
    await shell.init();

    expect(shell.getManifests()).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe('shell:manifest');
    expect(errors[0].error.message).toContain('missing required fields');

    window.fetch = originalFetch;
  });

  describe('manifest & route validation (D-06/D-07/D-08)', () => {
    it('normalizes a route missing a leading slash so it becomes reachable', async () => {
      shell = createShell({
        ...testLoaders,
        manifests: [
          {
            id: 'blog',
            name: 'Blog',
            version: '0.0.1',
            route: 'blog',
            entry: 'data:text/javascript,',
            nav: { label: 'Blog' },
          },
        ],
      });

      await shell.init();

      const mounted = vi.fn();
      window.addEventListener('dx:dapp:mounted', mounted);
      shell.navigate('/blog');
      await new Promise((r) => setTimeout(r, 0));

      expect(mounted).toHaveBeenCalledOnce();
      window.removeEventListener('dx:dapp:mounted', mounted);
    });

    it('normalizes a route with leading whitespace so it becomes reachable', async () => {
      shell = createShell({
        ...testLoaders,
        manifests: [
          {
            id: 'blog',
            name: 'Blog',
            version: '0.0.1',
            route: ' /a',
            entry: 'data:text/javascript,',
            nav: { label: 'Blog' },
          },
        ],
      });

      await shell.init();

      const mounted = vi.fn();
      window.addEventListener('dx:dapp:mounted', mounted);
      shell.navigate('/a');
      await new Promise((r) => setTimeout(r, 0));

      expect(mounted).toHaveBeenCalledOnce();
      window.removeEventListener('dx:dapp:mounted', mounted);
    });

    it('normalizes a route with trailing whitespace so it becomes reachable', async () => {
      shell = createShell({
        ...testLoaders,
        manifests: [
          {
            id: 'blog',
            name: 'Blog',
            version: '0.0.1',
            route: '/a ',
            entry: 'data:text/javascript,',
            nav: { label: 'Blog' },
          },
        ],
      });

      await shell.init();

      const mounted = vi.fn();
      window.addEventListener('dx:dapp:mounted', mounted);
      shell.navigate('/a');
      await new Promise((r) => setTimeout(r, 0));

      expect(mounted).toHaveBeenCalledOnce();
      window.removeEventListener('dx:dapp:mounted', mounted);
    });

    it('discards a manifest with an empty/whitespace-only route and emits a shell:route dx:error', async () => {
      const errors: { source: string; error: Error }[] = [];
      onDxError(((e: CustomEvent) => {
        errors.push(e.detail);
      }) as EventListener);

      shell = createShell({
        ...testLoaders,
        manifests: [
          {
            id: 'ghost',
            name: 'Ghost',
            version: '0.0.1',
            route: '   ',
            entry: 'data:text/javascript,',
            nav: { label: 'Ghost' },
          },
        ],
      });

      await shell.init();

      expect(shell.getManifests()).toHaveLength(0);
      expect(errors.some((e) => e.source === 'shell:route' && e.error.message.includes('ghost'))).toBe(true);
    });

    it('discards an invalid inline manifest and emits a shell:manifest dx:error (tier parity)', async () => {
      const errors: { source: string; error: Error }[] = [];
      onDxError(((e: CustomEvent) => {
        errors.push(e.detail);
      }) as EventListener);

      shell = createShell({
        ...testLoaders,
        manifests: [{ id: 'broken-inline', name: 'Broken' } as unknown as DappManifest],
      });

      await shell.init();

      expect(shell.getManifests()).toHaveLength(0);
      expect(errors.some((e) => e.source === 'shell:manifest' && e.error.message.includes('broken-inline'))).toBe(true);
    });

    it('discards an invalid registry.json manifest and emits a shell:manifest dx:error (tier parity)', async () => {
      const errors: { source: string; error: Error }[] = [];
      onDxError(((e: CustomEvent) => {
        errors.push(e.detail);
      }) as EventListener);

      const originalFetch = window.fetch;
      window.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => [{ id: 'broken-registry', name: 'Broken' }],
      })) as any;

      shell = createShell({ ...testLoaders });
      await shell.init();

      expect(shell.getManifests()).toHaveLength(0);
      expect(errors.some((e) => e.source === 'shell:manifest' && e.error.message.includes('broken-registry'))).toBe(
        true,
      );

      window.fetch = originalFetch;
    });

    it('emits a shell:manifest dx:error naming both ids on duplicate exact routes; first-registered wins at mount', async () => {
      const errors: { source: string; error: Error }[] = [];
      onDxError(((e: CustomEvent) => {
        errors.push(e.detail);
      }) as EventListener);

      const mountedIds: string[] = [];
      window.addEventListener('dx:dapp:mounted', ((e: CustomEvent) => {
        mountedIds.push(e.detail.id);
      }) as EventListener);

      shell = createShell({
        ...testLoaders,
        manifests: [
          {
            id: 'first',
            name: 'First',
            version: '0.0.1',
            route: '/dup',
            entry: 'data:text/javascript,',
            nav: { label: 'First' },
          },
          {
            id: 'second',
            name: 'Second',
            version: '0.0.1',
            route: '/dup',
            entry: 'data:text/javascript,',
            nav: { label: 'Second' },
          },
        ],
      });

      await shell.init();
      shell.navigate('/dup');
      await new Promise((r) => setTimeout(r, 0));

      expect(mountedIds).toEqual(['first']);
      expect(
        errors.some(
          (e) =>
            e.source === 'shell:manifest' && e.error.message.includes('first') && e.error.message.includes('second'),
        ),
      ).toBe(true);
    });
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

  it('a consumer-supplied lifecycle.hasPlugin (including undefined) cannot disable required-plugin enforcement', async () => {
    const dapp: DappManifest = {
      id: 'needs-wallet',
      name: 'Needs Wallet',
      version: '0.0.1',
      route: '/',
      entry: 'needs-wallet/app.js',
      nav: { label: 'Needs Wallet' },
      requires: { plugins: ['wallet'] },
    };

    const errors: { source: string; error: Error }[] = [];
    onDxError(((e: CustomEvent) => {
      errors.push(e.detail);
    }) as EventListener);
    const mounted = vi.fn();
    window.addEventListener('dx:dapp:mounted', mounted as EventListener);

    // Untyped/IIFE consumers can pass `lifecycle: { hasPlugin: undefined }` at runtime even
    // though the ShellConfig type now excludes it — cast past the type guard to exercise the
    // runtime defense (FIND-1).
    shell = createShell({
      plugins: {},
      manifests: [dapp],
      lifecycle: { ...testLoaders.lifecycle, hasPlugin: undefined },
    } as ShellConfig);

    await shell.init();

    expect(mounted).not.toHaveBeenCalled();
    expect(errors.some((e) => e.source === 'lifecycle:needs-wallet' && e.error.message.includes('wallet'))).toBe(true);
  });

  describe('sub-path notifications', () => {
    const dapp: DappManifest = {
      id: 'tools',
      name: 'Tools',
      version: '0.0.1',
      route: '/tools',
      entry: 'data:text/javascript,',
      nav: { label: 'Tools' },
    };

    it('emits dx:route:subpath when sub-path changes within same dapp', async () => {
      shell = createShell({ ...testLoaders, manifests: [dapp] });
      await shell.init();

      const handler = vi.fn();
      window.addEventListener('dx:route:subpath', ((e: CustomEvent) => {
        handler(e.detail);
      }) as EventListener);

      // Initial mount at /tools
      shell.navigate('/tools');
      // Allow route change to process
      await new Promise((r) => setTimeout(r, 0));

      // Navigate to sub-path within the same dapp
      shell.navigate('/tools/cic');
      await new Promise((r) => setTimeout(r, 0));

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({
        id: 'tools',
        path: '/tools/cic',
        previousPath: '/tools',
      });

      window.removeEventListener('dx:route:subpath', handler);
    });

    it('does not emit dx:route:subpath when navigating to same path', async () => {
      shell = createShell({ ...testLoaders, manifests: [dapp] });
      await shell.init();

      const handler = vi.fn();
      window.addEventListener('dx:route:subpath', handler);

      shell.navigate('/tools');
      await new Promise((r) => setTimeout(r, 0));

      shell.navigate('/tools');
      await new Promise((r) => setTimeout(r, 0));

      expect(handler).not.toHaveBeenCalled();
      window.removeEventListener('dx:route:subpath', handler);
    });

    it('emits dx:route:subpath with correct previous path on multiple sub-path changes', async () => {
      shell = createShell({ ...testLoaders, manifests: [dapp] });
      await shell.init();

      const calls: any[] = [];
      window.addEventListener('dx:route:subpath', ((e: CustomEvent) => {
        calls.push(e.detail);
      }) as EventListener);

      shell.navigate('/tools');
      await new Promise((r) => setTimeout(r, 0));

      shell.navigate('/tools/a');
      await new Promise((r) => setTimeout(r, 0));

      shell.navigate('/tools/b');
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({ id: 'tools', path: '/tools/a', previousPath: '/tools' });
      expect(calls[1]).toEqual({ id: 'tools', path: '/tools/b', previousPath: '/tools/a' });
    });
  });

  describe('mount de-duplication (double-mount regression)', () => {
    const tick = () => new Promise((r) => setTimeout(r, 0));

    const dappA: DappManifest = {
      id: 'a',
      name: 'A',
      version: '0.0.1',
      route: '/a',
      entry: '/dapps/a/app.js',
      nav: { label: 'A' },
    };
    const dappB: DappManifest = {
      id: 'b',
      name: 'B',
      version: '0.0.1',
      route: '/b',
      entry: '/dapps/b/app.js',
      nav: { label: 'B' },
    };

    function countMounts(id: string): { count: () => number; cleanup: () => void } {
      let n = 0;
      const handler = (e: Event) => {
        if ((e as CustomEvent).detail.id === id) n += 1;
      };
      window.addEventListener('dx:mount', handler);
      return { count: () => n, cleanup: () => window.removeEventListener('dx:mount', handler) };
    }

    /** Entry loader that holds the first load open until release() — widens the in-flight window. */
    function deferredEntryLoader(): { loader: ScriptLoader; release: () => void } {
      let release!: () => void;
      let started = false;
      const first = new Promise<void>((res) => {
        release = res;
      });
      const loader: ScriptLoader = (_src: string) => {
        if (!started) {
          started = true;
          return first;
        }
        // A concurrent load of the same script resolves immediately — mirrors the real
        // loader, where the second caller finds the <script> already injected.
        return Promise.resolve();
      };
      return { loader, release };
    }

    it('hash mode: cross-route navigate mounts the target exactly once', async () => {
      shell = createShell({ ...testLoaders, mode: 'hash', manifests: [dappA, dappB] });
      await shell.init();

      shell.navigate('/a');
      await tick();

      const mounts = countMounts('b');
      shell.navigate('/b');
      await tick();

      expect(mounts.count()).toBe(1);
      expect(shell.getCurrentRoute()).toBe('/b');
      mounts.cleanup();
    });

    it('history mode: cross-route navigate mounts the target exactly once', async () => {
      shell = createShell({ ...testLoaders, mode: 'history', manifests: [dappA, dappB] });
      await shell.init();

      shell.navigate('/a');
      await tick();

      const mounts = countMounts('b');
      shell.navigate('/b');
      await tick();

      expect(mounts.count()).toBe(1);
      expect(shell.getCurrentRoute()).toBe('/b');
      mounts.cleanup();
    });

    it('drops a duplicate notification while a mount of the same dapp is in flight', async () => {
      const { loader, release } = deferredEntryLoader();
      shell = createShell({
        lifecycle: { scriptLoader: loader, styleLoader: async () => {} },
        mode: 'history',
        manifests: [dappB],
      });
      await shell.init();

      const mounts = countMounts('b');
      // First navigate suspends inside lifecycle.mount on the held entry load;
      // the second is a duplicate notification for the same dapp and must be dropped.
      shell.navigate('/b');
      shell.navigate('/b');
      release();
      await tick();

      expect(mounts.count()).toBe(1);
      mounts.cleanup();
    });

    it('hash mode: navigating to the current route still resolves (no silent no-op)', async () => {
      shell = createShell({ ...testLoaders, mode: 'hash', manifests: [dappA] });
      await shell.init();

      shell.navigate('/a');
      await tick();

      const changed = vi.fn();
      window.addEventListener('dx:route:changed', changed);
      shell.navigate('/a'); // same route — must still run resolution, not no-op
      await tick();

      expect(changed).toHaveBeenCalledTimes(1);
      window.removeEventListener('dx:route:changed', changed);
    });

    it('hash mode: booting directly at a route mounts exactly once', async () => {
      const mounts = countMounts('b');
      window.location.hash = '#/b';
      shell = createShell({ ...testLoaders, mode: 'hash', manifests: [dappA, dappB] });
      await shell.init();
      await tick(); // allow the pre-init hashchange to flush

      expect(mounts.count()).toBe(1);
      mounts.cleanup();
    });
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

    it('disableDapp() mid-flight (uncommitted mount) for the currently-routed dapp navigates to / (D-16)', async () => {
      const home: DappManifest = {
        id: 'home',
        name: 'Home',
        version: '0.0.1',
        route: '/',
        entry: '/dapps/home/app.js',
        nav: { label: 'Home' },
      };
      const helloOptional: DappManifest = {
        id: 'hello',
        name: 'Hello',
        version: '0.0.1',
        route: '/hello',
        entry: '/dapps/hello/app.js',
        nav: { label: 'Hello' },
        optional: true,
      };

      // Gated only on hello's entry — home's initial-route mount during init() resolves
      // immediately so it doesn't hang the test.
      let releaseHelloEntry: (() => void) | undefined;
      const scriptLoader: ScriptLoader = (src: string) => {
        if (src === helloOptional.entry) {
          return new Promise<void>((resolve) => {
            releaseHelloEntry = resolve;
          });
        }
        return Promise.resolve();
      };

      shell = createShell({
        lifecycle: { scriptLoader, styleLoader: async () => {} },
        manifests: [home, helloOptional],
      });
      await shell.init();

      shell.navigate('/hello');
      await new Promise((r) => setTimeout(r, 0)); // mountDapp('hello') suspends at the entry-script gate

      shell.disableDapp('hello'); // uncommitted mount whose route is active — must navigate to /

      expect(shell.getCurrentRoute()).toBe('/');

      releaseHelloEntry?.();
      await new Promise((r) => setTimeout(r, 0));

      // Releasing the abandoned mount's held loader must not re-navigate away from /.
      expect(shell.getCurrentRoute()).toBe('/');
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

  describe('config.lifecycle passthrough (D-03/D-04)', () => {
    it('a lifecycle.sanitizeTemplate configured via createShell runs during a real mount', async () => {
      const rawHtml = '<div id="content">hi</div>';
      const sanitizeTemplate = vi.fn((html: string) => `<!--sanitized-->${html}`);
      const manifest: DappManifest = {
        id: 'templated',
        name: 'Templated',
        version: '0.0.1',
        route: '/templated',
        entry: 'data:text/javascript,',
        template: '/templated/index.html',
        nav: { label: 'Templated' },
      };

      shell = createShell({
        lifecycle: {
          scriptLoader: async () => {},
          styleLoader: async () => {},
          templateLoader: async (src: string) => (src === manifest.template ? rawHtml : ''),
          sanitizeTemplate,
          // Also exercise timeout/cacheTemplates — previously unreachable from createShell() (D-04).
          timeout: 5000,
          cacheTemplates: false,
        },
        manifests: [manifest],
      });

      await shell.init();
      shell.navigate('/templated');
      await new Promise((r) => setTimeout(r, 0));

      expect(sanitizeTemplate).toHaveBeenCalledWith(rawHtml, expect.objectContaining({ id: 'templated' }));
      expect(container.innerHTML).toBe(`<!--sanitized-->${rawHtml}`);
    });
  });

  describe('flat-loader runtime throw (D-05)', () => {
    it('throws when scriptLoader is passed at the top level', () => {
      expect(() => createShell({ scriptLoader: async () => {} } as unknown as ShellConfig)).toThrow(
        /config\.lifecycle/,
      );
    });

    it('throws when styleLoader is passed at the top level', () => {
      expect(() => createShell({ styleLoader: async () => {} } as unknown as ShellConfig)).toThrow(/config\.lifecycle/);
    });

    it('throws when templateLoader is passed at the top level', () => {
      expect(() => createShell({ templateLoader: async () => '' } as unknown as ShellConfig)).toThrow(
        /config\.lifecycle/,
      );
    });

    it('throws once naming all three flat keys when combined', () => {
      expect(() =>
        createShell({
          scriptLoader: async () => {},
          styleLoader: async () => {},
          templateLoader: async () => '',
        } as unknown as ShellConfig),
      ).toThrow(/config\.lifecycle/);
    });
  });
});

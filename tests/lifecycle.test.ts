import type { DappManifest, EventBus } from '@dnzn/dxkit';
import { createEventBus, createLifecycleManager } from '@dnzn/dxkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const noopLoader = async () => {};
const failLoader = async (src: string) => {
  throw new Error(`Failed to load: ${src}`);
};

function manifest(id: string): DappManifest {
  return {
    id,
    name: id,
    version: '0.0.1',
    route: `/${id}`,
    entry: `/dapps/${id}/app.js`,
    nav: { label: id },
  };
}

describe('LifecycleManager', () => {
  let events: EventBus;
  let container: HTMLElement;

  beforeEach(() => {
    events = createEventBus();
    container = document.createElement('div');
    container.id = 'dx-mount';
    document.body.appendChild(container);

    return () => {
      container.remove();
    };
  });

  it('emits dx:mount and dx:dapp:mounted on mount', async () => {
    const lm = createLifecycleManager(events, { scriptLoader: noopLoader });
    const mountHandler = vi.fn();
    const mountedHandler = vi.fn();

    events.on('dx:mount', mountHandler);
    events.on('dx:dapp:mounted', mountedHandler);

    await lm.mount(manifest('hello'), container);

    expect(mountHandler).toHaveBeenCalledWith({
      id: 'hello',
      container,
      path: '/hello',
    });
    expect(mountedHandler).toHaveBeenCalledWith({ id: 'hello' });
    expect(lm.getCurrentDapp()).toBe('hello');

    lm.destroy();
  });

  it('emits dx:unmount and dx:dapp:unmounted on unmount', async () => {
    const lm = createLifecycleManager(events, { scriptLoader: noopLoader });
    const unmountHandler = vi.fn();
    const unmountedHandler = vi.fn();

    events.on('dx:unmount', unmountHandler);
    events.on('dx:dapp:unmounted', unmountedHandler);

    await lm.mount(manifest('hello'), container);
    lm.unmount();

    expect(unmountHandler).toHaveBeenCalledWith({ id: 'hello' });
    expect(unmountedHandler).toHaveBeenCalledWith({ id: 'hello' });
    expect(lm.getCurrentDapp()).toBeNull();

    lm.destroy();
  });

  it('unmounts current dapp before mounting new one', async () => {
    const lm = createLifecycleManager(events, { scriptLoader: noopLoader });
    const unmountedIds: string[] = [];

    events.on('dx:dapp:unmounted', ({ id }) => unmountedIds.push(id));

    await lm.mount(manifest('first'), container);
    await lm.mount(manifest('second'), container);

    expect(unmountedIds).toEqual(['first']);
    expect(lm.getCurrentDapp()).toBe('second');

    lm.destroy();
  });

  it('emits dx:error when script fails to load', async () => {
    const lm = createLifecycleManager(events, { scriptLoader: failLoader });
    const errorHandler = vi.fn();

    events.on('dx:error', errorHandler);

    await lm.mount(manifest('broken'), container);

    expect(errorHandler).toHaveBeenCalledOnce();
    expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:broken');
    expect(lm.getCurrentDapp()).toBeNull();

    lm.destroy();
  });

  it('unmount is a no-op when nothing is mounted', () => {
    const lm = createLifecycleManager(events, { scriptLoader: noopLoader });
    const handler = vi.fn();

    events.on('dx:unmount', handler);

    lm.unmount();

    expect(handler).not.toHaveBeenCalled();
    lm.destroy();
  });

  it('loads styles before script when manifest has styles', async () => {
    const loadOrder: string[] = [];
    const trackingScriptLoader = async (src: string) => {
      loadOrder.push(`script:${src}`);
    };
    const trackingStyleLoader = async (href: string) => {
      loadOrder.push(`style:${href}`);
    };

    const lm = createLifecycleManager(events, {
      scriptLoader: trackingScriptLoader,
      styleLoader: trackingStyleLoader,
    });

    const m = { ...manifest('styled'), styles: '/dapps/styled/style.css' };
    await lm.mount(m, container);

    expect(loadOrder).toEqual(['style:/dapps/styled/style.css', 'script:/dapps/styled/app.js']);
    expect(lm.getCurrentDapp()).toBe('styled');

    lm.destroy();
  });

  it('skips style loading when manifest has no styles', async () => {
    const styleLoader = vi.fn();
    const lm = createLifecycleManager(events, {
      scriptLoader: noopLoader,
      styleLoader,
    });

    await lm.mount(manifest('plain'), container);

    expect(styleLoader).not.toHaveBeenCalled();
    lm.destroy();
  });

  it('emits dx:error on style failure but still mounts', async () => {
    const lm = createLifecycleManager(events, {
      scriptLoader: noopLoader,
      styleLoader: failLoader,
    });

    const errorHandler = vi.fn();
    const mountedHandler = vi.fn();
    events.on('dx:error', errorHandler);
    events.on('dx:dapp:mounted', mountedHandler);

    const m = { ...manifest('bad-css'), styles: '/dapps/bad-css/style.css' };
    await lm.mount(m, container);

    expect(errorHandler).toHaveBeenCalledOnce();
    expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:bad-css:styles');
    // Dapp still mounts despite CSS failure
    expect(mountedHandler).toHaveBeenCalledWith({ id: 'bad-css' });
    expect(lm.getCurrentDapp()).toBe('bad-css');

    lm.destroy();
  });

  it('blocks mount when required plugin is missing', async () => {
    const lm = createLifecycleManager(events, {
      scriptLoader: noopLoader,
      hasPlugin: () => false,
    });

    const errorHandler = vi.fn();
    events.on('dx:error', errorHandler);

    const m = { ...manifest('needs-wallet'), requires: { plugins: ['wallet'] } };
    await lm.mount(m, container);

    expect(errorHandler).toHaveBeenCalledOnce();
    expect(errorHandler.mock.calls[0][0].error.message).toContain('wallet');
    expect(lm.getCurrentDapp()).toBeNull();

    lm.destroy();
  });

  it('mounts when all required plugins are satisfied', async () => {
    const lm = createLifecycleManager(events, {
      scriptLoader: noopLoader,
      hasPlugin: (name) => name === 'wallet' || name === 'theme',
    });

    const mountedHandler = vi.fn();
    events.on('dx:dapp:mounted', mountedHandler);

    const m = { ...manifest('full'), requires: { plugins: ['wallet', 'theme'] } };
    await lm.mount(m, container);

    expect(mountedHandler).toHaveBeenCalledWith({ id: 'full' });
    expect(lm.getCurrentDapp()).toBe('full');

    lm.destroy();
  });

  it('mounts when no requires are declared', async () => {
    const lm = createLifecycleManager(events, {
      scriptLoader: noopLoader,
      hasPlugin: () => false, // nothing registered
    });

    const mountedHandler = vi.fn();
    events.on('dx:dapp:mounted', mountedHandler);

    await lm.mount(manifest('simple'), container);

    expect(mountedHandler).toHaveBeenCalledWith({ id: 'simple' });

    lm.destroy();
  });

  it('reports all missing plugins in error', async () => {
    const lm = createLifecycleManager(events, {
      scriptLoader: noopLoader,
      hasPlugin: () => false,
    });

    const errorHandler = vi.fn();
    events.on('dx:error', errorHandler);

    const m = { ...manifest('greedy'), requires: { plugins: ['wallet', 'auth', 'settings'] } };
    await lm.mount(m, container);

    const msg = errorHandler.mock.calls[0][0].error.message;
    expect(msg).toContain('wallet');
    expect(msg).toContain('auth');
    expect(msg).toContain('settings');

    lm.destroy();
  });

  it('passes path to dx:mount event', async () => {
    const lm = createLifecycleManager(events, { scriptLoader: noopLoader });
    const handler = vi.fn();
    events.on('dx:mount', handler);

    await lm.mount(manifest('hello'), container, '/hello/sub/path');

    expect(handler).toHaveBeenCalledWith({
      id: 'hello',
      container,
      path: '/hello/sub/path',
    });

    lm.destroy();
  });

  it('defaults path to manifest route when not provided', async () => {
    const lm = createLifecycleManager(events, { scriptLoader: noopLoader });
    const handler = vi.fn();
    events.on('dx:mount', handler);

    await lm.mount(manifest('hello'), container);

    expect(handler.mock.calls[0][0].path).toBe('/hello');

    lm.destroy();
  });

  it('injects template HTML into container before loading scripts', async () => {
    const loadOrder: string[] = [];
    const lm = createLifecycleManager(events, {
      scriptLoader: async (src) => {
        loadOrder.push(`script:${src}`);
      },
      templateLoader: async (src) => {
        loadOrder.push(`template:${src}`);
        return '<div id="app">Template Content</div>';
      },
    });

    const m = { ...manifest('templated'), template: '/dapps/templated/template.html' };
    await lm.mount(m, container);

    expect(loadOrder[0]).toBe('template:/dapps/templated/template.html');
    expect(loadOrder[1]).toBe('script:/dapps/templated/app.js');
    expect(container.innerHTML).toBe('<div id="app">Template Content</div>');
    expect(lm.getCurrentDapp()).toBe('templated');

    lm.destroy();
  });

  it('aborts mount when template fails to load', async () => {
    const lm = createLifecycleManager(events, {
      scriptLoader: noopLoader,
      templateLoader: async () => {
        throw new Error('404');
      },
    });

    const errorHandler = vi.fn();
    const mountedHandler = vi.fn();
    events.on('dx:error', errorHandler);
    events.on('dx:dapp:mounted', mountedHandler);

    const m = { ...manifest('bad-tpl'), template: '/missing.html' };
    await lm.mount(m, container);

    expect(errorHandler).toHaveBeenCalledOnce();
    expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:bad-tpl:template');
    expect(mountedHandler).not.toHaveBeenCalled();
    expect(lm.getCurrentDapp()).toBeNull();

    lm.destroy();
  });

  it('loads template before dependencies and entry', async () => {
    const loadOrder: string[] = [];
    const lm = createLifecycleManager(events, {
      scriptLoader: async (src) => {
        loadOrder.push(`script:${src}`);
      },
      templateLoader: async (src) => {
        loadOrder.push(`template:${src}`);
        return '<p>hi</p>';
      },
    });

    const m = {
      ...manifest('full'),
      template: '/dapps/full/tpl.html',
      dependencies: ['/lib/dep.js'],
    };
    await lm.mount(m, container);

    expect(loadOrder).toEqual(['template:/dapps/full/tpl.html', 'script:/lib/dep.js', 'script:/dapps/full/app.js']);

    lm.destroy();
  });

  it('skips template loading when not declared', async () => {
    const templateLoader = vi.fn();
    const lm = createLifecycleManager(events, {
      scriptLoader: noopLoader,
      templateLoader,
    });

    await lm.mount(manifest('no-tpl'), container);

    expect(templateLoader).not.toHaveBeenCalled();
    lm.destroy();
  });

  it('loads dependencies before entry script', async () => {
    const loadOrder: string[] = [];
    const trackingLoader = async (src: string) => {
      loadOrder.push(src);
    };

    const lm = createLifecycleManager(events, { scriptLoader: trackingLoader });
    const m = { ...manifest('multi'), dependencies: ['/lib/a.js', '/lib/b.js'] };
    await lm.mount(m, container);

    expect(loadOrder).toEqual(['/lib/a.js', '/lib/b.js', '/dapps/multi/app.js']);
    expect(lm.getCurrentDapp()).toBe('multi');

    lm.destroy();
  });

  it('aborts mount when a dependency fails to load', async () => {
    const lm = createLifecycleManager(events, {
      scriptLoader: async (src: string) => {
        if (src.includes('bad')) throw new Error(`Failed: ${src}`);
      },
    });

    const errorHandler = vi.fn();
    const mountedHandler = vi.fn();
    events.on('dx:error', errorHandler);
    events.on('dx:dapp:mounted', mountedHandler);

    const m = { ...manifest('broken-dep'), dependencies: ['/lib/bad.js'] };
    await lm.mount(m, container);

    expect(errorHandler).toHaveBeenCalledOnce();
    expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:broken-dep:dependency');
    expect(mountedHandler).not.toHaveBeenCalled();
    expect(lm.getCurrentDapp()).toBeNull();

    lm.destroy();
  });

  it('clears the mount container when entry script fails after a template was injected', async () => {
    const lm = createLifecycleManager(events, {
      scriptLoader: failLoader,
      templateLoader: async () => '<div id="app">Template Content</div>',
    });

    const errorHandler = vi.fn();
    events.on('dx:error', errorHandler);

    const m = { ...manifest('tpl-entry-fail'), template: '/dapps/tpl-entry-fail/tpl.html' };
    await lm.mount(m, container);

    expect(container.innerHTML).toBe('');
    expect(errorHandler).toHaveBeenCalledOnce();
    expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:tpl-entry-fail');
    expect(lm.getCurrentDapp()).toBeNull();

    lm.destroy();
  });

  it('clears the mount container when a dependency fails after a template was injected', async () => {
    const lm = createLifecycleManager(events, {
      scriptLoader: async (src: string) => {
        if (src.includes('bad')) throw new Error(`Failed: ${src}`);
      },
      templateLoader: async () => '<div id="app">Template Content</div>',
    });

    const errorHandler = vi.fn();
    events.on('dx:error', errorHandler);

    const m = {
      ...manifest('tpl-dep-fail'),
      template: '/dapps/tpl-dep-fail/tpl.html',
      dependencies: ['/lib/bad.js'],
    };
    await lm.mount(m, container);

    expect(container.innerHTML).toBe('');
    expect(errorHandler).toHaveBeenCalledOnce();
    expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:tpl-dep-fail:dependency');
    expect(lm.getCurrentDapp()).toBeNull();

    lm.destroy();
  });

  it('skips dependency loading when none declared', async () => {
    const loader = vi.fn(async () => {});
    const lm = createLifecycleManager(events, { scriptLoader: loader });

    await lm.mount(manifest('simple'), container);

    // Only the entry script should be loaded
    expect(loader).toHaveBeenCalledOnce();
    expect(loader).toHaveBeenCalledWith('/dapps/simple/app.js');

    lm.destroy();
  });

  it('destroy() unmounts the current dapp', async () => {
    const lm = createLifecycleManager(events, { scriptLoader: noopLoader });
    const handler = vi.fn();

    events.on('dx:dapp:unmounted', handler);

    await lm.mount(manifest('hello'), container);
    lm.destroy();

    expect(handler).toHaveBeenCalledWith({ id: 'hello' });
    expect(lm.getCurrentDapp()).toBeNull();
  });

  describe('load timeout', () => {
    const neverResolves = () => new Promise<never>(() => {});

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('style timeout is non-blocking — dx:error fires but the mount continues', async () => {
      const lm = createLifecycleManager(events, {
        scriptLoader: noopLoader,
        styleLoader: neverResolves,
        timeout: 30,
      });

      const errorHandler = vi.fn();
      const mountedHandler = vi.fn();
      events.on('dx:error', errorHandler);
      events.on('dx:dapp:mounted', mountedHandler);

      const m = { ...manifest('slow-css'), styles: '/dapps/slow-css/style.css' };
      const mountPromise = lm.mount(m, container);
      await vi.advanceTimersByTimeAsync(30);
      await mountPromise;

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:slow-css:styles');
      expect(mountedHandler).toHaveBeenCalledWith({ id: 'slow-css' });
      expect(lm.getCurrentDapp()).toBe('slow-css');

      lm.destroy();
    });

    it('template timeout aborts the mount — dx:error fires, no dx:mount, container not left with stale HTML', async () => {
      const lm = createLifecycleManager(events, {
        scriptLoader: noopLoader,
        templateLoader: neverResolves,
        timeout: 30,
      });

      const errorHandler = vi.fn();
      const mountedHandler = vi.fn();
      events.on('dx:error', errorHandler);
      events.on('dx:dapp:mounted', mountedHandler);

      const m = { ...manifest('slow-tpl'), template: '/dapps/slow-tpl/tpl.html' };
      const mountPromise = lm.mount(m, container);
      await vi.advanceTimersByTimeAsync(30);
      await mountPromise;

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:slow-tpl:template');
      expect(mountedHandler).not.toHaveBeenCalled();
      expect(container.innerHTML).toBe('');
      expect(lm.getCurrentDapp()).toBeNull();

      lm.destroy();
    });

    it('sanitize timeout aborts the mount — dx:error fires with source lifecycle:<id>:sanitize, no injection, no dx:dapp:mounted', async () => {
      const lm = createLifecycleManager(events, {
        scriptLoader: noopLoader,
        templateLoader: async () => '<div id="app">Template Content</div>',
        sanitizeTemplate: neverResolves,
        timeout: 30,
      });

      const errorHandler = vi.fn();
      const mountedHandler = vi.fn();
      events.on('dx:error', errorHandler);
      events.on('dx:dapp:mounted', mountedHandler);

      const m = { ...manifest('slow-sanitize'), template: '/dapps/slow-sanitize/tpl.html' };
      const mountPromise = lm.mount(m, container);
      await vi.advanceTimersByTimeAsync(30);
      await mountPromise;

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:slow-sanitize:sanitize');
      expect(mountedHandler).not.toHaveBeenCalled();
      expect(container.innerHTML).toBe('');
      expect(lm.getCurrentDapp()).toBeNull();

      lm.destroy();
    });

    it('dependency timeout aborts the mount and clears the container', async () => {
      const lm = createLifecycleManager(events, {
        scriptLoader: (src: string) => (src.includes('dep') ? neverResolves() : Promise.resolve()),
        templateLoader: async () => '<div id="app">Template Content</div>',
        timeout: 30,
      });

      const errorHandler = vi.fn();
      const mountedHandler = vi.fn();
      events.on('dx:error', errorHandler);
      events.on('dx:dapp:mounted', mountedHandler);

      const m = {
        ...manifest('slow-dep'),
        template: '/dapps/slow-dep/tpl.html',
        dependencies: ['/lib/dep.js'],
      };
      const mountPromise = lm.mount(m, container);
      await vi.advanceTimersByTimeAsync(30);
      await mountPromise;

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:slow-dep:dependency');
      expect(mountedHandler).not.toHaveBeenCalled();
      expect(container.innerHTML).toBe('');
      expect(lm.getCurrentDapp()).toBeNull();

      lm.destroy();
    });

    it('entry timeout aborts the mount and clears the container', async () => {
      const lm = createLifecycleManager(events, {
        scriptLoader: neverResolves,
        timeout: 30,
      });

      const errorHandler = vi.fn();
      const mountedHandler = vi.fn();
      events.on('dx:error', errorHandler);
      events.on('dx:dapp:mounted', mountedHandler);

      const m = manifest('slow-entry');
      const mountPromise = lm.mount(m, container);
      await vi.advanceTimersByTimeAsync(30);
      await mountPromise;

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:slow-entry');
      expect(mountedHandler).not.toHaveBeenCalled();
      expect(container.innerHTML).toBe('');
      expect(lm.getCurrentDapp()).toBeNull();

      lm.destroy();
    });

    it.each([
      0,
      Infinity,
    ])('timeout: %s disables the guard — a slow-but-eventually-resolving loader is awaited to completion', async (timeoutValue) => {
      const lm = createLifecycleManager(events, {
        scriptLoader: () => new Promise((resolve) => setTimeout(resolve, 60_000)),
        timeout: timeoutValue,
      });

      const errorHandler = vi.fn();
      const mountedHandler = vi.fn();
      events.on('dx:error', errorHandler);
      events.on('dx:dapp:mounted', mountedHandler);

      const m = manifest('slow-but-fine');
      const mountPromise = lm.mount(m, container);
      await vi.advanceTimersByTimeAsync(60_000);
      await mountPromise;

      expect(errorHandler).not.toHaveBeenCalled();
      expect(mountedHandler).toHaveBeenCalledWith({ id: 'slow-but-fine' });
      expect(lm.getCurrentDapp()).toBe('slow-but-fine');

      lm.destroy();
    });

    it('custom (opaque) loader hang guard fires dx:error via Promise.race even though the underlying load keeps running', async () => {
      let resolveHang: () => void = () => {};
      const hangingButEventuallyResolves = () =>
        new Promise<void>((resolve) => {
          resolveHang = resolve;
        });

      const lm = createLifecycleManager(events, {
        scriptLoader: hangingButEventuallyResolves,
        timeout: 30,
      });

      const errorHandler = vi.fn();
      events.on('dx:error', errorHandler);

      const m = manifest('opaque-hang');
      const mountPromise = lm.mount(m, container);
      await vi.advanceTimersByTimeAsync(30);
      await mountPromise;

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:opaque-hang');
      expect(lm.getCurrentDapp()).toBeNull();

      // Underlying load resolves later in the background (documented degradation, D-07) —
      // must not throw or double-emit once the race already settled.
      resolveHang();
      await Promise.resolve();
      expect(errorHandler).toHaveBeenCalledOnce();

      lm.destroy();
    });

    it('custom loader that settles before its timeout clears the pending timer (WR-01 regression)', async () => {
      const lm = createLifecycleManager(events, {
        scriptLoader: noopLoader,
        timeout: 30,
      });

      await lm.mount(manifest('fast-custom'), container);

      // Before the WR-01 fix, withTimeout() never cleared its setTimeout on the resolved
      // branch of the race, leaving a live timer per load until it eventually fired a no-op
      // rejection into an already-settled result.
      expect(vi.getTimerCount()).toBe(0);

      lm.destroy();
    });

    it('default 30000ms timeout applies when no timeout option is given', async () => {
      const lm = createLifecycleManager(events, { scriptLoader: neverResolves });

      const errorHandler = vi.fn();
      events.on('dx:error', errorHandler);

      const m = manifest('default-timeout');
      const mountPromise = lm.mount(m, container);

      await vi.advanceTimersByTimeAsync(29_999);
      expect(errorHandler).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      await mountPromise;

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0].error.message).toContain('30000ms');

      lm.destroy();
    });
  });

  describe('template cache', () => {
    it('reuses a cached template across repeated mounts of the same URL — the loader is called once', async () => {
      const templateLoader = vi.fn(async () => '<div id="app">Template Content</div>');
      const lm = createLifecycleManager(events, { scriptLoader: noopLoader, templateLoader });

      const m = { ...manifest('cached'), template: '/dapps/cached/tpl.html' };
      await lm.mount(m, container);
      expect(container.innerHTML).toBe('<div id="app">Template Content</div>');

      lm.unmount();
      await lm.mount(m, container);
      expect(container.innerHTML).toBe('<div id="app">Template Content</div>');

      expect(templateLoader).toHaveBeenCalledOnce();

      lm.destroy();
    });

    it('clearTemplateCache() forces a refetch on the next mount', async () => {
      const templateLoader = vi.fn(async () => '<div id="app">Template Content</div>');
      const lm = createLifecycleManager(events, { scriptLoader: noopLoader, templateLoader });

      const m = { ...manifest('cleared'), template: '/dapps/cleared/tpl.html' };
      await lm.mount(m, container);
      lm.unmount();

      lm.clearTemplateCache();
      await lm.mount(m, container);

      expect(templateLoader).toHaveBeenCalledTimes(2);

      lm.destroy();
    });

    it('invalidateTemplate(url) forces a refetch of only that URL — other cached templates are unaffected', async () => {
      const templateLoader = vi.fn(async (src: string) => `<div>${src}</div>`);
      const lm = createLifecycleManager(events, { scriptLoader: noopLoader, templateLoader });

      const urlA = '/dapps/a/tpl.html';
      const urlB = '/dapps/b/tpl.html';
      const mA = { ...manifest('a'), template: urlA };
      const mB = { ...manifest('b'), template: urlB };

      await lm.mount(mA, container);
      lm.unmount();
      await lm.mount(mB, container);
      lm.unmount();
      expect(templateLoader).toHaveBeenCalledTimes(2);

      lm.invalidateTemplate(urlA);

      await lm.mount(mA, container);
      lm.unmount();
      await lm.mount(mB, container);
      lm.unmount();

      // A refetched (invalidated), B stayed cached (2 initial + 1 refetch of A = 3)
      expect(templateLoader).toHaveBeenCalledTimes(3);
      expect(templateLoader).toHaveBeenCalledWith(urlA);

      lm.destroy();
    });

    it('does not cache a failed template fetch — a subsequent mount calls the loader again', async () => {
      const templateLoader = vi.fn(async () => {
        throw new Error('404');
      });
      const lm = createLifecycleManager(events, { scriptLoader: noopLoader, templateLoader });

      const errorHandler = vi.fn();
      events.on('dx:error', errorHandler);

      const m = { ...manifest('failing'), template: '/dapps/failing/tpl.html' };
      await lm.mount(m, container);
      await lm.mount(m, container);

      expect(templateLoader).toHaveBeenCalledTimes(2);
      expect(errorHandler).toHaveBeenCalledTimes(2);

      lm.destroy();
    });

    it('cacheTemplates: false disables caching — every mount refetches the template', async () => {
      const templateLoader = vi.fn(async () => '<div id="app">Template Content</div>');
      const lm = createLifecycleManager(events, {
        scriptLoader: noopLoader,
        templateLoader,
        cacheTemplates: false,
      });

      const m = { ...manifest('uncached'), template: '/dapps/uncached/tpl.html' };
      await lm.mount(m, container);
      lm.unmount();
      await lm.mount(m, container);

      expect(templateLoader).toHaveBeenCalledTimes(2);

      lm.destroy();
    });
  });

  describe('sanitizeTemplate', () => {
    it('is called with (html, manifest) and its returned value is injected instead of the raw HTML', async () => {
      const rawHtml = '<div id="app">Raw</div>';
      const sanitizeTemplate = vi.fn((html: string) => html.replace('Raw', 'Sanitized'));
      const lm = createLifecycleManager(events, {
        scriptLoader: noopLoader,
        templateLoader: async () => rawHtml,
        sanitizeTemplate,
      });

      const m = { ...manifest('sanitized'), template: '/dapps/sanitized/tpl.html' };
      await lm.mount(m, container);

      expect(sanitizeTemplate).toHaveBeenCalledOnce();
      expect(sanitizeTemplate).toHaveBeenCalledWith(rawHtml, expect.objectContaining({ id: 'sanitized' }));
      expect(container.innerHTML).toBe('<div id="app">Sanitized</div>');

      lm.destroy();
    });

    it('awaits an async sanitizeTemplate before injecting the resolved value', async () => {
      const rawHtml = '<div id="app">Raw</div>';
      const sanitizeTemplate = async (html: string) => {
        await Promise.resolve();
        return html.replace('Raw', 'AsyncSanitized');
      };
      const lm = createLifecycleManager(events, {
        scriptLoader: noopLoader,
        templateLoader: async () => rawHtml,
        sanitizeTemplate,
      });

      const m = { ...manifest('async-sanitized'), template: '/dapps/async-sanitized/tpl.html' };
      await lm.mount(m, container);

      expect(container.innerHTML).toBe('<div id="app">AsyncSanitized</div>');

      lm.destroy();
    });

    it('injects an XSS-shaped payload verbatim when no sanitizeTemplate is configured (unchanged 0.1.5 default)', async () => {
      const xssPayload = '<img src="x" onerror="alert(1)"><script>alert(2)</script>';
      const lm = createLifecycleManager(events, {
        scriptLoader: noopLoader,
        templateLoader: async () => xssPayload,
      });

      const m = { ...manifest('unsanitized'), template: '/dapps/unsanitized/tpl.html' };
      await lm.mount(m, container);

      expect(container.innerHTML).toContain(xssPayload);

      lm.destroy();
    });

    it('fail-closed: a sanitizeTemplate that throws emits dx:error with source lifecycle:<id>:sanitize and does not inject', async () => {
      const xssPayload = '<div>payload</div>';
      const lm = createLifecycleManager(events, {
        scriptLoader: noopLoader,
        templateLoader: async () => xssPayload,
        sanitizeTemplate: () => {
          throw new Error('sanitizer exploded');
        },
      });

      const errorHandler = vi.fn();
      const mountedHandler = vi.fn();
      events.on('dx:error', errorHandler);
      events.on('dx:dapp:mounted', mountedHandler);

      const m = { ...manifest('sanitize-throws'), template: '/dapps/sanitize-throws/tpl.html' };
      await lm.mount(m, container);

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:sanitize-throws:sanitize');
      expect(container.innerHTML).not.toContain(xssPayload);
      expect(mountedHandler).not.toHaveBeenCalled();
      expect(lm.getCurrentDapp()).toBeNull();

      lm.destroy();
    });

    it('fail-closed: a sanitizeTemplate that rejects emits dx:error with source lifecycle:<id>:sanitize and does not inject', async () => {
      const xssPayload = '<div>payload</div>';
      const lm = createLifecycleManager(events, {
        scriptLoader: noopLoader,
        templateLoader: async () => xssPayload,
        sanitizeTemplate: async () => {
          throw new Error('sanitizer rejected');
        },
      });

      const errorHandler = vi.fn();
      events.on('dx:error', errorHandler);

      const m = { ...manifest('sanitize-rejects'), template: '/dapps/sanitize-rejects/tpl.html' };
      await lm.mount(m, container);

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0].source).toBe('lifecycle:sanitize-rejects:sanitize');
      expect(container.innerHTML).not.toContain(xssPayload);

      lm.destroy();
    });

    it('re-runs the sanitizer on every mount while the template cache stores only raw HTML (D-06)', async () => {
      const rawHtml = '<div id="app">Raw</div>';
      const templateLoader = vi.fn(async () => rawHtml);
      let strip = true;
      const sanitizeTemplate = (html: string) => (strip ? html.replace('Raw', 'Stripped') : html);

      const lm = createLifecycleManager(events, {
        scriptLoader: noopLoader,
        templateLoader,
        sanitizeTemplate,
      });

      const m = { ...manifest('cache-raw'), template: '/dapps/cache-raw/tpl.html' };
      await lm.mount(m, container);
      expect(container.innerHTML).toBe('<div id="app">Stripped</div>');
      lm.unmount();

      // Sanitizer behavior swapped to passthrough for the second mount — the templateCache
      // still only ever held the raw fetched HTML, so this proves the cache never stored
      // sanitized output and the sanitizer re-ran fresh on the cache-hit mount.
      strip = false;
      await lm.mount(m, container);
      expect(container.innerHTML).toBe(rawHtml);

      expect(templateLoader).toHaveBeenCalledOnce();

      lm.destroy();
    });
  });
});

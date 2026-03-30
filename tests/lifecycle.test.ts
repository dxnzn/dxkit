import type { DappManifest, EventBus } from '@dnzn/dxkit';
import { createEventBus, createLifecycleManager } from '@dnzn/dxkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('destroy() unmounts the current dapp', async () => {
    const lm = createLifecycleManager(events, { scriptLoader: noopLoader });
    const handler = vi.fn();

    events.on('dx:dapp:unmounted', handler);

    await lm.mount(manifest('hello'), container);
    lm.destroy();

    expect(handler).toHaveBeenCalledWith({ id: 'hello' });
    expect(lm.getCurrentDapp()).toBeNull();
  });
});

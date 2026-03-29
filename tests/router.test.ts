import type { DappManifest } from 'dxkit';
import { createRouter } from 'dxkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function manifest(overrides: Partial<DappManifest> & { id: string; route: string }): DappManifest {
  return {
    name: overrides.id,
    version: '0.0.1',
    entry: `/dapps/${overrides.id}/app.js`,
    nav: { label: overrides.id },
    ...overrides,
  };
}

describe('Router', () => {
  beforeEach(() => {
    // Reset URL to root
    window.history.replaceState(null, '', '/');
  });

  it('resolves exact route match', () => {
    const router = createRouter({
      mode: 'history',
      basePath: '/',
      manifests: [manifest({ id: 'blog', route: '/blog' })],
    });

    expect(router.resolve('/blog')?.id).toBe('blog');
    router.destroy();
  });

  it('resolves nested paths to parent route', () => {
    const router = createRouter({
      mode: 'history',
      basePath: '/',
      manifests: [manifest({ id: 'blog', route: '/blog' })],
    });

    expect(router.resolve('/blog/post/123')?.id).toBe('blog');
    router.destroy();
  });

  it('returns null for unmatched paths', () => {
    const router = createRouter({
      mode: 'history',
      basePath: '/',
      manifests: [manifest({ id: 'blog', route: '/blog' })],
    });

    expect(router.resolve('/unknown')).toBeNull();
    router.destroy();
  });

  it('uses longest prefix match', () => {
    const router = createRouter({
      mode: 'history',
      basePath: '/',
      manifests: [
        manifest({ id: 'tools', route: '/tools' }),
        manifest({ id: 'token-sender', route: '/tools/token-sender' }),
      ],
    });

    expect(router.resolve('/tools/token-sender')?.id).toBe('token-sender');
    expect(router.resolve('/tools/other')?.id).toBe('tools');
    router.destroy();
  });

  it('getCurrentPath() reads from window.location', () => {
    window.history.replaceState(null, '', '/blog');

    const router = createRouter({
      mode: 'history',
      basePath: '/',
      manifests: [],
    });

    expect(router.getCurrentPath()).toBe('/blog');
    router.destroy();
  });

  it('navigate() updates path and notifies listeners', () => {
    const router = createRouter({
      mode: 'history',
      basePath: '/',
      manifests: [manifest({ id: 'blog', route: '/blog' })],
    });

    const handler = vi.fn();
    router.onRouteChange(handler);
    router.navigate('/blog');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]?.id).toBe('blog');
    expect(router.getCurrentPath()).toBe('/blog');
    router.destroy();
  });

  it('onRouteChange() returns an unsubscribe function', () => {
    const router = createRouter({
      mode: 'history',
      basePath: '/',
      manifests: [manifest({ id: 'blog', route: '/blog' })],
    });

    const handler = vi.fn();
    const unsub = router.onRouteChange(handler);
    unsub();
    router.navigate('/blog');

    expect(handler).not.toHaveBeenCalled();
    router.destroy();
  });

  it('strips basePath from resolution', () => {
    const router = createRouter({
      mode: 'history',
      basePath: '/app',
      manifests: [manifest({ id: 'blog', route: '/blog' })],
    });

    expect(router.resolve('/app/blog')?.id).toBe('blog');
    router.destroy();
  });

  it('normalizes trailing slashes', () => {
    const router = createRouter({
      mode: 'history',
      basePath: '/',
      manifests: [manifest({ id: 'blog', route: '/blog' })],
    });

    expect(router.resolve('/blog/')?.id).toBe('blog');
    router.destroy();
  });

  it('resolves root route', () => {
    const router = createRouter({
      mode: 'history',
      basePath: '/',
      manifests: [manifest({ id: 'home', route: '/' })],
    });

    expect(router.resolve('/')?.id).toBe('home');
    router.destroy();
  });
});

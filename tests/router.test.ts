import type { DappManifest } from '@dnzn/dxkit';
import { createRouter } from '@dnzn/dxkit';
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

  // D-08: exact-duplicate routes — resolution stays deterministic (first-registered-wins,
  // guaranteed by the stable construction-time sort); the dx:error visibility half is
  // shell-owned and tested in tests/shell.test.ts.
  describe('duplicate exact routes', () => {
    it('resolve() returns the first-registered manifest when two share an identical exact route', () => {
      const router = createRouter({
        mode: 'history',
        basePath: '/',
        manifests: [manifest({ id: 'first', route: '/dup' }), manifest({ id: 'second', route: '/dup' })],
      });

      expect(router.resolve('/dup')?.id).toBe('first');
      router.destroy();
    });

    it('resolve() still returns the first-registered manifest when input order is reversed', () => {
      const router = createRouter({
        mode: 'history',
        basePath: '/',
        manifests: [manifest({ id: 'beta', route: '/dup' }), manifest({ id: 'alpha', route: '/dup' })],
      });

      // Reversed input order (beta before alpha) — first-array-position still wins, so 'beta' resolves.
      expect(router.resolve('/dup')?.id).toBe('beta');
      router.destroy();
    });
  });

  // Regression (ROB-02/D-08): the length-sort is snapshotted once at construction, not
  // recomputed on every resolve() call — the router is immutable and fully rebuilt by
  // shell.rebuildRouter() whenever manifests change.
  describe('construction-time sort caching', () => {
    it('longest prefix still wins after the sort is hoisted', () => {
      const router = createRouter({
        mode: 'history',
        basePath: '/',
        manifests: [manifest({ id: 'tools', route: '/tools' }), manifest({ id: 'sender', route: '/tools/sender' })],
      });

      expect(router.resolve('/tools/sender/x')?.id).toBe('sender');
      router.destroy();
    });

    it('mutating the original manifests array after construction does not affect resolution', () => {
      const manifests = [manifest({ id: 'tools', route: '/tools' })];
      const router = createRouter({
        mode: 'history',
        basePath: '/',
        manifests,
      });

      // Pushing a new, longer-prefix manifest onto the *original* array post-construction
      // must not change resolve() output — the sorted snapshot was taken at construction time.
      manifests.push(manifest({ id: 'sender', route: '/tools/sender' }));

      expect(router.resolve('/tools/sender')?.id).toBe('tools');
      router.destroy();
    });

    it('repeated resolve() calls return consistent results across navigations', () => {
      const router = createRouter({
        mode: 'history',
        basePath: '/',
        manifests: [
          manifest({ id: 'tools', route: '/tools' }),
          manifest({ id: 'sender', route: '/tools/sender' }),
          manifest({ id: 'blog', route: '/blog' }),
        ],
      });

      for (let i = 0; i < 3; i++) {
        expect(router.resolve('/tools/sender')?.id).toBe('sender');
        expect(router.resolve('/tools/other')?.id).toBe('tools');
        expect(router.resolve('/blog')?.id).toBe('blog');
      }
      router.destroy();
    });
  });

  // Regression: in hash mode, assigning location.hash fires an async 'hashchange'.
  // navigate() must not ALSO notify explicitly or listeners fire twice per navigation.
  describe('hash mode notifications', () => {
    const tick = () => new Promise((r) => setTimeout(r, 0));

    it('navigate() to a new hash notifies listeners exactly once', async () => {
      const router = createRouter({
        mode: 'hash',
        basePath: '/',
        manifests: [manifest({ id: 'a', route: '/a' }), manifest({ id: 'b', route: '/b' })],
      });

      router.navigate('/a');
      await tick(); // let the initial hashchange settle before observing

      const handler = vi.fn();
      router.onRouteChange(handler);
      router.navigate('/b'); // different hash -> hashchange (async) is the only notification
      await tick();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]?.id).toBe('b');
      router.destroy();
    });

    it('navigate() to the current hash still notifies (no hashchange fires)', async () => {
      const router = createRouter({
        mode: 'hash',
        basePath: '/',
        manifests: [manifest({ id: 'a', route: '/a' })],
      });

      router.navigate('/a');
      await tick();

      const handler = vi.fn();
      router.onRouteChange(handler);
      router.navigate('/a'); // same hash -> assignment fires nothing -> explicit notify required
      await tick();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]?.id).toBe('a');
      router.destroy();
    });
  });
});

import type { DappManifest, ScriptLoader, Shell, TemplateLoader } from '@dnzn/dxkit';
import { createShell } from '@dnzn/dxkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Dedicated concurrency/race stress suite (D-11) proving the mount-generation guard
 * (src/lifecycle.ts) and its shell-side wiring (src/shell.ts) satisfy last-navigation-wins
 * (D-01), strict dx:mount/dx:unmount alternation (D-02), and the full D-03 race matrix.
 *
 * Driven entirely through createShell() + shell.navigate() (Pitfall 4) — the shell-level
 * pendingMountId dedupe only exists in shell.ts, so a lifecycle-only test would miss it.
 * mode: 'history' throughout (Pitfall 3) — its navigate() calls notifyListeners()
 * synchronously, unlike hash mode's real, uncontrollable async hashchange dispatch.
 */

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * A loader keyed by src/url — every call registers a waiter, release(key) resolves ALL
 * waiters currently queued for that key (concurrent calls for the same src/url share the
 * same release, matching how a real duplicate script/template request would eventually
 * settle together). Gives exact manual control over interleaving without any dependency on
 * promise-resolution-order timing (D-12).
 */
function keyedGate<T>(): { loader: (key: string) => Promise<T>; release: (key: string, value: T) => void } {
  const waiters = new Map<string, Array<(value: T) => void>>();
  const loader = (key: string) =>
    new Promise<T>((resolve) => {
      const list = waiters.get(key) ?? [];
      list.push(resolve);
      waiters.set(key, list);
    });
  return {
    loader,
    release: (key: string, value: T) => {
      const list = waiters.get(key);
      if (!list) return;
      waiters.delete(key);
      for (const resolve of list) resolve(value);
    },
  };
}

function countMounts(id: string): { count: () => number; cleanup: () => void } {
  let n = 0;
  const handler = (e: Event) => {
    if ((e as CustomEvent).detail.id === id) n += 1;
  };
  window.addEventListener('dx:mount', handler);
  return { count: () => n, cleanup: () => window.removeEventListener('dx:mount', handler) };
}

/**
 * Records the combined chronological dx:mount/dx:unmount stream and asserts the
 * single-dapp-active invariant (D-02): a mount for any id must never fire while another
 * mount is still active, and each active mount's own unmount must fire before the next mount.
 */
function recordAlternation(): {
  log: Array<{ type: 'mount' | 'unmount'; id: string }>;
  assertStrict: () => void;
  cleanup: () => void;
} {
  const log: Array<{ type: 'mount' | 'unmount'; id: string }> = [];
  const onMount = (e: Event) => log.push({ type: 'mount', id: (e as CustomEvent).detail.id });
  const onUnmount = (e: Event) => log.push({ type: 'unmount', id: (e as CustomEvent).detail.id });
  window.addEventListener('dx:mount', onMount);
  window.addEventListener('dx:unmount', onUnmount);
  return {
    log,
    assertStrict: () => {
      let active: string | null = null;
      for (const entry of log) {
        if (entry.type === 'mount') {
          expect(active).toBeNull();
          active = entry.id;
        } else {
          expect(active).toBe(entry.id);
          active = null;
        }
      }
    },
    cleanup: () => {
      window.removeEventListener('dx:mount', onMount);
      window.removeEventListener('dx:unmount', onUnmount);
    },
  };
}

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
const dappOptional: DappManifest = {
  id: 'opt',
  name: 'Optional',
  version: '0.0.1',
  route: '/opt',
  entry: '/dapps/opt/app.js',
  nav: { label: 'Optional' },
  optional: true,
};

describe('stress: concurrency & mount races (TEST-01, D-01/D-02/D-03)', () => {
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

  it('rapid A -> B -> A: last-navigation-wins, no double-mount, strict alternation, DOM matches the winner', async () => {
    const dappATpl: DappManifest = { ...dappA, template: '/dapps/a/tpl.html' };
    const dappBTpl: DappManifest = { ...dappB, template: '/dapps/b/tpl.html' };
    const templateGate = keyedGate<string>();
    const scriptGate = keyedGate<void>();
    const templateLoader: TemplateLoader = (src) => templateGate.loader(src);
    const scriptLoader: ScriptLoader = (src) => scriptGate.loader(src);

    shell = createShell({
      lifecycle: { scriptLoader, styleLoader: async () => {}, templateLoader },
      mode: 'history',
      manifests: [dappATpl, dappBTpl],
    });
    await shell.init();

    const alternation = recordAlternation();

    shell.navigate('/a');
    await tick(); // A's mount suspends at the template gate

    shell.navigate('/b');
    await tick(); // B's mount suspends at the template gate

    shell.navigate('/a');
    await tick(); // second A mount registers its own waiter for the same template key

    // Release out of navigation order: B first, then A (resolves BOTH pending A template waiters).
    templateGate.release('/dapps/b/tpl.html', '<div data-dapp="b">B content</div>');
    await tick();
    templateGate.release('/dapps/a/tpl.html', '<div data-dapp="a">A content</div>');
    await tick();

    // Only the winning (third) A mount ever reaches the entry-script gate.
    scriptGate.release('/dapps/a/app.js', undefined);
    await tick();

    expect(shell.getCurrentRoute()).toBe('/a');
    expect(alternation.log.filter((e) => e.type === 'mount' && e.id === 'a')).toHaveLength(1);
    expect(alternation.log.some((e) => e.id === 'b')).toBe(false);
    alternation.assertStrict();
    expect(container.innerHTML).toContain('data-dapp="a"');
    expect(container.innerHTML).not.toContain('data-dapp="b"');

    alternation.cleanup();
  });

  it('disableDapp() while that dapp is mid-mount abandons it — no dx:mount, no dx:dapp:mounted, currentDappId never set to it (D-03 scenario 1)', async () => {
    const scriptGate = keyedGate<void>();
    shell = createShell({
      lifecycle: { scriptLoader: (src) => scriptGate.loader(src), styleLoader: async () => {} },
      mode: 'history',
      manifests: [dappOptional],
    });
    await shell.init();

    const mounts = countMounts('opt');
    const mountedDapp = vi.fn();
    window.addEventListener('dx:dapp:mounted', mountedDapp);

    shell.navigate('/opt');
    await tick(); // mountDapp('opt') suspends at the entry-script gate

    shell.disableDapp('opt'); // must abandon the in-flight mount (invalidatePendingMount)

    scriptGate.release('/dapps/opt/app.js', undefined);
    await tick();

    expect(mounts.count()).toBe(0);
    expect(mountedDapp).not.toHaveBeenCalled();
    expect(shell.isDappEnabled('opt')).toBe(false);

    mounts.cleanup();
    window.removeEventListener('dx:dapp:mounted', mountedDapp);
  });

  it('navigate to an unmatched route while a dapp mount is in flight abandons it — no dx:mount, empty container, no dx:route:subpath (CR-01/D-01)', async () => {
    const dappATpl: DappManifest = { ...dappA, template: '/dapps/a/tpl.html' };
    const templateGate = keyedGate<string>();
    const templateLoader: TemplateLoader = (src) => templateGate.loader(src);

    shell = createShell({
      lifecycle: { scriptLoader: async () => {}, styleLoader: async () => {}, templateLoader },
      mode: 'history',
      manifests: [dappATpl],
    });
    await shell.init();

    const mounts = countMounts('a');
    const subpathEvents: { id: string; path: string; previousPath: string }[] = [];
    const onSubpath = ((e: CustomEvent) => subpathEvents.push(e.detail)) as EventListener;
    window.addEventListener('dx:route:subpath', onSubpath);

    shell.navigate('/a');
    await tick(); // A's mount suspends at the held template gate, container still empty

    shell.navigate('/nowhere'); // no manifest matches — drives handleRouteChange(null)
    await tick();

    // Release the held template — the now-stale A mount must hit its isStale() gate and
    // return before writing to the container.
    templateGate.release('/dapps/a/tpl.html', '<div data-dapp="a">A content</div>');
    await tick();

    expect(mounts.count()).toBe(0);
    expect(container.innerHTML).toBe('');
    expect(subpathEvents).toHaveLength(0);
    expect(shell.getCurrentRoute()).toBe('/nowhere');

    mounts.cleanup();
    window.removeEventListener('dx:route:subpath', onSubpath);
  });

  it('A->B overlap where stale A settles first, then an unmatched-route navigation abandons the still-in-flight B (CR-01 reopened/D-01)', async () => {
    const scriptGate = keyedGate<void>();
    const scriptLoader: ScriptLoader = (src) => scriptGate.loader(src);

    shell = createShell({
      lifecycle: { scriptLoader, styleLoader: async () => {} },
      mode: 'history',
      manifests: [dappA, dappB],
    });
    await shell.init();

    const mountsA = countMounts('a');
    const mountsB = countMounts('b');
    const mountedDapp = vi.fn();
    window.addEventListener('dx:dapp:mounted', mountedDapp);
    const alternation = recordAlternation();

    shell.navigate('/a');
    await tick(); // A's mount suspends at the held entry-script gate (pendingMountId='a')

    shell.navigate('/b');
    await tick(); // B supersedes A and suspends at the held entry-script gate (pendingMountId='b')

    scriptGate.release('/dapps/a/app.js', undefined);
    await tick(); // A resumes stale, hits isStale() and returns; guarded finally leaves pendingMountId='b'

    shell.navigate('/nowhere'); // no manifest matches — drives handleRouteChange(null)
    await tick(); // must invalidateAnyPendingMount() and bump the generation so B goes stale

    scriptGate.release('/dapps/b/app.js', undefined);
    await tick(); // B resumes stale, hits its final isStale() gate and returns before committing

    expect(mountsB.count()).toBe(0);
    expect(mountsA.count()).toBe(0);
    expect(mountedDapp).not.toHaveBeenCalled();
    expect(shell.getCurrentRoute()).toBe('/nowhere');
    alternation.assertStrict();

    mountsA.cleanup();
    mountsB.cleanup();
    window.removeEventListener('dx:dapp:mounted', mountedDapp);
    alternation.cleanup();
  });

  describe('load timeout races navigation (fake timers)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('a load timeout firing after navigate-away does not clear the new dapp DOM or misattribute dx:error (D-03 scenario 2)', async () => {
      const dappATpl: DappManifest = { ...dappA, template: '/dapps/a/tpl.html' };
      const dappBTpl: DappManifest = { ...dappB, template: '/dapps/b/tpl.html' };
      const templateContents: Record<string, string> = {
        '/dapps/a/tpl.html': '<div data-dapp="a">A content</div>',
        '/dapps/b/tpl.html': '<div data-dapp="b">B content</div>',
      };
      const templateLoader: TemplateLoader = async (src) => templateContents[src] ?? '';
      const neverResolves = () => new Promise<void>(() => {});
      const scriptLoader: ScriptLoader = (src) => (src === dappA.entry ? neverResolves() : Promise.resolve());

      shell = createShell({
        lifecycle: { scriptLoader, styleLoader: async () => {}, templateLoader, timeout: 20 },
        mode: 'history',
        manifests: [dappATpl, dappBTpl],
      });
      await shell.init();

      const errors: { source: string }[] = [];
      window.addEventListener('dx:error', ((e: CustomEvent) => errors.push(e.detail)) as EventListener);

      shell.navigate('/a'); // A's entry load hangs forever
      await vi.advanceTimersByTimeAsync(0); // flush A's template resolve, reach the entry hang

      shell.navigate('/b'); // B mounts fully before A's timeout ever fires
      await vi.advanceTimersByTimeAsync(0);

      // Advance past A's 20ms entry-script timeout — it must fire into a now-stale mount.
      await vi.advanceTimersByTimeAsync(20);

      expect(shell.getCurrentRoute()).toBe('/b');
      expect(container.innerHTML).toContain('data-dapp="b"');
      expect(container.innerHTML).not.toContain('data-dapp="a"');
      expect(errors.some((e) => e.source.startsWith('lifecycle:a'))).toBe(false);
    });
  });

  it('sub-path navigation into A while A is still mounting commits with the freshest path, not the stale first path (D-03 scenario 3)', async () => {
    const scriptGate = keyedGate<void>();
    shell = createShell({
      lifecycle: { scriptLoader: (src) => scriptGate.loader(src), styleLoader: async () => {} },
      mode: 'history',
      manifests: [dappA],
    });
    await shell.init();

    const subpathEvents: { id: string; path: string; previousPath: string }[] = [];
    const onSubpath = ((e: CustomEvent) => subpathEvents.push(e.detail)) as EventListener;
    window.addEventListener('dx:route:subpath', onSubpath);

    shell.navigate('/a'); // A's entry load pending
    await tick();

    shell.navigate('/a/sub'); // dropped by the same-dapp pendingMountId dedupe while A is in flight

    scriptGate.release('/dapps/a/app.js', undefined);
    await tick();

    expect(shell.getCurrentRoute()).toBe('/a/sub');
    expect(subpathEvents).toHaveLength(1);
    expect(subpathEvents[0]).toEqual({ id: 'a', path: '/a/sub', previousPath: '/a' });

    window.removeEventListener('dx:route:subpath', onSubpath);
  });

  it("shell.init()'s initial-route mount races an immediate first navigation — last-navigation-wins (D-03 scenario 4)", async () => {
    window.history.replaceState(null, '', '/a'); // initial URL resolves to dapp A on init()
    const scriptGate = keyedGate<void>();

    shell = createShell({
      lifecycle: { scriptLoader: (src) => scriptGate.loader(src), styleLoader: async () => {} },
      mode: 'history',
      manifests: [dappA, dappB],
    });

    const mountsA = countMounts('a');
    const mountsB = countMounts('b');

    const initPromise = shell.init(); // begins mounting A (held) as the initial route
    await tick(); // let init() progress past manifest loading and reach the held entry-script await

    shell.navigate('/b'); // fires before init's initial A mount ever commits
    await tick();

    scriptGate.release('/dapps/a/app.js', undefined);
    scriptGate.release('/dapps/b/app.js', undefined);
    await tick();
    await initPromise;

    expect(shell.getCurrentRoute()).toBe('/b');
    expect(mountsA.count()).toBe(0);
    expect(mountsB.count()).toBe(1);

    mountsA.cleanup();
    mountsB.cleanup();
  });
});

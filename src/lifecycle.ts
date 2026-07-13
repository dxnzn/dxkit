import type { DappManifest, EventBus } from './types/index.js';

export interface LifecycleManager {
  mount(manifest: DappManifest, container: HTMLElement, path?: string): Promise<void>;
  unmount(): void;
  getCurrentDapp(): string | null;
  destroy(): void;
  /** Drop every cached template, forcing the next mount of any dapp to refetch its template. */
  clearTemplateCache(): void;
  /** Drop a single cached template by its manifest-declared URL, forcing that one to refetch. */
  invalidateTemplate(url: string): void;
  /**
   * Abandon an in-flight (not-yet-committed) mount for `id` — closes the disable-mid-flight
   * gap where the shell revokes access to a dapp whose mount hasn't reached currentDappId yet.
   */
  invalidatePendingMount(id: string): void;
}

export type ScriptLoader = (src: string) => Promise<void>;
export type StyleLoader = (href: string) => Promise<void>;
export type TemplateLoader = (src: string) => Promise<string>;
/**
 * Bring-your-own template sanitizer (e.g. DOMPurify). Called with the fetched template HTML
 * and the mounting manifest, and awaited before injection — the `string | Promise<string>`
 * return accommodates both sync (DOMPurify) and async (dynamically-imported/policy-driven)
 * implementations (D-01).
 */
export type TemplateSanitizer = (html: string, manifest: DappManifest) => string | Promise<string>;

/** `timeout: 0` or `Infinity` is the documented opt-out that restores hang-forever behavior (D-03). */
function isTimeoutActive(timeoutMs: number): boolean {
  return timeoutMs > 0 && Number.isFinite(timeoutMs);
}

/**
 * Wraps an opaque custom loader with a hang guard. Unlike the built-in loaders, a custom
 * loader's in-flight work can't be truly cancelled — the timeout only abandons the wait;
 * the underlying promise keeps running in the background (D-07). The timer is cleared as
 * soon as the loader settles either way, so a fast-resolving loader doesn't leave a stray
 * timer running for the rest of `timeoutMs`.
 */
function withTimeout<R>(
  loader: (arg: string) => Promise<R>,
  timeoutMs: number,
  label: string,
): (arg: string) => Promise<R> {
  if (!isTimeoutActive(timeoutMs)) return loader;

  return (arg: string) =>
    new Promise<R>((resolve, reject) => {
      // Clear on settle so a resolved/rejected custom loader doesn't leave a ~timeoutMs
      // timer running for the rest of the tab's life (WR-01) — matches the clear-on-settle
      // discipline the default loaders already follow.
      const timer = setTimeout(() => {
        reject(new Error(`Timed out loading dapp ${label} after ${timeoutMs}ms: ${arg}`));
      }, timeoutMs);

      loader(arg).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
}

/**
 * Bounds the opaque, consumer-supplied sanitizer with the same hang guard used for custom
 * loaders (D-07) — a never-settling sanitizeTemplate would otherwise reintroduce the
 * mount-forever hang that Phase 2's timeout machinery eliminated for loaders. A timeout
 * rejection flows into the mount's existing sanitize catch, so it fails closed exactly like a
 * sanitizer throw. Honors the timeout: 0/Infinity opt-out (D-03) via isTimeoutActive.
 */
function withSanitizeTimeout(sanitizer: TemplateSanitizer, timeoutMs: number): TemplateSanitizer {
  if (!isTimeoutActive(timeoutMs)) return sanitizer;

  return (html: string, manifest: DappManifest) =>
    new Promise<string>((resolve, reject) => {
      // Clear on settle (WR-01 discipline) so a resolved/rejected sanitizer doesn't leave a
      // stray timer running for the rest of timeoutMs.
      const timer = setTimeout(() => {
        reject(new Error(`Timed out sanitizing dapp template after ${timeoutMs}ms: ${manifest.id}`));
      }, timeoutMs);

      Promise.resolve(sanitizer(html, manifest)).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
}

/** Default script loader — injects a <script type="module"> into the DOM. */
function defaultScriptLoader(timeoutMs: number): ScriptLoader {
  const loaded = new Set<string>();

  return (src: string) => {
    if (loaded.has(src)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = src;

      let timer: ReturnType<typeof setTimeout> | undefined;

      script.onload = () => {
        if (timer) clearTimeout(timer);
        loaded.add(src);
        resolve();
      };
      script.onerror = () => {
        if (timer) clearTimeout(timer);
        reject(new Error(`Failed to load dapp script: ${src}`));
      };

      document.head.appendChild(script);

      if (isTimeoutActive(timeoutMs)) {
        timer = setTimeout(() => {
          // True abort (D-06): null the handlers and remove the node so a late-arriving
          // load/error event can't fire into an already-cleared or next dapp.
          script.onload = null;
          script.onerror = null;
          script.remove();
          reject(new Error(`Timed out loading dapp script after ${timeoutMs}ms: ${src}`));
        }, timeoutMs);
      }
    });
  };
}

/** Default style loader — injects a <link rel="stylesheet"> into the DOM. */
function defaultStyleLoader(timeoutMs: number): StyleLoader {
  const loaded = new Set<string>();

  return (href: string) => {
    if (loaded.has(href)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;

      let timer: ReturnType<typeof setTimeout> | undefined;

      link.onload = () => {
        if (timer) clearTimeout(timer);
        loaded.add(href);
        resolve();
      };
      link.onerror = () => {
        if (timer) clearTimeout(timer);
        reject(new Error(`Failed to load dapp styles: ${href}`));
      };

      document.head.appendChild(link);

      if (isTimeoutActive(timeoutMs)) {
        timer = setTimeout(() => {
          // True abort (D-06): null the handlers and remove the node so a late-arriving
          // load/error event can't fire into an already-cleared or next dapp.
          link.onload = null;
          link.onerror = null;
          link.remove();
          reject(new Error(`Timed out loading dapp styles after ${timeoutMs}ms: ${href}`));
        }, timeoutMs);
      }
    });
  };
}

export interface LifecycleManagerOptions {
  /** Override the script loader (useful for testing). */
  scriptLoader?: ScriptLoader;
  /** Override the style loader (useful for testing). */
  styleLoader?: StyleLoader;
  /** Override the template loader (useful for testing). */
  templateLoader?: TemplateLoader;
  /** Check if a named plugin is registered. Used for permission enforcement. */
  hasPlugin?: (name: string) => boolean;
  /**
   * Per-fetch load timeout in milliseconds for style/template/script loads. Default 30000.
   * Pass `0` or `Infinity` to disable and restore hang-forever behavior — the escape hatch
   * for legitimately-slow IPFS gateways (D-03).
   */
  timeout?: number;
  /**
   * Cache fetched dapp templates by URL so repeated mounts of the same dapp skip the fetch.
   * Default true — safe for the content-addressed/immutable IPFS/static target. Set false for
   * dev/live-editing so template edits are picked up without an explicit invalidation call.
   */
  cacheTemplates?: boolean;
  /**
   * Runs on fetched template HTML immediately before it is written to the mount container,
   * on every mount (including cache hits) — DxKit ships no built-in sanitizer, this is a
   * bring-your-own seam (DOMPurify or equivalent). Applies to template HTML only; dapp entry
   * scripts are trusted code outside its reach (D-14). With no sanitizer configured, injection
   * is unchanged from 0.1.5. A throw or rejection aborts the mount (D-07).
   */
  sanitizeTemplate?: TemplateSanitizer;
}

/** Default template loader — fetches HTML via fetch(). */
function defaultTemplateLoader(timeoutMs: number): TemplateLoader {
  return async (src: string) => {
    if (!isTimeoutActive(timeoutMs)) {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`Failed to load dapp template: ${src} (${res.status})`);
      return res.text();
    }

    // True abort (D-06): a real AbortController cancels the in-flight fetch, unlike the
    // Promise.race fallback used for opaque custom loaders.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(src, { signal: controller.signal });
      if (!res.ok) throw new Error(`Failed to load dapp template: ${src} (${res.status})`);
      return await res.text();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Timed out loading dapp template after ${timeoutMs}ms: ${src}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
}

export function createLifecycleManager(events: EventBus, options: LifecycleManagerOptions = {}): LifecycleManager {
  const timeoutMs = options.timeout ?? 30000;
  const loadScript = options.scriptLoader
    ? withTimeout(options.scriptLoader, timeoutMs, 'script')
    : defaultScriptLoader(timeoutMs);
  const loadStyle = options.styleLoader
    ? withTimeout(options.styleLoader, timeoutMs, 'styles')
    : defaultStyleLoader(timeoutMs);
  const loadTemplateUncached = options.templateLoader
    ? withTimeout(options.templateLoader, timeoutMs, 'template')
    : defaultTemplateLoader(timeoutMs);
  const hasPlugin = options.hasPlugin ?? (() => true);
  // undefined means "pass through unchanged" — no `??` default, unlike timeoutMs/cacheEnabled above.
  const sanitizeTemplate = options.sanitizeTemplate
    ? withSanitizeTimeout(options.sanitizeTemplate, timeoutMs)
    : undefined;
  let currentDappId: string | null = null;
  // Generalizes shell.ts's same-dapp pendingMountId dedupe to cross-dapp supersession (D-01/D-04):
  // each mount() call captures the generation at its own commit points, so only the single
  // still-current call at each gate can ever reach currentDappId/dx:mount. Both live in this
  // closure, never at module scope — multiple shells in one process must not share a counter.
  let mountGeneration = 0;
  let inFlightMountId: string | null = null;

  // Cache wraps OUTERMOST, above the timeout-wrapped loader (D-11/D-12): a cache hit returns
  // immediately and never touches the fetch or its timeout. Only successful fetches are stored —
  // failures/timeouts reject through without caching. Keyed by the manifest URL verbatim.
  const cacheEnabled = options.cacheTemplates ?? true;
  const templateCache = new Map<string, string>();

  async function loadTemplate(url: string): Promise<string> {
    if (!cacheEnabled) return loadTemplateUncached(url);

    const cached = templateCache.get(url);
    if (cached !== undefined) return cached;

    const html = await loadTemplateUncached(url);
    templateCache.set(url, html);
    return html;
  }

  async function mount(manifest: DappManifest, container: HTMLElement, path?: string): Promise<void> {
    // Captured once per call; every gate below re-checks isStale() against the live counter so
    // only the single most-recently-started mount can ever reach a commit point (D-01).
    const generation = ++mountGeneration;
    inFlightMountId = manifest.id;
    const isStale = () => generation !== mountGeneration;

    // Unmount current dapp if any — safe unguarded: nothing async has happened yet, so this
    // call is by definition still the current generation.
    if (currentDappId) {
      unmount();
    }

    // requires.plugins lists required plugin names — missing plugin → dx:error, skip mount
    if (manifest.requires?.plugins?.length) {
      const missing = manifest.requires.plugins.filter((p) => !hasPlugin(p));
      if (missing.length > 0) {
        events.emit('dx:error', {
          source: `lifecycle:${manifest.id}`,
          error: new Error(`Missing required plugin(s): ${missing.join(', ')}`),
        });
        inFlightMountId = null;
        return;
      }
    }

    // CSS failures are non-blocking — emit error but continue mount
    if (manifest.styles) {
      try {
        await loadStyle(manifest.styles);
      } catch (err) {
        // A superseded mount's own style failure isn't worth reporting — the newer mount
        // already owns the container/currentDappId by the time this settles.
        if (!isStale()) {
          events.emit('dx:error', {
            source: `lifecycle:${manifest.id}:styles`,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    }

    // Template fetch is blocking — the dapp expects a populated container
    if (manifest.template) {
      let html: string;
      try {
        html = await loadTemplate(manifest.template);
      } catch (err) {
        if (!isStale()) {
          events.emit('dx:error', {
            source: `lifecycle:${manifest.id}:template`,
            error: err instanceof Error ? err : new Error(String(err)),
          });
          inFlightMountId = null;
        }
        return;
      }
      // Re-check immediately before the DOM write (Pitfall 1) — a stale mount must never
      // inject its template into a container the newer mount now owns.
      if (isStale()) return;

      // Sanitize step gets its own try/catch (D-08) so its failure source is distinguishable
      // from a fetch failure. No sanitizer configured → html passes through unchanged (0.1.5
      // default behavior). Runs after loadTemplate() every time, including cache hits — the
      // templateCache never stores sanitized output (D-06).
      if (sanitizeTemplate) {
        let sanitized: string;
        try {
          sanitized = await sanitizeTemplate(html, manifest);
        } catch (err) {
          if (!isStale()) {
            events.emit('dx:error', {
              source: `lifecycle:${manifest.id}:sanitize`,
              error: err instanceof Error ? err : new Error(String(err), { cause: err }),
            });
            inFlightMountId = null;
          }
          return;
        }
        if (isStale()) return; // re-check again — the sanitize await is another commit gate
        container.innerHTML = sanitized;
      } else {
        container.innerHTML = html;
      }
    }

    // Load dependency scripts before entry — sequential to preserve order
    if (manifest.dependencies?.length) {
      for (const dep of manifest.dependencies) {
        try {
          await loadScript(dep);
        } catch (err) {
          if (!isStale()) {
            events.emit('dx:error', {
              source: `lifecycle:${manifest.id}:dependency`,
              error: err instanceof Error ? err : new Error(String(err)),
            });
            // Post-injection failure — clear any template HTML so no stale dapp DOM remains addressable.
            container.innerHTML = '';
            inFlightMountId = null;
          }
          return;
        }
        if (isStale()) return; // superseded mid-loop — don't load further deps for a dead mount
      }
    }

    // Entry scripts load as ES modules
    try {
      await loadScript(manifest.entry);
    } catch (err) {
      if (!isStale()) {
        events.emit('dx:error', {
          source: `lifecycle:${manifest.id}`,
          error: err instanceof Error ? err : new Error(String(err)),
        });
        // Post-injection failure — clear any template HTML so no stale dapp DOM remains addressable.
        container.innerHTML = '';
        inFlightMountId = null;
      }
      return;
    }
    if (isStale()) return; // final gate before commit

    currentDappId = manifest.id;
    inFlightMountId = null;

    // Dapp contract: listen for dx:mount on container, render into it, listen for dx:unmount to teardown
    events.emit('dx:mount', { id: manifest.id, container, path: path ?? manifest.route });
    events.emit('dx:dapp:mounted', { id: manifest.id });
  }

  function unmount(): void {
    if (!currentDappId) return;

    const id = currentDappId;
    events.emit('dx:unmount', { id });
    events.emit('dx:dapp:unmounted', { id });
    currentDappId = null;
  }

  function getCurrentDapp(): string | null {
    return currentDappId;
  }

  function destroy(): void {
    if (currentDappId) unmount();
  }

  function clearTemplateCache(): void {
    templateCache.clear();
  }

  function invalidateTemplate(url: string): void {
    templateCache.delete(url);
  }

  function invalidatePendingMount(id: string): void {
    // Bumping the generation makes the in-flight mount's own isStale() gate fail at its next
    // check — a no-op if `id` isn't the currently in-flight mount (already superseded or
    // already committed, in which case getCurrentDapp()/unmount() is the right tool instead).
    if (inFlightMountId === id) {
      mountGeneration++;
    }
  }

  return {
    mount,
    unmount,
    getCurrentDapp,
    destroy,
    clearTemplateCache,
    invalidateTemplate,
    invalidatePendingMount,
  };
}

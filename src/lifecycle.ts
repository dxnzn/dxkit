import type { DappManifest, EventBus } from './types/index.js';

export interface LifecycleManager {
  mount(manifest: DappManifest, container: HTMLElement, path?: string): Promise<void>;
  unmount(): void;
  getCurrentDapp(): string | null;
  destroy(): void;
}

export type ScriptLoader = (src: string) => Promise<void>;
export type StyleLoader = (href: string) => Promise<void>;

/** Default script loader — injects a <script type="module"> into the DOM. */
function defaultScriptLoader(): ScriptLoader {
  const loaded = new Set<string>();

  return (src: string) => {
    if (loaded.has(src)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = src;
      script.onload = () => {
        loaded.add(src);
        resolve();
      };
      script.onerror = () => {
        reject(new Error(`Failed to load dapp script: ${src}`));
      };
      document.head.appendChild(script);
    });
  };
}

/** Default style loader — injects a <link rel="stylesheet"> into the DOM. */
function defaultStyleLoader(): StyleLoader {
  const loaded = new Set<string>();

  return (href: string) => {
    if (loaded.has(href)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => {
        loaded.add(href);
        resolve();
      };
      link.onerror = () => {
        reject(new Error(`Failed to load dapp styles: ${href}`));
      };
      document.head.appendChild(link);
    });
  };
}

export interface LifecycleManagerOptions {
  /** Override the script loader (useful for testing). */
  scriptLoader?: ScriptLoader;
  /** Override the style loader (useful for testing). */
  styleLoader?: StyleLoader;
  /** Check if a named plugin is registered. Used for permission enforcement. */
  hasPlugin?: (name: string) => boolean;
}

export function createLifecycleManager(events: EventBus, options: LifecycleManagerOptions = {}): LifecycleManager {
  const loadScript = options.scriptLoader ?? defaultScriptLoader();
  const loadStyle = options.styleLoader ?? defaultStyleLoader();
  const hasPlugin = options.hasPlugin ?? (() => true);
  let currentDappId: string | null = null;

  async function mount(manifest: DappManifest, container: HTMLElement, path?: string): Promise<void> {
    // Unmount current dapp if any
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
        return;
      }
    }

    // CSS failures are non-blocking — emit error but continue mount
    if (manifest.styles) {
      try {
        await loadStyle(manifest.styles);
      } catch (err) {
        events.emit('dx:error', {
          source: `lifecycle:${manifest.id}:styles`,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }

    // Entry scripts load as ES modules
    try {
      await loadScript(manifest.entry);
    } catch (err) {
      events.emit('dx:error', {
        source: `lifecycle:${manifest.id}`,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return;
    }

    currentDappId = manifest.id;

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

  return { mount, unmount, getCurrentDapp, destroy };
}

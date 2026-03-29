import type { DappManifest } from './types/index.js';

export interface Router {
  resolve(path: string): DappManifest | null;
  navigate(path: string): void;
  getCurrentPath(): string;
  onRouteChange(handler: (manifest: DappManifest | null) => void): () => void;
  destroy(): void;
}

export interface RouterConfig {
  mode: 'history' | 'hash';
  basePath: string;
  manifests: DappManifest[];
}

export function createRouter(config: RouterConfig): Router {
  const { mode, basePath, manifests } = config;
  const listeners = new Set<(manifest: DappManifest | null) => void>();

  // Strip basePath prefix, ensure leading slash, remove trailing slash
  function normalizePath(path: string): string {
    let normalized = path;
    if (basePath !== '/' && normalized.startsWith(basePath)) {
      normalized = normalized.slice(basePath.length) || '/';
    }
    // Ensure leading slash
    if (!normalized.startsWith('/')) normalized = `/${normalized}`;
    // Remove trailing slash (except root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  function resolve(path: string): DappManifest | null {
    const normalized = normalizePath(path);

    // Longest prefix wins — /tools/sender matches before /tools
    const sorted = [...manifests].sort((a, b) => b.route.length - a.route.length);

    for (const manifest of sorted) {
      if (normalized === manifest.route || normalized.startsWith(`${manifest.route}/`)) {
        return manifest;
      }
    }

    return null;
  }

  function readCurrentPath(): string {
    if (mode === 'hash') {
      const hash = window.location.hash.slice(1); // strip '#'
      return hash || '/';
    }
    return window.location.pathname;
  }

  function getCurrentPath(): string {
    return normalizePath(readCurrentPath());
  }

  function navigate(path: string): void {
    const fullPath = basePath === '/' ? path : basePath + path;

    if (mode === 'hash') {
      window.location.hash = `#${fullPath}`;
    } else {
      window.history.pushState(null, '', fullPath);
    }

    notifyListeners();
  }

  function notifyListeners(): void {
    const manifest = resolve(readCurrentPath());
    for (const handler of listeners) {
      handler(manifest);
    }
  }

  function onRouteChange(handler: (manifest: DappManifest | null) => void): () => void {
    listeners.add(handler);
    return () => listeners.delete(handler);
  }

  // Listen for browser navigation (back/forward)
  const onPopState = () => notifyListeners();
  window.addEventListener('popstate', onPopState);

  // Hash mode also needs hashchange
  const onHashChange = mode === 'hash' ? () => notifyListeners() : null;
  if (onHashChange) {
    window.addEventListener('hashchange', onHashChange);
  }

  function destroy(): void {
    window.removeEventListener('popstate', onPopState);
    if (onHashChange) {
      window.removeEventListener('hashchange', onHashChange);
    }
    listeners.clear();
  }

  return { resolve, navigate, getCurrentPath, onRouteChange, destroy };
}

import type { Plugin } from './interfaces.js';
import type { DappManifest } from './manifest.js';

/** A dapp entry in the shell config — path to manifest.json plus optional overrides. */
export interface DappEntry {
  /** Path to the dapp's manifest.json (fetched at init). */
  manifest: string;
  /** Partial overrides deep-merged on top of the fetched manifest. */
  overrides?: Partial<DappManifest>;
}

/** Configuration passed to createShell(). */
export interface ShellConfig {
  /** Named plugin instances. */
  plugins?: Record<string, Plugin>;
  /** Dapp entries — each points to a manifest.json with optional overrides. */
  dapps?: DappEntry[];
  /** Inline manifests (fully specified, no fetch). Takes precedence over registry.json. */
  manifests?: DappManifest[];
  /** URL to fetch registry.json from. Default: '/registry.json'. */
  registryUrl?: string;
  /** Base path for routing. Default: '/'. */
  basePath?: string;
  /** Routing mode. Default: 'history'. */
  mode?: 'history' | 'hash';
  /** Override the script loader (useful for testing). */
  scriptLoader?: (src: string) => Promise<void>;
  /** Override the style loader (useful for testing). */
  styleLoader?: (href: string) => Promise<void>;
  /** Override the template loader (useful for testing). */
  templateLoader?: (src: string) => Promise<string>;
}

/** The shell instance returned by createShell(). */
export interface Shell {
  /** Initialize plugins, load manifests, resolve initial route. */
  init(): Promise<void>;
  /** Retrieve a registered plugin by name. */
  getPlugin<T extends Plugin>(name: string): T | undefined;
  /** Get all loaded dapp manifests. */
  getManifests(): DappManifest[];
  /** Get only enabled dapp manifests. */
  getEnabledManifests(): DappManifest[];
  /** Enable an optional dapp by ID. */
  enableDapp(id: string): void;
  /** Disable an optional dapp by ID. */
  disableDapp(id: string): void;
  /** Check whether a dapp is currently enabled. */
  isDappEnabled(id: string): boolean;
  /** Navigate to a path. */
  navigate(path: string): void;
  /** Get the current resolved route path. */
  getCurrentRoute(): string;
  /** Tear down the shell — destroy plugins, remove listeners. */
  destroy(): void;
}

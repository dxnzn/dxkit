import type { EventBus, EventRegistry } from './events.js';
import type { Plugin } from './interfaces.js';
import type { DappManifest } from './manifest.js';
import type { Settings } from './settings.js';

/** The public surface area dapps interact with via window.__DXKIT__. */
export interface Context {
  /** DxKit event bus for typed pub/sub. */
  events: EventBus;

  /** Event registration for plugins and dapps. */
  eventRegistry: EventRegistry;

  /** Router — navigate and read current path. */
  router: {
    navigate: (path: string) => void;
    getCurrentPath: () => string;
  };

  /** Retrieve a registered plugin by name. */
  getPlugin: <T extends Plugin>(name: string) => T | undefined;

  /** Get all registered plugins as a name→plugin map. */
  getPlugins: () => Record<string, Plugin>;

  /** Get all loaded dapp manifests. */
  getManifests: () => DappManifest[];

  /** Get only enabled dapp manifests (respects optional/enabled state). */
  getEnabledManifests: () => DappManifest[];

  /** Enable an optional dapp by ID. No-op if already enabled or not optional. */
  enableDapp: (id: string) => void;

  /** Disable an optional dapp by ID. No-op if already disabled or not optional. */
  disableDapp: (id: string) => void;

  /** Check whether a dapp is currently enabled. Non-optional dapps always return true. */
  isDappEnabled: (id: string) => boolean;

  /** Injected at runtime by settings plugin if registered. */
  settings?: Settings;
}

declare global {
  interface Window {
    __DXKIT__?: Context;
  }
}

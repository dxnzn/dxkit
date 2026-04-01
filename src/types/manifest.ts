/** Declares a dapp's identity, routing, and navigation metadata. */
export interface DappManifest {
  // Identity
  /** Unique slug, e.g. 'token-sender'. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Short description of what this dapp does. */
  description?: string;
  /** Semver version string. */
  version: string;

  // Routing
  /** Path prefix this dapp owns, e.g. '/tools/token-sender'. */
  route: string;
  /** Compiled JS entry point, relative to dapp root. */
  entry: string;
  /** HTML template path, relative to dapp root. Injected into container before scripts load. */
  template?: string;
  /** Additional scripts loaded before the entry point (e.g. domain logic modules). */
  dependencies?: string[];
  /** CSS stylesheet path, relative to dapp root. Lazy-loaded on first mount. */
  styles?: string;

  // Navigation
  nav: {
    /** Menu text. */
    label: string;
    /** Icon identifier (SVG name, URL, or inline SVG). */
    icon?: string;
    /** Nav grouping, e.g. 'tools', 'defi', 'admin'. */
    group?: string;
    /** Sort order within group. */
    order?: number;
    /** Registered but not shown in nav. */
    hidden?: boolean;
  };

  // Requirements
  /** Declare what this dapp needs from the shell. */
  requires?: {
    /** Plugin names that must be registered before mount, e.g. ['wallet', 'auth']. */
    plugins?: string[];
  };

  // Settings
  /** Configurable settings declared by this dapp. */
  settings?: import('./settings.js').SettingDefinition[];

  // Enable/disable
  /** Whether the end-user can toggle this dapp on or off (default: false = always on). */
  optional?: boolean;
  /** Initial enabled state (default: true). Only meaningful when `optional` is true. */
  enabled?: boolean;

  // Development
  /** Whether this dapp can run outside the shell (default: true). */
  standalone?: boolean;
}

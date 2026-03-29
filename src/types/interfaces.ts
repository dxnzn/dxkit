import type { Context } from './context.js';
import type { SettingDefinition } from './settings.js';

// ---------------------------------------------------------------------------
// Plugin — base interface for all DxKit plugins
// ---------------------------------------------------------------------------

/** Base interface that all DxKit plugins implement. */
export interface Plugin {
  /** Unique name identifying this plugin in the registry. */
  readonly name: string;

  /** Called once during shell init with the DxKit context. */
  init?(context: Context): Promise<void>;

  /** Called on shell teardown for cleanup. */
  destroy?(): Promise<void>;

  /** Optional settings definitions — exposed via the settings plugin. */
  settings?: SettingDefinition[];
}

// ---------------------------------------------------------------------------
// Wallet interface
// ---------------------------------------------------------------------------

export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  /** Raw provider reference — intentionally loose, plugin decides the type. */
  provider: unknown;
}

export interface Wallet extends Plugin {
  /** Connect a wallet. Optionally specify a provider by ID. */
  connect(providerId?: string): Promise<WalletState>;
  disconnect(): Promise<void>;
  getState(): WalletState;
  sign(message: string): Promise<string>;
  onStateChange(handler: (state: WalletState) => void): () => void;
  /** Get all registered wallet providers. */
  getProviders(): WalletProvider[];
  /** Get the currently active provider (null if disconnected). */
  getActiveProvider(): WalletProvider | null;
}

// ---------------------------------------------------------------------------
// WalletProvider — pluggable wallet backend
// ---------------------------------------------------------------------------

/** Pluggable wallet backend. Implementations: EIP-1193, local dev, WalletConnect, etc. */
export interface WalletProvider {
  /** Unique provider ID, e.g. 'eip1193', 'local', 'walletconnect'. */
  readonly id: string;
  /** Human-readable name, e.g. 'Browser Wallet', 'Local (Dev)'. */
  readonly name: string;
  /** Whether this provider can work in the current environment. */
  available(): boolean;
  /** Connect and return the resulting wallet state. */
  connect(): Promise<WalletState>;
  /** Disconnect and clear state. */
  disconnect(): Promise<void>;
  /** Sign a message with the connected account. */
  sign(message: string): Promise<string>;
  /** Subscribe to state changes. Returns unsubscribe function. */
  onStateChange(handler: (state: WalletState) => void): () => void;
}

// ---------------------------------------------------------------------------
// Auth interface
// ---------------------------------------------------------------------------

export interface AuthState {
  authenticated: boolean;
  address: string | null;
  /** SIWE token, JWT, or null. */
  token: string | null;
  /** Unix timestamp, or null if no expiry. */
  expiresAt: number | null;
}

export interface Auth extends Plugin {
  authenticate(): Promise<AuthState>;
  deauthenticate(): Promise<void>;
  getState(): AuthState;
  isAuthenticated(): boolean;
  onStateChange(handler: (state: AuthState) => void): () => void;
}

// ---------------------------------------------------------------------------
// Theme interface
// ---------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme extends Plugin {
  /** Current mode setting (may be 'system'). */
  getMode(): ThemeMode;
  /** Set mode to light, dark, or system. */
  setMode(mode: ThemeMode): void;
  /** Cycle: system → light → dark → system. */
  toggleMode(): void;
  /** The resolved mode actually applied to the DOM ('light' or 'dark'). */
  getResolvedMode(): 'light' | 'dark';
  onModeChange(handler: (mode: ThemeMode, resolved: 'light' | 'dark') => void): () => void;

  /** Current theme name (e.g. 'default', 'cyberpunk'). */
  getTheme(): string;
  setTheme(theme: string): void;
  getAvailableThemes(): string[];
  onThemeChange(handler: (theme: string) => void): () => void;
}

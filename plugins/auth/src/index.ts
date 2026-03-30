import type { Auth, AuthState, Context, Wallet } from '@dnzn/dxkit';
import '@dnzn/dxkit-wallet';

declare module '@dnzn/dxkit' {
  interface EventMap {
    'dx:plugin:auth:authenticated': { address: string };
    'dx:plugin:auth:deauthenticated': Record<string, never>;
  }
}

export interface PassthroughAuthOptions {
  /** Name of the wallet plugin in the registry. Default: 'wallet'. */
  walletPlugin?: string;
}

/**
 * Creates a passthrough auth plugin.
 * Wallet connected = authenticated. No tokens, no sessions.
 */
export function createPassthroughAuth(options: PassthroughAuthOptions = {}): Auth {
  const { walletPlugin = 'wallet' } = options;

  let state: AuthState = {
    authenticated: false,
    address: null,
    token: null,
    expiresAt: null,
  };
  let dx: Context | null = null;
  let wallet: Wallet | null = null;
  let walletUnsub: (() => void) | null = null;
  const handlers = new Set<(state: AuthState) => void>();

  function updateState(updates: Partial<AuthState>): void {
    state = { ...state, ...updates };
    for (const handler of handlers) handler(state);
  }

  function syncFromWallet(ws: { connected: boolean; address: string | null }): void {
    if (ws.connected && ws.address) {
      updateState({ authenticated: true, address: ws.address });
      dx?.events.emit('dx:plugin:auth:authenticated', { address: ws.address });
    } else {
      updateState({ authenticated: false, address: null });
      dx?.events.emit('dx:plugin:auth:deauthenticated', {});
    }
  }

  const plugin: Auth = {
    name: 'auth',

    async init(context: Context): Promise<void> {
      dx = context;

      context.eventRegistry.registerEvent('auth', [
        { name: 'dx:plugin:auth:authenticated' },
        { name: 'dx:plugin:auth:deauthenticated' },
      ]);

      wallet = context.getPlugin<Wallet>(walletPlugin) ?? null;

      if (wallet) {
        // Sync initial state
        const ws = wallet.getState();
        if (ws.connected && ws.address) {
          state = { authenticated: true, address: ws.address, token: null, expiresAt: null };
        }

        // Listen for wallet changes
        walletUnsub = wallet.onStateChange(syncFromWallet);
      }
    },

    async destroy(): Promise<void> {
      if (walletUnsub) {
        walletUnsub();
        walletUnsub = null;
      }
      handlers.clear();
      wallet = null;
      dx = null;
    },

    async authenticate(): Promise<AuthState> {
      if (!wallet) {
        throw new Error('No wallet plugin registered — cannot authenticate');
      }

      // Delegates to wallet — onStateChange → syncFromWallet handles auth state + events
      await wallet.connect();
      return state;
    },

    async deauthenticate(): Promise<void> {
      if (wallet) {
        // wallet.disconnect() triggers onStateChange → syncFromWallet handles state + events
        await wallet.disconnect();
      } else {
        updateState({ authenticated: false, address: null, token: null, expiresAt: null });
        dx?.events.emit('dx:plugin:auth:deauthenticated', {});
      }
    },

    getState(): AuthState {
      return { ...state };
    },

    isAuthenticated(): boolean {
      return state.authenticated;
    },

    onStateChange(handler: (state: AuthState) => void): () => void {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };

  return plugin;
}

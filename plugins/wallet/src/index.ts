import type { Context, SettingDefinition, Wallet, WalletProvider, WalletState } from '@dnzn/dxkit';
import '@dnzn/dxkit-settings';

declare module '@dnzn/dxkit' {
  interface EventMap {
    'dx:plugin:wallet:connected': { address: string; chainId: number };
    'dx:plugin:wallet:disconnected': Record<string, never>;
    'dx:plugin:wallet:changed': { address: string; chainId: number };
  }
}

// ---------------------------------------------------------------------------
// EIP-1193 Provider — works with MetaMask, Brave, Coinbase, any injected wallet
// ---------------------------------------------------------------------------

/** Creates a wallet provider using the browser's injected EIP-1193 provider (window.ethereum). */
export function createEIP1193Provider(): WalletProvider {
  let state: WalletState = { connected: false, address: null, chainId: null, provider: null };
  const handlers = new Set<(state: WalletState) => void>();
  let accountsListener: ((accounts: string[]) => void) | null = null;
  let chainListener: ((chainIdHex: string) => void) | null = null;

  function getEthereumProvider(): any {
    return (window as any).ethereum;
  }

  function updateState(updates: Partial<WalletState>): void {
    state = { ...state, ...updates };
    for (const handler of handlers) handler(state);
  }

  return {
    id: 'eip1193',
    name: 'Browser Wallet',

    available(): boolean {
      return !!(window as any).ethereum;
    },

    async connect(): Promise<WalletState> {
      const provider = getEthereumProvider();
      if (!provider) {
        throw new Error('No wallet detected. Install MetaMask or another EIP-1193 wallet.');
      }

      const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
      const chainIdHex: string = await provider.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);

      updateState({ connected: true, address: accounts[0], chainId, provider });

      // MetaMask/injected wallets fire these when user switches account or chain externally
      accountsListener = (accts: string[]) => {
        if (accts.length === 0) {
          updateState({ connected: false, address: null, provider: null });
        } else {
          updateState({ connected: true, address: accts[0] });
        }
      };
      chainListener = (hex: string) => {
        updateState({ chainId: parseInt(hex, 16) });
      };
      provider.on?.('accountsChanged', accountsListener);
      provider.on?.('chainChanged', chainListener);

      return state;
    },

    async disconnect(): Promise<void> {
      const provider = getEthereumProvider();
      if (accountsListener) provider?.removeListener?.('accountsChanged', accountsListener);
      if (chainListener) provider?.removeListener?.('chainChanged', chainListener);
      accountsListener = null;
      chainListener = null;
      updateState({ connected: false, address: null, chainId: null, provider: null });
    },

    async sign(message: string): Promise<string> {
      const provider = getEthereumProvider();
      if (!provider || !state.address) throw new Error('Wallet not connected');
      return provider.request({ method: 'personal_sign', params: [message, state.address] });
    },

    onStateChange(handler: (state: WalletState) => void): () => void {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

// ---------------------------------------------------------------------------
// Local Wallet Provider — dev/ephemeral, instant connect, no external deps
// ---------------------------------------------------------------------------

export interface LocalWalletProviderOptions {
  /** Override the deterministic address. Default: '0x0000000000000000000000000000000001' */
  address?: string;
}

/** Creates a local dev wallet provider. Instant connect, deterministic address. */
export function createLocalWalletProvider(options?: LocalWalletProviderOptions): WalletProvider {
  const address = options?.address ?? '0x0000000000000000000000000000000001';
  let state: WalletState = { connected: false, address: null, chainId: null, provider: null };
  const handlers = new Set<(state: WalletState) => void>();

  function updateState(updates: Partial<WalletState>): void {
    state = { ...state, ...updates };
    for (const handler of handlers) handler(state);
  }

  return {
    id: 'local',
    name: 'Local (Dev)',

    available(): boolean {
      return true;
    },

    async connect(): Promise<WalletState> {
      updateState({ connected: true, address, chainId: 0, provider: null });
      return state;
    },

    async disconnect(): Promise<void> {
      updateState({ connected: false, address: null, chainId: null, provider: null });
    },

    async sign(message: string): Promise<string> {
      if (!state.connected) throw new Error('Wallet not connected');
      // Deterministic signature for dev: hex-encode the message
      const bytes = new TextEncoder().encode(message);
      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `0x${hex}`;
    },

    onStateChange(handler: (state: WalletState) => void): () => void {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

// ---------------------------------------------------------------------------
// Wallet Coordinator — the Context plugin that manages providers
// ---------------------------------------------------------------------------

export interface WalletOptions {
  /** Available wallet providers. First available is used by default. */
  providers: WalletProvider[];
}

const STORAGE_KEY = 'dxkit:wallet';

/** Creates the wallet Context plugin — a coordinator that delegates to pluggable providers. */
export function createWallet(options: WalletOptions): Wallet {
  const providers = options.providers;
  let activeProvider: WalletProvider | null = null;
  let activeUnsub: (() => void) | null = null;
  let dx: Context | null = null;

  let state: WalletState = { connected: false, address: null, chainId: null, provider: null };
  const handlers = new Set<(state: WalletState) => void>();

  function persistProvider(providerId: string | null): void {
    try {
      if (providerId) {
        localStorage.setItem(STORAGE_KEY, providerId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* localStorage unavailable */
    }
  }

  function getPersistedProvider(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function updateState(newState: WalletState): void {
    const wasConnected = state.connected;
    state = { ...newState };
    for (const handler of handlers) handler(state);

    if (!dx) return;
    if (newState.connected && !wasConnected) {
      dx.events.emit('dx:plugin:wallet:connected', { address: newState.address!, chainId: newState.chainId ?? 0 });
    } else if (!newState.connected && wasConnected) {
      dx.events.emit('dx:plugin:wallet:disconnected', {});
    } else if (newState.connected && wasConnected) {
      dx.events.emit('dx:plugin:wallet:changed', { address: newState.address!, chainId: newState.chainId ?? 0 });
    }
  }

  function getSetting(key: string, fallback: any): any {
    try {
      const settings = (dx as any)?.settings;
      if (settings) return settings.get('wallet', key) ?? fallback;
    } catch {
      /* settings plugin not available */
    }
    return fallback;
  }

  const plugin: Wallet = {
    name: 'wallet',

    settings: [
      {
        key: 'revokeOnDisconnect',
        label: 'Revoke on Disconnect',
        type: 'boolean',
        default: true,
        description:
          'Revoke wallet permissions when disconnecting. When enabled, reconnecting requires explicit wallet approval.',
      },
    ] satisfies SettingDefinition[],

    async init(context: Context): Promise<void> {
      dx = context;

      context.eventRegistry.registerEvent('wallet', [
        { name: 'dx:plugin:wallet:connected' },
        { name: 'dx:plugin:wallet:disconnected' },
        { name: 'dx:plugin:wallet:changed' },
      ]);

      // Restore previous wallet connection
      const savedId = getPersistedProvider();
      if (savedId) {
        const provider = providers.find((p) => p.id === savedId);
        if (provider?.available()) {
          try {
            await plugin.connect(savedId);
          } catch {
            // Provider no longer available — clear persisted state
            persistProvider(null);
          }
        }
      }
    },

    async destroy(): Promise<void> {
      if (activeUnsub) activeUnsub();
      activeUnsub = null;
      if (activeProvider) {
        await activeProvider.disconnect();
      }
      activeProvider = null;
      handlers.clear();
      dx = null;
    },

    async connect(providerId?: string): Promise<WalletState> {
      // Unsub before disconnect to avoid double-firing state change handlers
      if (activeProvider) {
        if (activeUnsub) activeUnsub();
        activeUnsub = null;
        await activeProvider.disconnect();
      }

      // Select provider
      let provider: WalletProvider | undefined;
      if (providerId) {
        provider = providers.find((p) => p.id === providerId);
        if (!provider) throw new Error(`Wallet provider '${providerId}' not found`);
        if (!provider.available()) throw new Error(`Wallet provider '${providerId}' is not available`);
      } else {
        provider = providers.find((p) => p.available());
        if (!provider) throw new Error('No wallet provider available');
      }

      activeProvider = provider;

      // Subscribe before connect — provider.connect() triggers this, so no explicit updateState needed
      activeUnsub = provider.onStateChange((providerState: WalletState) => {
        updateState(providerState);
      });

      await provider.connect();
      persistProvider(provider.id);
      return state;
    },

    async disconnect(): Promise<void> {
      // EIP-1193 only: revoke permissions so reconnect requires explicit approval
      const shouldRevoke = getSetting('revokeOnDisconnect', true);
      if (shouldRevoke && activeProvider?.id === 'eip1193') {
        try {
          const eth = (window as any).ethereum;
          if (eth) {
            await eth.request({
              method: 'wallet_revokePermissions',
              params: [{ eth_accounts: {} }],
            });
          }
        } catch {
          /* Not all wallets support wallet_revokePermissions */
        }
      }

      // Unsub before disconnect to avoid double-firing state changes
      if (activeUnsub) activeUnsub();
      activeUnsub = null;
      if (activeProvider) {
        await activeProvider.disconnect();
      }
      activeProvider = null;
      persistProvider(null);
      updateState({ connected: false, address: null, chainId: null, provider: null });
    },

    getState(): WalletState {
      return { ...state };
    },

    async sign(message: string): Promise<string> {
      if (!activeProvider || !state.connected) throw new Error('Wallet not connected');
      return activeProvider.sign(message);
    },

    onStateChange(handler: (state: WalletState) => void): () => void {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },

    getProviders(): WalletProvider[] {
      return [...providers];
    },

    getActiveProvider(): WalletProvider | null {
      return activeProvider;
    },
  };

  return plugin;
}

// ---------------------------------------------------------------------------
// Backward compat — deprecated, use createWallet({ providers: [...] })
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `createWallet({ providers: [createEIP1193Provider()] })` instead.
 */
export function createEthereumWallet(): Wallet {
  return createWallet({ providers: [createEIP1193Provider()] });
}

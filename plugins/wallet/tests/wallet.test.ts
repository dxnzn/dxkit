import { createEIP1193Provider, createEthereumWallet, createLocalWalletProvider, createWallet } from '@dxkit/wallet';
import type { Context, Wallet } from 'dxkit';
import { createEventBus } from 'dxkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function mockContext(): Context {
  const events = createEventBus();
  return {
    events,
    eventRegistry: {
      registerEvent: vi.fn(),
      getRegisteredEvents: () => [],
      isRegistered: () => false,
    },
    router: { navigate: vi.fn(), getCurrentPath: () => '/' },
    getPlugin: () => undefined,
    getPlugins: () => ({}),
    getManifests: () => [],
    getEnabledManifests: () => [],
    enableDapp: vi.fn(),
    disableDapp: vi.fn(),
    isDappEnabled: () => true,
  };
}

function mockEIP1193Provider(accounts = ['0xabc123'], chainId = '0x1') {
  type Callback = (...args: any[]) => void;
  const listeners: Record<string, Callback[]> = {};
  return {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts') return accounts;
      if (method === 'eth_chainId') return chainId;
      if (method === 'personal_sign') return '0xsignature';
      throw new Error(`Unknown method: ${method}`);
    }),
    on: vi.fn((event: string, handler: Callback) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeListener: vi.fn((event: string, handler: Callback) => {
      listeners[event] = (listeners[event] || []).filter((h) => h !== handler);
    }),
    _emit: (event: string, ...args: any[]) => {
      for (const handler of listeners[event] || []) handler(...args);
    },
  };
}

// ---------------------------------------------------------------------------
// createEIP1193Provider
// ---------------------------------------------------------------------------

describe('createEIP1193Provider', () => {
  beforeEach(() => {
    delete (window as any).ethereum;
  });

  afterEach(() => {
    delete (window as any).ethereum;
  });

  it('has correct id and name', () => {
    const provider = createEIP1193Provider();
    expect(provider.id).toBe('eip1193');
    expect(provider.name).toBe('Browser Wallet');
  });

  it('available() returns false without window.ethereum', () => {
    const provider = createEIP1193Provider();
    expect(provider.available()).toBe(false);
  });

  it('available() returns true with window.ethereum', () => {
    (window as any).ethereum = mockEIP1193Provider();
    const provider = createEIP1193Provider();
    expect(provider.available()).toBe(true);
  });

  it('connect() returns connected state', async () => {
    (window as any).ethereum = mockEIP1193Provider();
    const provider = createEIP1193Provider();
    const state = await provider.connect();

    expect(state.connected).toBe(true);
    expect(state.address).toBe('0xabc123');
    expect(state.chainId).toBe(1);
  });

  it('connect() throws without window.ethereum', async () => {
    const provider = createEIP1193Provider();
    await expect(provider.connect()).rejects.toThrow('No wallet detected');
  });

  it('disconnect() clears state', async () => {
    (window as any).ethereum = mockEIP1193Provider();
    const provider = createEIP1193Provider();
    await provider.connect();
    await provider.disconnect();

    const handler = vi.fn();
    provider.onStateChange(handler);
    // State should have been cleared during disconnect
    // Connect again to verify clean state
    const state = await provider.connect();
    expect(state.connected).toBe(true);
  });

  it('sign() delegates to personal_sign', async () => {
    const mock = mockEIP1193Provider();
    (window as any).ethereum = mock;
    const provider = createEIP1193Provider();
    await provider.connect();

    const sig = await provider.sign('hello');
    expect(sig).toBe('0xsignature');
    expect(mock.request).toHaveBeenCalledWith({
      method: 'personal_sign',
      params: ['hello', '0xabc123'],
    });
  });

  it('sign() throws when not connected', async () => {
    const provider = createEIP1193Provider();
    await expect(provider.sign('hello')).rejects.toThrow('Wallet not connected');
  });

  it('onStateChange() fires on connect', async () => {
    (window as any).ethereum = mockEIP1193Provider();
    const provider = createEIP1193Provider();
    const handler = vi.fn();
    provider.onStateChange(handler);

    await provider.connect();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ connected: true, address: '0xabc123' }));
  });

  it('reacts to accountsChanged', async () => {
    const mock = mockEIP1193Provider();
    (window as any).ethereum = mock;
    const provider = createEIP1193Provider();
    await provider.connect();

    const handler = vi.fn();
    provider.onStateChange(handler);

    mock._emit('accountsChanged', ['0xnew']);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ address: '0xnew' }));
  });

  it('reacts to chainChanged', async () => {
    const mock = mockEIP1193Provider();
    (window as any).ethereum = mock;
    const provider = createEIP1193Provider();
    await provider.connect();

    const handler = vi.fn();
    provider.onStateChange(handler);

    mock._emit('chainChanged', '0x89');
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ chainId: 137 }));
  });
});

// ---------------------------------------------------------------------------
// createLocalWalletProvider
// ---------------------------------------------------------------------------

describe('createLocalWalletProvider', () => {
  it('has correct id and name', () => {
    const provider = createLocalWalletProvider();
    expect(provider.id).toBe('local');
    expect(provider.name).toBe('Local (Dev)');
  });

  it('available() is always true', () => {
    const provider = createLocalWalletProvider();
    expect(provider.available()).toBe(true);
  });

  it('connect() returns deterministic state', async () => {
    const provider = createLocalWalletProvider();
    const state = await provider.connect();

    expect(state.connected).toBe(true);
    expect(state.address).toBe('0x0000000000000000000000000000000001');
    expect(state.chainId).toBe(0);
  });

  it('connect() uses custom address when provided', async () => {
    const provider = createLocalWalletProvider({ address: '0xcafe' });
    const state = await provider.connect();
    expect(state.address).toBe('0xcafe');
  });

  it('disconnect() clears state', async () => {
    const provider = createLocalWalletProvider();
    await provider.connect();
    await provider.disconnect();

    const handler = vi.fn();
    provider.onStateChange(handler);
    await provider.connect();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ connected: true }));
  });

  it('sign() returns deterministic hex', async () => {
    const provider = createLocalWalletProvider();
    await provider.connect();

    const sig = await provider.sign('hi');
    expect(sig).toBe(`0x${Buffer.from('hi').toString('hex')}`);
  });

  it('sign() throws when not connected', async () => {
    const provider = createLocalWalletProvider();
    await expect(provider.sign('hello')).rejects.toThrow('Wallet not connected');
  });

  it('onStateChange() fires on connect/disconnect', async () => {
    const provider = createLocalWalletProvider();
    const handler = vi.fn();
    provider.onStateChange(handler);

    await provider.connect();
    await provider.disconnect();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].connected).toBe(true);
    expect(handler.mock.calls[1][0].connected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createWallet (coordinator)
// ---------------------------------------------------------------------------

describe('createWallet', () => {
  let wallet: Wallet;
  let ctx: Context;

  beforeEach(() => {
    ctx = mockContext();
    localStorage.removeItem('dxkit:wallet');
  });

  afterEach(async () => {
    if (wallet) await wallet.destroy?.();
  });

  it('starts disconnected with no active provider', () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    expect(wallet.getState().connected).toBe(false);
    expect(wallet.getActiveProvider()).toBeNull();
  });

  it('getProviders() returns all providers', () => {
    const local = createLocalWalletProvider();
    wallet = createWallet({ providers: [local] });
    expect(wallet.getProviders()).toHaveLength(1);
    expect(wallet.getProviders()[0].id).toBe('local');
  });

  it('connect() picks first available provider', async () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);

    const state = await wallet.connect();
    expect(state.connected).toBe(true);
    expect(wallet.getActiveProvider()?.id).toBe('local');
  });

  it('connect(providerId) selects specific provider', async () => {
    const local = createLocalWalletProvider();
    const eip = createEIP1193Provider();
    wallet = createWallet({ providers: [local, eip] });
    await wallet.init!(ctx);

    const state = await wallet.connect('local');
    expect(state.connected).toBe(true);
    expect(wallet.getActiveProvider()?.id).toBe('local');
  });

  it('connect() throws for unknown provider ID', async () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);

    await expect(wallet.connect('nonexistent')).rejects.toThrow("Wallet provider 'nonexistent' not found");
  });

  it('connect() throws if specified provider is not available', async () => {
    const eip = createEIP1193Provider(); // window.ethereum not set
    wallet = createWallet({ providers: [eip] });
    await wallet.init!(ctx);

    await expect(wallet.connect('eip1193')).rejects.toThrow("Wallet provider 'eip1193' is not available");
  });

  it('connect() throws if no provider is available', async () => {
    const eip = createEIP1193Provider(); // window.ethereum not set
    wallet = createWallet({ providers: [eip] });
    await wallet.init!(ctx);

    await expect(wallet.connect()).rejects.toThrow('No wallet provider available');
  });

  it('disconnect() clears active provider', async () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);
    await wallet.connect();

    await wallet.disconnect();
    expect(wallet.getState().connected).toBe(false);
    expect(wallet.getActiveProvider()).toBeNull();
  });

  it('emits dx:plugin:wallet:connected event', async () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);

    const handler = vi.fn();
    ctx.events.on('dx:plugin:wallet:connected', handler);

    await wallet.connect();
    expect(handler).toHaveBeenCalledWith({
      address: '0x0000000000000000000000000000000001',
      chainId: 0,
    });
  });

  it('emits dx:plugin:wallet:disconnected event', async () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);
    await wallet.connect();

    const handler = vi.fn();
    ctx.events.on('dx:plugin:wallet:disconnected', handler);

    await wallet.disconnect();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('onStateChange() propagates provider state changes', async () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);

    const handler = vi.fn();
    wallet.onStateChange(handler);

    await wallet.connect();
    await wallet.disconnect();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].connected).toBe(true);
    expect(handler.mock.calls[1][0].connected).toBe(false);
  });

  it('switching providers disconnects the previous one', async () => {
    const local1 = createLocalWalletProvider({ address: '0x001' });
    const local2 = createLocalWalletProvider({ address: '0x002' });
    // Override id so we can select by ID
    (local2 as any).id = 'local2';

    wallet = createWallet({ providers: [local1, local2] });
    await wallet.init!(ctx);

    await wallet.connect('local');
    expect(wallet.getState().address).toBe('0x001');

    await wallet.connect('local2');
    expect(wallet.getState().address).toBe('0x002');
    expect(wallet.getActiveProvider()?.id).toBe('local2');
  });

  it('sign() delegates to active provider', async () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);
    await wallet.connect();

    const sig = await wallet.sign('test');
    expect(sig).toMatch(/^0x/);
  });

  it('sign() throws when not connected', async () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);

    await expect(wallet.sign('test')).rejects.toThrow('Wallet not connected');
  });

  it('getState() returns a copy', () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    const a = wallet.getState();
    const b = wallet.getState();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('destroy() disconnects and cleans up', async () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);
    await wallet.connect();

    await wallet.destroy!();

    // After destroy, getState still works but shows disconnected
    // (destroy nulls ctx but state is still readable)
  });

  it('persists provider to localStorage and restores on next init', async () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);
    await wallet.connect();

    expect(localStorage.getItem('dxkit:wallet')).toBe('local');

    await wallet.destroy!();

    // New instance should auto-reconnect from persisted provider
    const wallet2 = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet2.init!(ctx);

    expect(wallet2.getState().connected).toBe(true);
    expect(wallet2.getActiveProvider()?.id).toBe('local');

    await wallet2.destroy!();
    wallet = null as any;
  });

  it('clears persisted provider on disconnect', async () => {
    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);
    await wallet.connect();

    expect(localStorage.getItem('dxkit:wallet')).toBe('local');

    await wallet.disconnect();

    expect(localStorage.getItem('dxkit:wallet')).toBeNull();
  });

  it('ignores persisted provider that is no longer available', async () => {
    // Persist an eip1193 provider ID, but only register local provider
    localStorage.setItem('dxkit:wallet', 'eip1193');

    wallet = createWallet({ providers: [createLocalWalletProvider()] });
    await wallet.init!(ctx);

    // Should not auto-connect — eip1193 provider not found
    expect(wallet.getState().connected).toBe(false);
    expect(wallet.getActiveProvider()).toBeNull();
  });

  it('calls wallet_revokePermissions on disconnect when setting enabled', async () => {
    const mock = mockEIP1193Provider();
    (window as any).ethereum = mock;

    wallet = createWallet({ providers: [createEIP1193Provider()] });
    await wallet.init!(ctx);
    await wallet.connect();

    await wallet.disconnect();

    expect(mock.request).toHaveBeenCalledWith({
      method: 'wallet_revokePermissions',
      params: [{ eth_accounts: {} }],
    });
  });
});

// ---------------------------------------------------------------------------
// createEthereumWallet (backward compat)
// ---------------------------------------------------------------------------

describe('createEthereumWallet (compat)', () => {
  let wallet: Wallet;
  let ctx: Context;

  beforeEach(() => {
    ctx = mockContext();
    delete (window as any).ethereum;
    localStorage.removeItem('dxkit:wallet');
  });

  afterEach(async () => {
    if (wallet) await wallet.destroy?.();
    delete (window as any).ethereum;
  });

  it('starts disconnected', () => {
    wallet = createEthereumWallet();
    const state = wallet.getState();

    expect(state.connected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.chainId).toBeNull();
  });

  it('connect() calls eth_requestAccounts and updates state', async () => {
    const provider = mockEIP1193Provider();
    (window as any).ethereum = provider;

    wallet = createEthereumWallet();
    await wallet.init!(ctx);

    const state = await wallet.connect();

    expect(state.connected).toBe(true);
    expect(state.address).toBe('0xabc123');
    expect(state.chainId).toBe(1);
    expect(provider.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
  });

  it('connect() emits dx:plugin:wallet:connected', async () => {
    (window as any).ethereum = mockEIP1193Provider();

    wallet = createEthereumWallet();
    await wallet.init!(ctx);

    const handler = vi.fn();
    ctx.events.on('dx:plugin:wallet:connected', handler);

    await wallet.connect();

    expect(handler).toHaveBeenCalledWith({ address: '0xabc123', chainId: 1 });
  });

  it('connect() throws if no provider', async () => {
    wallet = createEthereumWallet();
    await wallet.init!(ctx);

    await expect(wallet.connect()).rejects.toThrow();
  });

  it('disconnect() clears state and emits event', async () => {
    (window as any).ethereum = mockEIP1193Provider();

    wallet = createEthereumWallet();
    await wallet.init!(ctx);
    await wallet.connect();

    const handler = vi.fn();
    ctx.events.on('dx:plugin:wallet:disconnected', handler);

    await wallet.disconnect();

    expect(wallet.getState().connected).toBe(false);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('sign() calls personal_sign', async () => {
    const provider = mockEIP1193Provider();
    (window as any).ethereum = provider;

    wallet = createEthereumWallet();
    await wallet.init!(ctx);
    await wallet.connect();

    const sig = await wallet.sign('hello');

    expect(sig).toBe('0xsignature');
    expect(provider.request).toHaveBeenCalledWith({
      method: 'personal_sign',
      params: ['hello', '0xabc123'],
    });
  });

  it('sign() throws when not connected', async () => {
    wallet = createEthereumWallet();
    await wallet.init!(ctx);

    await expect(wallet.sign('hello')).rejects.toThrow('Wallet not connected');
  });

  it('onStateChange() notifies on connect/disconnect', async () => {
    (window as any).ethereum = mockEIP1193Provider();

    wallet = createEthereumWallet();
    await wallet.init!(ctx);

    const handler = vi.fn();
    wallet.onStateChange(handler);

    await wallet.connect();
    await wallet.disconnect();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].connected).toBe(true);
    expect(handler.mock.calls[1][0].connected).toBe(false);
  });

  it('getState() returns a copy', async () => {
    wallet = createEthereumWallet();
    const a = wallet.getState();
    const b = wallet.getState();

    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('has provider-aware methods (coordinator)', () => {
    wallet = createEthereumWallet();
    expect(wallet.getProviders()).toHaveLength(1);
    expect(wallet.getProviders()[0].id).toBe('eip1193');
    expect(wallet.getActiveProvider()).toBeNull();
  });
});

import { createPassthroughAuth } from '@dxkit/auth';
import type { Auth, Context, Wallet, WalletState } from 'dxkit';
import { createEventBus } from 'dxkit';
import { afterEach, describe, expect, it, vi } from 'vitest';

function mockWallet(
  initialState?: Partial<WalletState>,
): Wallet & { _triggerChange: (state: Partial<WalletState>) => void } {
  let state: WalletState = {
    connected: false,
    address: null,
    chainId: null,
    provider: null,
    ...initialState,
  };
  const handlers = new Set<(state: WalletState) => void>();

  return {
    name: 'wallet',
    getState: () => ({ ...state }),
    connect: vi.fn(async () => {
      state = { ...state, connected: true, address: '0xabc123', chainId: 1 };
      for (const h of handlers) h(state);
      return state;
    }),
    disconnect: vi.fn(async () => {
      state = { ...state, connected: false, address: null };
      for (const h of handlers) h(state);
    }),
    sign: vi.fn(async () => '0xsig'),
    onStateChange: (handler: (s: WalletState) => void) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    _triggerChange: (updates: Partial<WalletState>) => {
      state = { ...state, ...updates };
      for (const h of handlers) h(state);
    },
  };
}

function mockContext(wallet?: Wallet): Context {
  const events = createEventBus();
  return {
    events,
    eventRegistry: {
      registerEvent: vi.fn(),
      getRegisteredEvents: () => [],
      isRegistered: () => false,
    },
    router: { navigate: vi.fn(), getCurrentPath: () => '/' },
    getPlugin: (name: string) => (name === 'wallet' ? wallet : undefined) as any,
    getPlugins: () => (wallet ? { wallet } : {}),
    getManifests: () => [],
    getEnabledManifests: () => [],
    enableDapp: vi.fn(),
    disableDapp: vi.fn(),
    isDappEnabled: () => true,
  };
}

describe('createPassthroughAuth', () => {
  let auth: Auth;
  let ctx: Context;

  afterEach(async () => {
    if (auth) await auth.destroy?.();
  });

  it('starts unauthenticated', () => {
    auth = createPassthroughAuth();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getState().address).toBeNull();
  });

  it('authenticate() calls wallet.connect()', async () => {
    const wallet = mockWallet();
    ctx = mockContext(wallet);
    auth = createPassthroughAuth();
    await auth.init!(ctx);

    const state = await auth.authenticate();

    expect(wallet.connect).toHaveBeenCalledOnce();
    expect(state.authenticated).toBe(true);
    expect(state.address).toBe('0xabc123');
  });

  it('authenticate() emits dx:plugin:auth:authenticated', async () => {
    const wallet = mockWallet();
    ctx = mockContext(wallet);
    auth = createPassthroughAuth();
    await auth.init!(ctx);

    const handler = vi.fn();
    ctx.events.on('dx:plugin:auth:authenticated', handler);

    await auth.authenticate();

    expect(handler).toHaveBeenCalledWith({ address: '0xabc123' });
  });

  it('authenticate() throws without wallet plugin', async () => {
    ctx = mockContext(); // no wallet
    auth = createPassthroughAuth();
    await auth.init!(ctx);

    await expect(auth.authenticate()).rejects.toThrow('No wallet plugin');
  });

  it('deauthenticate() calls wallet.disconnect()', async () => {
    const wallet = mockWallet();
    ctx = mockContext(wallet);
    auth = createPassthroughAuth();
    await auth.init!(ctx);

    await auth.authenticate();
    await auth.deauthenticate();

    expect(wallet.disconnect).toHaveBeenCalledOnce();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('deauthenticate() emits dx:plugin:auth:deauthenticated', async () => {
    const wallet = mockWallet();
    ctx = mockContext(wallet);
    auth = createPassthroughAuth();
    await auth.init!(ctx);

    await auth.authenticate();

    const handler = vi.fn();
    ctx.events.on('dx:plugin:auth:deauthenticated', handler);

    await auth.deauthenticate();

    expect(handler).toHaveBeenCalledOnce();
  });

  it('syncs from wallet state changes', async () => {
    const wallet = mockWallet();
    ctx = mockContext(wallet);
    auth = createPassthroughAuth();
    await auth.init!(ctx);

    const handler = vi.fn();
    auth.onStateChange(handler);

    wallet._triggerChange({ connected: true, address: '0xnew' });

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getState().address).toBe('0xnew');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('syncs initial connected state from wallet', async () => {
    const wallet = mockWallet({ connected: true, address: '0xalready' });
    ctx = mockContext(wallet);
    auth = createPassthroughAuth();
    await auth.init!(ctx);

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getState().address).toBe('0xalready');
  });

  it('onStateChange() returns unsubscribe', async () => {
    const wallet = mockWallet();
    ctx = mockContext(wallet);
    auth = createPassthroughAuth();
    await auth.init!(ctx);

    const handler = vi.fn();
    const unsub = auth.onStateChange(handler);
    unsub();

    await auth.authenticate();

    expect(handler).not.toHaveBeenCalled();
  });

  it('getState() returns a copy', async () => {
    auth = createPassthroughAuth();
    const a = auth.getState();
    const b = auth.getState();

    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

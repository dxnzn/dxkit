import { createEventBus, createEventRegistry } from 'dxkit';
import { describe, expect, it, vi } from 'vitest';

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('dx:ready', handler);
    bus.emit('dx:ready', {});

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({});
  });

  it('delivers typed payloads', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('dx:dapp:mounted', handler);
    bus.emit('dx:dapp:mounted', { id: 'test' });

    expect(handler).toHaveBeenCalledWith({ id: 'test' });
  });

  it('on() returns a Listener with off()', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    const listener = bus.on('dx:ready', handler);
    listener.off();
    bus.emit('dx:ready', {});

    expect(handler).not.toHaveBeenCalled();
  });

  it('off() removes a specific handler', () => {
    const bus = createEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('dx:ready', handler1);
    bus.on('dx:ready', handler2);
    bus.off('dx:ready', handler1);
    bus.emit('dx:ready', {});

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('once() fires handler only once', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.once('dx:ready', handler);
    bus.emit('dx:ready', {});
    bus.emit('dx:ready', {});

    expect(handler).toHaveBeenCalledOnce();
  });

  it('multiple subscribers receive the same event', () => {
    const bus = createEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('dx:error', handler1);
    bus.on('dx:error', handler2);
    bus.emit('dx:error', { source: 'test', error: new Error('fail') });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('off() is safe to call for unregistered handlers', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    // Should not throw
    bus.off('dx:ready', handler);
  });

  it('pause() stops delivering events, resume() restarts', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    const listener = bus.on('dx:ready', handler);

    listener.pause();
    bus.emit('dx:ready', {});
    expect(handler).not.toHaveBeenCalled();

    listener.resume();
    bus.emit('dx:ready', {});
    expect(handler).toHaveBeenCalledOnce();
  });

  it('paused reflects current state', () => {
    const bus = createEventBus();
    const listener = bus.on('dx:ready', vi.fn());

    expect(listener.paused).toBe(false);
    listener.pause();
    expect(listener.paused).toBe(true);
    listener.resume();
    expect(listener.paused).toBe(false);
  });

  it('emits and receives custom (non-dx:) events', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('myapp:data:loaded', handler);
    bus.emit('myapp:data:loaded', { count: 42 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ count: 42 });
  });

  it('emits and receives plugin-namespaced events', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('dx:plugin:wallet:connected', handler);
    bus.emit('dx:plugin:wallet:connected', { address: '0xabc', chainId: 1 });

    expect(handler).toHaveBeenCalledWith({ address: '0xabc', chainId: 1 });
  });
});

describe('EventRegistry', () => {
  it('registers plugin events with dx:plugin:<name>:<action> format', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    registry.registerEvent('wallet', [
      { name: 'dx:plugin:wallet:connected' },
      { name: 'dx:plugin:wallet:disconnected' },
    ]);

    expect(registry.isRegistered('dx:plugin:wallet:connected')).toBe(true);
    expect(registry.isRegistered('dx:plugin:wallet:disconnected')).toBe(true);
  });

  it('registers dapp/developer events (no dx: prefix)', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    registry.registerEvent('dashboard', [{ name: 'dashboard:data:loaded' }]);

    expect(registry.isRegistered('dashboard:data:loaded')).toBe(true);
  });

  it('getRegisteredEvents() returns all registered events', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    registry.registerEvent('wallet', [{ name: 'dx:plugin:wallet:connected', description: 'Wallet connected' }]);
    registry.registerEvent('myapp', [{ name: 'myapp:loaded' }]);

    const events = registry.getRegisteredEvents();
    expect(events).toHaveLength(2);
    expect(events).toContainEqual({
      name: 'dx:plugin:wallet:connected',
      source: 'wallet',
      description: 'Wallet connected',
    });
    expect(events).toContainEqual({
      name: 'myapp:loaded',
      source: 'myapp',
      description: undefined,
    });
  });

  it('duplicate from same source is a no-op', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    registry.registerEvent('wallet', [{ name: 'dx:plugin:wallet:connected' }]);
    registry.registerEvent('wallet', [{ name: 'dx:plugin:wallet:connected' }]);

    expect(registry.getRegisteredEvents()).toHaveLength(1);
  });

  it('different source for same event name throws', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    registry.registerEvent('dashboard', [{ name: 'shared:data:loaded' }]);

    expect(() => {
      registry.registerEvent('analytics', [{ name: 'shared:data:loaded' }]);
    }).toThrow("already registered by 'dashboard'");
  });

  it('rejects built-in shell events', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    expect(() => {
      registry.registerEvent('rogue', [{ name: 'dx:ready' }]);
    }).toThrow('built-in shell event');
  });

  it('rejects dx:event:registered as a registerable event', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    expect(() => {
      registry.registerEvent('rogue', [{ name: 'dx:event:registered' }]);
    }).toThrow('built-in shell event');
  });

  it('rejects dx: prefix for non-plugin events', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    expect(() => {
      registry.registerEvent('foo', [{ name: 'dx:foo:bar' }]);
    }).toThrow('reserved dx: prefix');
  });

  it('rejects plugin namespace mismatch', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    expect(() => {
      registry.registerEvent('wallet', [{ name: 'dx:plugin:auth:foo' }]);
    }).toThrow('namespace mismatch');
  });

  it('rejects malformed plugin event name (missing action)', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    expect(() => {
      registry.registerEvent('wallet', [{ name: 'dx:plugin:wallet' }]);
    }).toThrow("expected 'dx:plugin:<name>:<action>'");
  });

  it('empty events array is a no-op', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    registry.registerEvent('wallet', []);
    expect(registry.getRegisteredEvents()).toHaveLength(0);
  });

  it('emits dx:event:registered on successful registration', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);
    const handler = vi.fn();

    bus.on('dx:event:registered', handler);

    registry.registerEvent('wallet', [
      { name: 'dx:plugin:wallet:connected' },
      { name: 'dx:plugin:wallet:disconnected' },
    ]);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      source: 'wallet',
      events: ['dx:plugin:wallet:connected', 'dx:plugin:wallet:disconnected'],
    });
  });

  it('does not emit dx:event:registered when all events are no-ops', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);
    const handler = vi.fn();

    registry.registerEvent('wallet', [{ name: 'dx:plugin:wallet:connected' }]);

    bus.on('dx:event:registered', handler);

    registry.registerEvent('wallet', [{ name: 'dx:plugin:wallet:connected' }]);

    expect(handler).not.toHaveBeenCalled();
  });

  it('isRegistered() returns false for unregistered events', () => {
    const bus = createEventBus();
    const registry = createEventRegistry(bus);

    expect(registry.isRegistered('dx:plugin:wallet:connected')).toBe(false);
    expect(registry.isRegistered('myapp:loaded')).toBe(false);
  });
});

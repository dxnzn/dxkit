import type { EventBus, EventMap, EventRegistration, EventRegistry, Listener, RegisteredEvent } from './types/index.js';

/** Static shell event names — cannot be registered at runtime. */
const SHELL_EVENTS = new Set<string>([
  'dx:ready',
  'dx:route:changed',
  'dx:dapp:mounted',
  'dx:dapp:unmounted',
  'dx:dapp:enabled',
  'dx:dapp:disabled',
  'dx:mount',
  'dx:unmount',
  'dx:route:subpath',
  'dx:error',
  'dx:plugin:registered',
  'dx:event:registered',
]);

/**
 * Creates a typed event bus backed by window.CustomEvent.
 *
 * All events are dispatched on the provided target (defaults to window)
 * using the `dx:*` namespace. Handlers receive the typed `detail` payload.
 */
export function createEventBus(target: EventTarget = window): EventBus {
  // Maps original handler → wrapper so we can removeEventListener with the same ref
  const handlers: Record<string, Map<(...args: any[]) => any, (e: Event) => void>> = {};

  function emit<K extends keyof EventMap>(event: K, detail: EventMap[K]): void {
    target.dispatchEvent(new CustomEvent(event as string, { detail }));
  }

  function on<K extends keyof EventMap>(event: K, handler: (detail: EventMap[K]) => void): Listener {
    // Paused listeners stay subscribed but silently drop events
    let paused = false;
    const wrapper = (e: Event) => {
      if (!paused) handler((e as CustomEvent).detail);
    };

    const key = event as string;
    if (!handlers[key]) {
      handlers[key] = new Map();
    }
    handlers[key].set(handler, wrapper);

    target.addEventListener(key, wrapper);
    return {
      off: () => off(event, handler),
      get paused() {
        return paused;
      },
      pause() {
        paused = true;
      },
      resume() {
        paused = false;
      },
    };
  }

  function once<K extends keyof EventMap>(event: K, handler: (detail: EventMap[K]) => void): void {
    const listener = on(event, (detail) => {
      listener.off();
      handler(detail);
    });
  }

  function off<K extends keyof EventMap>(event: K, handler: (detail: EventMap[K]) => void): void {
    const map = handlers[event as string];
    if (!map) return;

    const wrapper = map.get(handler);
    if (wrapper) {
      target.removeEventListener(event as string, wrapper);
      map.delete(handler);
    }
  }

  return { emit, on, once, off };
}

/**
 * Creates an event registry for runtime event registration and introspection.
 *
 * Namespace rules:
 * - `dx:plugin:<name>:<action>` — plugin events, name must match source
 * - No `dx:` prefix — dapp/developer events, any source
 * - `dx:*` without `dx:plugin:` prefix — reserved, rejected
 */
export function createEventRegistry(bus: EventBus): EventRegistry {
  const registered = new Map<string, RegisteredEvent>();

  function registerEvent(source: string, events: EventRegistration[]): void {
    if (!events.length) return;

    const newlyRegistered: string[] = [];

    for (const { name, description } of events) {
      // Reject built-in shell events
      if (SHELL_EVENTS.has(name)) {
        throw new Error(`Cannot register built-in shell event: '${name}'`);
      }

      // dx: prefix reserved for shell; plugins must use dx:plugin:<name>:<action>
      if (name.startsWith('dx:plugin:')) {
        const segments = name.split(':');
        if (segments.length !== 4 || !segments[3]) {
          throw new Error(`Invalid plugin event format: '${name}' — expected 'dx:plugin:<name>:<action>'`);
        }
        if (segments[2] !== source) {
          throw new Error(`Plugin '${source}' cannot register event '${name}' — namespace mismatch`);
        }
      } else if (name.startsWith('dx:')) {
        // Reserved dx: namespace (not dx:plugin:)
        throw new Error(`Event '${name}' uses reserved dx: prefix — plugins must use 'dx:plugin:${source}:<action>'`);
      }

      // Same source re-registering is a no-op; different source is a conflict
      const existing = registered.get(name);
      if (existing) {
        if (existing.source === source) continue;
        throw new Error(`Event '${name}' already registered by '${existing.source}'`);
      }

      registered.set(name, { name, source, description });
      newlyRegistered.push(name);
    }

    if (newlyRegistered.length) {
      bus.emit('dx:event:registered', { source, events: newlyRegistered });
    }
  }

  function getRegisteredEvents(): RegisteredEvent[] {
    return Array.from(registered.values());
  }

  function isRegistered(event: string): boolean {
    return registered.has(event);
  }

  return { registerEvent, getRegisteredEvents, isRegistered };
}

import type { DappManifest } from './manifest.js';

/**
 * Built-in shell event names mapped to their payload types.
 *
 * Plugin events use the `dx:plugin:<name>:<action>` convention and are
 * registered at runtime via `EventRegistry.registerEvent()`. Developer/dapp
 * events use any name that does not start with `dx:`.
 */
export interface EventMap {
  'dx:ready': Record<string, never>;
  'dx:route:changed': { path: string; manifest?: DappManifest };
  'dx:dapp:mounted': { id: string };
  'dx:dapp:unmounted': { id: string };
  'dx:dapp:enabled': { id: string };
  'dx:dapp:disabled': { id: string };
  'dx:mount': { id: string; container: HTMLElement; path: string }; // dispatched to dapp — tells it to render (distinct from dx:dapp:mounted broadcast)
  'dx:unmount': { id: string };
  'dx:error': { source: string; error: Error };
  'dx:plugin:registered': { name: string };
  'dx:event:registered': { source: string; events: string[] };
  /** Index signature — allows custom events registered at runtime. */
  [event: string]: unknown;
}

/** Input descriptor for `EventRegistry.registerEvent()`. */
export interface EventRegistration {
  /** Event name, e.g. `'dx:plugin:wallet:connected'` or `'myapp:loaded'`. */
  name: string;
  /** Optional human-readable description for introspection. */
  description?: string;
}

/** Describes a registered custom event (returned by `getRegisteredEvents()`). */
export interface RegisteredEvent {
  /** Full event name. */
  name: string;
  /** Which plugin or dapp registered this event. */
  source: string;
  /** Optional description. */
  description?: string;
}

/** Handle returned by EventBus.on() for managing a listener. */
export interface Listener {
  /** Remove the listener permanently. */
  off(): void;
  /** Whether the listener is currently paused. */
  readonly paused: boolean;
  /** Temporarily stop delivering events to this listener. */
  pause(): void;
  /** Resume delivering events after a pause. */
  resume(): void;
}

/** Typed event bus for DxKit communication. */
export interface EventBus {
  emit<K extends keyof EventMap>(event: K, detail: EventMap[K]): void;
  on<K extends keyof EventMap>(event: K, handler: (detail: EventMap[K]) => void): Listener;
  once<K extends keyof EventMap>(event: K, handler: (detail: EventMap[K]) => void): void;
  off<K extends keyof EventMap>(event: K, handler: (detail: EventMap[K]) => void): void;
}

/** Registry for runtime event registration and introspection. */
export interface EventRegistry {
  /**
   * Register one or more custom events.
   *
   * - Plugins: event names MUST match `dx:plugin:<source>:<action>`.
   * - Dapps/devs: event names MUST NOT start with `dx:`.
   * - Duplicate from same source is a no-op.
   * - Different source for same event name throws.
   * - Built-in shell events cannot be registered.
   */
  registerEvent(source: string, events: EventRegistration[]): void;
  /** Get all registered custom events (excludes static shell events). */
  getRegisteredEvents(): RegisteredEvent[];
  /** Check whether an event name has been registered. */
  isRegistered(event: string): boolean;
}

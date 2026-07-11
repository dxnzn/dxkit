# Coding Conventions

**Analysis Date:** 2026-07-11

## Naming Patterns

**Files:**
- Source files: `camelCase.ts` (e.g., `router.ts`, `events.ts`, `lifecycle.ts`)
- Test files: `camelCase.test.ts` (e.g., `router.test.ts`, `shell.test.ts`)
- Type definition files: `camelCase.ts` grouped in `types/` directory (e.g., `types/interfaces.ts`, `types/manifest.ts`)
- Index/barrel files: `index.ts`

**Functions:**
- All functions: `camelCase` (e.g., `createRouter()`, `normalizePath()`, `updateState()`)
- Factory functions: `create*` prefix (e.g., `createEventBus()`, `createPluginRegistry()`, `createEIP1193Provider()`)
- Internal/private functions: `camelCase`, declared within factory closures (e.g., `readCurrentPath()`, `notifyListeners()`)
- Handler functions: descriptive camelCase (e.g., `handleRouteChange()`, `onPopState()`)

**Variables:**
- `camelCase` for all variables and parameters (e.g., `manifests`, `handlers`, `pendingMountId`)
- `const` preferred; `let` for variables that must be reassigned
- Boolean variables: prefixed with verb when appropriate (e.g., `paused`, `initialized`, `connected`)
- Collections named plural (e.g., `manifests`, `listeners`, `handlers`)

**Types & Interfaces:**
- `PascalCase` for all type and interface names (e.g., `Router`, `EventBus`, `DappManifest`, `WalletState`)
- Interfaces: `PascalCase` (e.g., `Plugin`, `Context`, `LifecycleManager`)
- Type aliases: `PascalCase` (e.g., `ScriptLoader`, `StyleLoader`, `ThemeMode`)
- State object types: `*State` suffix (e.g., `WalletState`, `AuthState`)

**Constants:**
- Module-level constants: `UPPER_SNAKE_CASE` (e.g., `SHELL_EVENTS`)
- Used sparingly — most configuration is passed as function parameters

## Code Style

**Formatting:**
- Tool: Biome 2.5.1
- Indent: 2 spaces
- Line width: 120 characters
- Quotes: Single quotes (enforced)
- Trailing commas: All (enforced)
- See: `biome.json` for complete config

**Linting:**
- Tool: Biome (same as formatter)
- Preset: recommended
- Exceptions:
  - `noExplicitAny`: off — `any` allowed where necessary
  - `noNonNullAssertion`: off — non-null assertions allowed with `!`
- Run: `make lint` (checks only), `make lint-fix` (auto-fix)

## Import Organization

**Order:**
1. Type imports from external packages (`import type { ... } from '@dnzn/dxkit'`)
2. Default/named imports from external packages (`import { ... } from '@dnzn/dxkit'`)
3. Type imports from local modules (`import type { ... } from './types/index.js'`)
4. Imports from local modules (`import { ... } from './utils.js'`)

**Path Aliases:**
- `@dnzn/dxkit` → core package exports
- `@dnzn/dxkit-wallet` → wallet plugin package
- `@dnzn/dxkit-auth` → auth plugin package
- `@dnzn/dxkit-theme` → theme plugin package
- `@dnzn/dxkit-settings` → settings plugin package
- Defined in `vitest.config.ts` and TypeScript config
- Relative paths with `.js` extension for local imports (e.g., `./events.js`)

## Error Handling

**Patterns:**
- Errors are thrown for validation failures, precondition violations, and unrecoverable states
- Error messages are descriptive and include context (e.g., `"Failed to load dapp script: ${src}"`)
- Reserved namespaces trigger errors (e.g., event registry rejects `dx:` prefix for non-plugin events)
- Duplicate event registration by different sources throws error
- Safe fallbacks used where appropriate (e.g., `loadedScripts` caches prevent duplicate loads)

**Error Handling Approach:**
```typescript
// Throwing for validation/precondition failures
if (!provider) {
  throw new Error('No wallet detected. Install MetaMask or another EIP-1193 wallet.');
}

// Async error handling in loaders
script.onerror = () => {
  reject(new Error(`Failed to load dapp script: ${src}`));
};

// No-op/safe fallback for optional operations
if (!map) return; // Safe to call off() on unregistered handler
```

## Logging

**Framework:** console only — no external logging library

**Patterns:**
- Error events emitted on event bus (`dx:error`) rather than logged to console
- Event bus used for runtime event logging
- No debug logging in production code
- Tests use `vi.fn()` to capture function calls instead of logging assertions

## Comments

**When to Comment:**
- Explain non-obvious behavior and implicit contracts
- Document browser API quirks (e.g., hash mode navigation and async `hashchange` firing)
- Flag ordering dependencies or surprising no-ops
- Explain fallback chains and error-swallowing behavior

**Comment Style:**
- One-line comments preferred
- Multi-line comments only for complex behavior
- Comment the "why", not the "what" (code reads clearly enough)
- Skip comments on trivial code (barrel exports, simple Map wrappers, self-evident types)

**Examples from codebase:**
```typescript
// Hash mode also needs hashchange
const onHashChange = mode === 'hash' ? () => notifyListeners() : null;
if (onHashChange) {
  window.addEventListener('hashchange', onHashChange);
}

// Paused listeners stay subscribed but silently drop events
let paused = false;
const wrapper = (e: Event) => {
  if (!paused) handler((e as CustomEvent).detail);
};

// Assigning a *different* hash fires 'hashchange' (async) -> onHashChange -> notifyListeners.
// Notifying explicitly here too would double-notify, double-mounting the target dapp.
```

**JSDoc/TSDoc:**
- No `@param` or `@returns` on internal functions — types speak for themselves
- JSDoc used only for public API surface and complex factory functions
- Multi-line JSDoc for context (e.g., `createEventBus()`, `createEventRegistry()`)

**Examples:**
```typescript
/**
 * Creates a typed event bus backed by window.CustomEvent.
 *
 * All events are dispatched on the provided target (defaults to window)
 * using the `dx:*` namespace. Handlers receive the typed `detail` payload.
 */
export function createEventBus(target: EventTarget = window): EventBus {
  // ...
}

// Internal function — no JSDoc, types are clear
function normalizePath(path: string): string {
  // ...
}
```

## Function Design

**Size:** Prefer small, focused functions. Factory functions contain helper functions via closures.

**Parameters:**
- Typed with interfaces/types
- Configuration objects preferred over many parameters (e.g., `config: RouterConfig`)
- Optional parameters: marked with `?` in type
- Defaults: in function signature (e.g., `events: EventBus = createEventBus()`)

**Return Values:**
- Named interfaces for return types (never `any` or overly generic types)
- Factory functions return interface, not implementation class
- Unsubscribe functions returned as `() => void` (e.g., `router.onRouteChange()` returns unsubscribe)
- Async functions return `Promise<T>` or `Promise<void>`

**Examples:**
```typescript
// Factory pattern — returns interface, closures hold private state
export function createRouter(config: RouterConfig): Router {
  const { mode, basePath, manifests } = config;
  const listeners = new Set<(manifest: DappManifest | null) => void>();

  function normalizePath(path: string): string { /* ... */ }
  function resolve(path: string): DappManifest | null { /* ... */ }

  return { resolve, navigate, getCurrentPath, onRouteChange, destroy };
}

// Listener/subscription pattern
function onRouteChange(handler: (manifest: DappManifest | null) => void): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler); // Unsubscribe function
}
```

## Module Design

**Export Style:**
- Named exports only (no default exports)
- Barrel files (`index.ts`) export types and factories
- Interfaces exported as type, implementations as functions

**Barrel Files:**
```typescript
// src/index.ts — typical barrel file structure
export { createEventBus, createEventRegistry } from './events.js';
export type {
  EventBus,
  EventMap,
  Listener,
  // ...
} from './types/index.js';
```

**Closures for State:**
- Encapsulation via factory function closures (no classes)
- Private state (e.g., `loaded`, `listeners`, `handlers`) held in closure
- Public interface returned as object literal

**No Barrel Re-exports:**
- `src/types/index.ts` collects all type exports
- No intermediate barrel files that re-export

## TypeScript-Specific

**Strict Mode:**
- `strict: true` enforced
- `esModuleInterop: true`
- `moduleResolution: bundler`
- Types generated (`declaration: true`, `declarationMap: true`)

**Type Patterns:**
- Generic constraints used (e.g., `<K extends keyof EventMap>`, `<T extends Plugin>`)
- Partial types used where appropriate (e.g., `Partial<DappManifest>`)
- Record types for maps (e.g., `Record<string, Plugin>`)
- Union types for modes (e.g., `mode: 'history' | 'hash'`)

## Code Organization Examples

**Typical module structure:**
```typescript
// Imports at top
import type { SomeType } from './types/index.js';

// Interfaces/types (if not in types/ directory)
export interface PublicInterface {
  method(): void;
}

// Factory function
export function createX(config: Config): PublicInterface {
  // State (private, in closure)
  let state = initialValue;
  const helpers = new Set<() => void>();

  // Helper functions (private)
  function helperA(): void { /* ... */ }
  function helperB(): void { /* ... */ }

  // Event listeners/cleanup
  window.addEventListener('popstate', helperA);

  // Return public interface
  return {
    method() { /* ... */ },
    destroy() {
      window.removeEventListener('popstate', helperA);
      helpers.clear();
    },
  };
}
```

---

*Convention analysis: 2026-07-11*

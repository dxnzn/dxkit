# Testing Patterns

**Analysis Date:** 2026-07-11

## Test Framework

**Runner:**
- Vitest 4.1.9
- Config: `vitest.config.ts`

**Environment:**
- DOM: happy-dom 20.10.6 (lightweight happy-dom implementation)
- TypeScript: 5.8.3

**Run Commands:**
```bash
make test                # Lint + run all tests (vitest run)
make test-watch         # Lint + run tests in watch mode (vitest)
```

**Test Files:**
- Location: `tests/**/*.test.ts` for core, `plugins/*/tests/**/*.test.ts` for plugins
- Assertion library: Vitest built-in `expect()`
- Mock library: `vi` from Vitest

## Test File Organization

**Location:**
- Core tests: `tests/` directory (parallel structure to `src/`)
- Plugin tests: `plugins/<name>/tests/` directory (parallel to `plugins/<name>/src/`)
- Path aliases configured in `vitest.config.ts` for imports

**Naming:**
- File naming: `<module>.test.ts` (e.g., `router.test.ts`, `shell.test.ts`)
- Test files mirror source module structure
- One test file per source module

**Example Structure:**
```
src/
├── router.ts
├── events.ts
├── lifecycle.ts
└── shell.ts

tests/
├── router.test.ts
├── events.test.ts
├── lifecycle.test.ts
└── shell.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import type { DappManifest } from '@dnzn/dxkit';
import { createRouter } from '@dnzn/dxkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Router', () => {
  beforeEach(() => {
    // Setup — typically reset window state or initialize fixtures
    window.history.replaceState(null, '', '/');
  });

  it('resolves exact route match', () => {
    // Arrange
    const router = createRouter({ /* config */ });

    // Act & Assert
    expect(router.resolve('/blog')?.id).toBe('blog');

    // Cleanup
    router.destroy();
  });

  describe('hash mode notifications', () => {
    // Nested describes for related test groups
    it('navigate() to a new hash notifies listeners exactly once', async () => {
      // Async test with tick() helper for async event handling
      const router = createRouter({ mode: 'hash', /* ... */ });
      router.navigate('/a');
      await tick(); // yield to event loop

      const handler = vi.fn();
      router.onRouteChange(handler);
      router.navigate('/b');
      await tick();

      expect(handler).toHaveBeenCalledTimes(1);
      router.destroy();
    });
  });
});
```

**Setup Patterns:**
- `beforeEach()` resets shared state (window.location, DOM)
- `afterEach()` cleanup in plugin tests (e.g., `delete window.__DXKIT__`)
- Fixtures created fresh per test to avoid state leakage

## Mocking

**Framework:** Vitest's built-in `vi` module

**Mock Functions:**
```typescript
const handler = vi.fn();

// Assert call count
expect(handler).toHaveBeenCalledOnce();
expect(handler).toHaveBeenCalledTimes(1);

// Assert arguments
expect(handler).toHaveBeenCalledWith({ id: 'test' });

// Access call details
expect(handler.mock.calls[0][0]?.id).toBe('blog');
```

**Mock Objects:**
```typescript
// Simple mock for listener tracking
const listeners: Record<string, Callback[]> = {};
const mockProvider = {
  request: vi.fn(async ({ method }) => {
    if (method === 'eth_requestAccounts') return ['0xabc123'];
    throw new Error(`Unknown method: ${method}`);
  }),
  on: vi.fn((event: string, handler: Callback) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
  }),
  _emit: (event: string, ...args: any[]) => {
    for (const handler of listeners[event] || []) handler(...args);
  },
};
```

**Context/Fixture Mocks:**
```typescript
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
```

**What to Mock:**
- External services (wallet providers, API endpoints)
- Browser APIs when testing logic (e.g., `window.location`, `window.history`)
- Dependencies of the unit under test (e.g., mocking the settings plugin in shell tests)

**What NOT to Mock:**
- Core event bus (used to drive tests)
- The module under test itself
- Simple DOM operations (happy-dom handles these)
- Error scenarios — test error paths directly

## Fixtures and Factories

**Test Data Factories:**
```typescript
// Manifest factory — used throughout router/shell tests
function manifest(overrides: Partial<DappManifest> & { id: string; route: string }): DappManifest {
  return {
    name: overrides.id,
    version: '0.0.1',
    entry: `/dapps/${overrides.id}/app.js`,
    nav: { label: overrides.id },
    ...overrides,
  };
}

// Usage
const router = createRouter({
  mode: 'history',
  basePath: '/',
  manifests: [manifest({ id: 'blog', route: '/blog' })],
});
```

**Loader Stubs:**
```typescript
const noopLoader = async () => {};
const failLoader = async (src: string) => {
  throw new Error(`Failed to load: ${src}`);
};

// Pass to lifecycle manager for testing
const lm = createLifecycleManager(events, { scriptLoader: noopLoader });
```

**Location:** Fixtures defined inline in test files (not extracted to shared files)

## Test Types

**Unit Tests:**
- Scope: Single factory function (e.g., `createRouter()`, `createEventBus()`)
- Approach: Direct instantiation, call methods, assert behavior
- Coverage: Happy path and edge cases (null routes, unmatched paths, etc.)
- Isolation: Each test creates fresh instance

**Integration Tests:**
- Scope: Multiple modules interacting (e.g., `shell.test.ts` tests router + lifecycle + events)
- Approach: Create shell, configure plugins/dapps, navigate, verify events fired
- Coverage: End-to-end flows (init → navigate → mount → unmount)
- Example: `tests/shell.test.ts` verifies plugin init, event registration, dapp mounting

**Plugin Tests:**
- Scope: Plugin factory + provider implementations
- Approach: Mock context, call plugin methods, verify state and events
- Coverage: Provider connect/disconnect, state changes, error handling
- Location: `plugins/*/tests/*.test.ts`

**No E2E Tests:**
- E2E tests not in scope (browser integration would require different setup)
- Browser-specific behavior (hashchange, popstate) tested with event simulation in unit tests

## Coverage

**Requirements:** Not enforced (no coverage thresholds in config)

**View Coverage:**
```bash
# Coverage not configured — add coverage reporter to vitest.config.ts if needed
```

## Common Patterns

**Async Testing:**
```typescript
const tick = () => new Promise((r) => setTimeout(r, 0));

it('navigate() notifies listeners exactly once', async () => {
  const router = createRouter({ mode: 'hash', /* ... */ });
  router.navigate('/a');
  await tick(); // let hashchange settle

  const handler = vi.fn();
  router.onRouteChange(handler);
  router.navigate('/b');
  await tick();

  expect(handler).toHaveBeenCalledTimes(1);
  router.destroy();
});
```

**Error Testing:**
```typescript
it('rejects plugin namespace mismatch', () => {
  const bus = createEventBus();
  const registry = createEventRegistry(bus);

  expect(() => {
    registry.registerEvent('wallet', [{ name: 'dx:plugin:auth:foo' }]);
  }).toThrow('namespace mismatch');
});

// Or for async errors
it('connect() throws without window.ethereum', async () => {
  const provider = createEIP1193Provider();
  await expect(provider.connect()).rejects.toThrow('No wallet detected');
});
```

**Event Bus Testing:**
```typescript
it('delivers events to subscribers', () => {
  const bus = createEventBus();
  const handler = vi.fn();

  bus.on('dx:ready', handler);
  bus.emit('dx:ready', {});

  expect(handler).toHaveBeenCalledOnce();
  expect(handler).toHaveBeenCalledWith({});
});

// Multiple subscribers
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
```

**DOM Testing:**
```typescript
beforeEach(() => {
  container = document.createElement('div');
  container.id = 'dx-mount';
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
});

it('emits dx:mount with container reference', async () => {
  const lm = createLifecycleManager(events, { scriptLoader: noopLoader });
  const handler = vi.fn();

  events.on('dx:mount', handler);
  await lm.mount(manifest('hello'), container);

  expect(handler).toHaveBeenCalledWith({
    id: 'hello',
    container, // Actual DOM reference
    path: '/hello',
  });
});
```

**Listener Unsubscribe Testing:**
```typescript
it('onRouteChange() returns an unsubscribe function', () => {
  const router = createRouter({ /* ... */ });
  const handler = vi.fn();
  const unsub = router.onRouteChange(handler);

  unsub(); // Unsubscribe
  router.navigate('/blog');

  expect(handler).not.toHaveBeenCalled();
  router.destroy();
});
```

**State Testing:**
```typescript
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
```

## Test Cleanup

**Destroy Pattern:**
- Most factories return a `destroy()` method
- Called in test (not in afterEach) to verify cleanup happens
- Typical cleanup: remove event listeners, clear state

```typescript
it('some test', () => {
  const router = createRouter(config);
  // ... test ...
  router.destroy(); // Unsubscribe from popstate/hashchange
});
```

**Window State Cleanup:**
- `beforeEach()` resets `window.location` via `window.history.replaceState(null, '', '/')`
- `afterEach()` in shell tests deletes `window.__DXKIT__`

---

*Testing analysis: 2026-07-11*

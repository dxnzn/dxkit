[Getting Started](getting-started.md) | [Dapp Development](dapp-development.md) | [Plugin Development](plugin-development.md) | [System Internals](system-internals.md) | [Events Reference](events-reference.md) | [API Reference](api-reference.md) | [Cookbook](cookbook.md) | [Configuration](configuration.md) | [Development](development.md) | **Testing** | [Security](security.md)

---

# Testing

DxKit's test suite runs on [Vitest](https://vitest.dev) 4.x with [happy-dom](https://github.com/capricorn86/happy-dom) as the DOM environment, driven by a single root-level `vitest.config.ts` that covers the core package and all four plugins — there is no per-package test runner. This doc covers how the suite is configured, how to run it, and the conventions observed across the existing test files. See [Development](development.md) for the broader local dev workflow (build, lint, commit).

[Test Framework & Setup](#test-framework--setup) | [Running Tests](#running-tests) | [Test Locations](#test-locations) | [Writing New Tests](#writing-new-tests) | [Conventions](#conventions) | [Coverage](#coverage) | [CI Integration](#ci-integration)

---

## Test Framework & Setup

| Tool | Version | Role |
|---|---|---|
| `vitest` | `^4.1.10` | Test runner, assertions (`expect`), mocking (`vi`) |
| `happy-dom` | `^20.10.6` | Lightweight DOM implementation — provides `document`, `window`, `CustomEvent`, `localStorage`, etc. for tests that exercise DOM-touching code (mounting, event bus, storage) |

Both are `devDependencies` at the workspace root (`package.json`) — no test dependencies live in the individual plugin `package.json` files. No global setup step is required beyond `pnpm install` (or `make setup`).

`vitest.config.ts` (project root):

```ts
export default defineConfig({
  resolve: { alias: aliases },
  test: {
    environment: 'happy-dom',
    include: [
      'tests/**/*.test.ts',
      'plugins/*/tests/**/*.test.ts',
    ],
  },
});
```

| Setting | Value | Why it matters |
|---|---|---|
| `test.environment` | `'happy-dom'` | Applies to the whole suite — every test file gets a DOM, not only ones that explicitly need one. |
| `test.include` | `tests/**/*.test.ts`, `plugins/*/tests/**/*.test.ts` | The only two locations Vitest scans. A test file placed anywhere else is silently excluded from the suite. |
| `resolve.alias` | Maps `@dnzn/dxkit`, `@dnzn/dxkit-wallet`, `@dnzn/dxkit-auth`, `@dnzn/dxkit-theme`, `@dnzn/dxkit-settings` to each package's `src/index.ts` | Tests run against **source**, not built `dist/` output — no build step is required before running tests, and test runs reflect uncommitted source changes immediately. |

## Running Tests

| Command | Runs |
|---|---|
| `make test` | `make lint` (Biome check), then `make typecheck` (`tsc --noEmit` per package), then `npx vitest run` — the full suite, once, non-interactively. This is what CI runs. |
| `make test-watch` | `make lint`, then `make typecheck`, then `npx vitest` — full suite in watch mode, re-running on file change. |
| `make smoke` | Build, then `vitest run --config vitest.smoke.config.ts` against the real `dist/` artifacts — a separate suite from `make test` (see [Build-artifact smoke test](#build-artifact-smoke-test)). |
| `npm run test` / `pnpm test` | `vitest run` directly (no lint step) — root `package.json` script. |
| `npm run test:watch` / `pnpm test:watch` | `vitest` in watch mode (no lint step) — root `package.json` script. |

To run a subset, pass a path or pattern straight to Vitest:

```bash
npx vitest run tests/router.test.ts                    # single file
npx vitest run plugins/wallet/tests/wallet.test.ts      # single plugin's tests
npx vitest run -t "rejects dx: prefix for non-plugin events"   # by test name
npx vitest tests/router.test.ts                          # single file, watch mode
```

Because there's one root config and no per-package `test` script, `pnpm --filter` scoping (common in other pnpm monorepos) doesn't apply here — always invoke `vitest` from the project root, or pass a `plugins/<name>/tests/...` path to scope to a single plugin.

## Test Locations

| Path | Covers |
|---|---|
| `tests/*.test.ts` | Core package (`src/`) — `events.test.ts`, `lifecycle.test.ts`, `registry.test.ts`, `router.test.ts`, `shell.test.ts`, `stress.test.ts`, `utils.test.ts` |
| `plugins/auth/tests/auth.test.ts` | `@dnzn/dxkit-auth` |
| `plugins/settings/tests/settings.test.ts`, `plugins/settings/tests/integration.test.ts` | `@dnzn/dxkit-settings` |
| `plugins/theme/tests/theme.test.ts` | `@dnzn/dxkit-theme` |
| `plugins/wallet/tests/wallet.test.ts` | `@dnzn/dxkit-wallet` |

`tests/stress.test.ts` covers concurrency and mount-race scenarios (rapid navigation, overlapping mounts, load-timeout races) rather than a single `src/` module. Most plugins have one test file mirroring their single `src/index.ts` entry point; `@dnzn/dxkit-settings` is the exception, with `settings.test.ts` covering the plugin in isolation and `integration.test.ts` covering full-shell disable-cleanup behavior. Core otherwise has one test file per module (`src/events.ts` → `tests/events.test.ts`, `src/router.ts` → `tests/router.test.ts`, etc.), with `utils.test.ts` covering `src/utils.ts`.

## Writing New Tests

- **File naming:** `<module>.test.ts`, placed under `tests/` (core) or `plugins/<name>/tests/` (plugin). Anything outside those two globs is not picked up by `vitest.config.ts`.
- **No shared test-helpers file.** There is no `tests/helpers.ts`, `tests/setup.ts`, or global fixture file. Each test file defines its own local fixtures inline — for example, `plugins/wallet/tests/wallet.test.ts` declares a local `mockContext()` function that duck-types the full `Context` interface (`events`, `eventRegistry`, `router`, `getPlugin`, etc.) and a local `mockEIP1193Provider()` for simulating `window.ethereum`. Follow this pattern rather than introducing a shared helper module.
- **Imports:** import the public API via the package alias (`import { createEventBus } from '@dnzn/dxkit'`, `import { createWallet } from '@dnzn/dxkit-wallet'`) the same way a consumer would. `tests/utils.test.ts` is the one exception — since `deepMerge` isn't part of the public export surface, it imports directly from source (`import { deepMerge } from '../src/utils.js'`). Use the alias for anything exported from a package's `index.ts`; fall back to a relative source import only for internal, non-exported helpers.
- **`describe` blocks are named after the factory or module under test** (`describe('createShell', ...)`, `describe('EventBus', ...)`, `describe('EventRegistry', ...)`), with `it(...)` descriptions written as plain-English behavior statements ("emits dx:error (source shell:mount) when #dx-mount is absent, without throwing").

## Conventions

- **`vi.fn()` capture over log assertions.** Behavior is verified by asserting on mock call args/counts (`toHaveBeenCalledWith`, `toHaveBeenCalledOnce`), never by asserting on `console.*` output — the codebase doesn't log to console in the first place. Runtime errors are emitted on the event bus (`dx:error`) rather than logged; see [Development](development.md) for the full logging convention.
- **Factory-per-test isolation.** Nothing is shared across tests via module-level state. Each `it()` (or each `beforeEach`) calls the relevant `create*()` factory fresh — `createEventBus()`, `createShell()`, `createEIP1193Provider()`, etc. — so tests don't leak listeners or state into one another. Where a factory attaches to global/DOM state (`createShell()` sets `window.__DXKIT__` and mounts into `#dx-mount`), `afterEach` tears it down explicitly:
  ```ts
  afterEach(() => {
    if (shell) shell.destroy();
    container.remove();
    delete window.__DXKIT__;
  });
  ```
- **`dx:error` event assertions.** Because failures are surfaced as events rather than thrown exceptions or console output (per the shell's fail-safe design — see [System Internals](system-internals.md)), tests that exercise an error path subscribe a `vi.fn()` handler to `dx:error` (via `bus.on('dx:error', handler)`, `window.addEventListener('dx:error', ...)`, or `ctx.events.on('dx:error', ...)` depending on what's under test) and assert on the captured payload's `source` and `error`/`message` fields, e.g. `expect(handler).toHaveBeenCalledWith({ source: 'test', error: new Error('fail') })`. Tests that assert an operation *doesn't* fail also assert the negative — `expect(errorHandler).not.toHaveBeenCalled()`.
- **DOM setup/teardown lives in `beforeEach`/`afterEach`**, not in shared fixtures — tests that need a mount point create and append a `<div id="dx-mount">` in `beforeEach` and `.remove()` it in `afterEach`.
- **No-op loaders for lifecycle-adjacent tests.** Tests that create a `Shell` but don't care about actual asset loading pass no-op `scriptLoader`/`styleLoader` overrides (`lifecycle: { scriptLoader: async () => {}, styleLoader: async () => {} } `) to avoid happy-dom's lack of real script/stylesheet execution.

## Coverage

No coverage tool (`@vitest/coverage-v8`, `c8`, `nyc`, etc.) is configured in `package.json` `devDependencies`, `vitest.config.ts`, or any `.nycrc`/`c8` config file. There is no coverage threshold enforced locally or in CI.

## Build-artifact smoke test

Separate from the unit suite, `make smoke` exercises the *built* `dist/` artifacts — the deployment surface that neither `tsc` nor `vitest run` (which run against `src/`) touch. It uses its own config, `vitest.smoke.config.ts`, and lives under `smoke/`:

| Path | Purpose |
|---|---|
| `smoke/dist-exports.smoke.test.ts` | The smoke suite — asserts export parity against the built artifacts |
| `smoke/fixtures/expected-exports.ts` | `EXPECTED_EXPORTS`: the expected top-level export-key set per package |
| `smoke/node-builtins.d.ts` | Ambient declarations for the `node:*` builtins used, keeping the smoke suite `@types/node`-free (same posture as `tests/`) |
| `vitest.smoke.config.ts` | Dedicated vitest config scoped to `smoke/` |

For each package (core + all 4 plugins) it checks two real consumption paths:

- **CJS `require()` interop** — `require('<pkg>/dist/index.cjs')` returns exactly the expected top-level key set.
- **IIFE global-attach** — the `dist/index.global.js` bundle is executed via `node:vm`'s `runInContext` against a fresh happy-dom `Window` (never happy-dom's `<script>`-element path, which silently drops top-level `var` globals), and the expected global (`DxKit`, `DxWallet`, `DxAuth`, `DxTheme`, `DxSettings`) attaches with exactly its expected key set. Core is loaded before any plugin, mirroring the real multi-`<script>` deployment shape and confirming globals coexist without collision.

`make smoke` declares `build` as a prerequisite, so the artifacts under test are always freshly built, never stale. It is **not** part of `make test` (which stays fast and source-only) — it runs in `make release`, `make publish`, and CI, always after `make verify-outputs`. `dist/` paths are resolved from the repo root (`process.cwd()`), never from an env var or CLI argument.

## CI Integration

`.github/workflows/ci.yml` — job `test`, triggered on push to `main` and on pull requests targeting `main`:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: pnpm/action-setup@v4
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}   # ['22.12.0', 24]
      cache: pnpm
  - run: pnpm install --frozen-lockfile
  - run: make build
  - run: make verify-outputs
  - run: make smoke
  - name: Typecheck / deprecation gate (GATE-01)
    run: make typecheck
  - name: Zero-runtime-dependency assertion (GATE-02)
    run: make verify-no-runtime-deps
  - run: make test
```

CI builds every package first (`make build`), asserts all three build outputs exist per package (`make verify-outputs`), and smoke-tests the real built artifacts (`make smoke` — see [Build-artifact smoke test](#build-artifact-smoke-test) below). It then runs two named guardrail steps, each surfacing as its own GitHub Check: `Typecheck / deprecation gate (GATE-01)` (`make typecheck` — standalone `tsc --noEmit` per package) so a `tsc`/deprecation error fails distinctly rather than buried inside `make test`, and `Zero-runtime-dependency assertion (GATE-02)` (`make verify-no-runtime-deps`) which fails if the core `@dnzn/dxkit` package declares any runtime dependency. Finally `make test` lints (`biome check .`), type-checks again as part of its own chain, and runs the full Vitest suite (`vitest run`) — the same commands a contributor runs locally. The matrix runs two Node legs, `['22.12.0', 24]`: the pinned `22.12.0` leg exercises the exact `engines` floor (so a floor regression can't hide behind a rounded-up patch), and `24` is the current stable line. No coverage upload or reporting step is configured.

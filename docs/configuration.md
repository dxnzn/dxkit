[Getting Started](getting-started.md) | [Dapp Development](dapp-development.md) | [Plugin Development](plugin-development.md) | [System Internals](system-internals.md) | [Events Reference](events-reference.md) | [API Reference](api-reference.md) | [Cookbook](cookbook.md) | **Configuration** | [Development](development.md) | [Testing](testing.md) | [Security](security.md)

---

# Configuration

DxKit has no `.env` file, no config file loader, and no environment-variable surface. Everything is configured **programmatically** — options objects passed to `createShell()` and to each plugin's factory function. This doc catalogs every configuration knob across the shell, the lifecycle manager, and the four bundled plugins, plus the build-time config files that shape how the packages compile.

[Shell Configuration](#shell-configuration) | [Lifecycle Manager Options](#lifecycle-manager-options) | [Plugin Configuration](#plugin-configuration) | [localStorage Keys](#localstorage-keys) | [Build-Time Configuration](#build-time-configuration) | [Environment Variables](#environment-variables) | [Per-Environment Overrides](#per-environment-overrides)

---

## Shell Configuration

`createShell(config)` (`src/shell.ts`) accepts a `ShellConfig` (`src/types/shell.ts`):

```ts
interface ShellConfig {
  plugins?: Record<string, Plugin>;
  dapps?: DappEntry[];
  manifests?: DappManifest[];
  registryUrl?: string;       // default: '/registry.json'
  basePath?: string;          // default: '/'
  mode?: 'history' | 'hash';  // default: 'history'
  lifecycle?: LifecycleManagerOptions;
}
```

| Option | Required | Default | Description |
|---|---|---|---|
| `plugins` | No | `{}` | Plugin instances keyed by name. Initialized in this order during `shell.init()`. |
| `dapps` | No | — | Array of `{ manifest, overrides? }` — fetches each manifest URL, deep-merges `overrides`. Takes priority over `manifests` and `registryUrl` if provided. |
| `manifests` | No | — | Inline, fully-specified manifests — no fetch. Used if `dapps` is absent. |
| `registryUrl` | No | `'/registry.json'` | Fallback source — fetched only if neither `dapps` nor `manifests` is set. |
| `basePath` | No | `'/'` | Prefix stripped from routes before matching. |
| `mode` | No | `'history'` | `'history'` (pushState) or `'hash'` (`location.hash`) routing. |
| `lifecycle` | No | `{}` | Nested group for asset-loading knobs — see [Lifecycle Manager Options](#lifecycle-manager-options). |

See [Getting Started > Configuration](getting-started.md#configuration) for the manifest-loading fallback order and a full `DappManifest` example, and [API Reference > ShellConfig](api-reference.md#shellconfig) for the type signature.

> **Note:** Passing `scriptLoader`, `styleLoader`, or `templateLoader` directly on `ShellConfig` — instead of nested under `lifecycle` — throws an `Error` at `createShell()` time, naming the offending key(s) (`src/shell.ts`). This guard exists because untyped IIFE/JS consumers get no compile-time error for the wrong shape. Upgrading from 0.1.5? See [Migrating to 0.2.0](getting-started.md#migrating-to-020).

> **Note:** For the same untyped-consumer reason, `dapps`, `manifests`, and a fetched `registryUrl` body must each be an **array**. A wrong-shape value (object, string, number) does not throw — `loadManifests()`'s shared `coerceManifestArray()` guard emits a `dx:error` (source `shell:manifest`) and fail-closes that tier to an empty manifest list, so `window.__DXKIT__` is still exposed. Listen on `dx:error` to catch a malformed manifest config.

## Lifecycle Manager Options

The `lifecycle` group configures how the [Lifecycle Manager](system-internals.md) loads and mounts dapp assets (`src/lifecycle.ts`):

```ts
interface LifecycleManagerOptions {
  scriptLoader?: (src: string) => Promise<void>;
  styleLoader?: (href: string) => Promise<void>;
  templateLoader?: (src: string) => Promise<string>;
  timeout?: number;
  cacheTemplates?: boolean;
  sanitizeTemplate?: (html: string, manifest: DappManifest) => string | Promise<string>;
}
```

| Option | Default | Description |
|---|---|---|
| `scriptLoader` | Injects a `<script type="module">` | Override how dapp entry scripts are loaded — useful for testing or custom bundling. |
| `styleLoader` | Injects a `<link rel="stylesheet">` | Override how dapp stylesheets are loaded. |
| `templateLoader` | `fetch()` + `.text()` | Override how dapp HTML templates are fetched. |
| `timeout` | `30000` (30s) | Per-fetch timeout in milliseconds applied to script, style, and template loads. Pass `0` or `Infinity` to disable and restore hang-forever behavior — the documented escape hatch for slow IPFS gateways. |
| `cacheTemplates` | `true` | Cache fetched templates by URL so repeated mounts of the same dapp skip the fetch. Safe default for the content-addressed/immutable IPFS/static deployment target; set `false` for live-editing during development. Use `lifecycleManager.clearTemplateCache()` or `.invalidateTemplate(url)` to bust the cache manually. |
| `sanitizeTemplate` | none | Bring-your-own sanitizer (e.g. DOMPurify) run on fetched template HTML immediately before it's written into the mount container, on every mount including cache hits. Applies to template HTML only — dapp entry scripts are trusted code outside its reach. A throw or rejection aborts the mount. With no sanitizer configured, template injection is unchanged from pre-hardening behavior. |

Custom `scriptLoader`/`styleLoader`/`templateLoader` overrides are still subject to `timeout`, but via a `Promise.race` guard rather than a true abort — the overridden promise keeps running in the background after the guard rejects. Only the built-in loaders (left unset) get a true abort (`AbortController` / node removal).

```js
DxKit.createShell({
  lifecycle: {
    timeout: 15000,
    cacheTemplates: false, // dev mode: always refetch templates
    sanitizeTemplate: (html) => DOMPurify.sanitize(html),
  },
});
```

## Plugin Configuration

Each plugin is configured through its own factory function options — there is no shared plugin config schema. Options are merged with in-code defaults; nothing is read from environment variables or config files.

### `@dnzn/dxkit-wallet`

`createWallet(options)` — `WalletOptions` (`plugins/wallet/src/index.ts`):

| Option | Required | Default | Description |
|---|---|---|---|
| `providers` | Yes | — | Array of `WalletProvider` instances. The first `available()` provider is used by default. |
| `storageKey` | No | `'dxkit:wallet'` | `localStorage` key for the persisted active-provider selection. |

`createLocalWalletProvider(options)` — `LocalWalletProviderOptions`, a dev-only provider with an instant, deterministic connection:

| Option | Required | Default | Description |
|---|---|---|---|
| `address` | No | `'0x0000000000000000000000000000000001'` | Overrides the deterministic dev address returned on connect. |

See [@dxkit/wallet](plugins/wallet.md) for `createEIP1193Provider()` and custom-provider details.

### `@dnzn/dxkit-auth`

`createPassthroughAuth(options)` — `PassthroughAuthOptions` (`plugins/auth/src/index.ts`):

| Option | Required | Default | Description |
|---|---|---|---|
| `walletPlugin` | No | `'wallet'` | Name of the wallet plugin in the registry that auth bridges to. Wallet connected = authenticated; no tokens or sessions. |

### `@dnzn/dxkit-theme`

`createCSSTheme(options)` — `CSSThemeOptions` (`plugins/theme/src/index.ts`):

| Option | Required | Default | Description |
|---|---|---|---|
| `themes` | No | `['default']` | Available theme names. The first entry is the initial theme. |
| `defaultMode` | No | `'system'` | Initial mode: `'light'`, `'dark'`, or `'system'` (follows `prefers-color-scheme`). |
| `storageKey` | No | `'dxkit:theme'` | `localStorage` key for the persisted `{ theme, mode }` selection. |
| `onApply` | No | — | Called after `data-theme`/`data-mode` attributes are set on `<html>` — use for side effects like favicon or meta theme-color updates. |

### `@dnzn/dxkit-settings`

`createSettings(options)` — `SettingsPluginOptions` (`plugins/settings/src/index.ts`):

| Option | Required | Default | Description |
|---|---|---|---|
| `storageKey` | No | `'dxkit:settings'` | `localStorage` key for the persisted settings store (all dapps' values, in one JSON blob keyed by dapp ID internally). |

## localStorage Keys

DxKit's only persistence mechanism is `localStorage`, and only for the plugins above. Each plugin uses a single configurable key — there is no automatic per-dapp key namespacing at the storage layer; the settings plugin namespaces by dapp ID *inside* its one JSON blob, not via separate keys per dapp.

| Key (default) | Set by | Contents |
|---|---|---|
| `dxkit:wallet` | `@dnzn/dxkit-wallet` | Active provider ID string. |
| `dxkit:theme` | `@dnzn/dxkit-theme` | `{ theme, mode }` JSON. |
| `dxkit:settings` | `@dnzn/dxkit-settings` | JSON map of `dappId -> key -> value` for all dapps. |

All three plugins guard `localStorage` access behind a `typeof localStorage !== 'undefined'` check and swallow write/read errors into a `dx:error` event rather than throwing — safe in environments without storage (private browsing, `file:///`, SSR). If you run multiple shells or multiple dapp suites on the same origin and want isolated storage, pass a distinct `storageKey` per instance.

## Build-Time Configuration

These files control how the packages compile and how the workspace is linted, formatted, and tested. They are not read at runtime by DxKit itself.

### `tsup.config.ts`

Each package (core + each plugin under `plugins/*/`) has its own `tsup.config.ts`, producing three outputs from `src/index.ts`:

| Format | Output | Notes |
|---|---|---|
| ESM + CJS | `dist/index.js`, `dist/index.cjs` | `clean: true`, `sourcemap: true`. `.d.ts` declarations are emitted by a `tsc --emitDeclarationOnly` pass in tsup's `onSuccess` hook (not tsup's bundled `dts`, which injects a `baseUrl` deprecated under TypeScript 6). Core is declared `external` in plugin builds to avoid bundling it twice. |
| IIFE | `dist/index.global.js` | `platform: 'browser'`, attaches to a `globalName` (`DxKit`, `DxWallet`, `DxAuth`, `DxTheme`, `DxSettings`). Plugin IIFE builds set `noExternal: ['@dnzn/dxkit']` to bundle core inline so the `<script>` tag works standalone. |

### `tsconfig.json`

| Setting | Value |
|---|---|
| `target` / `module` | `ES2022` |
| `moduleResolution` | `bundler` |
| `lib` | `['ES2022', 'DOM']` |
| `strict` | `true` |
| `esModuleInterop` | `true` |
| `declaration` / `sourceMap` | `true` |
| `declarationMap` | `false` — the published package ships only `dist` (`files: ["dist"]`), so declaration maps pointing back at `src/` would dead-link for consumers; they are not emitted |
| `outDir` / `rootDir` | `dist` / `src` |
| `verbatimModuleSyntax` | `true` — forward-compat: import/export elision is explicit, so type-only imports must be written `import type` |
| `isolatedDeclarations` | `true` — forward-compat: every exported declaration must be independently typeable, guaranteeing per-file `.d.ts` emit without whole-program inference |
| `erasableSyntaxOnly` | `true` — forward-compat: bans non-erasable TS-only syntax (`enum`, `namespace`, parameter properties) so the source stays type-strippable |

The three forward-compat flags above are enabled in the base `tsconfig.json` and inherited by every package via `extends`; they ready the codebase for a future TypeScript 7.x jump without a rewrite. A durable guard in `tests/typecheck-config.test.ts` (the *Forward-compat flag presence* block) fails `make test` if any of the three is silently removed. The built artifacts are separately proven intact by `make smoke` (see [Testing › Build-artifact smoke test](testing.md#build-artifact-smoke-test)).

Each package also has a `tsconfig.typecheck.json` that extends its build config with `noEmit: true` and widens `include` to cover `tests/` as well as `src/`. This is the config `make typecheck` runs (`tsc --noEmit -p tsconfig.typecheck.json`) — a standalone type-check over source *and* tests, independent of the build's declaration emit. It sets `paths` (mirroring `vitest.config.ts`'s workspace aliases) but deliberately **no** `baseUrl`, since `baseUrl` is deprecated under TypeScript 6 (`TS5101`).

### `biome.json`

Biome 2.5.4 replaces ESLint/Prettier for both linting and formatting.

| Setting | Value |
|---|---|
| Formatter | 2-space indent, 120-char line width |
| Quotes | Single quotes |
| Trailing commas | All |
| Linter preset | `recommended`, with `suspicious.noExplicitAny` and `style.noNonNullAssertion` turned off |
| Scope | `src/**/*.ts`, `tests/**/*.ts`, `plugins/*/src/**/*.ts`, `plugins/*/tests/**/*.ts` |

Run `make lint` to check, `make lint-fix` to auto-fix, `make lint-format` to auto-format only.

### `vitest.config.ts`

| Setting | Value |
|---|---|
| `environment` | `happy-dom` |
| `test.include` | `tests/**/*.test.ts`, `plugins/*/tests/**/*.test.ts` |
| `resolve.alias` | Maps `@dnzn/dxkit*` package specifiers to their `src/index.ts` source, so tests run against source, not built `dist/` output. |

Run `make test` (lint + full suite) or `make test-watch` (lint + watch mode). See [Cookbook](cookbook.md) for testing patterns.

## Environment Variables

DxKit reads no environment variables at runtime — the source contains no `process.env` references. There is no `.env`, `.env.example`, or equivalent file in this repository. All runtime behavior is configured via the factory-function options documented above.

## Per-Environment Overrides

DxKit has no built-in `NODE_ENV`-style environment branching. If you need different configuration for development vs. production (e.g., a shorter `lifecycle.timeout`, `cacheTemplates: false` for live-editing, or a `createLocalWalletProvider()` in place of `createEIP1193Provider()`), branch on your own build-time flag or bundler `define` and pass the resulting values into `createShell()` / plugin factories — DxKit has no opinion on how that branching happens.

<!-- VERIFY: Deployment platform-specific env/secret mechanisms (if any) for whatever host serves the built dist/ assets are outside this repository's scope and not discoverable from source. -->

# Codebase Structure

**Analysis Date:** 2026-07-11

## Directory Layout

```
dxkit/
├── src/                    # Core framework source (TypeScript)
│   ├── shell.ts            # Shell orchestrator — main entry point for developers
│   ├── router.ts           # Router — path resolution and navigation
│   ├── lifecycle.ts        # Lifecycle manager — asset loading orchestration
│   ├── events.ts           # Event bus and event registry
│   ├── registry.ts         # Plugin registry
│   ├── utils.ts            # Utilities (deepMerge)
│   └── types/              # TypeScript type definitions
│       ├── index.ts        # Type barrel export
│       ├── shell.ts        # Shell/ShellConfig/Shell interface
│       ├── context.ts      # Context API (window.__DXKIT__)
│       ├── interfaces.ts   # Plugin, Wallet, Auth, Theme interfaces
│       ├── manifest.ts     # DappManifest interface
│       ├── events.ts       # EventBus, EventRegistry, EventMap
│       └── settings.ts     # Settings types (referenced by plugins)
│
├── plugins/                # Plugin packages (each is a separate package)
│   ├── wallet/             # @dnzn/dxkit-wallet — EIP-1193 wallet providers
│   │   ├── src/index.ts    # createEIP1193Provider, createLocalWalletProvider, createWallet factory
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsup.config.ts
│   ├── auth/               # @dnzn/dxkit-auth — Auth plugin (bridges to wallet)
│   │   ├── src/index.ts    # createPassthroughAuth factory
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsup.config.ts
│   ├── theme/              # @dnzn/dxkit-theme — Theme plugin (light/dark/system modes)
│   │   ├── src/index.ts    # createTheme factory
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsup.config.ts
│   └── settings/           # @dnzn/dxkit-settings — Settings plugin (key-value store)
│       ├── src/index.ts    # createSettings factory
│       ├── tests/
│       ├── package.json
│       └── tsup.config.ts
│
├── tests/                  # Core framework tests (vitest)
│   ├── shell.test.ts       # Shell orchestration tests
│   ├── router.test.ts      # Router path resolution tests
│   ├── lifecycle.test.ts   # Lifecycle mount/unmount tests
│   ├── events.test.ts      # Event bus and registry tests
│   ├── registry.test.ts    # Plugin registry tests
│   └── utils.test.ts       # Utility function tests
│
├── dist/                   # Compiled output (ESM, CJS, IIFE)
│   ├── index.js            # ESM build
│   ├── index.cjs           # CommonJS build
│   ├── index.global.js     # IIFE build (browser, no bundler required)
│   ├── index.d.ts          # TypeScript declarations
│   └── index.global.js.map # Source map
│
├── docs/                   # Developer documentation (markdown)
│   ├── getting-started.md          # Framework overview, quick start
│   ├── dapp-development.md         # Building dapps, manifest, lifecycle, context
│   ├── plugin-development.md       # Building plugins, initialization, events
│   ├── system-internals.md         # Architecture diagrams, sequence flows
│   ├── events-reference.md         # Complete event catalog
│   ├── api-reference.md            # All exported types and functions
│   ├── cookbook.md                 # Patterns and recipes
│   └── plugins/                    # Plugin documentation
│       ├── wallet.md               # Wallet plugin guide
│       ├── auth.md                 # Auth plugin guide
│       ├── theme.md                # Theme plugin guide
│       └── settings.md             # Settings plugin guide
│
├── examples/               # Example projects
│   └── getting-started/    # Complete sample dapp project
│
├── plans/                  # GSD planning artifacts
│
├── audit/                  # Audit reports
│   └── self/               # Self-review audits
│
├── .planning/              # GSD planning directory
│   └── codebase/           # This analysis and other codebase maps
│
├── .claude/                # Claude Code project config
├── .github/                # GitHub workflows (CI/release)
├── Makefile                # Build targets (make build, make test, etc.)
├── package.json            # Root workspace package
├── pnpm-workspace.yaml     # PNPM monorepo config
├── pnpm-lock.yaml          # Lockfile
├── tsconfig.json           # TypeScript config (root)
├── vitest.config.ts        # Vitest config
├── biome.json              # Biome linter/formatter config
├── CLAUDE.md               # Project instructions for Claude
├── README.md               # Project overview and dev guide
└── LICENSE                 # MIT license
```

## Directory Purposes

**`src/`**
- Purpose: Core framework implementation
- Contains: Framework entry point, routing, lifecycle, event bus, type definitions
- Key files: `shell.ts` (orchestrator), `router.ts` (navigation), `lifecycle.ts` (asset loading)

**`src/types/`**
- Purpose: Centralized TypeScript interfaces and types
- Contains: Type definitions for all public APIs (Plugin, Context, DappManifest, EventBus, etc.)
- Key files: `interfaces.ts` (Plugin hierarchy), `manifest.ts` (DappManifest), `context.ts` (window.__DXKIT__)

**`plugins/`**
- Purpose: Extensible plugin ecosystem
- Contains: Separate package for each plugin (wallet, auth, theme, settings)
- Pattern: Each plugin is independently versioned and distributed on npm as @dnzn/dxkit-*

**`plugins/wallet/`**
- Purpose: Wallet integration (EIP-1193 and local providers)
- Key exports: `createEIP1193Provider()`, `createLocalWalletProvider()`, `createWallet()`

**`plugins/auth/`**
- Purpose: Authentication via wallet bridge
- Key exports: `createPassthroughAuth()`
- Dependencies: Requires wallet plugin to be registered

**`plugins/theme/`**
- Purpose: Light/dark/system theme management
- Key exports: `createTheme()`
- DOM integration: Applies `[data-theme-mode="light|dark"]` to `<html>`

**`plugins/settings/`**
- Purpose: Key-value settings store with sections and form generation
- Key exports: `createSettings()`
- Storage: localStorage by default

**`tests/`**
- Purpose: Unit and integration tests for core framework
- Framework: Vitest with happy-dom for DOM APIs
- Pattern: One test file per core module (shell.test.ts, router.test.ts, lifecycle.test.ts, etc.)
- Each plugin has its own tests under `plugins/*/tests/`

**`dist/`**
- Purpose: Compiled JavaScript output (generated by tsup)
- Outputs: ESM (index.js), CJS (index.cjs), IIFE (index.global.js), TypeScript declarations (index.d.ts)
- Use: Consumed by npm packages and script tags

**`docs/`**
- Purpose: Developer documentation
- Audience: Dapp developers, plugin developers, contributors
- Entry point: docs/getting-started.md

**`examples/`**
- Purpose: Sample projects demonstrating framework usage
- Use case: Getting started, learning dapp development pattern

**`audit/`**
- Purpose: Security and code quality audits
- Format: Self-review reports (markdown)

## Key File Locations

**Entry Points:**
- `src/index.ts` — Main barrel export (types and factories)
- `src/shell.ts` — `createShell()` factory for developers
- `plugins/*/src/index.ts` — Plugin factories

**Configuration:**
- `tsconfig.json` — TypeScript compiler options
- `tsup.config.ts` — Build configuration (ESM/CJS/IIFE outputs)
- `vitest.config.ts` — Test runner configuration
- `biome.json` — Linting and formatting rules
- `pnpm-workspace.yaml` — Monorepo workspace (root + plugins)

**Core Logic:**
- `src/shell.ts` — Shell initialization, plugin registration, dapp lifecycle
- `src/router.ts` — Path resolution, navigation, route matching
- `src/lifecycle.ts` — Asset loading (scripts, styles, templates), mount/unmount orchestration
- `src/events.ts` — Event bus (emit/on/once/off), event registry (validation, introspection)
- `src/registry.ts` — Plugin storage and lookup

**Type Definitions:**
- `src/types/interfaces.ts` — Plugin, Wallet, Auth, Theme interfaces
- `src/types/manifest.ts` — DappManifest (dapp metadata)
- `src/types/context.ts` — Context API (window.__DXKIT__)
- `src/types/events.ts` — EventBus, EventRegistry, EventMap (typed events)

**Testing:**
- `tests/shell.test.ts` — Shell orchestration, plugin registration, dapp enable/disable
- `tests/router.test.ts` — Path resolution, navigation, route matching, hash/history modes
- `tests/lifecycle.test.ts` — Mount/unmount, asset loading, error handling
- `tests/events.test.ts` — Event emission, listener management, event registry
- `tests/registry.test.ts` — Plugin registration and retrieval

## Naming Conventions

**Files:**
- Core modules: camelCase with .ts extension (shell.ts, router.ts, lifecycle.ts)
- Type definitions: Descriptive names with .ts extension (manifest.ts, context.ts, interfaces.ts)
- Tests: Match module name + .test.ts suffix (shell.test.ts, router.test.ts)
- Configuration: Lowercase with hyphens (tsup.config.ts, vitest.config.ts)

**Directories:**
- Core source: lowercase single word (src, types, tests, dist)
- Feature groups: lowercase plural (plugins, docs, examples)
- Hidden: dot prefix (.git, .github, .claude, .planning)

**Exported Functions:**
- Factory functions: createX pattern (createShell, createRouter, createPluginRegistry, createEventBus)
- Providers: createXProvider pattern (createEIP1193Provider, createLocalWalletProvider)

**Type Names:**
- Interfaces: PascalCase, suffixed with specific descriptor (Plugin, DappManifest, EventBus, EventRegistry)
- Type aliases: PascalCase (ShellConfig, WalletState, AuthState)
- Enums/unions: PascalCase (ThemeMode = 'light' | 'dark' | 'system')

**Event Names:**
- Shell events: `dx:<entity>:<action>` (dx:ready, dx:route:changed, dx:dapp:mounted, dx:error)
- Plugin events: `dx:plugin:<plugin-name>:<action>` (dx:plugin:wallet:connected, dx:plugin:auth:authenticated)
- Custom events: No `dx:` prefix required (myapp:loaded, myapp:error)

## Where to Add New Code

**New Plugin (Isolated Feature):**
- Create directory under `plugins/<plugin-name>/`
- Copy structure from existing plugin (wallet, auth, theme, or settings)
- Implement factory function in `plugins/<plugin-name>/src/index.ts`
- Export Plugin interface with name property
- Add optional init/destroy lifecycle hooks
- Register custom events in init via `context.eventRegistry.registerEvent()`
- Write tests in `plugins/<plugin-name>/tests/`
- Add to `pnpm-workspace.yaml` if not already listed
- Document in `docs/plugins/<plugin-name>.md`

**New Core Module (Shell Infrastructure):**
- Add TypeScript file to `src/`
- Export factory function and types
- Add barrel export to `src/index.ts`
- Add type definitions to `src/types/` if needed
- Write tests in `tests/`
- Document in `docs/system-internals.md`

**New Utility Function:**
- Add to `src/utils.ts` (if small and general-purpose)
- Or create new module in `src/` if complex/domain-specific
- Export from `src/index.ts` barrel
- Write test in `tests/utils.test.ts`

**New Type/Interface:**
- Add to appropriate type file in `src/types/`:
  - Plugin-related → `src/types/interfaces.ts`
  - Manifest-related → `src/types/manifest.ts`
  - Event-related → `src/types/events.ts`
  - Context API → `src/types/context.ts`
  - Shell config → `src/types/shell.ts`
- Export from `src/types/index.ts` barrel
- Export from main `src/index.ts` barrel

**New Test:**
- Place in `tests/` for core modules
- Place in `plugins/<plugin-name>/tests/` for plugins
- Use vitest (describe, it, expect, vi.fn(), beforeEach, afterEach)
- Mock loaders using testLoaders pattern from `tests/shell.test.ts:6-9`
- Clean up listeners and DOM in afterEach

**Documentation:**
- Framework docs (getting-started, dapp-development, plugin-development) → `docs/`
- Plugin docs → `docs/plugins/<plugin-name>.md`
- Architecture/internals → `docs/system-internals.md`
- API reference → `docs/api-reference.md`
- Recipes → `docs/cookbook.md`

## Special Directories

**`dist/`**
- Purpose: Compiled JavaScript output
- Generated: Yes (by tsup during `make build`)
- Committed: No (in .gitignore)
- Use: `npm install @dnzn/dxkit` downloads from dist

**`node_modules/`**
- Purpose: Installed dependencies
- Generated: Yes (by pnpm during `make setup`)
- Committed: No
- Use: Available to all build tools and tests

**`.planning/`**
- Purpose: GSD planning artifacts (phases, milestones, codebase maps)
- Generated: Yes (by GSD tools)
- Committed: Yes (tracked in git for audit trail)
- Use: Planning and execution context for GSD commands

**`.github/workflows/`**
- Purpose: GitHub Actions CI/CD pipelines
- Use: Automated testing, linting, releasing on version bump

**`plugins/*/node_modules/`**
- Purpose: Plugin-specific dependencies
- Generated: Yes (workspace hoisting by pnpm)
- Committed: No
- Note: Each plugin is a separate package in pnpm workspace

---

*Structure analysis: 2026-07-11*

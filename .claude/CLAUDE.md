<!-- GSD:project-start source:PROJECT.md -->

## Project

**DxKit**

DxKit is a headless microframework for building composable dapps — routing, lifecycle
management, a typed event bus, and a plugin registry, with zero DOM ownership. It ships a
core package (`@dnzn/dxkit`) plus four optional plugins (wallet, auth, theme, settings),
and targets static/IPFS deployment via IIFE builds alongside ESM/CJS for bundlers. It is
for developers assembling small, decoupled dapps (mounted one at a time into `#dx-mount`)
that talk to the shell only through `window.__DXKIT__`.

The framework is in alpha (0.1.5). This milestone hardens it toward beta — not beta yet,
but meaningfully more robust — and brings all documentation back into truth with the code.

**Core Value:** DxKit stays trustworthy for real use: failures are visible (never silent), the documented
behavior matches the actual behavior, and the alpha is stable enough to build on with
confidence.

### Constraints

- **Tech stack**: TypeScript 5.8.3, Node `^22.12.0 || >=24.0.0` / ES2022, pnpm 10.32.1, tsup, vitest + happy-dom, Biome — established; stay on TS 5.x this milestone (TS6 deferred).
- **Compatibility**: Breaking changes are acceptable (still alpha) *only where they clearly
  improve the API*; each must carry a `BREAKING CHANGE:` footer and migration notes. Prefer
  additive (new events / optional config) wherever it's equivalent.

- **Zero runtime deps**: Hardening must not introduce runtime dependencies — the zero-dep
  posture is a selling point.

- **Deployment**: IIFE / static / IPFS remains a first-class target; changes must not assume a bundler.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.8.3 - Core framework and all plugins
- JavaScript (generated) - Build outputs and tests

## Runtime

- Node.js `^22.12.0 || >=24.0.0` (ES2022 target)
- pnpm 10.32.1
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

- @dnzn/dxkit 0.1.5 - Headless microframework for composable dapps
- @dnzn/dxkit-wallet 0.1.5 - Wallet provider coordination and EIP-1193 support
- @dnzn/dxkit-auth 0.1.5 - Passthrough authentication (wallet-based)
- @dnzn/dxkit-theme 0.1.5 - CSS theme management with light/dark/system modes
- @dnzn/dxkit-settings 0.1.5 - Per-dapp configuration and settings persistence
- vitest 4.1.10 - Unit and integration test runner
- happy-dom 20.10.6 - Lightweight DOM implementation for test environment
- tsup 8.5.1 - Bundler for ES2022 → ESM/CJS/IIFE outputs
- vite 8.1.4 - Development server and module resolution
- @biomejs/biome 2.5.4 - Linter and formatter (replaces ESLint/Prettier)
- TypeScript 5.8.3 - Language compiler
- commit-and-tag-version 12.7.3 - Automated versioning and changelog
- commitizen 4.3.2 - Conventional commit interface
- cz-git 1.13.1 - Commit message adapter (maintained; replaces cz-conventional-changelog)

## Key Dependencies

- Framework exports only type definitions and factory functions
- All plugins are zero-dependency (internal workspace packages only)
- No external npm packages required at runtime
- All dependencies listed above are devDependencies
- Safe to remove for production builds

## Configuration

- No .env configuration required
- Framework is configured programmatically via factory options
- `tsup.config.ts` - Main package + IIFE build for browser (3 outputs per package)
- Plugin-specific `tsup.config.ts` files in each `plugins/*/tsup.config.ts`
- `vitest.config.ts` - Test environment configuration with path aliases
- `tsconfig.json` - TypeScript compilation target ES2022, strict mode, DOM lib included
- `biome.json` - Linting and formatting rules (2-space indent, 120-char line width, single quotes)

## Output Formats

- Modern import/export syntax
- For bundlers, Node.js ES modules, `<script type="module">`
- CommonJS require() syntax
- For legacy Node.js tooling
- Self-contained browser bundle
- Attaches to global: `DxKit`, `DxWallet`, `DxAuth`, `DxTheme`, `DxSettings`
- Primary deployment target for IPFS/static hosting
- Generated TypeScript type files with source maps

## Platform Requirements

- Node.js `^22.12.0 || >=24.0.0` (ES2022 support)
- pnpm 10.32.1
- Linux/macOS/Windows with bash/make
- Browser with ES2022 support (via IIFE or bundler)
- Optional: localStorage for persistence (theme, settings, wallet state)
- Optional: window.ethereum (EIP-1193 injected provider for wallet plugin)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Source files: `camelCase.ts` (e.g., `router.ts`, `events.ts`, `lifecycle.ts`)
- Test files: `camelCase.test.ts` (e.g., `router.test.ts`, `shell.test.ts`)
- Type definition files: `camelCase.ts` grouped in `types/` directory (e.g., `types/interfaces.ts`, `types/manifest.ts`)
- Index/barrel files: `index.ts`
- All functions: `camelCase` (e.g., `createRouter()`, `normalizePath()`, `updateState()`)
- Factory functions: `create*` prefix (e.g., `createEventBus()`, `createPluginRegistry()`, `createEIP1193Provider()`)
- Internal/private functions: `camelCase`, declared within factory closures (e.g., `readCurrentPath()`, `notifyListeners()`)
- Handler functions: descriptive camelCase (e.g., `handleRouteChange()`, `onPopState()`)
- `camelCase` for all variables and parameters (e.g., `manifests`, `handlers`, `pendingMountId`)
- `const` preferred; `let` for variables that must be reassigned
- Boolean variables: prefixed with verb when appropriate (e.g., `paused`, `initialized`, `connected`)
- Collections named plural (e.g., `manifests`, `listeners`, `handlers`)
- `PascalCase` for all type and interface names (e.g., `Router`, `EventBus`, `DappManifest`, `WalletState`)
- Interfaces: `PascalCase` (e.g., `Plugin`, `Context`, `LifecycleManager`)
- Type aliases: `PascalCase` (e.g., `ScriptLoader`, `StyleLoader`, `ThemeMode`)
- State object types: `*State` suffix (e.g., `WalletState`, `AuthState`)
- Module-level constants: `UPPER_SNAKE_CASE` (e.g., `SHELL_EVENTS`)
- Used sparingly — most configuration is passed as function parameters

## Code Style

- Tool: Biome 2.5.4
- Indent: 2 spaces
- Line width: 120 characters
- Quotes: Single quotes (enforced)
- Trailing commas: All (enforced)
- See: `biome.json` for complete config
- Tool: Biome (same as formatter)
- Preset: recommended
- Exceptions:
- Run: `make lint` (checks only), `make lint-fix` (auto-fix)

## Import Organization

- `@dnzn/dxkit` → core package exports
- `@dnzn/dxkit-wallet` → wallet plugin package
- `@dnzn/dxkit-auth` → auth plugin package
- `@dnzn/dxkit-theme` → theme plugin package
- `@dnzn/dxkit-settings` → settings plugin package
- Defined in `vitest.config.ts` and TypeScript config
- Relative paths with `.js` extension for local imports (e.g., `./events.js`)

## Error Handling

- Errors are thrown for validation failures, precondition violations, and unrecoverable states
- Error messages are descriptive and include context (e.g., `"Failed to load dapp script: ${src}"`)
- Reserved namespaces trigger errors (e.g., event registry rejects `dx:` prefix for non-plugin events)
- Duplicate event registration by different sources throws error
- Safe fallbacks used where appropriate (e.g., `loadedScripts` caches prevent duplicate loads)

## Logging

- Error events emitted on event bus (`dx:error`) rather than logged to console
- Event bus used for runtime event logging
- No debug logging in production code
- Tests use `vi.fn()` to capture function calls instead of logging assertions

## Comments

- Explain non-obvious behavior and implicit contracts
- Document browser API quirks (e.g., hash mode navigation and async `hashchange` firing)
- Flag ordering dependencies or surprising no-ops
- Explain fallback chains and error-swallowing behavior
- One-line comments preferred
- Multi-line comments only for complex behavior
- Comment the "why", not the "what" (code reads clearly enough)
- Skip comments on trivial code (barrel exports, simple Map wrappers, self-evident types)
- No `@param` or `@returns` on internal functions — types speak for themselves
- JSDoc used only for public API surface and complex factory functions
- Multi-line JSDoc for context (e.g., `createEventBus()`, `createEventRegistry()`)

## Function Design

- Typed with interfaces/types
- Configuration objects preferred over many parameters (e.g., `config: RouterConfig`)
- Optional parameters: marked with `?` in type
- Defaults: in function signature (e.g., `events: EventBus = createEventBus()`)
- Named interfaces for return types (never `any` or overly generic types)
- Factory functions return interface, not implementation class
- Unsubscribe functions returned as `() => void` (e.g., `router.onRouteChange()` returns unsubscribe)
- Async functions return `Promise<T>` or `Promise<void>`

## Module Design

- Named exports only (no default exports)
- Barrel files (`index.ts`) export types and factories
- Interfaces exported as type, implementations as functions
- Encapsulation via factory function closures (no classes)
- Private state (e.g., `loaded`, `listeners`, `handlers`) held in closure
- Public interface returned as object literal
- `src/types/index.ts` collects all type exports
- No intermediate barrel files that re-export

## TypeScript-Specific

- `strict: true` enforced
- `esModuleInterop: true`
- `moduleResolution: bundler`
- Types generated (`declaration: true`, `declarationMap: true`)
- Generic constraints used (e.g., `<K extends keyof EventMap>`, `<T extends Plugin>`)
- Partial types used where appropriate (e.g., `Partial<DappManifest>`)
- Record types for maps (e.g., `Record<string, Plugin>`)
- Union types for modes (e.g., `mode: 'history' | 'hash'`)

## Code Organization Examples

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Shell | Orchestrate plugins, routing, lifecycle, dapp mounting/unmounting | `src/shell.ts` |
| Router | Parse paths, resolve to manifests, listen for browser navigation | `src/router.ts` |
| Lifecycle Manager | Load assets (scripts/styles/templates), emit mount/unmount events | `src/lifecycle.ts` |
| Event Bus | Typed pub/sub via CustomEvent, pause/resume listeners | `src/events.ts` |
| Event Registry | Runtime event validation and introspection | `src/events.ts` |
| Plugin Registry | Store and retrieve plugin instances by name | `src/registry.ts` |
| Context | Public API surface exposed on window.__DXKIT__ | `src/types/context.ts` |

## Pattern Overview

- **Decoupled dapps** — Each dapp is a standalone mini-app that knows nothing about the shell beyond the window.__DXKIT__ API
- **Plugin-based extensibility** — Auth, wallet, theme, settings implemented as plugins, not core
- **Declarative manifests** — Dapp metadata (route, entry, assets) defined in JSON, not code
- **Immutable router** — Manifests are read-only after init; changes trigger full router rebuild
- **Event namespace isolation** — Shell events (dx:*), plugin events (dx:plugin:<name>:<action>), developer events (anything else)

## Layers

- Purpose: User-facing functionality — forms, charts, transactions, etc.
- Location: External (outside dxkit repo, mounted at runtime)
- Contains: HTML + JavaScript entry points specified in manifests
- Depends on: window.__DXKIT__ API only
- Used by: End users
- Purpose: Coordinate plugins, routing, mount/unmount, manifest loading
- Location: `src/shell.ts`, `src/lifecycle.ts`, `src/router.ts`
- Contains: Shell init logic, dapp mount/unmount, manifest fetching, enabled state tracking
- Depends on: Router, Lifecycle, EventBus, PluginRegistry
- Used by: Application startup code
- Purpose: Parse URLs, match to dapp routes, listen for navigation events
- Location: `src/router.ts`
- Contains: Path normalization, longest-prefix matching, history/hash mode support
- Depends on: DappManifest interface
- Used by: Shell (notifies on route change)
- Purpose: Typed pub/sub and event introspection
- Location: `src/events.ts`
- Contains: CustomEvent wrapper, listener management, registration validation
- Depends on: EventMap type definitions
- Used by: All components, plugins, dapps
- Purpose: Extend shell with wallet, auth, theme, settings capabilities
- Location: `plugins/*/src/index.ts`
- Contains: Plugin factory functions implementing Plugin interface
- Depends on: Context API
- Used by: Dapps via getPlugin()

## Data Flow

### Primary Request Path: User Clicks Link

### Sub-Path Navigation (Dapp Already Mounted)

### Unmount Path

### Plugin Initialization

### Event Flow

- Dapp calls `window.__DXKIT__.getPlugin('wallet')`
- Dapp calls wallet methods (connect, sign, etc.)
- Wallet emits typed events → Dapp listens via `window.__DXKIT__.events.on()`
- During init, plugin calls `context.getPlugin('other')`
- Plugin subscribes to other's events via `context.events.on()`
- Example: Auth plugin subscribes to wallet state changes → `plugins/auth/src/index.ts:70`
- Plugins hold their own state (wallet.state, auth.state, theme.state)
- Plugins notify subscribers via events when state changes
- No centralized store — each plugin is responsible for its own state

## Key Abstractions

- Purpose: Standard interface for extensible capabilities
- Examples: `plugins/auth/src/index.ts`, `plugins/wallet/src/index.ts`
- Pattern: Factory function returning Plugin instance with name, optional init/destroy, state getters, event handlers
- See: `src/types/interfaces.ts:9-21`
- Purpose: Declarative metadata for a dapp's identity, routing, and assets
- Examples: `{ id: 'token-sender', route: '/tools/sender', entry: 'dist/index.js', template: 'index.html' }`
- Pattern: Loaded from registry.json, dapp entries, or inline in shell config
- See: `src/types/manifest.ts`
- Purpose: Public surface area dapps interact with
- Accessed via: `window.__DXKIT__`
- Frozen at init to prevent mutation → `src/shell.ts:244`
- Includes: events, eventRegistry, router, getPlugin, getManifests, enableDapp, disableDapp, isDappEnabled
- See: `src/types/context.ts`
- Purpose: Path resolution with longest-prefix matching
- Pattern: Immutable — rebuild required when manifests change
- Modes: 'history' (pushState) or 'hash' (location.hash)
- Normalization: Strips basePath, ensures leading slash, removes trailing slash (except root)
- See: `src/router.ts:22-34`
- Purpose: Orchestrate asset loading in correct order with fail-safe patterns
- Order: Validate plugins → Load styles (non-blocking) → Load template → Load dependencies → Load entry script
- Failures: Styles fail silently, template/dependencies/entry fail loudly and prevent mount
- See: `src/lifecycle.ts:87-162`

## Entry Points

- Location: `src/shell.ts:15-46`
- Triggers: Application startup (developer calls `shell.init()`)
- Responsibilities: Register plugins, load manifests, initialize router, expose window.__DXKIT__, listen for route changes
- Location: `src/router.ts:63-81`
- Triggers: User click, history back/forward, or developer call to `shell.navigate()`
- Responsibilities: Update browser location, trigger route change listeners
- Location: `src/lifecycle.ts:87-162`
- Triggers: Route change to a dapp (detected by router)
- Responsibilities: Load scripts/styles/templates, emit dx:mount event to dapp

## Architectural Constraints

- **Single dapp active:** Only one dapp can be mounted at a time. Mounting a new dapp unmounts the previous one.
- **Mount container required:** Dapp must mount into `document.getElementById('dx-mount')`. If not found, mount is silently skipped.
- **Router immutability:** Router cannot be updated mid-session. Enabling/disabling dapps triggers full router rebuild and (if needed) unmount.
- **Pending mount guard:** Concurrent mount calls for the same dapp are deduplicated via pendingMountId → `src/shell.ts:43-45`
- **Global state:** Shell uses module-level variables (manifests, router, initialized, currentPath, pendingMountId, enabledState). Not suitable for multiple shell instances in same process.
- **Event isolation:** Shell events (dx:*) and plugin events (dx:plugin:<name>:<action>) are reserved. Developer/dapp events must not start with `dx:`.
- **Module-level singletons:** defaultScriptLoader, defaultStyleLoader, defaultTemplateLoader use module-level caches (loaded Set) → `src/lifecycle.ts:15-77`

## Anti-Patterns

### Duck-Typing for Plugin Detection

### Payload Mutation in Event Handlers

## Error Handling

- Missing required plugin → Error event emitted, dapp mount skipped → `src/lifecycle.ts:97-101`
- Style load failure → Error event emitted, mount continues (styles are non-blocking) → `src/lifecycle.ts:106-115`
- Template/dependency/entry failure → Error event emitted, mount aborted → `src/lifecycle.ts:118-155`
- Plugin init failure → Error event emitted, shell continues (plugin not available) → `src/shell.ts:219-230`
- Invalid manifest → Error event emitted, manifest discarded, shell continues → `src/shell.ts:164-172`

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

## Documentation Ship Gate

Documentation is first-class in this project. `/gsd-docs-update` MUST run (and pass) before `/gsd-ship` may push a branch or create a PR. This gate is blocking, exactly like the security ship gate.

**Marker contract** — `/gsd-docs-update`, when run in this project, must finish by writing a marker to the phase directory of the phase being shipped: `{phase_dir}/{padded_phase}-DOCS.md` with frontmatter:

```yaml
---
phase: <padded phase number>
status: current
verified_against: <git HEAD sha when the docs pass completed>
updated: <ISO date>
---
```

followed by a short body listing which docs were updated or verified as already accurate (a "no drift found" result is a valid pass — the marker still gets written). Commit the marker with the docs changes.

**Ship gate predicate** — during `/gsd-ship` preflight (alongside the security gate, before any push or `gh pr create`):

1. Resolve `DOCS_FILE={phase_dir}/{padded_phase}-DOCS.md`. If missing → **block** with `DOCS_SHIP_GATE_NO_UPDATE`: tell the user to run `/gsd-docs-update` and re-ship. Do not push; do not create the PR.
2. If present, read `verified_against` and check freshness: `git log <verified_against>..HEAD -- src/ plugins/*/src/` must be empty. Any source commit after the docs pass → **block** with `DOCS_SHIP_GATE_STALE`: docs were updated before later code changes; re-run `/gsd-docs-update`. (Planning/test/doc-only commits after the marker do not invalidate it.)
3. `status` must be `current`; any other or missing value fails closed.

This gate applies to phase ships and milestone ships alike. It is never satisfied by intent or by unrelated doc edits — only by the marker written at the end of a completed `/gsd-docs-update` run.

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

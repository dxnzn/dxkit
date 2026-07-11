<!-- refreshed: 2026-07-11 -->
# Architecture

**Analysis Date:** 2026-07-11

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Dapp Instances                          │
│  Individual mini-apps mounted one at a time into #dx-mount   │
└──────────────────────┬──────────────────────────────────────┘
                       │ dx:mount event triggers render
                       │ dx:unmount triggers teardown
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   Orchestration Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │  Shell       │  │  Lifecycle   │  │  Router         │    │
│  │ (shell.ts)   │  │ (lifecycle.) │  │ (router.ts)     │    │
│  └──────────────┘  └──────────────┘  └─────────────────┘    │
│  - Init/destroy    - Mount/unmount    - Path resolve/nav    │
│  - Plugin registry - Asset loading    - Longest-prefix      │
│  - Dapp enable/    - Script/style/    - Hash/history modes  │
│    disable         template loading   - popstate/hashchange │
└──────────────────┬─────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              Communication & State Management                │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │ Event Bus    │  │ Event        │  │ Plugin Registry │    │
│  │ (events.ts)  │  │ Registry     │  │ (registry.ts)   │    │
│  │              │  │ (events.ts)  │  │                 │    │
│  └──────────────┘  └──────────────┘  └─────────────────┘    │
│  - Typed emit/on   - Runtime event   - Plugin lookup        │
│  - once/off        registration      - getPlugin/getAll     │
│  - pause/resume    - Namespace       - Plugin lifecycle     │
│  - CustomEvent     validation        (init/destroy)         │
└─────────────────────────────────────────────────────────────┘
                       ▲
                       │
          ┌────────────┴────────────┐
          │                         │
          │ window.__DXKIT__        │ Plugins (wallet, auth,
          │ (context.ts)            │  theme, settings)
          │                         │ (plugins/*/src/)
          └────────────┬────────────┘
                       │
          Dapps access via window.__DXKIT__:
          - events (emit/on/once/off)
          - eventRegistry (registerEvent)
          - router (navigate/getCurrentPath)
          - getPlugin/getPlugins/getManifests
          - enableDapp/disableDapp/isDappEnabled
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

**Overall:** Layered event-driven architecture with zero DOM ownership.

**Key Characteristics:**
- **Decoupled dapps** — Each dapp is a standalone mini-app that knows nothing about the shell beyond the window.__DXKIT__ API
- **Plugin-based extensibility** — Auth, wallet, theme, settings implemented as plugins, not core
- **Declarative manifests** — Dapp metadata (route, entry, assets) defined in JSON, not code
- **Immutable router** — Manifests are read-only after init; changes trigger full router rebuild
- **Event namespace isolation** — Shell events (dx:*), plugin events (dx:plugin:<name>:<action>), developer events (anything else)

## Layers

**Presentation Layer (Dapps):**
- Purpose: User-facing functionality — forms, charts, transactions, etc.
- Location: External (outside dxkit repo, mounted at runtime)
- Contains: HTML + JavaScript entry points specified in manifests
- Depends on: window.__DXKIT__ API only
- Used by: End users

**Orchestration Layer:**
- Purpose: Coordinate plugins, routing, mount/unmount, manifest loading
- Location: `src/shell.ts`, `src/lifecycle.ts`, `src/router.ts`
- Contains: Shell init logic, dapp mount/unmount, manifest fetching, enabled state tracking
- Depends on: Router, Lifecycle, EventBus, PluginRegistry
- Used by: Application startup code

**Routing Layer:**
- Purpose: Parse URLs, match to dapp routes, listen for navigation events
- Location: `src/router.ts`
- Contains: Path normalization, longest-prefix matching, history/hash mode support
- Depends on: DappManifest interface
- Used by: Shell (notifies on route change)

**Communication Layer:**
- Purpose: Typed pub/sub and event introspection
- Location: `src/events.ts`
- Contains: CustomEvent wrapper, listener management, registration validation
- Depends on: EventMap type definitions
- Used by: All components, plugins, dapps

**Plugin Layer:**
- Purpose: Extend shell with wallet, auth, theme, settings capabilities
- Location: `plugins/*/src/index.ts`
- Contains: Plugin factory functions implementing Plugin interface
- Depends on: Context API
- Used by: Dapps via getPlugin()

## Data Flow

### Primary Request Path: User Clicks Link

1. **Browser navigation triggered** (`window.location.hash` or `window.history.pushState`)
2. **Router detects change** (via `popstate`/`hashchange` listener) → `src/router.ts:97-104`
3. **Router calls notifyListeners()** → Resolves path to DappManifest → `src/router.ts:84-88`
4. **Shell handleRouteChange fires** → Determines if mount or unmount needed → `src/shell.ts:258-267`
5. **Lifecycle.mount() loads assets**:
   - Validate required plugins → `src/lifecycle.ts:94-103`
   - Load styles (non-blocking) → `src/lifecycle.ts:106-115`
   - Load template (blocking) → `src/lifecycle.ts:118-129`
   - Load dependencies in order → `src/lifecycle.ts:132-144`
   - Load entry script → `src/lifecycle.ts:147-155`
6. **Lifecycle emits dx:mount** → Dapp listens for this event and renders into container → `src/lifecycle.ts:160`
7. **Shell emits dx:dapp:mounted** → Broadcast that dapp is now active → `src/lifecycle.ts:161`

### Sub-Path Navigation (Dapp Already Mounted)

When user navigates within a mounted dapp's route (e.g., `/tools/sender` → `/tools/sender/123`):

1. **Shell.mountDapp() detects same dapp** → `src/shell.ts:274`
2. **Shell emits dx:route:subpath** → Notifies dapp of path change within its scope → `src/shell.ts:278`
3. **Dapp receives subpath event, updates its own internal state** (no remount)

### Unmount Path

1. **Route changes to unrelated path** (different dapp or root)
2. **Shell calls lifecycle.unmount()** → `src/shell.ts:262`
3. **Lifecycle emits dx:unmount** → Dapp teardown hook, cleanup listeners → `src/lifecycle.ts:168`
4. **Lifecycle emits dx:dapp:unmounted** → Broadcast unmount complete → `src/lifecycle.ts:169`

### Plugin Initialization

1. **Shell.init() registers plugins** → Adds to registry, emits dx:plugin:registered → `src/shell.ts:208-212`
2. **Shell loads manifests** (dapp entries, inline, or registry.json) → `src/shell.ts:215`
3. **Shell calls plugin.init(context)** → Plugins subscribe to events, fetch initial state → `src/shell.ts:219-230`
4. **Plugins use duck-typing** to detect and interop with other plugins (e.g., Auth fetches Wallet) → `src/shell.ts:65-68`

### Event Flow

**Dapp → Plugin communication:**
- Dapp calls `window.__DXKIT__.getPlugin('wallet')`
- Dapp calls wallet methods (connect, sign, etc.)
- Wallet emits typed events → Dapp listens via `window.__DXKIT__.events.on()`

**Plugin → Plugin communication:**
- During init, plugin calls `context.getPlugin('other')`
- Plugin subscribes to other's events via `context.events.on()`
- Example: Auth plugin subscribes to wallet state changes → `plugins/auth/src/index.ts:70`

**State Management:**
- Plugins hold their own state (wallet.state, auth.state, theme.state)
- Plugins notify subscribers via events when state changes
- No centralized store — each plugin is responsible for its own state

## Key Abstractions

**Plugin Interface:**
- Purpose: Standard interface for extensible capabilities
- Examples: `plugins/auth/src/index.ts`, `plugins/wallet/src/index.ts`
- Pattern: Factory function returning Plugin instance with name, optional init/destroy, state getters, event handlers
- See: `src/types/interfaces.ts:9-21`

**DappManifest:**
- Purpose: Declarative metadata for a dapp's identity, routing, and assets
- Examples: `{ id: 'token-sender', route: '/tools/sender', entry: 'dist/index.js', template: 'index.html' }`
- Pattern: Loaded from registry.json, dapp entries, or inline in shell config
- See: `src/types/manifest.ts`

**Context API:**
- Purpose: Public surface area dapps interact with
- Accessed via: `window.__DXKIT__`
- Frozen at init to prevent mutation → `src/shell.ts:244`
- Includes: events, eventRegistry, router, getPlugin, getManifests, enableDapp, disableDapp, isDappEnabled
- See: `src/types/context.ts`

**Router:**
- Purpose: Path resolution with longest-prefix matching
- Pattern: Immutable — rebuild required when manifests change
- Modes: 'history' (pushState) or 'hash' (location.hash)
- Normalization: Strips basePath, ensures leading slash, removes trailing slash (except root)
- See: `src/router.ts:22-34`

**Lifecycle Manager:**
- Purpose: Orchestrate asset loading in correct order with fail-safe patterns
- Order: Validate plugins → Load styles (non-blocking) → Load template → Load dependencies → Load entry script
- Failures: Styles fail silently, template/dependencies/entry fail loudly and prevent mount
- See: `src/lifecycle.ts:87-162`

## Entry Points

**Shell Init:**
- Location: `src/shell.ts:15-46`
- Triggers: Application startup (developer calls `shell.init()`)
- Responsibilities: Register plugins, load manifests, initialize router, expose window.__DXKIT__, listen for route changes

**Route Navigation:**
- Location: `src/router.ts:63-81`
- Triggers: User click, history back/forward, or developer call to `shell.navigate()`
- Responsibilities: Update browser location, trigger route change listeners

**Dapp Mount:**
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

**What happens:** Shell and plugins detect each other by checking for specific method names rather than using interfaces.

Example: Auth plugin checks if wallet has 'getSettingsAPI' → `src/shell.ts:66`

**Why it's wrong:** No type safety, unclear contracts, easy to break if method names change.

**Do this instead:** Define and use typed plugin interfaces. If a plugin needs to be optional, use a callback or explicit registration instead of duck-typing.

### Payload Mutation in Event Handlers

**What happens:** Some events pass mutable objects (e.g., `dx:mount` passes container HTMLElement).

**Why it's wrong:** Dapp could modify event detail, causing unexpected side effects in other listeners.

**Do this instead:** Use object freezing for all payloads, or use defensive copying if mutable objects are necessary.

## Error Handling

**Strategy:** Fail-safe with silent fallbacks for non-critical failures, error events for logging.

**Patterns:**
- Missing required plugin → Error event emitted, dapp mount skipped → `src/lifecycle.ts:97-101`
- Style load failure → Error event emitted, mount continues (styles are non-blocking) → `src/lifecycle.ts:106-115`
- Template/dependency/entry failure → Error event emitted, mount aborted → `src/lifecycle.ts:118-155`
- Plugin init failure → Error event emitted, shell continues (plugin not available) → `src/shell.ts:219-230`
- Invalid manifest → Error event emitted, manifest discarded, shell continues → `src/shell.ts:164-172`

All errors are emitted as `dx:error` events for developer to handle via event listener.

## Cross-Cutting Concerns

**Logging:** Not built-in. Developers listen to `dx:error`, `dx:route:changed`, `dx:mount`, `dx:unmount`, `dx:dapp:mounted`, `dx:dapp:unmounted` events to log.

**Validation:** Manifest validation in Shell.loadDappManifest() checks required fields → `src/shell.ts:148-157`. Event namespace validation in EventRegistry prevents naming conflicts → `src/events.ts:99-116`.

**Authentication:** Not core feature — implemented as optional Auth plugin that bridges to Wallet plugin → `plugins/auth/src/index.ts`.

**Theming:** Not core feature — implemented as optional Theme plugin that manages CSS classes and persisted preference → `plugins/theme/src/index.ts`.

---

*Architecture analysis: 2026-07-11*

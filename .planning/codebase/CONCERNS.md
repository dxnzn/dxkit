# Codebase Concerns

**Analysis Date:** 2026-07-11

## Project Status

**Alpha Software:**
- The README explicitly states this is alpha software (version 0.1.x) and should not be trusted in production without thorough testing and review
- Files: `README.md` (line 15)
- Impact: Consumers need explicit warning before deploying to production

## Security Concerns

### XSS Risk in Template Injection

**What happens:** `container.innerHTML = html` directly injects fetched HTML without sanitization.

**Files:** `src/lifecycle.ts` (line 121)

**Current mitigation:** Developers are expected to validate/sanitize template sources themselves. No documentation mentions this responsibility.

**Risk:** If template URLs point to untrusted sources or are compromised, arbitrary scripts can run in the app context with access to `window.__DXKIT__` context.

**Recommendations:**
1. Document that templates must be from trusted sources only
2. Consider adding an optional template sanitizer option to `LifecycleManager` config
3. Add validation/linting for template content in test/dev environments

### Settings Storage Lacks Encryption

**What happens:** Settings are persisted to `localStorage` in plain text, including user preferences and potentially sensitive configuration.

**Files:** `plugins/settings/src/index.ts` (lines 46-57), `plugins/theme/src/index.ts` (lines 68-81), `plugins/wallet/src/index.ts` (line 169)

**Current mitigation:** localStorage availability is checked, but no encryption.

**Recommendations:**
1. Document that sensitive settings should not be persisted via the settings plugin
2. Consider adding an optional encryption layer for storage

## Performance Bottlenecks

### Route Resolution Sorts Manifests on Every Call

**What happens:** Router.resolve() sorts manifests by length on every invocation (line 40 in `router.ts`).

**Files:** `src/router.ts` (line 40)

**Problem:** With many dapps (>50), this creates O(n log n) overhead per navigation. Sorting should occur once when router is created or manifests change.

**Cause:** Router is recreated in shell.rebuildRouter() when dapps are enabled/disabled, but within that instance, sorting happens repeatedly.

**Improvement path:**
1. Cache sorted manifests in router constructor
2. Update cache only when manifests change (which already triggers full router rebuild)
3. Benchmark impact with 100+ manifests

## Fragile Areas

### Hash Mode Navigation Double-Mount (Recently Fixed)

**Files:** `src/router.ts` (lines 66-76, comments on lines 68-71), `tests/router.test.ts` (lines 150-192)

**What was fixed:** Commit 419a0c7 — "fix(router): mount target dapp once per hash-mode navigation"

**Why it was fragile:** Hash mode requires special logic: assigning a *different* hash fires `hashchange` event (async), but assigning the *same* hash fires nothing. The fix explicitly notifies listeners when same hash is assigned, but requires careful conditional to avoid double-notify.

**Safe modification:** Any changes to hash mode navigation logic must preserve the conditional on line 72: `if (window.location.hash === target)`. Test with both different-hash and same-hash scenarios.

**Test coverage:** `router.test.ts` lines 150-192 cover the regression. Add more tests if modifying this logic.

### Settings-Theme Sync Loop Prevention

**What happens:** Theme plugin uses `syncing` flag to prevent re-entrant loop: settings change → theme change → settings write → settings event → theme change.

**Files:** `plugins/theme/src/index.ts` (lines 37-38, 98-102, 126-132)

**Why fragile:** The flag is a simple boolean. If a third party adds another layer that observes both settings and theme events, the re-entrancy protection breaks.

**Safe modification:** Before adding more settings-responsive plugins, consider a more robust pattern (e.g., transaction IDs or deeper call stack tracking).

### Mount Container Lazy Resolution with No Fallback

**What happens:** Shell lazily resolves `#dx-mount` on first mount. If it doesn't exist or is removed, mounts silently fail.

**Files:** `src/shell.ts` (lines 300-305)

**Problem:** No warning is emitted, and `currentDapp` remains null. Dapps and developers won't know why mounts aren't working.

**Safe modification:** Add a `dx:error` event when mount container can't be resolved, or validate during init().

## Scaling Limits

### Settings Storage Per-Section Handlers

**Current capacity:** Each setting (dappId + key) can have unlimited handlers via `onChange()` and `onAnyChange()`.

**Limit:** No cleanup happens when dapps are disabled. Handlers accumulate in `keyHandlers` and `dappHandlers` maps even after dapp is removed from DOM.

**Scaling path:** 
1. Track which handlers belong to which dapp
2. Clear handlers when dapp is disabled via `shell.disableDapp()`
3. Or provide a `clearHandlers(dappId)` method

**Files:** `plugins/settings/src/index.ts` (lines 32-34, 99-107)

### Window Event Listeners Not Cleaned Up on Shell Reuse

**What happens:** If a page creates multiple shell instances without destroying the first, event listeners accumulate on `window`.

**Files:** `src/router.ts` (lines 98-104)

**Limit:** Multiple shells = multiple `popstate` and `hashchange` listeners firing on each navigation.

**Scaling path:** Document that `shell.destroy()` must be called before creating a new shell. Consider warning if multiple shells are initialized without cleanup.

## Dependencies at Risk

### TypeScript 6 Migration Required

**Current:** TypeScript ^5.8.3 in `package.json`

**Risk:** TypeScript 6 is likely to introduce breaking changes. The codebase uses advanced types (module augmentation, generics with constraints), which may be affected.

**Files:** `package.json` (line 48), `docs/plans` (mentioned in commit 359fd82)

**Migration plan:**
1. Test with TypeScript 6 beta when available
2. Run through existing test suite
3. Update all plugin packages in lockstep

### Plugin Lockstep Versioning Requires Discipline

**What happens:** All plugins must be released with the same version as core. Enforced by `.versionrc.json`.

**Files:** `.versionrc.json`, `bf822db` commit

**Risk:** If a plugin has a critical fix but core has no changes, the plugin can't be released independently. Conversely, a minor core update forces all plugins to bump major versions.

**Impact:** Consumer package.json management becomes complex; pinning core version pins all plugins.

## Missing Critical Features

### No Template Caching

**What happens:** Templates are fetched and injected on every mount, even if the same dapp is remounted.

**Files:** `src/lifecycle.ts` (lines 118-129)

**Blocks:** High-frequency navigation between same dapps will re-fetch the same HTML repeatedly.

**Improvement:** Cache fetched templates by URL, invalidate on explicit shell reload.

## Test Coverage Gaps

### No Tests for Concurrent Navigation and Mount Failures

**What's not tested:** 
- Rapid navigation (A → B → A → B) with slow script loaders
- Navigation while a mount is failing (e.g., timeout mid-load)
- Multiple shell instances competing for the same `#dx-mount` container

**Files:** `tests/shell.test.ts` has some mount de-duplication tests (lines 462-510) but not high-concurrency scenarios

**Risk:** Timing-dependent bugs similar to the hash-mode regression could hide in edge cases.

**Priority:** High — add stress tests with fast navigation and simulated slow loaders.

### Manifest Validation is Minimal

**What's not tested:**
- Manifests with invalid route formats (empty string, no leading slash)
- Routes that resolve to multiple manifests (shouldn't happen, but no check)
- Manifest deepMerge behavior with deeply nested overrides

**Files:** `src/shell.ts` (lines 147-157) has minimal validation; no tests for edge cases

**Risk:** Malformed manifests silently fail to load, consuming development time.

**Priority:** Medium — add validation tests for route formats and merge edge cases.

### Settings Plugin Handler Cleanup on Disable

**What's not tested:** Handlers registered via `onChange()` or `onAnyChange()` should not fire after a dapp is disabled via `shell.disableDapp()`.

**Files:** `plugins/settings/src/index.ts` (no cleanup on dapp disable)

**Risk:** Handlers fire on disabled dapps, potentially triggering logic in components that no longer exist.

**Priority:** Medium — test and fix handler cleanup.

### No E2E Tests for Plugin Initialization Order

**What's not tested:** Plugin init order matters. If settings plugin is registered before wallet, wallet's settings won't be available.

**Files:** `docs/plugin-development.md` documents this but no tests verify it.

**Risk:** Developers can misconfigure plugin order and get silent failures.

**Priority:** Low-Medium — add tests for common plugin ordering scenarios.

## Known Limitations

### No Built-in State Sharing Between Dapps

**Limitation:** Dapps don't have access to each other's state. Communication flows only through events.

**Files:** `docs/getting-started.md` (line 58)

**Impact:** Dapps building complex shared state need to implement their own mechanism (Redux, Zustand, etc.).

**Workaround:** Dapps can use the event bus to coordinate.

### Wallet Provider Persistence Relies on localStorage Key

**Limitation:** Selected provider is saved to `localStorage` under hardcoded key `dxkit:wallet`. If multiple apps share the same origin, they'll collide.

**Files:** `plugins/wallet/src/index.ts` (line 154)

**Impact:** Two DxKit apps on the same domain will interfere with each other's wallet persistence.

**Recommendation:** Make storage key configurable via `WalletOptions`.

### Router Doesn't Support Regex or Wildcard Routes

**Limitation:** Routes are matched via prefix matching only (`route` or `route/...`). No regex, no wildcards.

**Files:** `src/router.ts` (lines 36-48)

**Impact:** Complex routing scenarios (e.g., `/user/:id`) require post-resolution parsing in dapps.

## Potential Issues

### localStorage Failures Are Silent

**What happens:** When localStorage is unavailable or full, errors are caught and ignored in multiple places.

**Files:** 
- `plugins/wallet/src/index.ts` (lines 168, 179)
- `plugins/theme/src/index.ts` (lines 68, 83)
- `plugins/settings/src/index.ts` (lines 46, 59)

**Problem:** No warning is emitted. Users won't know their settings aren't being saved.

**Recommendation:** Emit `dx:error` event when storage operations fail.

### Script Load Errors Don't Clear Container

**What happens:** If `manifest.entry` fails to load, the mount is aborted but the DOM container isn't cleared. Previous dapp's DOM remains visible.

**Files:** `src/lifecycle.ts` (lines 146-155)

**Problem:** UI shows stale content from a previous dapp.

**Recommendation:** Clear container on script load failure, or restore previous content.

### No Timeout for Script/Style/Template Loads

**What happens:** If a script URL hangs, the mount hangs forever. No timeout protection.

**Files:** `src/lifecycle.ts` (lines 107-143)

**Problem:** Broken CDN or network issues cause the app to freeze mid-navigation.

**Recommendation:** Add optional timeout config to LifecycleManager.

### Theme System Assumes HTML Element Exists

**What happens:** Theme plugin tries to set attributes on `document.documentElement` at init. If document isn't ready, fails silently.

**Files:** `plugins/theme/src/index.ts` (lines 51-58)

**Mitigation:** Code checks `if (typeof document === 'undefined')` but doesn't retry if document becomes available later.

**Recommendation:** Defer DOM access until after DOM is ready if needed for SSR or prerendering scenarios.

## Deployment Concerns

### IIFE Builds Attach to Global Namespace

**What happens:** Each plugin IIFE attaches to a global (DxKit, DxWallet, DxAuth, DxTheme, DxSettings). Name collisions are possible.

**Files:** `plugins/*/tsup.config.ts`, `README.md` (lines 100-104)

**Risk:** Third-party scripts on the same page could overwrite these globals.

**Recommendation:** Use a namespace like `window.DxKitPlugins` or add version suffix to avoid collisions.

### No Content Security Policy Guidance

**What happens:** Using `innerHTML` to inject templates and loading scripts from external URLs requires specific CSP headers.

**Files:** `src/lifecycle.ts`, `docs/` lack CSP guidance

**Blocks:** Using DxKit on pages with strict CSP requires developer knowledge.

**Recommendation:** Add CSP configuration guide to docs.

---

*Concerns audit: 2026-07-11*

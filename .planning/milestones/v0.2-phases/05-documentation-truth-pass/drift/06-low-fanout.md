# Drift Log — Plan 05-06 (Cookbook, Development, Testing)

Per-doc record of what was wrong and what changed, verified against source read this plan
(`src/*.ts`, `src/types/*.ts`, `plugins/*/src/index.ts`, `plugins/*/tsup.config.ts`, `Makefile`,
`package.json`, `plugins/*/package.json`, `tsup.config.ts`, `vitest.config.ts`, `tsconfig.json`,
`biome.json`, `.versionrc.json`, `.github/workflows/ci.yml`, `pnpm-workspace.yaml`).

## docs/cookbook.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | "Custom Events Between Dapps" module-augmentation example used `declare module 'dxkit'` | Corrected package name to `declare module '@dnzn/dxkit'` | `package.json` (`"name": "@dnzn/dxkit"`); matches the same fix already applied to `events-reference.md`/`api-reference.md` in Plan 05-02 — cookbook.md had the identical bug, unfixed until now |
| 2 | "Remote Manifests with Overrides" deep-merge rule line omitted `null`-replaces behavior ("objects merge recursively, arrays replace entirely, `undefined` is skipped") | Added `null` replaces the previous value | `src/utils.ts:1` (`deepMerge` JSDoc + implementation: the recursive-merge branch is gated on `val !== undefined && val !== null`, so `null` falls through to a plain overwrite, not a skip) |

**Everything else checked and found already correct:** dapp manifest fields (Minimal Shell,
Permission-Gated Dapps, Optional Dapps); `dx:mount`/`dx:unmount` event payload shape
(`{ id, container, path }` / `{ id }`, `src/lifecycle.ts:452-464`); `dx:error` source-prefix
(`lifecycle:${id}`) and message text (`Missing required plugin(s): ...`, `src/lifecycle.ts:328-329`);
hash-mode `navigate()` behavior (`src/router.ts:65-81`); `eventRegistry.registerEvent(source,
events)` shape (`src/events.ts:93`, `EventRegistration { name, description? }`); settings plugin API
(`get`, `onChange`, `getSections` returning `{ id, label, definitions }`, `_shell` section labeled
"Dapps" — `plugins/settings/src/index.ts:109-220`); theme plugin API (`getResolvedMode()`,
`onModeChange()`, `data-mode` attribute on `<html>` — `plugins/theme/src/index.ts:53-231`);
`enableDapp`/`disableDapp`/`isDappEnabled` + `dx:dapp:enabled`/`dx:dapp:disabled` events
(`src/shell.ts:124-170`); `ShellConfig.plugins: Record<string, Plugin>` and `DappEntry { manifest,
overrides? }` (`src/types/shell.ts`); wallet plugin API (`createWallet`, `createEIP1193Provider` id
`'eip1193'` name `'Browser Wallet'`, `createLocalWalletProvider` id `'local'` name `'Local (Dev)'`,
`connect(providerId?)`, `getProviders()` — `plugins/wallet/src/index.ts:17-381`). No D-13
booster/hedge words present.

## docs/development.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | Monorepo layout tree nested `src/` and `tests/` only under the last plugin entry (`theme/`), visually implying only `theme` has those subdirectories | Replaced the misleading nesting with a single annotation applying to all four plugin dirs | `find plugins -maxdepth 2 -type d` — every plugin (`settings/`, `wallet/`, `auth/`, `theme/`) has its own `src/` and `tests/` |
| 2 | Build System section claimed plugin IIFE builds "bundle `@dnzn/dxkit` (and any intra-plugin dependency, e.g. `wallet` bundles `settings`) inline via `noExternal`, so a plugin `<script>` tag works standalone" | Corrected: every plugin's `tsup.config.ts` only sets `noExternal: ['@dnzn/dxkit']` — no plugin config lists an intra-plugin package (`@dnzn/dxkit-settings`, `@dnzn/dxkit-wallet`) as `noExternal` or `external` at all. In practice every plugin imports only *types* from `@dnzn/dxkit` and pulls in a sibling plugin package solely via a bare `import '@dnzn/dxkit-<name>'` for TS declaration-merging (no runtime value used), so nothing from either package is actually bundled into any plugin's output (verified: `grep -c dxkit-settings plugins/wallet/dist/index.global.js` → `0`; the CJS build even emits `require("@dnzn/dxkit-settings")` — i.e. left external, not inlined). Rewrote the paragraph to state what's actually true: plugin IIFE builds work standalone because they don't depend on any runtime code from `@dnzn/dxkit` or sibling plugin packages at all, only on their own bundled logic | `plugins/settings\|wallet\|auth\|theme/tsup.config.ts` (all four, identical shape: `external: ['@dnzn/dxkit']` for esm/cjs, `noExternal: ['@dnzn/dxkit']` for iife — no other package named); `plugins/wallet/src/index.ts:1-2` (`import type {...} from '@dnzn/dxkit'; import '@dnzn/dxkit-settings';`); `plugins/wallet/dist/index.global.js` (built artifact — 0 references to `dxkit-settings`, 0 references to `dxkit` core beyond an unrelated `storageKey` default string); `plugins/wallet/dist/index.cjs:29` (`require("@dnzn/dxkit-settings")` proves it's external, not bundled) |
| 3 | `make audit` table row attributed "against `src/` and `plugins/`" to all three tools (`pnpm audit`, `semgrep`, `gitleaks`) | Corrected: only `semgrep` scopes to `src/ plugins/`; `pnpm audit` operates on the lockfile/dependency graph (no path arg) and `gitleaks detect` scans `--source .` (the whole repo, not just `src/`/`plugins/`) | `Makefile:77-89` (`audit:` target — `semgrep --config p/typescript --metrics off src/ plugins/` vs. `gitleaks detect --source . --no-banner`) |

**Everything else checked and found already correct:** Node 18+/pnpm 10.32.1/make prerequisites;
`make setup`/`build`/`test`/`test-watch`/`lint`/`lint-fix`/`lint-format`/`clean`/`superclean`/
`commit`/`release`/`publish` targets and descriptions (`Makefile`); `test`/`test-watch` lint-first
gating; per-package `package.json` scripts (root has `test`/`test:watch`/`lint`/`lint:fix`/`format`
in addition to `build`/`clean`; plugins have only `build`/`clean`); tsup ESM/CJS/IIFE output paths
and per-package `globalName`s (`DxKit`/`DxWallet`/`DxAuth`/`DxTheme`/`DxSettings` —
`tsup.config.ts`, `plugins/*/tsup.config.ts`); Biome config (2-space indent, 120-char width, single
quotes, trailing commas, `noExplicitAny`/`noNonNullAssertion` off, `files.includes` glob —
`biome.json`); `vitest.config.ts` include globs; `.versionrc.json` `bumpFiles` list (verbatim);
`.github/workflows/ci.yml` (Node 20, `ubuntu-latest`, push/PR to `main`, `make build` then `make
test`); `pnpm-workspace.yaml` package list; commit conventions / Commitizen wiring
(`config.commitizen` in `package.json`). No D-13 booster/hedge words present.

## docs/testing.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | `test.environment` row explanation used "not just ones that explicitly need one" — trips the D-13 verify grep's `just` check even though the usage isn't a hedge/booster (it's "not only") | Reworded to "not only ones that explicitly need one" | D-13 slop-bar verify grep (`grep -Eiqw '...\|just\|...'`) |

**Everything else checked and found already correct:** Vitest 4.x / happy-dom devDependency
versions (`package.json`); `vitest.config.ts` code excerpt (verbatim `resolve.alias` + `test.environment`/
`test.include`); `make test`/`make test-watch`/`npm run test`/`npm run test:watch` command table;
single-root-config claim (no per-plugin `test` script — confirmed against all four plugin
`package.json` files, so `pnpm --filter <pkg> test` has nothing to run); Test Locations table
(`tests/*.test.ts` — `events`/`lifecycle`/`registry`/`router`/`shell`/`stress`/`utils`; one test file
per plugin except `settings`, which has `settings.test.ts` + `integration.test.ts` — confirmed via
directory listing of `tests/` and `plugins/*/tests/`); `afterEach` teardown pattern
(`shell.destroy()`, `container.remove()`, `delete window.__DXKIT__` — `tests/shell.test.ts:33-36`);
no-shared-test-helpers claim and `mockContext()`/`mockEIP1193Provider()` local-fixture pattern
(`plugins/wallet/tests/wallet.test.ts:11,31`); `deepMerge` direct-source-import exception
(`tests/utils.test.ts:1-2`, not re-exported from the package alias); no-op loader pattern
(`tests/shell.test.ts:8-9`); no coverage tool configured (`package.json` devDependencies,
`vitest.config.ts`); CI job shape (`.github/workflows/ci.yml` — single Node 20 matrix entry, no
coverage step).

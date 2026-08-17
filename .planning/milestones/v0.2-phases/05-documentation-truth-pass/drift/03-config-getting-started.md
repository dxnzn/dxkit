# Drift Log — Plan 05-03 (Config + Getting Started)

Per-doc record of what was wrong and what changed, verified against source read this plan
(`src/shell.ts`, `src/lifecycle.ts`, `src/types/shell.ts`, `src/types/manifest.ts`,
`plugins/*/src/index.ts`).

## docs/configuration.md

Config defaults, shapes, and the nested `lifecycle` group were already correct going into this
plan (timeout 30000, cacheTemplates true, sanitizeTemplate undefined-pass-through, plugin
storageKey defaults, mode/basePath defaults — all confirmed field-for-field against
`src/shell.ts:36-44`, `src/lifecycle.ts:253-267`, `plugins/*/src/index.ts`). Two drift items found:

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | "Breaking change note" callout used historical framing ("used to be top-level fields", "now live under") — violates D-07 (doc bodies stay timeless present; historical framing confined to the migration section) | Rewritten to describe only current behavior (the runtime guard throws) with a pointer to the new `getting-started.md#migrating-to-020` section for consumers upgrading from 0.1.5 | D-07 (05-CONTEXT.md); `src/shell.ts:16-29` (guard is current behavior, not history) |
| 2 | `scriptLoader`/`styleLoader`/`templateLoader` table rows didn't note that custom-loader overrides are still `timeout`-guarded via `Promise.race`, not a true abort (missing acceptance-criteria item) | Added a note below the Lifecycle Manager Options table: custom loaders get the `Promise.race` hang guard (background promise keeps running after reject); only built-in (unset) loaders get a true abort | RESEARCH §Code Truth: Config Defaults, `LifecycleManagerOptions.scriptLoader/styleLoader/templateLoader` row; `src/lifecycle.ts` `withTimeout()` |

**Everything else checked and found already correct:** `ShellConfig` interface shape and defaults
(`registryUrl` `/registry.json`, `basePath` `/`, `mode` `history`, `lifecycle` `{}`);
`LifecycleManagerOptions` field shapes (excludes `hasPlugin`, matching `Omit<LifecycleManagerOptions,
'hasPlugin'>` on `ShellConfig.lifecycle` — RESEARCH Pitfall 2); `WalletOptions`/
`LocalWalletProviderOptions`/`PassthroughAuthOptions`/`CSSThemeOptions`/`SettingsPluginOptions`
defaults and storageKey values; localStorage key table; build-time config tables (`tsup.config.ts`,
`tsconfig.json`, `biome.json`, `vitest.config.ts`); DOMPurify ESM snippet (already correct per
RESEARCH note).

## docs/getting-started.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | No migration path — "Further Configuration" section described the loader-nesting change with historical framing ("moved from top-level ShellConfig fields... now throws") but wasn't a dedicated, complete migration section, and violated D-07's timeless-present rule outside the designated migration section | Trimmed "Further Configuration" to timeless present (describes only the current `lifecycle` shape), added new "Migrating to 0.2.0" section covering all three breaking changes with before/after snippets for the loader-nesting change and the `timeout: 0`/`Infinity` escape hatch snippet | D-05 (migration section required, 05-CONTEXT.md); D-07 (timeless present elsewhere, 05-CONTEXT.md); RESEARCH §State of the Art (delta table) |
| 2 | Table of contents didn't link to a migration section (didn't exist) | Added `[Migrating to 0.2.0](#migrating-to-020)` to the top-of-doc nav line | New section added this plan |

**Migration section covers, per D-05:**
1. 30000ms default load timeout + `timeout: 0`/`Infinity` escape hatch (`src/lifecycle.ts:253`
   `options.timeout ?? 30000`)
2. Nested `ShellConfig.lifecycle` replacing flat `scriptLoader`/`styleLoader`/`templateLoader`,
   which now throw a runtime `Error` if present at the top level (`src/shell.ts:16-29`)
3. Manifest route normalization + rejection of empty/whitespace routes, `shell:route` `dx:error`
   (RESEARCH §Code Truth: Behavior → Route normalization and rejection)

**Everything else checked and found already correct:** Architecture diagram, Framework Overview,
Core Concepts (Shell/Dapps/Interfaces & Plugins/Events), System Lifecycle (Init/Navigation/
Teardown ordering), `ShellConfig` example (already nested-lifecycle shape at lines 157-161 per
RESEARCH), `DappManifest` example (matches `src/types/manifest.ts` field-for-field, including
`nav.hidden`, `optional`/`enabled`/`standalone` defaults), Manifest Loading three-tier fallback
description, Sample Project / example instructions.

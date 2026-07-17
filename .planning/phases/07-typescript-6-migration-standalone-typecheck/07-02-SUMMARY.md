---
phase: 07-typescript-6-migration-standalone-typecheck
plan: 02
subsystem: build-tooling
tags: [typescript, typecheck, tsconfig, plugins, type-safety]
dependency graph:
  requires:
    - "07-01 (tsconfig.typecheck.json pattern verified for the root package)"
  provides:
    - "plugins/{auth,wallet,theme,settings}/tsconfig.typecheck.json — standalone tsc --noEmit config per plugin, extends plugin build tsconfig, includes src+tests"
    - "green plugin typechecks (src+tests) on the currently-resolved TypeScript (5.9.3)"
  affects:
    - "07-03 (make typecheck target loops PLUGIN_BUILD_ORDER, invoking these 4 configs)"
    - "07-04 (TypeScript 6 bump validates against this green plugin baseline)"
tech-stack:
  added: []
  patterns:
    - "Each plugin's *.typecheck.json extends its own build tsconfig.json (which extends root), never skips straight to root (D-02)"
    - "rootDir widened to the monorepo root ('../..' from each plugin dir) so cross-package paths aliases resolving to sibling src/*.ts don't trip TS6059"
    - "paths block mirrors vitest.config.ts's alias map (5 keys) but omits baseUrl (avoids TS6's TS5101 deprecation)"
key-files:
  created:
    - plugins/auth/tsconfig.typecheck.json
    - plugins/wallet/tsconfig.typecheck.json
    - plugins/theme/tsconfig.typecheck.json
    - plugins/settings/tsconfig.typecheck.json
  modified:
    - plugins/auth/tests/auth.test.ts
    - plugins/wallet/tests/wallet.test.ts
    - plugins/theme/tests/theme.test.ts
    - plugins/settings/tests/settings.test.ts
decisions:
  - "wallet.test.ts's Buffer-based hex assertion rewritten to TextEncoder + manual hex encoding (mirrors the plugin's own dev-signer implementation) instead of adding @types/node — keeps zero new devDependencies and the browser-first posture, per RESEARCH Open Question 1's recommendation"
  - "auth.test.ts's mockContext().getPlugins() rebuilt to construct a Record<string, Plugin> imperatively (conditionally assigning wallet) instead of a conditional-spread that produced an undefined branch the index signature rejects"
  - "theme.test.ts's mock settings.get widened to the interface's own generic <T = unknown>(dappId, key) => T | undefined signature rather than returning a bare unknown"
  - "theme.test.ts's mock settings object was also missing getSections() — not in RESEARCH's original 15-error catalog, surfaced only once the get() fix let typecheck continue past that line; fixed at source as the same shallow-mock root cause (Rule 1)"
metrics:
  duration: 15min
  completed: 2026-07-17
status: complete
---

# Phase 7 Plan 2: Plugin Package Standalone Typecheck Baseline Summary

Created `tsconfig.typecheck.json` for all four plugin packages (auth, wallet, theme, settings)
and fixed each plugin's pre-existing test-only type errors, establishing a green `tsc --noEmit`
baseline on the currently-resolved TypeScript (5.9.3) before the TS6 bump — the plugin half of
the phase's measurable pre-bump baseline (D-07 step 1), completing plugin lockstep coverage
alongside 07-01's root package baseline.

## What Was Built

**`plugins/{auth,wallet,theme,settings}/tsconfig.typecheck.json` (4 new, identical shape):**
Each extends its own `./tsconfig.json` (the plugin's build config, which itself extends
`../../tsconfig.json` — never skips straight to root, D-02) and sets `noEmit: true`,
`rootDir: "../.."`, and the same 5-key `paths` block (mirroring `vitest.config.ts`'s alias map)
resolving `@dnzn/dxkit` and all 4 plugin package names to real sibling `src/index.ts` files —
not unbuilt `dist/*.d.ts`. `include: ["src", "tests"]` makes each plugin's `tests/` a
first-class typed consumer of both its own and every sibling package's public types for the
first time. `rootDir` is deliberately `"../.."` (monorepo root), not the plugin's own directory —
narrower would trip `TS6059` once cross-package `paths` pull in sibling source outside the
plugin. No `baseUrl` is set, avoiding TS6's `TS5101` deprecation error that would otherwise force
a forbidden `ignoreDeprecations` shim (TS6-02). All 4 build `tsconfig.json` files are left
byte-for-byte unchanged.

**Plugin test fixes (11 pre-existing errors, all latent — never `tsc`-checked before this
phase, identical under TS 5.9.3 and TS 6.0.3):**
- `auth.test.ts`: mock `Wallet` object was missing `getProviders`/`getActiveProvider` (added to
  the `Wallet` interface after the mock was written) — added both members. `mockContext()`'s
  `getPlugins()` used a conditional-spread (`wallet ? { wallet } : {}`) that inferred
  `{ wallet?: undefined }` on the falsy branch, which `Record<string, Plugin>`'s index signature
  rejects — rebuilt as an imperative `Record<string, Plugin>` local, conditionally assigned.
- `wallet.test.ts`: the `sign()` hex-encoding assertion used Node's `Buffer` global (browser-first
  test code, no `@types/node` devDependency) — rewrote to `TextEncoder` + manual hex encoding,
  matching the plugin's own local-provider `sign()` implementation exactly. Also removed a stale
  `@ts-expect-error` on `delete (globalThis as any).localStorage` (deleting an already-`any`-typed
  property never errors, so the directive was unused).
- `theme.test.ts`: removed the same stale `delete (globalThis as any).localStorage`
  `@ts-expect-error`. Widened the mock `settings.get` callback to the `Settings` interface's own
  generic `<T = unknown>(dappId, key) => T | undefined` signature instead of returning a bare
  `unknown`. Also added the mock's missing `getSections()` member — this surfaced only after the
  `get()` fix let the typechecker continue past that property and was not in RESEARCH's original
  catalog; same shallow-mock root cause, fixed at source (Rule 1).
- `settings.test.ts`: removed the same stale `delete (globalThis as any).localStorage`
  `@ts-expect-error`.

No `@types/node` devDependency was added anywhere; no new `@ts-expect-error`/`as any` was
introduced to suppress an error.

## Verification

- `(cd plugins/auth && npx tsc --noEmit -p tsconfig.typecheck.json)` — exits 0
- `(cd plugins/wallet && npx tsc --noEmit -p tsconfig.typecheck.json)` — exits 0
- `(cd plugins/theme && npx tsc --noEmit -p tsconfig.typecheck.json)` — exits 0
- `(cd plugins/settings && npx tsc --noEmit -p tsconfig.typecheck.json)` — exits 0
- `npx vitest run plugins/` — 133/133 tests passing (5 files), unchanged behavior
- `grep -rn "@types/node" package.json plugins/*/package.json` — no matches (no new devDependency)
- `grep -rn "baseUrl\|ignoreDeprecations" plugins/*/tsconfig.typecheck.json` — no matches
- `git diff --stat plugins/*/tsconfig.json` — empty (all 4 build configs untouched)
- Task 1 automated verify script (JSON shape assertions: `noEmit`, no `baseUrl`,
  `rootDir === "../.."`, exactly 5 `paths` keys) — passed for all 4 plugins

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `theme.test.ts` mock `settings` object was also missing `getSections()`**
- **Found during:** Task 2, after fixing the cataloged `settings.get` callback type mismatch
- **Issue:** RESEARCH's Pitfall 4 catalog listed only 2 errors for `theme.test.ts` (the stale
  `@ts-expect-error` at line 425 and the `get` callback return-type mismatch at line 462). Once
  the `get` fix was applied, `tsc` surfaced a third, previously-masked error: the mock `settings`
  object literal didn't satisfy `Settings` because it was missing the required `getSections()`
  method. This wasn't a new TS6 issue — it's the same shallow, never-checked-before mock object
  pattern as the other cataloged errors; it just wasn't visible until the prior line's error was
  resolved.
- **Fix:** Added `getSections: () => []` to the mock `settings` object literal.
- **Files modified:** `plugins/theme/tests/theme.test.ts`
- **Commit:** `5ba01ca`

None of the other 3 plugins surfaced any error beyond RESEARCH's catalog.

## Known Stubs

None — this plan touches build-tooling config and test-fixture type fixes only, no UI or
data-flow code.

## Threat Flags

None — this plan introduces no new runtime attack surface (build-time typecheck config + test
fixture fixes; zero runtime deps preserved), matching the plan's own threat model disposition
(T-07-02, accepted).

## Self-Check: PASSED

- FOUND: plugins/auth/tsconfig.typecheck.json
- FOUND: plugins/wallet/tsconfig.typecheck.json
- FOUND: plugins/theme/tsconfig.typecheck.json
- FOUND: plugins/settings/tsconfig.typecheck.json
- FOUND: commit 66b20fd (Task 1)
- FOUND: commit 5ba01ca (Task 2)

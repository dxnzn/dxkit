# Architecture Research: TS6 + Toolchain Modernization Integration

**Domain:** Integrating TypeScript 6 migration + forward-compat typing (`isolatedDeclarations`, `verbatimModuleSyntax`) + Node 20 floor into an existing zero-dep TS pnpm-workspace monorepo (5 packages: core + 4 plugins, triple-format tsup builds)
**Researched:** 2026-07-15
**Confidence:** MEDIUM (web-cross-checked findings on tsup/TS internals; HIGH on repo-grounded facts read directly from source)

This is not a "design a new architecture" doc — DxKit's shell/router/lifecycle/event-bus/plugin-registry structure is unchanged by this milestone. This document maps **where each modernization capability lands** against the *existing* structure: root `tsconfig.json` (ES2022, DOM lib, `strict`, `esModuleInterop`, `isolatedModules: true` already on, `moduleResolution: bundler`), 5 `tsup.config.ts` files (root 2-target: ESM/CJS + IIFE; each plugin the same 2-target shape with `external`/`noExternal: ['@dnzn/dxkit']` split), 5 `package.json` files (no `engines` field currently, no `@types/node` anywhere — confirmed zero Node-runtime typing dependency), and a `Makefile`-driven manual build order (`tsup` at root, then `plugins/settings/ plugins/wallet/ plugins/auth/ plugins/theme/`).

## Current-State Facts (read directly from the repo, not inferred)

These are load-bearing for every recommendation below:

- **Root `tsconfig.json`** already has `isolatedModules: true`, `strict: true`, `moduleResolution: bundler`, `module: ES2022`, `target: ES2022`, `lib: ["ES2022", "DOM"]`, `declaration`/`declarationMap`/`sourceMap: true`. No `verbatimModuleSyntax`, no `isolatedDeclarations` yet.
- **4 plugin `tsconfig.json` files** all `extend "../../tsconfig.json"` and only override `outDir`/`rootDir`/`lib`. There is no shared *intermediate* base — plugins inherit directly from root.
- **`tsup.config.ts`** (root and all 4 plugins) is a 2-entry array: `{ format: ['esm','cjs'], dts: true, clean, sourcemap }` + `{ format: ['iife'], globalName, outExtension → .global.js, platform: 'browser' }`. Plugin configs additionally set `external: ['@dnzn/dxkit']` on the ESM/CJS target and `noExternal: ['@dnzn/dxkit']` on the IIFE target.
- **No `engines` field** in any `package.json`. CI (`.github/workflows/ci.yml`) already runs a single-entry matrix `node-version: [20]` — meaning the *stated* project constraint ("Node 18+") is already stricter than reality; CI has silently been Node-20-only.
- **No `@types/node`** in any `package.json`, anywhere. `vitest.config.ts` imports `node:path` and uses `__dirname`, but that file lives outside `tsconfig.json`'s `include: ["src"]`, so it is never part of the strict-typed compile — it's resolved by tsup/vite's own esbuild-register loader, not `tsc`. **This means Node 20 does not touch `lib`/`target` for `src/`** — those stay ES2022+DOM, browser-only, exactly as the milestone's PROJECT.md already asserts.
- **Real cross-package dependency graph** (from each plugin's `package.json` `dependencies`, not just "plugins import only types" narrative):
  - `core` — no deps
  - `settings` → `core`
  - `wallet` → `core`, `settings`
  - `auth` → `core`, `wallet`
  - `theme` → `core`, `settings`
  - The `Makefile`'s `PLUGIN_BUILD_ORDER := plugins/settings/ plugins/wallet/ plugins/auth/ plugins/theme/` is a hand-maintained topological sort of this exact graph — correct, but serial where `wallet` and `theme` could build in parallel (both only need `settings` to be built first).

## Q1 — `isolatedDeclarations` + tsup: does tsup benefit, or is a separate dts step needed?

**Finding (cross-checked, MEDIUM confidence):** tsup does **not** benefit from `isolatedDeclarations`. tsup's `dts: true` path drives declaration generation through the TypeScript compiler API in a rollup-style bundling step, regardless of `isolatedDeclarations` in `tsconfig.json` — there is no oxc/isolated-declarations-aware fast path in tsup. That fast path exists in **tsdown** (tsup's Rolldown-based successor: "isolated-declarations aware... built-in support for quickly generating types" — `tsc` with `--isolated-declarations` is already faster than tsup's dts generation, and tsdown is faster still). Notably, **tsup's own README states it is no longer actively maintained** and recommends tsdown for new projects — this is independent of `isolatedDeclarations` but relevant context for "toolchain audit & modernization."

**Implication for this milestone:** PROJECT.md scopes this milestone as "bump tsup... to current," not "replace tsup with tsdown" — swapping bundlers is out of scope (it would touch every `tsup.config.ts` and is a bigger, riskier change than the milestone's stated intent). So:

- **Adopt `isolatedDeclarations` as a type-checking gate, not a build-speed win.** Its value here is *correctness*, not performance: it forces every exported symbol across core + 4 plugins to carry an explicit, portable type, which is exactly the property a future `tsdown`/`tsgo` swap will require anyway. Treat it as insurance for the TS7 jump, not a tsup optimization.
- **Enforce it via a dedicated `tsc --noEmit` (or `tsc -b`) CI step**, separate from tsup's own dts emission. tsup keeps doing what it already does (TS-compiler-driven `dts: true`); a new lint-like gate (`tsc --noEmit -p tsconfig.json` with `isolatedDeclarations: true` set) catches violations *before* tsup ever runs. This is additive — no `tsup.config.ts` changes required for this specific capability.
- If/when a future milestone migrates to tsdown, `isolatedDeclarations` is already-enforced groundwork — the swap becomes a config change (`tsup.config.ts` → `tsdown.config.ts`) rather than a "find every implicit export type" audit.

### Per-package tsconfig layout for `isolatedDeclarations` + `verbatimModuleSyntax`

The current layout (root `tsconfig.json` + 4 plugin `tsconfig.json extends "../../tsconfig.json"`) is already the right shape — no new intermediate base package is needed for a 5-package monorepo this size. Land both flags in the **root** `tsconfig.json` `compilerOptions`:

```jsonc
// tsconfig.json (root) — additive
{
  "compilerOptions": {
    // ...existing...
    "isolatedDeclarations": true,   // requires declaration: true (already set)
    "verbatimModuleSyntax": true
  }
}
```

Because every plugin `tsconfig.json` does a bare `extends`, this propagates automatically to all 4 plugins with **zero plugin-level tsconfig edits**. Plugin tsconfigs only need to keep overriding `outDir`/`rootDir`/`lib` as they already do — no new override surface is introduced by either flag.

**One layout addition worth making now (not required, but cheap and directly serves Q5):** add `composite: true` + a root `references` array pointing at the 4 plugin tsconfigs, and each plugin tsconfig gets `"references": [{ "path": "../.." }]` reflecting its actual dependency (core, or core+settings for wallet/theme, or core+wallet for auth). See Q5 — this is the concrete "config swap, not rewrite" lever for TS7/tsgo.

## Q2 — `verbatimModuleSyntax` + the 3-format build: does it touch CJS `require()` or the IIFE global?

**Finding (cross-checked, HIGH confidence):** No functional change to any of the three build outputs. `verbatimModuleSyntax` is a **`tsc`-side authoring/type-checking constraint**, not a codegen instruction esbuild consumes. Concretely:

- esbuild (which tsup uses under the hood for all three formats — ESM, CJS, IIFE) has *always* stripped type-only imports on a per-file basis, because esbuild transpiles one file at a time and can't do TypeScript's whole-program elision. This is exactly the "isolated compilation" model `verbatimModuleSyntax` is designed to make `tsc` agree with.
- Before this flag, there was a latent risk class: `tsc`'s type-checking pass could infer an import as type-only (and be fine with it being silently dropped) while esbuild's local, syntax-only heuristic might not agree in an edge case — or vice versa, where `tsc` treats something as a value import for its own emit purposes but the actual runtime need was ambiguous. `verbatimModuleSyntax` forces the *source* to be unambiguous: an import either has `type` on it (always stripped) or it doesn't (always kept, verbatim), full stop. This closes that gap **at the source-authoring level**, before esbuild ever sees the file.
- **Net effect on the 3-format build:** the ESM output, the CJS `require()` output, and the IIFE global-attach output are all esbuild-transpiled from the same source and were already behaving this way. `verbatimModuleSyntax` doesn't change what ships; it changes what `tsc` *accepts* as valid source, making explicit what esbuild was already assuming.

**Why this specifically matters for DxKit's architecture (not just TS hygiene):** The README's central IIFE claim — *"every plugin imports only types from `@dnzn/dxkit`, so nothing from core ends up in any output"* — currently holds because of *convention*, not enforcement. Today nothing stops a plugin from accidentally writing `import { createShell } from '@dnzn/dxkit'` (a value import) instead of `import type { Shell } from '@dnzn/dxkit'`; TS's default elision might still silently drop it if it turns out to be unused as a value, or a genuinely-used value import would just quietly get bundled into the "types-only" IIFE and violate the zero-core-in-plugin-output invariant without any error. **`verbatimModuleSyntax` turns this invariant into a compile-time-checked contract**: once enabled, every cross-package import from `@dnzn/dxkit` in `plugins/*/src/` must be explicitly `import type`, and if a plugin developer ever writes a real (value) import of core, `tsc` treats it as a real, always-kept import — surfacing the violation immediately (and likely causing a build/lint failure once core is `external` in the ESM/CJS target) rather than leaking silently into a future IIFE bundle. **This is a genuine architectural payoff of this flag for DxKit specifically, not just generic TS modernization — it belongs in FEATURES/PITFALLS framing as a real bug class this milestone closes, not only "adopt the flag because it's current."**

### Mechanical fallout to budget for

`verbatimModuleSyntax` requires **every type-only re-export in barrel files to use `export type`**, not bare `export`. This touches:
- `src/types/index.ts` (type barrel — likely needs blanket `export type { ... }` conversion)
- `src/index.ts` (main barrel — mixed value + type exports; only the type-only ones need the `type` modifier)
- `plugins/*/src/index.ts` — each plugin's cross-package type imports from `@dnzn/dxkit` (per the "plugins import only types" convention) need `import type`

This is mechanical (find every type-only import/export, add the modifier) but touches every package — budget it as a small, uniform pass across all 5 packages rather than a design decision per package.

## Q3 — Node 20 floor: what actually changes

**Finding (repo-grounded + cross-checked web):** Very little, and the browser (`src/`) target is correctly unaffected.

| Area | Change | Why |
|---|---|---|
| `tsconfig.json` `lib`/`target` for `src/` | **No change.** Stays `ES2022` + `["ES2022", "DOM"]`. | `src/` has zero Node-runtime dependency (no `@types/node`, no `fs`/`path` imports); it's a browser library. Node's version only affects the *tooling* that builds/tests it, not the code's own type surface. |
| `package.json` `engines` | **Add** `"engines": { "node": ">=20" }` to root + all 4 plugin `package.json` (or root-only if plugins don't publish independently of the workspace — verify against `.versionrc.json` lockstep versioning). | Currently absent everywhere; CI already only tests Node 20, so this closes a docs/CI/package.json consistency gap that predates this milestone. |
| CI matrix (`.github/workflows/ci.yml`) | Currently `node-version: [20]` (single entry) — **already meets** the stated Node 20 floor. Consider **widening**, not raising: add Node 22 (current Maintenance LTS) as a second matrix entry so the "deprecation gate" (this milestone's other active requirement) catches issues on the LTS the project will need next, not just the one it's leaving behind. | See LTS timing flag below. |
| `@types/node` | **No addition needed for `src/`.** Only relevant if a build/test config file starts needing typed Node APIs *and* gets pulled into a `tsc`-checked `include` — neither is true today (`vitest.config.ts`/`tsup.config.ts` are outside `include: ["src"]` and are loaded via esbuild-register, not `tsc`). | Zero-runtime-deps posture is preserved; this stays a non-change. |
| Build/dev tooling floor | tsup 8.4, vite 7.3, vitest 4.1 (already pinned in root `package.json`) already assume Node ≥18.18/20 in practice — bumping them "to current" per this milestone's other active requirement will likely *require* Node 20+ as a side effect, independent of this decision. | Confirms Node 20 is the natural floor for the tooling bump anyway, not an arbitrary choice. |

**Flag for the roadmap (MEDIUM confidence, worth a decision, not a silent override):** Node 20 reached end-of-life **2026-04-30** — already past as of this milestone's date (2026-07-15). Node 22 is the current Maintenance LTS (EOL 2027-04-30) and is the version the Node.js project itself recommends as the production floor today; Node 24 is Active LTS. PROJECT.md explicitly commits to "Node 20" as this milestone's target floor, and CI is already there — this research doesn't override that decision, but the roadmap should make an explicit, informed call: keep Node 20 as a deliberate "meets the stated 18→20 hardening goal, defer the 20→22 jump" choice, or fold the extra one-version bump into this milestone's `engines`/CI work since the tooling bump (tsup/vite/vitest/Biome "to current") is happening anyway and may push the practical floor to 20 regardless.

## Q4 — Suggested build order across the monorepo, and where each change lands

**Core-before-plugins is already enforced today** — via `moduleResolution: bundler` plugins resolve `@dnzn/dxkit`'s types through the package's `types` field (`dist/index.d.ts`), meaning **plugins currently type-check against core's *built* declarations, not its source**. This is a real, already-existing constraint (not something this milestone introduces): core must be built before any plugin's `tsc`/tsup step can succeed. The `Makefile`'s serial `tsup` (root) → `PLUGIN_BUILD_ORDER` loop already respects this.

Recommended sequencing for the modernization work itself:

1. **Root config first** (`tsconfig.json`: add `isolatedDeclarations`, `verbatimModuleSyntax`; bump `typescript` devDependency to 6.x). Since all 4 plugin tsconfigs `extend` root, this is the single highest-leverage edit — do it once, validate against `src/` (smallest, most-audited surface — 0 plugin dependents to break yet), then propagate.
2. **Core package** (`src/`): fix every `isolatedDeclarations` violation (explicit return types on exported factories — `createShell`, `createRouter`, `createEventBus`, etc.) and every `verbatimModuleSyntax` violation (barrel `export type` conversions in `src/types/index.ts`, `src/index.ts`). Run `tsc --noEmit` clean, then `tsup` build clean, before touching any plugin. **This gate matters more than usual here**: since plugins type-check against core's *built* `.d.ts`, a broken or stale core build silently propagates broken types into every plugin's compile — the existing architecture already makes core-first non-negotiable, and isolatedDeclarations enforcement should sit at this exact seam.
3. **Plugins, in the existing dependency order** (`settings` → `wallet` → `auth`, and `theme` in parallel with `wallet` since both only depend on `settings`): apply the same two-flag fixes. `wallet`/`auth`/`theme` each get an extra check specific to Q2 — audit their `@dnzn/dxkit` import to confirm it's fully `import type` (this is where the "nothing from core in the IIFE" invariant gets enforced for real).
4. **WR-01 (registry.json array validation)** and the **CI deprecation gate** are independent of the TS-flag work and can land in parallel on a separate branch/phase — they don't touch `tsconfig.json`/`tsup.config.ts` and have no ordering dependency on steps 1–3.
5. **Node 20 `engines` + CI matrix** changes are also independent and can land any time — they don't block or get blocked by the TS-flag work.

| Change | File(s) touched | New or modified | Blocks / blocked by |
|---|---|---|---|
| `isolatedDeclarations`, `verbatimModuleSyntax` | root `tsconfig.json` | Modified (additive keys) | Blocks all per-package fixes (step 2–3) |
| TS6 upgrade | root `package.json` (`typescript` devDep) | Modified | Should land with step 1 — TS6's stricter defaults (`strict` now implied, `types: []` default) interact with the same tsconfig edit |
| Explicit return types / `export type` fixes | `src/**/*.ts`, `src/types/index.ts`, `src/index.ts` | Modified | Blocked by step 1; blocks step 3 (plugins type-check against core's built `.d.ts`) |
| Same fixes per plugin | `plugins/*/src/**/*.ts`, `plugins/*/src/index.ts` | Modified | Blocked by core being rebuilt clean |
| New `tsc --noEmit` gate (isolatedDeclarations enforcement) | new script in root `package.json` + `.github/workflows/ci.yml` | New | Independent; should run before `tsup` in CI, mirroring `make build`'s implicit core-first ordering |
| `tsup.config.ts` (all 5) | — | **No change required** for either flag | tsup's dts path is unaffected by `isolatedDeclarations` (Q1); `verbatimModuleSyntax` doesn't change esbuild's format-specific output (Q2) |
| `engines` field | root + 4 plugin `package.json` | New | Independent |
| CI Node matrix | `.github/workflows/ci.yml` | Modified (widen, already meets floor) | Independent |
| Project references (optional, see Q5) | root `tsconfig.json` (`composite`, `references`), 4 plugin `tsconfig.json` (`references`) | New | Independent; purely additive forward-compat groundwork |

## Q5 — TS7 (`tsgo`) forward-compat: what makes the eventual jump a config swap, not a rewrite

**Finding (cross-checked, MEDIUM confidence):** TS7's native compiler (`tsgo`, Project Corsa) is explicitly designed to have "the same behavior on all TypeScript code as `tsc` from TypeScript 6.0 — just much faster" (~10x cold start, ~21x hot reload, ~80% less memory). The prep story from Microsoft's own guidance is narrow and directly actionable against this codebase:

1. **`isolatedModules` is the primary forward-compat flag** — flags code that can't be correctly handled by single-file/isolated transpilation, which is the exact same constraint model both `tsgo` and esbuild (already in use via tsup) need. **DxKit already has this on** (`isolatedModules: true` in the current root tsconfig) — this milestone's `isolatedDeclarations` + `verbatimModuleSyntax` additions are the *remaining* two-thirds of that same "single-file emit safe" story, not new territory.
2. **Project references** are TS7's mechanism for monorepo build parallelism (configurable parallel build workers, compounding with type-checker workers). DxKit's dependency graph (core → settings → {wallet, theme} → auth) is a small, well-understood DAG that's currently encoded only informally in the `Makefile`'s `PLUGIN_BUILD_ORDER`. Adding `composite: true` to root `tsconfig.json` and a `references` array to each plugin's tsconfig (pointing at its actual dependencies — not just root) makes this DAG **machine-readable** ahead of time. This is a config-only, non-breaking addition today (root's own `tsc`/tsup build is unaffected by unused `composite`/`references` fields) that means a future `tsc -b` or `tsgo -b` invocation can build the whole workspace correctly-ordered and in parallel *without* the Makefile's hand-maintained ordering — the eventual TS7 adoption reduces to "point the build at the references graph that already exists" instead of "figure out the dependency graph for the first time."
3. **`stableTypeOrdering`** (new in TS6) is a narrow, low-risk flag worth turning on alongside the other two in this milestone specifically because its purpose is to make 6.0's type-ordering behavior match 7.0's ahead of time — it's a pure de-risking lever with no architectural footprint (single tsconfig key, no code changes expected in a codebase this size).
4. **No architectural rewrite is implied.** DxKit's factory-function/closure pattern, named-exports-only barrels, and `Record`/generic-constrained types are all plain, portable TypeScript with no dependency on `tsc`-specific emit behavior (no decorators, no `namespace`, no legacy `module` syntax, no `enum` — confirmed via CONVENTIONS: "Union types for modes... not TS enums"). The two flags in this milestone plus the already-on `isolatedModules` are the complete "single-file emittable" checklist; there is no fourth capability needed before a `tsgo` swap becomes viable.

**Concrete recommendation for this milestone:** land `isolatedModules` (already on, no-op), `isolatedDeclarations`, `verbatimModuleSyntax`, and `stableTypeOrdering` together in the root `tsconfig.json` edit (step 1 of Q4's build order). Treat `composite`/`references` as an optional stretch item in the same phase — it's cheap, additive, and directly targets "config swap not rewrite," but it doesn't block or get blocked by anything else in this milestone and can slip to a follow-up phase without cost if time is tight.

## Integration Points Summary

| Boundary | What crosses it | Modernization impact |
|---|---|---|
| root `tsconfig.json` → 4 plugin `tsconfig.json` (via `extends`) | All compiler options | Single edit point for both new flags — no plugin-level tsconfig changes needed |
| core `dist/index.d.ts` → plugin `tsconfig.json` type resolution (via `moduleResolution: bundler` + package `types` field) | Type-only surface (already convention; becomes compiler-enforced under `verbatimModuleSyntax`) | Core must build clean *first*; this was already true, this milestone makes the "types-only" contract itself enforceable |
| `tsup.config.ts` (ESM/CJS `external: ['@dnzn/dxkit']`, IIFE `noExternal: ['@dnzn/dxkit']`) | Build-time bundling decision | Unaffected by either flag directly, but is the mechanism that would surface a `verbatimModuleSyntax` violation as a real build failure (a stray value import of core suddenly can't be externalized cleanly) |
| `Makefile` `PLUGIN_BUILD_ORDER` → package dependency graph | Manual topological order | Currently correct but serial; `composite`/`references` (Q5) is the path to making this graph explicit and parallel-buildable without touching the Makefile's actual logic this milestone |
| CI (`ci.yml`) → `make build` / `make test` | Node version, lint/type gates | New `tsc --noEmit` gate slots in before `make build` (mirrors the existing core-before-plugins ordering); Node matrix widening is orthogonal |

## Sources

- [TypeScript: TSConfig Option — isolatedDeclarations](https://www.typescriptlang.org/tsconfig/isolatedDeclarations.html)
- [TypeScript: TSConfig Option — verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html)
- [Announcing TypeScript 6.0 — Microsoft DevBlogs](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [TypeScript 6.0 — official release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
- [Progress on TypeScript 7 — December 2025 — Microsoft DevBlogs](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)
- [microsoft/typescript-go — staging repo for the native compiler](https://github.com/microsoft/typescript-go)
- [Switching from tsup to tsdown — Alan Norbauer](https://alan.norbauer.com/articles/tsdown-bundler/) (tsup dts mechanism, tsdown's oxc-aware fast path)
- [tsdown — Declaration Files (dts) docs](https://tsdown.dev/options/dts)
- [egoist/tsup — GitHub README](https://github.com/egoist/tsup) (maintenance-status statement, no isolatedDeclarations awareness confirmed)
- [Node.js — End-of-Life official schedule](https://nodejs.org/en/about/eol) / [endoflife.date/nodejs](https://endoflife.date/nodejs) (Node 20 EOL 2026-04-30, Node 22 current Maintenance LTS)
- Repo-grounded (read directly, HIGH confidence): `tsconfig.json`, `tsup.config.ts` (root + 4 plugins), `package.json` (root + 4 plugins), `Makefile`, `.github/workflows/ci.yml`, `vitest.config.ts`, `pnpm-workspace.yaml`, `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

---
*Architecture research for: TS6 migration + forward-compat typing integration (DxKit v1.1)*
*Researched: 2026-07-15*

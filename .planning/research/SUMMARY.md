# Research Summary: DxKit v1.1 TypeScript 6 + Toolchain Modernization

**Project:** DxKit — headless microframework for composable dapps  
**Domain:** TypeScript 6 migration + forward-compat hardening for zero-runtime-dep TS library monorepo  
**Researched:** 2026-07-15  
**Confidence:** HIGH for concrete findings (version numbers, deprecation lists, repo-grounded facts); MEDIUM for cross-project patterns and bot behavior

## Executive Summary

DxKit v1.1 is a focused modernization pass addressing one critical problem and one strategic opportunity. **Problem:** Node 20 (currently assumed as the "new floor") is already EOL as of 2026-04-30; this milestone should land on Node 22 (current Maintenance LTS) instead, at no cost to the rest of the recommended stack. **Opportunity:** The codebase is already ~80% prepared for TypeScript 6's stricter forward-compat flags (`isolatedDeclarations`, `verbatimModuleSyntax`), which are not speedups under the current tsup-based build but are **prerequisite type-safety discipline** for a later, separate TypeScript 7 / tsdown migration. The research converges on three independent, high-confidence findings: (1) add a `tsc --noEmit` CI step *before* touching the TS6 version bump, not after; (2) adopt both strict flags per-package, not repo-wide, to isolate failures; (3) establish Renovate (not Dependabot) for pnpm-workspace dependency automation, with scoped automerge rules to protect the zero-runtime-dep posture.

The critical risk is treating `isolatedDeclarations` as a build-speed lever (it isn't, under tsup); the phase must be framed as TS7-readiness type discipline, not performance. Secondary risk: skipping the IIFE artifact verification step after `verbatimModuleSyntax` lands, since neither `tsc` nor the existing vitest suite exercises that output format. Mitigation: explicit IIFE smoke test added to the build-artifact verification gate.

## Key Findings

### Recommended Stack

This milestone bumps TypeScript from 5.8 → 6.0 and modernizes the dev toolchain while staying on the current architecture (no bundler swap). **Node floor should move from EOL Node 20 to Node 22** (Maintenance LTS, EOL mid-2027), which costs nothing — every tool supporting Node 20 also supports Node 22, and some key dependencies (pnpm 11.x, tsdown 0.22.x for future use) *require* Node 22+. This is a forward-looking decision that closes a consistency gap: CI already tests Node 20 only, but CI Node-version statements in `.github/workflows/ci.yml` should be widened to include Node 22, and `engines` fields (currently missing) should explicitly declare the floor.

**Core technologies with no change:**
- TypeScript: **6.0.3** (final JS-based "Strada" release; TS7 will be Go-based "Corsa" with different API surface) — replace 5.8.3
- tsup: **8.5.1** (stay pinned; explicitly not actively maintained but functional; no isolated-declarations speed benefit under tsup 8.x) — no change
- Biome: **2.5.4** (syntax-only parser, no TS6-specific changes needed) — patch bump from 2.5.1
- Vite: **8.1.4** (breaking changes unlikely to hit DxKit's config-only usage) — upgrade from 7.3.6 (confirmed compatible with Vitest 4.1.10)
- Vitest: **4.1.10** (already latest, peerDeps support tsup/vite/biome versions in play) — no change
- Dependency automation: **Renovate** (not Dependabot; natively understands pnpm workspaces, supports monorepo-aware grouping) — new

### Expected Features

**Must have (table stakes, per PROJECT.md):**
1. TS6 compiler upgrade across core + 4 plugins with zero `ignoreDeprecations` remaining — the milestone's headline claim
2. `verbatimModuleSyntax: true` in root `tsconfig.json` (propagates to all plugins via `extends`) — closes type-only import contract violations
3. `isolatedDeclarations: true` in root `tsconfig.json` — enforces explicit return types on all exported symbols
4. CI step running `tsc --noEmit` per-package as a required gate — the actual "deprecation gate" (no standalone TS flag for this; fail CI on exit code 2)
5. Renovate configured for pnpm workspace (grouped PRs by tool family, automerge patch/minor on green CI, manual review for majors)
6. WR-01: `registry.json` array-shape validation with `dx:error` emission — closes a known crash path

**Should have (strategic forward-compat, low-cost additions):**
- `stableTypeOrdering: true` (TS6 flag that aligns type-display ordering with TS7, zero-cost forward-compat signal)
- `erasableSyntaxOnly: true` (alongside verbatimModuleSyntax; disallows enums/namespaces — already forbidden by convention, zero-diff audit)
- Project references in `tsconfig.json` (`composite: true` at root, per-package `references` fields) — explicit DAG for TS7's parallel monorepo builds

**Defer (v1.2+, TS7 / next-milestone scope):**
- tsup → tsdown migration (requires Node 22.18+, is a bundler-identity change, deferred per PROJECT.md constraints)
- Internal `@deprecated` JSDoc lint coverage (Biome has no equivalent to `@typescript-eslint/no-deprecated`; tooling gap, not code gap)

### Architecture Approach

This milestone integrates with existing architecture with zero breaking changes. Root `tsconfig.json` already has `isolatedModules: true`, `strict: true`, `moduleResolution: bundler`, and ES2022 target; adding two new flags (`isolatedDeclarations`, `verbatimModuleSyntax`) is a config-only propagation via the root → plugins `extends` chain. The three-format build (ESM/CJS/IIFE via tsup) is unaffected by either flag at the codegen level — both are tsc-side constraints that make the source-level authoring unambiguous to esbuild's own (already-strict) import-elision logic. Plugins already use `import type` exclusively for core imports, closing the "type-only re-export" contract; the flags make that contract compile-time-enforced rather than convention-based. Build order (core before plugins, enforced by `moduleResolution: bundler` type resolution against core's `dist/index.d.ts`) is unchanged; no new intermediate base configs needed.

**Key seams affected:**
1. Root `tsconfig.json` → plugin configs: Both flags added once to root, inherited by all 4 plugins
2. Core `.d.ts` → plugin type-checking: Already core-first (typecheck against built `.d.ts`); both flags strengthen this contract but don't change sequencing
3. `tsup.config.ts` (5 files): Zero changes needed — neither flag changes esbuild's output, only what `tsc` accepts as input
4. CI pipeline: New `tsc --noEmit` gate added before `make build`, mirroring existing core-first ordering

### Critical Pitfalls

1. **No `tsc --noEmit` baseline exists before TS6 bump** — Type checking happens only as a side effect of tsup's `dts: true` step. This is the single biggest integration gap. Must add a dedicated `tsc --noEmit` script to CI *and* local `make test` *before* upgrading to TS6, so the migration has a baseline to diff against. If skipped, TS6's deprecation errors can silently mix with existing build noise and mask incomplete migration work.

2. **`isolatedDeclarations` churn concentrated in barrels and `as const` exports, not factory functions** — Factories already have explicit return types by convention. Real work is auditing `export type { ... } from` statements in `src/types/index.ts`, `src/index.ts`, and per-plugin barrels, plus any `as const`-derived exports. Budget this as low-to-moderate (single-digit to low-double-digit annotations across 5 packages), scoped per-package with `tsc` diagnostics as the gate.

3. **`isolatedDeclarations` enables build speed only with tsdown, not tsup** — The flag forces explicit annotations (type-safety win), but tsup 8.x's `.d.ts` emission still goes through the full TypeScript compiler API + rollup bundling. The speed payoff requires switching to tsdown or `tsc` with `oxc-transform`, neither in scope for v1.1. Frame this phase as TS7-readiness discipline, not performance improvement. Do not gate on build-time deltas.

4. **`verbatimModuleSyntax` risk is at the IIFE/CJS build boundary, not in source** — Source is already 100% `import type` clean; the real risk is the *build*: esbuild's import elision must continue to correctly drop core's types from plugin IIFEs. Must include a smoke test (load `dist/index.global.js` in a bare HTML page or vitest setup) to confirm expected globals exist and have expected keys.

5. **Node 20 floor unenforced without `engines` field** — PROJECT.md states Node 20 as the floor, but no `package.json` anywhere declares `"engines": { "node": ">=20" }`. This is a "silent failure" antipattern. Must add `engines` to all 5 `package.json` files and set `pnpm.overrides` / `.npmrc engine-strict=true` to fail fast. **Stronger recommendation: declare `>=22` alongside this work, since Node 20 is already EOL.**

6. **Dependency-freshness bot misconfigured risks breaking the IIFE/zero-dep posture unreviewed** — Default Renovate/Dependabot settings have no concept of "zero runtime deps and IIFE is primary deployment target." Must configure Renovate to (a) never automerge major bumps for tsup/vite/vitest/biome/typescript, (b) group minor/patch per tool, (c) add a CI check that fails if any `dependencies` (non-dev) entry is non-empty, and (d) add an IIFE artifact smoke test. An unconfigured bot is worse than no bot.

## Implications for Roadmap

Based on cross-research convergence, the v1.1 milestone should be structured as **four sequential phases plus one explicit decision point**:

### Phase 1: Toolchain Audit & Modernization
**Rationale:** Prerequisite for everything else. Establishes the Node floor, bumps toolchain versions, adds `engines` enforcement, and widens CI matrix.

**Delivers:**
- Root `package.json` bumps: typescript 6.0.3, vite 8.1.4, vitest 4.1.10, biome 2.5.4 (patches)
- `engines: { "node": ">=22" }` in root + all 4 plugin `package.json` (decision point: adopt Node 22 as floor per research recommendation, or keep Node 20 if external constraint overrides)
- CI matrix widened: add Node 22 alongside Node 20
- `.npmrc` or `pnpm.overrides` with `engine-strict=true`
- Negative test: verify install fails on Node 18

**Avoids:** Pitfall 5 (unenforced floor), Pitfall 1 (no baseline for TS6 audit)

---

### Phase 2: TS6 Migration + CI Deprecation Gate
**Rationale:** Core compiler work. Must land `tsc --noEmit` script *before* the TS6 version bump, so the migration has a measurement baseline.

**Delivers:**
- `tsc --noEmit` (or `tsc -b`) script in root `package.json` and `.github/workflows/ci.yml` — runs per-package, fails CI on exit code 2
- TypeScript 5.8 → 6.0.3 version bump in root
- `tsconfig.json` audit: confirm no deprecated options anywhere
- Optional: add `stableTypeOrdering: true` to root `tsconfig.json`
- Zero `ignoreDeprecations` in any `tsconfig.json` after completion
- CI diagnostic diff reviewed; new errors fixed before calling phase done

**Avoids:** Pitfall 1 (missing typecheck step), prevents Pitfalls 2/3 (running flag work against wrong compiler version)

---

### Phase 3: Forward-Compat Typing (Per-Package)
**Rationale:** Add the two strict flags and audit all packages. Sequenced *after* TS6 Migration so fixes are made against the final compiler version, not twice.

**Delivers:**
- `isolatedDeclarations: true` added to root `tsconfig.json`
- `verbatimModuleSyntax: true` added to root `tsconfig.json`
- Per-package audit & fixes:
  - **Core (`src/`):** Fix all `tsc` diagnostics for the two flags
  - **Plugins** (settings → wallet → auth, theme parallel): Same fixes, plus verification that all `@dnzn/dxkit` imports remain `import type`
- Optional: add `composite: true` to root and per-package `references` fields for TS7 parallel-build groundwork
- Full `make build` passes per-package before advancing to next
- IIFE artifact smoke test added: load each `dist/*.global.js` and verify expected globals + top-level keys exist

**Avoids:** Pitfalls 2, 3, 4 (churn underestimation, speed expectations, IIFE boundary)

---

### Phase 4: Continuous Debt Guardrails
**Rationale:** Implement dependency-freshness automation and WR-01. Sequenced last because the deprecation gate requires baseline CI from TS6 Migration to exist first.

**Delivers:**
- Renovate configuration (self-hosted or GitHub App):
  - `extends: ["config:recommended", "group:monorepos"]`
  - `packageRules` grouping devDeps minor/patch, leaving majors ungrouped for core tools
  - `minimumReleaseAge: "3 days"` to align with pnpm 11's supply-chain defaults
  - Automerge only patch/minor on green CI; majors require manual review
- CI check (`pnpm ls --prod` or custom assertion) that fails if any package.json has non-empty `dependencies` (non-dev)
- IIFE artifact smoke test wired as a separate CI step
- WR-01: `registry.json` array-shape guard, runtime validation on shell.ts init
- Explicit scope boundary on CI deprecation gate: fails only on diagnostics under `src/`/`plugins/*/src/`

**Avoids:** Pitfalls 6, 7 (scope overflow, zero-dep posture breakage)

---

### Phase Ordering Rationale

1. **Toolchain Audit & Modernization first** because Node/engines decisions gate everything below
2. **TS6 Migration before flag work** because `tsc --noEmit` must be the baseline for measuring progress
3. **Forward-Compat Typing per-package** to isolate failures (core first, smallest plugin first, learn patterns before largest)
4. **Continuous Debt Guardrails last** because the deprecation gate and bot config must be scoped against the *final* CI pipeline

### Research Flags

- **Phase 1 (Toolchain):** ✓ Standard pattern, no research needed. Version numbers verified against npm registry; `engines` setup is convention.
- **Phase 2 (TS6 Migration):** ✓ Standard pattern. Official TypeScript 6.0 release notes provide the checklist. `tsc --noEmit` is built-in; no tooling to invent.
- **Phase 3 (Forward-Compat Typing):** ⚠ **LIGHT RESEARCH RECOMMENDED** — Biome's TS6 syntax-parsing coverage (brief docs check), verification that IIFE artifact smoke test catches type-elision boundary issues.
- **Phase 4 (Guardrails):** ⚠ **LIGHT RESEARCH RECOMMENDED** — Renovate config key names + behavior (check `docs.renovatebot.com`), Biome's deprecation-rule landscape.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Version numbers + engines fields verified against npm registry API; Node EOL dates verified against 2+ sources; no inference needed. Node 20 vs 22 decision is data-driven. |
| Features | **HIGH** | Table-stakes list derived from PROJECT.md + official TS6 deprecation list + community consensus. Anti-features explicitly reasoned. |
| Architecture | **MEDIUM–HIGH** | Core facts verified directly against repo source (HIGH). Cross-project assumptions verified against official docs + multiple 2026 sources, but NOT against tsup source code itself (MEDIUM hedge). Recommend brief verification during phase planning. |
| Pitfalls | **HIGH** | All 7 pitfalls grounded in repo facts verified directly against codebase. Prevention strategies from official TS docs + established best practices. Recovery costs estimated conservatively. |

**Overall confidence: HIGH.** The four research files converge strongly on phase structure, Node-floor decision, and pitfall priorities. Main hedges are Renovate config specifics (MEDIUM) and Biome TS6 coverage (MEDIUM — quick docs scan will resolve). No show-stoppers; ready for planning.

### Gaps to Address

1. **Biome TS6 syntax parsing coverage:** Confirm Biome 2.5.x docs at `biomejs.dev/internals/language-support/` before phase starts (likely non-issue).
2. **Vite 8 `rollupOptions` compatibility:** Grep live `vite.config.ts` and `vitest.config.ts` for `rollupOptions`/`esbuildOptions` usage before upgrading to Vite 8.
3. **Renovate automerge gate:** Test automerge gate logic in dry-run mode before enabling in production.
4. **IIFE smoke test implementation:** Forward-Compat Typing phase should include concrete smoke-test code (vitest setup hook or HTML-based test).
5. **Internal `@deprecated` JSDoc usage:** Quick grep for `@deprecated` in `src/` at phase planning to determine if v1.1 or v1.2 scope.

## Sources

### Primary (HIGH confidence)

- **npm registry API** (npmjs.org `dist-tags` + `engines` + `peerDependencies` direct queries, 2026-07-15) — All version numbers, `engines` fields, compatibility matrices
- **TypeScript 6.0 release notes** (typescript.org official docs) — Deprecation list, strict defaults, `ignoreDeprecations`, `stableTypeOrdering`
- **Node.js EOL schedule** (nodejs.org previous-releases + endoflife.date/nodejs) — Node 20/22/24 status, EOL dates
- **DxKit repository source** (direct read: `tsconfig.json`, `tsup.config.ts`, `package.json`, `.github/workflows/ci.yml`, source files) — Codebase-grounded facts

### Secondary (MEDIUM confidence)

- **TypeScript 5.5+ / 6.0 docs on isolatedDeclarations** (typescript.org) — Annotation requirements, exemptions, edge cases
- **TypeScript 5.8 docs on erasableSyntaxOnly** (typescript.org) — Forward-compat flag rationale
- **tsdown migration docs + tsdown GitHub** (tsdown.dev, github.com) — Build-tool comparison, Node version requirements
- **Vite 8 migration guide** (vite.dev) — Breaking changes, Rolldown/Oxc internals
- **Renovate vs Dependabot 2026 comparisons** (multiple community sources, cross-checked ≥3 independent sources) — pnpm workspace support
- **Biome linter docs** (biomejs.dev) — Linter capabilities

### Tertiary (LOWER confidence, flagged for validation)

- **tsup GitHub README** ("not actively maintained, consider tsdown") — Maintenance status quoted directly but not independently verified
- **STACK.md / FEATURES.md / ARCHITECTURE.md / PITFALLS.md** (4 parallel research agents, 2026-07-15) — Synthesized cross-project findings

---

## Ready for Roadmap?

**Yes.** All four research files converge on a clear phase structure: Toolchain → TS6 Migration → Forward-Compat Typing → Guardrails. Decision point (Node 20 vs. Node 22) is clear and data-driven. Pitfalls are mapped to phases with prevention strategies. Research flags identify where light validation is needed during planning. No blockers; ready to proceed to requirements definition.

---

*Research completed: 2026-07-15*  
*Synthesized by: gsd-research-synthesizer*  
*Status: READY FOR ROADMAP*

# Roadmap: DxKit

## Milestones

- ✅ **v1.0 Beta Hardening** — Phases 1–5 (shipped 2026-07-15, released as 0.2.0)
- 🚧 **v1.1 TypeScript 6 Migration & Toolchain Modernization** — Phases 6–9 (active)

v1.0 detail archived in [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md).

## Overview (v1.1)

A focused modernization pass, not a feature push. The work sequences along one hard constraint
the research surfaced: **there is no standalone typecheck step in the repo today** — type checking
only happens as a side effect of tsup's `dts:true` emit — so every deprecation gate and forward-compat
flag needs a real `tsc --noEmit` baseline to attach to first.

Toolchain modernization lands first (Phase 6): it raises the Node floor from EOL Node 18 to Node 22
LTS with an enforced `engines` guard, bumps tsup/vite/vitest/Biome to current, and swaps the
unmaintained `cz-conventional-changelog` for `cz-git` — this gates which tool versions are even
discussable below it. The TS6 migration (Phase 7) then lands the standalone per-package `tsc --noEmit`
step *before* the compiler bump, so the migration has a baseline to diff against, and resolves every
deprecation at the source. Forward-compat typing (Phase 8) turns on `verbatimModuleSyntax`,
`isolatedDeclarations`, and `erasableSyntaxOnly` across all packages, core-before-plugins, verified
against the built IIFE/CJS artifacts (nothing exercises those outputs today). Guardrails close the
milestone (Phase 9): a scoped CI deprecation gate that can only exist once the `tsc` step does, a
zero-runtime-dep assertion, Renovate targeting the final pipeline, and the carried-over WR-01 registry
robustness fix.

Out of scope this milestone (deferred to v2): the TS7 migration itself and the tsup→tsdown swap.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- v1.1 continues numbering from v1.0 (which ended at Phase 5)

<details>
<summary>✅ v1.0 Beta Hardening (Phases 1–5) — SHIPPED 2026-07-15</summary>

Hardened DxKit 0.1.5 → 0.2.0 without expanding the feature surface: silent failures made
visible via `dx:error`, load/hang/leak guards, an optional template sanitizer + configurable
storage keys, a stress/edge-case/regression test suite, and a full documentation truth pass.

- [x] Phase 1: Diagnostics — Surface Silent Failures (2/2 plans) — completed 2026-07-11
- [x] Phase 2: Robustness — Load Guards, Caching & Handler Cleanup (4/4 plans) — completed 2026-07-12
- [x] Phase 3: Security — Sanitization & Storage Isolation (3/3 plans) — completed 2026-07-12
- [x] Phase 4: Testing — Stress, Edge-Case & Regression Coverage (6/6 plans) — completed 2026-07-14
- [x] Phase 5: Documentation — Truth Pass (8/8 plans) — completed 2026-07-14

</details>

**🚧 v1.1 TypeScript 6 Migration & Toolchain Modernization (Phases 6–9)**

- [ ] **Phase 6: Toolchain Audit & Modernization** - Dev toolchain on current TS6-compatible versions with an enforced Node 22 LTS floor; all three build outputs still emit.
- [ ] **Phase 7: TypeScript 6 Migration & Standalone Typecheck** - A per-package `tsc --noEmit` baseline lands, then core + 4 plugins compile clean on TS6 with zero deprecation shims.
- [ ] **Phase 8: Forward-Compat Typing** - `verbatimModuleSyntax` + `isolatedDeclarations` + `erasableSyntaxOnly` on across all packages, verified against the built IIFE/CJS artifacts.
- [ ] **Phase 9: Continuous Debt Guardrails & Registry Robustness** - Scoped CI deprecation gate, zero-runtime-dep assertion, Renovate automation, and the WR-01 registry array-shape fix.

## Phase Details

### Phase 6: Toolchain Audit & Modernization

**Goal**: The dev toolchain runs on current, TS6-compatible versions with an enforced Node 22 LTS floor, and all three build outputs still emit correctly — establishing the version baseline every phase below depends on.
**Depends on**: Nothing new (first phase of v1.1; v1.0 shipped)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05
**Success Criteria** (what must be TRUE):

  1. Every `package.json` (core + 4 plugins) declares `engines: { "node": ">=22" }` and, with `engine-strict` set, a `pnpm install` on Node 18/20 fails fast — proven by a negative install test that expects failure on the old floor.
  2. CI runs the full suite on Node 22 and no longer includes EOL Node 18/20 in its matrix.
  3. tsup, vite, vitest, happy-dom, and Biome are bumped to current TS6-compatible versions with `make test` green.
  4. The commitizen flow uses maintained `cz-git` (unmaintained `cz-conventional-changelog` removed) and still emits conventional commits.
  5. All three build outputs (ESM `dist/index.js`, CJS `dist/index.cjs`, IIFE `dist/index.global.js`) are still produced per package and confirmed present after the toolchain bumps.

**Plans**: TBD
**Breaking change**: Node `engines` floor raised to ≥22 (drops Node 18/20). Requires a `BREAKING CHANGE:` footer + migration note (contributors/consumers must be on Node 22 LTS).

### Phase 7: TypeScript 6 Migration & Standalone Typecheck

**Goal**: Core + all four plugins compile clean under TypeScript 6, with a dedicated per-package `tsc --noEmit` step in place — the typecheck baseline that every later deprecation gate attaches to.
**Depends on**: Phase 6 (the Node floor and toolchain versions gate which TypeScript / tooling versions are even installable)
**Requirements**: TS6-01, TS6-02, TS6-03
**Success Criteria** (what must be TRUE):

  1. A standalone `tsc --noEmit` typecheck runs per package — independent of tsup's `dts:true` emit — wired into `make test` and CI, and it exists and passes *before* the TS6 version bump lands (giving the migration a measurable baseline to diff against).
  2. Core and all four plugins compile under TypeScript 6.0.x with zero type errors.
  3. No `ignoreDeprecations` shim remains in any `tsconfig.json` — every deprecation TS6 surfaces is resolved at the source.
  4. The full vitest suite stays green after the TS6 bump.

**Plans**: TBD

### Phase 8: Forward-Compat Typing

**Goal**: The three strict forward-compat flags are enabled across every package with the built artifacts proven intact, making the eventual TS7 jump a config swap rather than a rewrite.
**Depends on**: Phase 7 (flag fixes must be made once, against the final TS6 compiler and its `tsc --noEmit` gate — not twice)
**Requirements**: FCT-01, FCT-02, FCT-03, FCT-04
**Success Criteria** (what must be TRUE):

  1. `verbatimModuleSyntax` is enabled across all packages; build and tests stay green.
  2. `isolatedDeclarations` is enabled across all packages (core before plugins, per-package audit) and `.d.ts` emit succeeds for every package.
  3. `erasableSyntaxOnly` is enabled across all packages, with no non-erasable TS syntax remaining anywhere.
  4. A smoke test loads the built `dist/` artifacts and confirms each IIFE global attaches with its expected top-level keys and CJS `require()` interop returns the expected exports — the artifact path neither `tsc` nor the current vitest suite exercises today.

**Plans**: TBD
**Breaking change**: `isolatedDeclarations` can require consumers who augment DxKit's public types (module augmentation on `Context` / `window.__DXKIT__`) to add explicit export type annotations. Flag with a `BREAKING CHANGE:` footer + migration note if consumer-visible type behavior changes.

### Phase 9: Continuous Debt Guardrails & Registry Robustness

**Goal**: CI continuously catches type/deprecation regressions and dependency drift scoped to project-owned code, the zero-runtime-dep posture is machine-enforced, and the last known registry crash path is closed.
**Depends on**: Phase 7 (the `tsc --noEmit` step must exist for the deprecation gate to attach to) and Phase 8 (Renovate's automerge policy and the artifact smoke test target the *final* CI pipeline)
**Requirements**: GATE-01, GATE-02, GATE-03, ROB-05
**Success Criteria** (what must be TRUE):

  1. CI fails the build on `tsc` typecheck/deprecation errors scoped to project-owned paths only (`src/`, `plugins/*/src/`) — a diagnostic under `node_modules/` never turns the build red.
  2. CI asserts the zero-runtime-dependency posture (e.g. a `pnpm why`-style check), so an automated bump that pulls a non-dev dependency into any package is caught and fails the build.
  3. Renovate is configured for the pnpm workspace with grouped PRs, release-age gating, and an automerge policy that blocks unreviewed major toolchain bumps (tsup/vite/vitest/Biome/TypeScript).
  4. `loadManifests()` validates that `registry.json` is an array; a wrong-shape `200` emits `dx:error` (source `shell:manifest`) instead of throwing an uncaught `TypeError` in `init()` before `window.__DXKIT__` is exposed (WR-01).

**Plans**: TBD

## Progress

**Execution Order:**
v1.1 phases execute in numeric order: 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Diagnostics — Surface Silent Failures | v1.0 | 2/2 | Complete | 2026-07-11 |
| 2. Robustness — Load Guards, Caching & Handler Cleanup | v1.0 | 4/4 | Complete | 2026-07-12 |
| 3. Security — Sanitization & Storage Isolation | v1.0 | 3/3 | Complete | 2026-07-12 |
| 4. Testing — Stress, Edge-Case & Regression Coverage | v1.0 | 6/6 | Complete | 2026-07-14 |
| 5. Documentation — Truth Pass | v1.0 | 8/8 | Complete | 2026-07-14 |
| 6. Toolchain Audit & Modernization | v1.1 | 0/? | Not started | - |
| 7. TypeScript 6 Migration & Standalone Typecheck | v1.1 | 0/? | Not started | - |
| 8. Forward-Compat Typing | v1.1 | 0/? | Not started | - |
| 9. Continuous Debt Guardrails & Registry Robustness | v1.1 | 0/? | Not started | - |

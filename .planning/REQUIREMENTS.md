# Requirements: DxKit — v1.1 TypeScript 6 Migration & Toolchain Modernization

**Defined:** 2026-07-15
**Core Value:** DxKit stays trustworthy for real use — failures are visible (never silent), documented behavior matches actual behavior, and the alpha is stable enough to build on with confidence.

> Milestone framing: this is a developer-experience / build-integrity milestone. "User" means the
> DxKit *consumer/developer* and the maintainer's build pipeline. Requirements are written to be
> observable and testable (a build passes/fails, an artifact is emitted, a flag is enforced). TS6 is
> a deliberate stepping stone to a future TS 7.1 migration — every forward-compat measure is chosen
> to make that jump a config swap, not a rewrite.

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### TypeScript 6 Migration

- [ ] **TS6-01**: Core and all four plugins compile under TypeScript 6.0.x with zero type errors
- [ ] **TS6-02**: Every deprecation TS6 surfaces is resolved at the source — no `ignoreDeprecations` shim remains in any tsconfig
- [ ] **TS6-03**: A standalone `tsc --noEmit` typecheck runs per package, independent of tsup's `dts:true` emit (the repo has no dedicated typecheck step today)

### Toolchain Modernization

- [x] **TOOL-01**: `engines` in every package.json requires Node ≥22 (Node 22 LTS floor); a wrong-Node install fails fast (engine-strict)
- [x] **TOOL-02**: CI runs on Node 22 and no longer tests EOL Node 18/20
- [x] **TOOL-03**: Build/test/lint tooling (tsup, vite, vitest, happy-dom, Biome) bumped to current TS6-compatible versions with the full test suite green
- [x] **TOOL-04**: `cz-conventional-changelog` replaced by maintained `cz-git`; the commitizen flow still emits conventional commits
- [x] **TOOL-05**: All three build outputs (ESM / CJS / IIFE) are still produced per package and verified after the toolchain bumps

### Forward-Compat Typing

- [ ] **FCT-01**: `verbatimModuleSyntax` enabled across all packages; build and tests stay green
- [ ] **FCT-02**: `isolatedDeclarations` enabled across all packages; `.d.ts` emit succeeds for every package
- [ ] **FCT-03**: `erasableSyntaxOnly` enabled across all packages (no non-erasable TS syntax remains)
- [ ] **FCT-04**: IIFE global-attach and CJS `require()` interop verified intact on the built `dist/` artifacts after the flags land (smoke test — nothing exercises the built artifacts today)

### Continuous Debt Guardrails

- [ ] **GATE-01**: CI fails the build on `tsc` typecheck/deprecation errors, scoped to project-owned paths only (never `node_modules/`)
- [ ] **GATE-02**: CI asserts the zero-runtime-dependency posture, so an automated bump that pulls in a runtime dep is caught
- [ ] **GATE-03**: Dependency-freshness automation (Renovate) configured for the pnpm workspace — grouped PRs, release-age gating, and an automerge policy that blocks unreviewed major toolchain bumps

### Robustness

- [ ] **ROB-05**: `loadManifests()` validates that registry.json is an array; a wrong-shape `200` emits `dx:error` (source `shell:manifest`) instead of throwing an uncaught `TypeError` in `init()` before `window.__DXKIT__` is exposed (WR-01)

## v2 Requirements

Acknowledged, deferred to a future milestone. Not in this roadmap.

### Modernization (next milestone)

- **TS7-01**: Migrate core + plugins to TypeScript 7.1 once a stable point release lands (the payoff of v1.1's forward-compat groundwork)
- **BUILD-01**: Migrate tsup → tsdown for native/parallel `.d.ts` emit and the `isolatedDeclarations` build-speed payoff (requires Node ≥22.18)

## Out of Scope

Explicitly excluded from v1.1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| TypeScript 7.x migration | The whole point of v1.1 is to *prepare* for it; TS7 is fresh and we're waiting on a stable 7.1 point release for ABI/API |
| tsup → tsdown migration | tsdown needs Node ≥22.18 and is a build-tool swap; v1.1 stays on maintained `tsup@8.5.x`. Deferred to next milestone |
| `isolatedDeclarations` build-speed gains | tsup 8.x doesn't honor the flag for faster emit; we adopt it for correctness/forward-compat only, speed payoff comes with tsdown |
| Storage encryption for persisted state | Larger standalone design effort, orthogonal to modernization |
| New routing features (wildcard / `:param`) | A feature push, not modernization — would pull focus from the TS6 goal |
| Biome `@deprecated`-export lint gate | Biome has no equivalent to `no-deprecated`; reintroducing ESLint conflicts with the Biome-only stance. Compiler-option deprecations are gated via `tsc` (GATE-01) instead |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TS6-01 | Phase 7 | Pending |
| TS6-02 | Phase 7 | Pending |
| TS6-03 | Phase 7 | Pending |
| TOOL-01 | Phase 6 | Complete |
| TOOL-02 | Phase 6 | Complete |
| TOOL-03 | Phase 6 | Complete |
| TOOL-04 | Phase 6 | Complete |
| TOOL-05 | Phase 6 | Complete |
| FCT-01 | Phase 8 | Pending |
| FCT-02 | Phase 8 | Pending |
| FCT-03 | Phase 8 | Pending |
| FCT-04 | Phase 8 | Pending |
| GATE-01 | Phase 9 | Pending |
| GATE-02 | Phase 9 | Pending |
| GATE-03 | Phase 9 | Pending |
| ROB-05 | Phase 9 | Pending |

**Coverage:**

- v1 requirements: 16 total
- Mapped to phases: 16 ✓
- Unmapped: 0 ✓

**Per-phase distribution:**

- Phase 6 — Toolchain Audit & Modernization: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05 (5)
- Phase 7 — TypeScript 6 Migration & Standalone Typecheck: TS6-01, TS6-02, TS6-03 (3)
- Phase 8 — Forward-Compat Typing: FCT-01, FCT-02, FCT-03, FCT-04 (4)
- Phase 9 — Continuous Debt Guardrails & Registry Robustness: GATE-01, GATE-02, GATE-03, ROB-05 (4)

---
*Requirements defined: 2026-07-15*
*Last updated: 2026-07-15 after roadmap creation — all 16 v1 requirements mapped to Phases 6–9*

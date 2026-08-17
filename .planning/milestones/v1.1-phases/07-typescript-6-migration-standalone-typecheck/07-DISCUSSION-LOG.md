# Phase 7: TypeScript 6 Migration & Standalone Typecheck - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 7-TypeScript 6 Migration & Standalone Typecheck
**Areas discussed:** Typecheck scope, Typecheck config shape, make/CI wiring, Migration sequencing

---

## Typecheck scope

| Option | Description | Selected |
|--------|-------------|----------|
| src + tests | Type-check src AND the ~5,900 LOC test suite per package; catches TS6 deprecations in the largest untyped surface; may surface pre-existing test type errors | ✓ |
| src only | Mirror the build's `include:['src']`; smallest baseline, no surprises, but tests + their deprecations stay unchecked | |
| src + tests + configs | Also type-check root config files (tsup/vitest); maximal but needs extra config for files outside any package rootDir | |

**User's choice:** src + tests
**Notes:** Tests become a first-class consumer of the public types. Fixing any pre-existing test-only type errors is accepted as in-scope — it's the point of a real baseline. Confirmed layout: core tests at `tests/` (7 files), each plugin at `plugins/<name>/tests/`.

---

## Typecheck config shape

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated typecheck config | `tsconfig.typecheck.json` per package (noEmit, include src+tests, paths mirroring vitest aliases); build tsconfigs untouched | ✓ |
| Reuse + widen existing | Widen existing tsconfig include to tests and run `tsc --noEmit -p tsconfig.json`; entangles build dts emit with typecheck | |
| Project references | Solution-style root config with `tsc -b`, composite:true; native cross-package resolution but reshapes the whole build | |

**User's choice:** Dedicated typecheck config
**Notes:** Surfaced the cross-package wrinkle — plugin tests import `@dnzn/dxkit` via vitest aliases `tsc` doesn't know; the typecheck configs must add `paths` mappings mirroring `vitest.config.ts` so they resolve to `src` without a prior build. Keeps typecheck and emit concerns fully separated.

---

## make/CI wiring

| Option | Description | Selected |
|--------|-------------|----------|
| typecheck target, in make test | New `make typecheck` (loops root + PLUGIN_BUILD_ORDER), prereq of `make test` so existing CI catches it; standalone for Phase 9's gate; runs before vitest | ✓ |
| Separate CI step only | `make typecheck` as its own ci.yml step, `make test` unchanged; local `make test` wouldn't catch type errors | |
| Fold into lint stage | Run typecheck inside the lint gate; couples unrelated tools, harder for Phase 9's tsc-scoped gate to target | |

**User's choice:** typecheck target, in make test
**Notes:** No `ci.yml` edit needed — CI runs `make test`, which gains the prereq. Standalone target is the attach point for Phase 9's scoped deprecation gate (GATE-01). Ordering lint → typecheck → vitest (fast static checks first).

---

## Migration sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Baseline / bump / fixes split | (1) typecheck green on 5.8.3 = baseline commit, (2) TS `^6.0.0` bump commit, (3) deprecation fixes as grouped follow-ups; bisectable per D-02 | ✓ |
| Baseline, then bump+fixes together | Baseline commit, then single commit bumping + fixing all at once; loses the "what TS6 broke" signal | |
| You decide granularity | Baseline first (locked), planner/executor picks commit boundaries based on how many deprecations surface | |

**User's choice:** Baseline / bump / fixes split
**Notes:** Baseline-before-bump ordering is fixed by ROADMAP Criterion 1. "Green on 5.8.3" is itself the measurable baseline — no snapshot artifact. Caret `^6.0.0` per Phase 6 D-03; lockfile pins exact. If zero deprecations surface, the fixes step is empty (baseline + bump only) — do not manufacture changes.

---

## Claude's Discretion

- Exact TS6.0.x patch resolved at implementation time (latest stable 6.0.x).
- Final `make test` prereq micro-ordering of lint vs typecheck (both before vitest).
- Specific `paths`/`baseUrl` details in each `tsconfig.typecheck.json`; whether a shared base fragment is factored out.
- Commit boundaries within the "fixes" step (per package vs per deprecation class), including the empty case when zero deprecations surface.

## Deferred Ideas

- CI deprecation gate scoped to `src/`+`plugins/*/src/` (GATE-01) — Phase 9; this phase only builds the `make typecheck` step it attaches to.
- Type-checking root config files (tsup.config.ts, vitest.config.ts) — deferred as low-value config churn.
- Project references / solution-style build — rejected for this phase; candidate if incremental typecheck perf ever matters.
- Forward-compat flags + IIFE/CJS artifact smoke test — Phase 8.

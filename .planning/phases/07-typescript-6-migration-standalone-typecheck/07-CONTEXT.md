# Phase 7: TypeScript 6 Migration & Standalone Typecheck - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Land a dedicated per-package `tsc --noEmit` typecheck step — independent of tsup's
`dts:true` emit — that passes green on today's **TypeScript 5.8.3** first (the baseline),
then bump core + all four plugins to **TypeScript 6.0.x** and resolve every deprecation TS6
surfaces **at the source**. No `ignoreDeprecations` shim survives in any tsconfig. The full
vitest suite stays green throughout.

Requirements covered: **TS6-01, TS6-02, TS6-03** (3 total — see `.planning/REQUIREMENTS.md`).

**Locked upstream (not re-litigated here):**
- **Sequencing (ROADMAP Success Criterion 1):** the typecheck step must exist and pass
  *before* the TS6 version bump lands — the migration diffs against that baseline.
- **No-shim rule (TS6-02):** deprecations are fixed at source, never suppressed.

**Explicitly NOT this phase (belongs to Phases 8–9):**
- Forward-compat flags `verbatimModuleSyntax` / `isolatedDeclarations` / `erasableSyntaxOnly` (Phase 8).
- The IIFE/CJS artifact smoke test (FCT-04, Phase 8).
- The CI *deprecation gate* that scopes `tsc` errors to `src/`+`plugins/*/src/`, the
  zero-runtime-dep assertion, Renovate, and WR-01 (Phase 9). This phase only builds the
  `tsc` step those later gates attach to.
- The TS7 migration and tsup→tsdown swap (deferred to v2).

</domain>

<decisions>
## Implementation Decisions

### Typecheck scope (TS6-03)
- **D-01:** The standalone `tsc --noEmit` covers **`src` + `tests`** per package — not
  `src` only. Tests (~5,900 LOC: core `tests/` = 7 files; each plugin has its own
  `plugins/<name>/tests/`) are type-checked by nothing today, so this is the largest
  untyped surface and the place TS6 deprecations would otherwise hide. Tests become a
  first-class consumer of each package's public types.
  - **Accepted risk:** widening to tests may surface *pre-existing* test-only type errors
    that were never checked. Fixing them is in-scope for this phase — that is the point of
    establishing a real baseline.
  - Root config files (`tsup.config.ts`, `vitest.config.ts`) are **out of scope** for the
    typecheck — they sit under no package `rootDir` and add config churn for low value.

### Typecheck config shape (TS6-03)
- **D-02:** Add a **dedicated `tsconfig.typecheck.json` per package** (5 total). Each
  extends the package's base tsconfig and sets `noEmit: true` with `include: ["src", "tests"]`.
  The existing build tsconfigs (`declaration: true`, `outDir`, `include: ["src"]`) are left
  **completely untouched** — typecheck and emit concerns stay separated so tsup's `dts:true`
  never picks up test files.
- **D-03:** Plugin tests import core across packages via vitest path aliases
  (`@dnzn/dxkit` → `src/index.ts`, etc. — see `vitest.config.ts:7-11`) that `tsc` does not
  understand. The typecheck configs must resolve these — **add `paths` mappings mirroring the
  vitest aliases** so plugin tests resolve `@dnzn/dxkit`/`@dnzn/dxkit-*` to each package's
  `src` (not to unbuilt `dist/*.d.ts`). This keeps typecheck runnable without a prior build.
- **D-04:** Project references (`tsc -b`, `composite: true`) were considered and **rejected**
  for this phase — they reshape how the whole repo builds and exceed what a per-package
  `--noEmit` needs.

### make/CI wiring (TS6-03)
- **D-05:** Add a new **`make typecheck`** target that loops the root package + the four
  plugins (reuse the existing `PLUGIN_BUILD_ORDER` var, mirroring the `verify-outputs`
  target's per-package loop) running `tsc --noEmit -p tsconfig.typecheck.json` for each.
- **D-06:** Make `typecheck` a **prerequisite of `make test`** so the existing CI (which runs
  `make build` + `make test`) picks it up with **no `ci.yml` edit required**. Keep it a
  distinct, standalone target so **Phase 9's deprecation gate can call `make typecheck`
  directly**. Ordering: **lint → typecheck → vitest** (fast static checks first, then the
  suite; final lint-vs-typecheck micro-ordering is Claude's discretion — see below).

### Migration sequencing & commit strategy (TS6-01, TS6-02)
- **D-07:** Commit in the **baseline / bump / fixes** split (matches Phase 6's D-02
  bisectable discipline):
  1. **Baseline** — typecheck infra (`tsconfig.typecheck.json` × 5, `make typecheck`,
     wiring into `make test`) committed **green on TS 5.8.3**. This *is* the measurable
     baseline — "green on 5.8.3" is sufficient; no separate snapshot artifact is needed.
  2. **Bump** — TypeScript root devDep `^5.8.3` → `^6.0.0` as its own commit (may go red).
  3. **Fixes** — deprecation/error resolutions as follow-up commit(s), grouped logically
     (per package or per deprecation class), each fixing at source. No `ignoreDeprecations`.
- **D-08:** TypeScript version range uses a **caret `^6.0.0`** per Phase 6's D-03 convention
  (keep carets on devDeps; `pnpm-lock.yaml` pins the exact resolved version; Renovate owns
  majors). TS6-01's "6.0.x" is satisfied by the resolved lockfile version at adoption time.

### Claude's Discretion
- Exact TS6.0.x patch resolved at implementation time (pick latest stable 6.0.x).
- Precise `make test` prerequisite ordering of `lint` vs `typecheck` (both must run before
  vitest; lint is faster so likely first).
- The specific set of `paths` entries and `baseUrl`/`rootDir` details in each
  `tsconfig.typecheck.json`, and whether a shared base typecheck fragment is factored out.
- Exact commit boundaries within the "fixes" step (per package vs per deprecation class),
  and the degenerate case where **zero deprecations surface** — then TS6-02 is trivially
  satisfied and the fixes step may be empty (baseline + bump commits only).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & requirements (authoritative)
- `.planning/REQUIREMENTS.md` — TS6-01/02/03 exact wording and the traceability table
  (lines ~18-20, ~75-77, ~101). Source of truth for what "done" means.
- `.planning/ROADMAP.md` §"Phase 7: TypeScript 6 Migration & Standalone Typecheck"
  (lines ~100-112) — goal, 4 success criteria, and the baseline-before-bump sequencing
  constraint (Criterion 1).
- `.planning/PROJECT.md` §"Current Milestone: v1.1" + §Constraints + §Key Decisions —
  zero-runtime-deps posture, caret-range convention, and why TS6 is the TS7 stepping stone.
- `.planning/STATE.md` §"Accumulated Context → Decisions" + §Blockers/Concerns — the
  cross-research sequencing convergence (tsc step is a precondition for GATE-01) and the
  Phase 9 gate-scoping caveat (`src/`+`plugins/*/src/` only).

### Prior-phase context (carried decisions)
- `.planning/phases/06-toolchain-audit-modernization/06-CONTEXT.md` — D-02 (per-tool
  bisectable commits), D-03 (keep caret ranges), D-04 (TS stayed 5.8.x, tools chosen
  TS6-compatible), and the `PLUGIN_BUILD_ORDER` / `verify-outputs` per-package-loop pattern.

### Files this phase will touch (confirmed present)
- `tsconfig.json` (root, core) and `plugins/{auth,wallet,theme,settings}/tsconfig.json` —
  base configs to `extends` from; **left unmodified** (D-02).
- **New:** `tsconfig.typecheck.json` at root + one per plugin (5 total) — noEmit, include
  src+tests, `paths` mirroring vitest aliases.
- `Makefile` — new `typecheck` target (reuse `PLUGIN_BUILD_ORDER`), add as `make test`
  prereq; `.PHONY` list update.
- `package.json` (root) — bump `typescript` devDep `^5.8.3` → `^6.0.0`; optional `typecheck`
  npm script mirroring the make target.
- `pnpm-lock.yaml` — updated by the TS bump.
- `vitest.config.ts` (lines ~7-11) — **read-only reference** for the alias list the
  `paths` mappings must mirror; not edited.

No external ADRs/specs beyond the `.planning/` docs above — requirements are fully captured
there and in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`PLUGIN_BUILD_ORDER`** (Makefile) — already used by both `build` and `verify-outputs`
  as the canonical per-package loop; reuse it for `typecheck` so the list can't drift.
- **`verify-outputs` target** — the structural template for a per-package Makefile loop
  (`@for dir in $(PLUGIN_BUILD_ORDER)`), including the root-package-first + plugins pattern.
- **vitest alias block** (`vitest.config.ts:7-11`) — the exact 5-entry alias map the
  typecheck `paths` must mirror for cross-package test type resolution.
- **Per-plugin `extends: "../../tsconfig.json"`** — plugins already inherit the root
  compiler options; the typecheck configs extend the same base with minimal overrides.

### Established Patterns
- **`make` is the contract** — CI runs `make build` + `make test`; wiring typecheck into
  `make test` means CI inherits it with no workflow edit.
- **Per-tool / bisectable commits (Phase 6 D-02)** — carried into D-07's baseline/bump/fixes
  split.
- **Caret devDep ranges (Phase 6 D-03)** — carried into D-08; lockfile pins exact versions.
- **Zero runtime dependencies** — TypeScript is and stays a devDependency; nothing here
  touches the runtime dep posture.
- **Plugin lockstep versioning** — not a version-bumping phase, but all 5 packages get the
  typecheck config together (uniform treatment).

### Integration Points
- `make test` gains `typecheck` as a prereq → the single choke point that both local dev and
  CI already run.
- `make typecheck` as a standalone target → the attach point Phase 9's scoped CI deprecation
  gate (GATE-01) will target.
- The TS bump touches only the root `typescript` devDep + `pnpm-lock.yaml`; CI `--frozen-lockfile`
  requires the lockfile update to land with the bump commit.

</code_context>

<specifics>
## Specific Ideas

- The pre-bump baseline is proven by **`make typecheck` passing green on TS 5.8.3**, committed
  before the compiler bump — no separate snapshot file. "It was green, then the bump changed X"
  is the diff.
- Expect the typecheck-on-tests step to be where any surprises land: tests were never
  type-checked, so pre-existing test type errors (if any) surface here and are fixed in the
  baseline step, keeping the TS6 bump's red strictly attributable to TS6 itself.
- Degenerate-but-valid outcome: if TS6 surfaces **zero** deprecations/errors, TS6-02 is
  trivially satisfied and the "fixes" commits are empty — baseline + bump only. Do not
  manufacture changes to satisfy the criterion.

</specifics>

<deferred>
## Deferred Ideas

- **CI deprecation gate scoped to `src/`+`plugins/*/src/`** (GATE-01) — Phase 9. This phase
  only builds the `make typecheck` step it attaches to; do NOT add error-scoping/filtering
  of `node_modules/` deprecation noise here.
- **Type-checking root config files** (`tsup.config.ts`, `vitest.config.ts`) — considered
  for typecheck scope; deferred (D-01) as low-value config churn outside any package rootDir.
- **Project references / solution-style build** (`tsc -b`, `composite`) — rejected for this
  phase (D-04); a candidate if incremental typecheck perf ever matters.
- **Forward-compat flags** (`verbatimModuleSyntax` / `isolatedDeclarations` /
  `erasableSyntaxOnly`) and the **IIFE/CJS artifact smoke test** — Phase 8.

None of the above are in Phase 7 scope — discussion stayed within the migration + typecheck boundary.

</deferred>

---

*Phase: 7-TypeScript 6 Migration & Standalone Typecheck*
*Context gathered: 2026-07-17*

# Phase 8: Forward-Compat Typing - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable the three strict forward-compat compiler flags — **`verbatimModuleSyntax`**,
**`isolatedDeclarations`**, and **`erasableSyntaxOnly`** — across core + all four plugins,
fix whatever they surface **at the source** (no shims), and prove the built `dist/`
artifacts still work with a new smoke test: each IIFE global attaches with its expected
top-level keys and CJS `require()` interop returns the expected exports (**FCT-04** — the
artifact path neither `tsc` nor the current vitest suite exercises today). Goal: make the
eventual TS7 jump a **config swap, not a rewrite**.

Requirements covered: **FCT-01, FCT-02, FCT-03, FCT-04** (4 total — see `.planning/REQUIREMENTS.md`).

**Scout findings that bound the work (from `scout_codebase`):**
- **`verbatimModuleSyntax` (FCT-01)** is **near-no-op** — source already uses `import type` /
  `export type` consistently (20 type-imports vs 5 genuine value-imports of factory functions),
  and `isolatedModules: true` is already on. Expect little-to-no churn; the smoke test is what
  proves the CJS/ESM interop boundary intact.
- **`erasableSyntaxOnly` (FCT-03)** is a **true no-op** — factory-function codebase with zero
  classes, enums, `const enum`, namespaces, or parameter properties. Turning it on should be
  clean. **Do not manufacture changes** to satisfy the criterion.
- **`isolatedDeclarations` (FCT-02)** is the **real work surface** — it requires explicit
  return-type / type annotations on exported symbols so `.d.ts` can be emitted without
  inference. This is where at-source fixes (if any) land.
- **FCT-04 smoke test** is the **other real surface** — nothing exercises `dist/` today; the
  IIFE/CJS boundary is the milestone's flagged risk (STATE.md Blockers/Concerns).

**Locked upstream (not re-litigated here):**
- **Sequencing (ROADMAP dependency):** flag fixes are made **once, against the final TS6
  compiler and its `tsc --noEmit` gate** — Phase 7 already landed the standalone typecheck and
  the TS6 bump. This phase attaches to that green baseline.
- **Core-before-plugins, per-package audit** for `isolatedDeclarations` (ROADMAP mandate).
- **No-shim rule** carried from Phase 7 (TS6-02): resolve at source, never suppress.

**Explicitly NOT this phase (belongs to Phase 9):**
- The **CI deprecation gate** scoped to `src/`+`plugins/*/src/` (GATE-01), the
  **zero-runtime-dep assertion** (GATE-02), **Renovate** automation (GATE-03), and the
  **WR-01 registry array-shape fix** (ROB-05). This phase does not add error-scoping /
  `node_modules/` noise filtering.
- The **TS7 migration** and **tsup→tsdown swap** (deferred to v2).

</domain>

<decisions>
## Implementation Decisions

### Flag config placement (FCT-01, FCT-02, FCT-03)
- **D-01:** All three flags go in the **root base `tsconfig.json`** — the single source of
  truth inherited by (a) the `tsc --emitDeclarationOnly -p tsconfig.json` declaration-emit
  pass, (b) the five `tsconfig.typecheck.json` configs, and (c) all four plugins via
  `extends: "../../tsconfig.json"`. Rationale: `isolatedDeclarations` only guards `.d.ts`
  emit, so it MUST live in the config the emit pass reads (not typecheck-only); putting all
  three in base keeps **emit and typecheck enforced in lockstep** and gives plugins the flags
  for free. Rejected: typecheck-only placement (would not guard the actual declaration emit)
  and split-by-where-each-bites (two places to reason about, no benefit here).

### isolatedDeclarations annotation policy (FCT-02)
- **D-02:** **Minimal at-source annotations.** Add explicit return-type / type annotations
  **only where `isolatedDeclarations` demands them** to emit clean `.d.ts` — no broader
  public-API audit, no manufactured churn (consistent with Phase 7's fix-at-source /
  no-invented-changes philosophy). The codebase already annotates factory return types with
  named interfaces (`createShell(): Shell`, etc.), so surface is expected to be small.
- **D-03:** **Breaking-change note only if a public type shape actually changes.** The
  ROADMAP warns `isolatedDeclarations` *can* force consumers who augment DxKit's public types
  (module augmentation on `Context` / `window.__DXKIT__`) to add explicit `export type`
  annotations. Write the `BREAKING CHANGE:` footer + migration note **only if the adoption
  actually alters consumer-visible type behavior**; if nothing public shifts, no note is
  manufactured. (Degenerate-but-valid: if no public shape changes, this is a non-breaking
  additive config change.)

### FCT-04 smoke test — placement & runner (FCT-04)
- **D-04:** **Separate target that builds first.** A dedicated `make` target (e.g.
  `make smoke`) runs `make build` and then a **vitest** pass against the **real built
  `dist/`** artifacts: CJS via `require('.../dist/index.cjs')`, IIFE loaded into **happy-dom**
  to assert global-attach. It is **NOT folded into `make test`** — `make test` never builds
  (Phase 7 constraint: `make test` = lint → typecheck → vitest, no build step). Wire the smoke
  target into the **build / release / CI** flow so a broken artifact fails automatically.
  Rejected: folding into `make test` (couples every test run to a full build) and a plain
  node script outside vitest (a second assertion style; vitest+happy-dom already fits both the
  `require()` and global-attach checks).

### FCT-04 smoke test — assertion depth (FCT-04)
- **D-05:** **Exhaustive expected-key assertions.** Each IIFE global — `DxKit`, `DxWallet`,
  `DxAuth`, `DxTheme`, `DxSettings` — must attach with its **full expected set of top-level
  export keys**, and CJS `require()` must return that **same expected export set**. This
  catches a dropped or renamed export (the exact failure mode `verbatimModuleSyntax` /
  `isolatedDeclarations` churn could introduce), not just total load failure. **Accepted
  trade-off:** the expected-key list becomes a **maintained fixture** — intentional, since its
  whole value is failing when the public export surface drifts unexpectedly.

### Rollout & commit order (FCT-01–04)
- **D-06:** **One bisectable commit per flag, no-ops first, isolatedDeclarations last.**
  Sequence: (1) `verbatimModuleSyntax` + `erasableSyntaxOnly` first — bank the near/actual
  no-op green (may be one commit or two); (2) `isolatedDeclarations` **core-before-plugins**,
  per-package, with any at-source annotation fixes; (3) the **FCT-04 smoke test** last.
  Isolates the real churn (isolatedDeclarations) in its own bisectable commit, matching the
  Phase 6 D-02 / Phase 7 D-07 per-tool bisectable discipline.

### Claude's Discretion
- Exact `make` target name for the smoke test (`smoke` vs `smoke-test` vs folding under an
  existing verify step's naming), and the precise CI/`release`/`publish` wiring point —
  mirror how `verify-outputs` is wired (D-04 intent, not exact string).
- Whether `verbatimModuleSyntax` and `erasableSyntaxOnly` land as one combined "no-op flags"
  commit or two separate commits (both are near/actual no-ops; either preserves bisectability).
- The exact happy-dom vs node mechanism for loading the IIFE global (e.g. script-eval into a
  happy-dom `window`) — implementation detail, as long as global-attach is genuinely asserted.
- The degenerate case where `isolatedDeclarations` surfaces **zero** required annotations —
  then FCT-02's "fixes" are empty (flag-on commit only); do not invent annotations.
- Whether the expected-export-key fixtures are inlined per-package or centralized in the smoke
  spec.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & requirements (authoritative)
- `.planning/REQUIREMENTS.md` — **FCT-01/02/03/04** exact wording + the traceability table.
  Source of truth for what "done" means (FCT-04 is explicitly a smoke test because "nothing
  exercises the built artifacts today").
- `.planning/ROADMAP.md` §"Phase 8: Forward-Compat Typing" — goal, 4 success criteria, the
  **core-before-plugins** ordering for `isolatedDeclarations`, and the `isolatedDeclarations`
  **BREAKING CHANGE** caveat (module augmentation on `Context` / `window.__DXKIT__`).
- `.planning/PROJECT.md` §"Current Milestone: v1.1" + §Constraints — zero-runtime-deps posture
  (smoke-test helpers must not add runtime deps), browser-first posture, and why the flags are
  TS7 de-risking.
- `.planning/STATE.md` §Blockers/Concerns — **Phase 8 risk note**: the IIFE/CJS build boundary
  is the real risk surface and FCT-04's smoke test must be a **required gate, not optional**
  (research Pitfalls 4 & 7).

### Prior-phase context (carried decisions — read before planning)
- `.planning/phases/07-typescript-6-migration-standalone-typecheck/07-CONTEXT.md` — the
  `tsconfig.typecheck.json` ×5 shape (extends base, `noEmit`, `include: ["src","tests"]`,
  `paths` mirroring vitest aliases), `make typecheck` / `make test` wiring (lint → typecheck →
  vitest, test does NOT build), the `PLUGIN_BUILD_ORDER` per-package-loop pattern, and the
  **dts-emit switch to `tsc --emitDeclarationOnly`** that `isolatedDeclarations` now attaches to.
- `.planning/phases/06-toolchain-audit-modernization/06-CONTEXT.md` — D-02 bisectable-commit
  discipline (carried into D-06) and the `verify-outputs` per-package dist/ loop (the wiring
  template the smoke target follows).

### Files this phase will touch (confirmed present)
- `tsconfig.json` (root/core) — **add** `verbatimModuleSyntax`, `isolatedDeclarations`,
  `erasableSyntaxOnly` here (D-01). Plugins inherit via `extends`; no per-plugin tsconfig edit
  needed for the flags.
- `src/**` and `plugins/*/src/**` — at-source annotation fixes for `isolatedDeclarations`
  **only where required** (D-02). Entry barrels most likely: `src/index.ts`,
  `plugins/{settings,wallet,auth,theme}/src/index.ts`.
- `Makefile` — new smoke target (build → vitest against `dist/`), wired into build/release/CI
  alongside the existing `verify-outputs` pattern (D-04); `.PHONY` update.
- **New:** an FCT-04 smoke test spec (vitest) + expected-export-key fixtures for the 5 globals
  (D-05).
- `tsup.config.ts` (root + plugins) — **read-only reference**: confirms dts is emitted by
  `tsc --emitDeclarationOnly` (onSuccess), which is the pass `isolatedDeclarations` guards.
- `.github/workflows/ci.yml` — CI wiring point for the smoke target (mirror how build /
  verify-outputs are invoked).

No external ADRs/specs beyond the `.planning/` docs above — requirements are fully captured
there and in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`PLUGIN_BUILD_ORDER`** (Makefile) — the canonical per-package list used by `build`,
  `verify-outputs`, and `typecheck`; reuse it for the smoke target so the package list can't
  drift.
- **`verify-outputs` target** — structural template for a Makefile loop over built `dist/`
  outputs; the smoke target follows the same build-then-check shape and CI wiring.
- **`tsc --emitDeclarationOnly -p tsconfig.json`** (tsup `onSuccess`, all 5 packages) — the
  declaration-emit pass `isolatedDeclarations` attaches to; already decoupled from tsup's dts
  bundler in Phase 7, so the flag lands cleanly on a real `tsc` emit.
- **happy-dom test env** (`vitest.config.ts`) — already the DOM impl for the suite; reuse it
  to load the IIFE build and assert global-attach without new deps.
- **IIFE globalName wiring** — `DxKit` (root `tsup.config.ts`) and `DxWallet`/`DxAuth`/
  `DxTheme`/`DxSettings` (plugin configs) are the exact globals the smoke test asserts on.

### Established Patterns
- **`make` is the contract** — CI runs make targets; the smoke target must be wired into
  build/release/CI (not `make test`, which never builds).
- **Per-tool / per-flag bisectable commits** (Phase 6 D-02 / Phase 7 D-07) — carried into D-06.
- **Fix-at-source, no shims, no manufactured changes** (Phase 7 no-shim rule) — carried into
  D-02/D-03; zero-deprecation, zero-invented-annotation posture.
- **`import type` / `export type` discipline** — already pervasive in source, which is why
  `verbatimModuleSyntax` is near-no-op.
- **Zero runtime dependencies / browser-first** — the smoke test must not introduce runtime
  deps; Phase 7 even avoided `@types/node`, so prefer `TextEncoder`/web-standard APIs over
  node-typed helpers where a choice exists.

### Integration Points
- `tsconfig.json` (base) → inherited by emit pass + typecheck configs + all plugins: the
  single edit point that turns all three flags on everywhere (D-01).
- New smoke target → the attach point for build/release/CI, and the FCT-04 required gate that
  proves the `dist/` artifact boundary intact.
- Phase 9's Renovate automerge policy and its own artifact expectations target the **final** CI
  pipeline this phase's smoke target helps define (ROADMAP Phase 9 depends-on note).

</code_context>

<specifics>
## Specific Ideas

- FCT-04 is a **required gate, not optional** (STATE.md Blockers/Concerns) — the IIFE/CJS
  boundary is the one output neither `tsc` nor the current vitest suite touches, and it's the
  milestone's flagged risk surface. Treat a failing smoke test as a hard stop.
- The expected-key fixtures for the 5 globals are a **deliberate maintenance point** — their
  value is precisely that they go red when the public export surface drifts (D-05).
- Degenerate-but-valid outcomes to expect and NOT paper over: `erasableSyntaxOnly` clean on
  first try (no non-erasable syntax exists), `verbatimModuleSyntax` clean or near-clean (type
  imports already marked), and `isolatedDeclarations` possibly needing few or zero annotations
  (factory returns already typed). If a flag surfaces nothing, land the flag-on commit and move
  on — no invented changes.

</specifics>

<deferred>
## Deferred Ideas

- **CI deprecation gate** scoped to `src/`+`plugins/*/src/` (GATE-01), **zero-runtime-dep
  assertion** (GATE-02), **Renovate** automation (GATE-03), **WR-01 registry array-shape fix**
  (ROB-05) — all **Phase 9**. This phase does not add `node_modules/` deprecation-noise scoping
  or dependency automation.
- **TS7 migration** and **tsup→tsdown swap** — deferred to v2 (milestone out-of-scope).

None — discussion stayed within the forward-compat-typing + artifact-smoke-test boundary.

</deferred>

---

*Phase: 8-Forward-Compat Typing*
*Context gathered: 2026-07-17*

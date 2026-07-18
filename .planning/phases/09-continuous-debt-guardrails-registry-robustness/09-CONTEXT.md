# Phase 9: Continuous Debt Guardrails & Registry Robustness - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Close out v1.1 with four independent, mostly-mechanical guardrails — no feature work:

1. **GATE-01** — a **visible CI deprecation gate**: `tsc --noEmit` type/deprecation errors fail
   the build, scoped to **project-owned paths only** (`src/`, `tests/`, `plugins/*/src/`) and
   **never** `node_modules/`.
2. **GATE-02** — a **machine-enforced zero-runtime-dep assertion**: any package that declares a
   runtime-visible dependency field fails the build.
3. **GATE-03** — **Renovate** configured for the pnpm workspace: grouped PRs, release-age gating,
   and an automerge policy that blocks unreviewed major toolchain bumps.
4. **ROB-05 (WR-01)** — `loadManifests()` validates that a `200` `registry.json` body is an
   **array**; a wrong-shape body emits `dx:error` (source `shell:manifest`) instead of throwing an
   uncaught `TypeError` in `init()` before `window.__DXKIT__` is exposed.

Requirements covered: **GATE-01, GATE-02, GATE-03, ROB-05** (4 total — see `.planning/REQUIREMENTS.md`).

**Depends on (locked upstream, not re-litigated):** Phase 7 (the standalone per-package
`tsc --noEmit` step + `tsconfig.typecheck.json` ×5 that GATE-01 attaches to) and Phase 8 (the
*final* CI pipeline — `build → verify-outputs → smoke → test` — that Renovate's automerge policy and
GATE-01/02 wire into).

**Explicitly NOT this phase:** TS7 migration and tsup→tsdown swap (deferred to v2); reintroducing
ESLint / a Biome `@deprecated`-export lint gate (out of scope per REQUIREMENTS — compiler-option
deprecations are gated via `tsc`, not lint); any new routing/feature surface.

</domain>

<decisions>
## Implementation Decisions

### GATE-03 — Renovate posture
- **D-01: Delivery = Mend GitHub App.** Ship `renovate.json` in-repo; the hosted Mend Renovate App
  reads it and opens PRs. **App installation on the repo/org is an operator step** (a GitHub setting
  outside this codebase) — record it in the confirmation/next-steps and STATE.md operator notes.
  Rejected: self-hosted CI action (adds a cron workflow + token secret + CI minutes for a
  low-velocity dev-only dep set; config is identical either way).
- **D-02: Automerge = non-major devDeps, after gating.** Patch **and** minor `devDependencies`
  bumps automerge unattended **only after** the release-age window passes **and** CI is green. All
  **major** bumps open a PR for review. The **toolchain majors** — `tsup`, `vite`, `vitest`,
  `@biomejs/biome`, `typescript` (and `happy-dom` as part of the toolchain group) — are **always
  blocked from automerge** regardless (requirement-locked). CI (typecheck + smoke + tests) is the
  safety net for the automerged tier.
- **D-03: Release-age gate = 3 days** (`minimumReleaseAge`). Filters yanked/hotfixed/compromised
  fresh releases; 3 days is sufficient because every dep is a `devDependency` (no runtime blast
  radius) and CI gates every bump. Rejected: 7 days (unnecessary queue stall for this dep profile).
- **D-04: Grouping = toolchain-as-one-PR + weekly lockfile-maintenance.** One grouped PR moves the
  build/test toolchain together (`tsup`, `vite`, `vitest`, `happy-dom`, `@biomejs/biome`,
  `typescript`) — they must stay TS6-compatible in lockstep, so grouping is meaningful. A weekly
  `lockFileMaintenance` PR refreshes `pnpm-lock.yaml`. Other `devDependencies` get individual,
  bisectable PRs. Rejected: one broad "all minor/patch devDeps" group (a red group PR is hard to
  bisect to the offending package).

### GATE-01 — deprecation gate shape & scope
- **D-05: Dedicated, named CI step.** Add an explicit typecheck/deprecation gate step in
  `.github/workflows/ci.yml` (invoking `make typecheck`) as its **own named red check**, separate
  from `make test` — mirrors how `verify-outputs` and `smoke` are already broken out as distinct CI
  steps. The existing `make test` → `typecheck` dependency stays as a local-dev convenience.
- **D-06 — GATE-01 deprecation gate scope.** Scope = `src/` + `tests/` + `plugins/*/src/`, never
  `node_modules/`. Keep the existing
  `tsconfig.typecheck.json` `include` (which already covers `src` + `tests`) as-is — no config
  narrowing**. The load-bearing constraint (STATE.md blocker, research Pitfall 6) is *"never fail on
  `node_modules/` deprecation noise"*, which the tsconfig `include` already guarantees; `tests/` is
  project-owned code and is already deprecation-clean under TS6, so gating it too is strictly more
  coverage for zero added config. Rejected: narrowing the gate to `src/` only and typechecking
  `tests/` in a separate leg (splits the tsconfig Phase 7 just standardized, for no real benefit).

### GATE-02 — zero-runtime-dep assertion
- **D-07: package.json field-check, not a pnpm-tree check.** A Makefile target asserts the invariant
  directly on the **core `@dnzn/dxkit` (root) `package.json`** by reading its dep fields with node's
  own JSON parsing. Fast, offline, deterministic, no resolved-install dependency. Rejected:
  `pnpm list --prod` / `pnpm why` tree check (slower, needs install, brittle output to parse — the
  posture is *defined by* not declaring deps, so assert that directly).
- **D-08 (REVISED 2026-07-18 — scope corrected to core-only): Assert the core package only.** The
  check fails if the root `@dnzn/dxkit` `package.json` declares a non-empty `dependencies`,
  `peerDependencies`, **or** `optionalDependencies`. Root has none today, so the check codifies the
  status quo as an invariant for the *framework* — which is the actual "zero-runtime-dep
  microframework" selling point.
  **Why revised:** the original D-08 premise ("all 5 packages have none of these fields") was
  factually wrong — 4 of 5 plugins already declare intra-monorepo `workspace:*` `dependencies`
  (wallet, auth, theme, settings). A blanket 5-package check would (a) fail the build immediately,
  and (b) box in future plugin work, since **plugins are expected to grow legitimate external runtime
  deps** (e.g. a wallet plugin needing an EIP-1193/crypto lib). The zero-dep posture that is a
  genuine selling point is the **core framework's**, not the optional plugins'. Additionally, the
  original "catch an automated Renovate bump" rationale does not hold for a package.json field check:
  Renovate bumps *versions* of existing deps and does lockfile maintenance — it never adds a new
  entry to the `dependencies` field. GATE-02's real value is executable documentation of the
  core-is-zero-dep claim, scoped where it is load-bearing. Plugins' `package.json` files are **not**
  checked by GATE-02.
  **Downstream impact:** the planner MUST update `.planning/REQUIREMENTS.md` (GATE-02 wording) and the
  Phase 9 ROADMAP success criterion #2 to reflect the core-only scope, so the requirement text no
  longer implies "any package."

### ROB-05 — registry array-shape fix
- **D-09: `Array.isArray()` guard on the parsed 200 body.** After `await res.json()` succeeds in
  `loadManifests()` (`src/shell.ts` ~line 274), validate the parsed value is an array before
  returning it. `Array.isArray()` rejects every wrong shape (object, string, number, `null`,
  boolean) in one check. On failure: **do not** pass the value to `normalizeAndValidateManifests()`
  (whose `for...of` is where the uncaught `TypeError` originates today).
- **D-10: Wrong-shape 200 ALWAYS emits, ungated.** Emit `dx:error` (source `shell:manifest`) for a
  wrong-shape 200 **regardless of `registryUrlExplicit`**, then `return []` so `init()` still
  completes and `window.__DXKIT__` is still exposed. Rationale: a wrong-shape 200 means a registry
  *is present but malformed* — a genuine misconfiguration/bug — which is categorically different
  from the 404/absence case the `registryUrlExplicit` gate (D-15, prior phase) deliberately keeps
  silent. This is the one registry outcome that breaks the silent-absence convention on purpose.
  Element-level manifest validation stays where it already is (`normalizeAndValidateManifests`);
  ROB-05 only guards the **top-level array shape**.

### Claude's Discretion (planning/research fills these in, grounded in prior-phase patterns)
- Exact Makefile target names for the dep-check gate (e.g. `verify-no-runtime-deps` /
  `check-deps`) and the precise CI step ordering — mirror `verify-outputs`/`smoke` wiring intent,
  not an exact string.
- Whether GATE-01/GATE-02 also wire into the `release` / `publish` targets alongside CI (the
  `verify-outputs`/`smoke` precedent suggests yes; confirm during planning).
- Exact `renovate.json` key spelling and preset choices (`config:recommended` base, `packageRules`
  for the toolchain group + automerge tiers, `minimumReleaseAge: "3 days"`, `lockFileMaintenance`,
  `schedule`) — implement D-01..D-04 intent; verify current Renovate config schema at plan time.
- `skipLibCheck` posture for GATE-01: if any TS6 deprecation surfaces from a `node_modules/` `.d.ts`
  via referenced lib types, `skipLibCheck` is the intended escape hatch (keeps the gate on
  project-owned code only) — decide at plan/execute time only if it actually surfaces.
- Exact `dx:error` message wording for D-10 (follow the existing `shell:manifest` message style in
  `loadManifests()`), and whether the array guard lives inline or in a tiny helper.
- Commit granularity: per-concern bisectable commits (one per GATE-01 / GATE-02 / GATE-03 / ROB-05),
  matching Phase 6 D-02 / Phase 7 D-07 / Phase 8 D-06 discipline.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & requirements (authoritative)
- `.planning/REQUIREMENTS.md` — **GATE-01/02/03** + **ROB-05** exact wording + the traceability
  table. Source of truth for what "done" means; also documents why the Biome `@deprecated`-export
  lint gate is **out of scope** (compiler-option deprecations are gated via `tsc` instead).
- `.planning/ROADMAP.md` §"Phase 9: Continuous Debt Guardrails & Registry Robustness" — goal, the 4
  success criteria (verbatim acceptance shape for each requirement), and the depends-on note (Phase
  7 `tsc` step + Phase 8 final CI pipeline).
- `.planning/STATE.md` §Blockers/Concerns — **the load-bearing GATE-01 constraint**: the gate must
  be scoped to `src/`+`plugins/*/src/` only; a gate that also fails on transitive `node_modules/`
  deprecation noise is unfixable-red and gets disabled (research Pitfall 6). Renovate must ship with
  scope rules (no automerge on tool majors) from day one.
- `.planning/PROJECT.md` §Constraints — the **zero-runtime-deps posture** GATE-02 enforces, and the
  browser-first / no-bundler-assumption constraints.

### Prior-phase context (carried decisions — read before planning)
- `.planning/phases/07-typescript-6-migration-standalone-typecheck/07-CONTEXT.md` — the
  `tsconfig.typecheck.json` ×5 shape (`extends` base, `noEmit`, `include: ["src","tests"]`, paths
  mirroring vitest aliases), the `make typecheck` target + `PLUGIN_BUILD_ORDER` per-package loop
  (**GATE-01 attaches to exactly this**), and the "typecheck kept standalone so Phase 9's
  deprecation gate can call `make typecheck` directly" decision.
- `.planning/phases/08-forward-compat-typing/08-CONTEXT.md` — the **final CI pipeline** shape
  (`build → verify-outputs → smoke → test`) that GATE-01/02 slot into, and the `verify-outputs`
  Makefile-loop-over-`PLUGIN_BUILD_ORDER` template that **GATE-02's dep-check follows**.
- `.planning/phases/06-toolchain-audit-modernization/06-CONTEXT.md` — the bisectable-per-concern
  commit discipline and the `verify-outputs` wiring into release/publish/CI.

### Files this phase will touch (confirmed present)
- `src/shell.ts` — `loadManifests()` (~lines 249–290): add the `Array.isArray()` guard + ungated
  `dx:error` emit after `await res.json()` (**ROB-05 / D-09, D-10**). `normalizeAndValidateManifests`
  (~line 311) is the current uncaught-`TypeError` site — read to confirm the failure path.
- `Makefile` — new zero-runtime-dep check target (**GATE-02**), following `verify-outputs` (lines
  ~77–95) and `PLUGIN_BUILD_ORDER` (line 5); update `.PHONY` (line 7); wire into CI (and
  release/publish per discretion).
- `.github/workflows/ci.yml` — add the dedicated GATE-01 typecheck step and the GATE-02 dep-check
  step (current pipeline: `build → verify-outputs → smoke → test` on Node `[22.12.0, 24]`).
- **New:** `renovate.json` (repo root or `.github/`) — **GATE-03** config (D-01..D-04).
- `tsconfig.typecheck.json` (root + ×4 plugin copies) — **read-only reference** for GATE-01: confirm
  `include` stays `src`+`tests` and excludes `node_modules` (D-06); only touch if a `node_modules`
  `.d.ts` deprecation forces `skipLibCheck`.
- **New (tests):** ROB-05 regression test (wrong-shape 200 → `dx:error`, no throw, `init()`
  completes) and GATE-02/GATE-01 guard tests as the planner sees fit — mirror the existing
  guard-test style (e.g. Phase 8's flag-presence guard, `typecheck-config.test.ts`).

No external ADRs/specs beyond the `.planning/` docs above — requirements are fully captured there
and in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`verify-outputs` Makefile target** (`Makefile` ~77–95) — the exact structural template for
  GATE-02: a loop over root + `PLUGIN_BUILD_ORDER` asserting a per-package invariant and `exit 1`
  on violation.
- **`PLUGIN_BUILD_ORDER`** (`Makefile` line 5) — canonical package list reused by `build`,
  `verify-outputs`, `typecheck`, `smoke`; GATE-02's dep-check must reuse it so the list can't drift.
- **`make typecheck`** (`Makefile` ~97–107) — already runs `tsc --noEmit -p tsconfig.typecheck.json`
  per package with `node_modules` excluded by the tsconfig `include`; **GATE-01 is wiring this as a
  named CI step**, not new type-checking machinery.
- **`registryUrlExplicit` gating + `shell:manifest` `dx:error` emits** (`src/shell.ts` ~259–287) —
  the established emit pattern ROB-05 extends; D-10 deliberately breaks the gating *only* for the
  wrong-shape-200 case.

### Established Patterns
- **`make` is the CI contract** — CI runs make targets; GATE-01/02 must be make targets wired into
  `ci.yml` (and, per `verify-outputs`/`smoke` precedent, likely `release`/`publish`).
- **Per-concern bisectable commits** (Phase 6 D-02 / Phase 7 D-07 / Phase 8 D-06) — carry into Phase
  9: GATE-01, GATE-02, GATE-03, ROB-05 are independent and should land as separate commits.
- **Fix/assert at source, no shims, no invented changes** — GATE-02 codifies the *current* zero-dep
  status quo as an invariant (no packages to fix); ROB-05 fixes the real crash path at its source.
- **Zero runtime dependencies / browser-first** — GATE-02 *is* the enforcement of this posture; the
  check itself must add no tooling (pure `make` + node's own JSON reading).

### Integration Points
- `make typecheck` → new named CI step = **GATE-01**.
- New dep-check target → CI (+release/publish) = **GATE-02**, enforcing PROJECT.md's zero-dep posture.
- `renovate.json` → Mend GitHub App (operator-installed) = **GATE-03**; its automerge policy targets
  the *final* Phase-8 CI pipeline (green `build → verify-outputs → smoke → test`).
- `loadManifests()` array guard → `normalizeAndValidateManifests()` no longer receives a non-array =
  **ROB-05**, closing the pre-`window.__DXKIT__` uncaught-`TypeError` init crash.

</code_context>

<specifics>
## Specific Ideas

- **ROB-05 acceptance is behavioral and precise:** a wrong-shape `200` must (a) NOT throw, (b) emit
  `dx:error` with source `shell:manifest`, (c) let `init()` finish and expose `window.__DXKIT__`,
  (d) emit **even on the default silent `/registry.json` probe** (D-10). A regression test should
  assert all four, distinguishing this from the 404/absence path which stays silent.
- **GATE-01 is a *visibility* upgrade, not new checking** — the type/deprecation checking already
  exists (Phase 7); the deliverable is a distinct, named, blocking CI check pointed at the existing
  `make typecheck`, so a regression reads as a deprecation-gate failure, not a generic test failure.
- **GATE-02 codifies the status quo** — all 5 packages currently declare zero runtime deps; the
  check's value is that it goes red the day an automated bump (Renovate) would introduce one.
- **Renovate config is inert until the Mend App is installed** — surface the app-install as an
  explicit operator next-step; don't let "config committed" read as "automation live".

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within the Phase 9 guardrails + registry-robustness boundary.

Already-scoped-elsewhere (not re-opened here): TS7.1 migration (TS7-01) and tsup→tsdown swap
(BUILD-01) remain **v2**; a Biome `@deprecated`-export lint gate is **out of scope this milestone**
(REQUIREMENTS.md — compiler-option deprecations are gated via `tsc` / GATE-01 instead of
reintroducing ESLint).

</deferred>

---

*Phase: 9-Continuous Debt Guardrails & Registry Robustness*
*Context gathered: 2026-07-17*

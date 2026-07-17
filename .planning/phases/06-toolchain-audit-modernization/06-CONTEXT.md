# Phase 6: Toolchain Audit & Modernization - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Get the DxKit dev toolchain onto current, TS6-compatible versions and raise the
Node floor to 22 LTS — establishing the version baseline every later v1.1 phase
depends on. Concretely: bump tsup / vite / vitest / happy-dom / Biome to their
latest stable majors, add an enforced `engines: ">=22"` floor across all five
packages, swap `cz-conventional-changelog` → maintained `cz-git`, and confirm all
three build outputs (ESM / CJS / IIFE) still emit per package.

**Explicitly NOT this phase (belongs to Phases 7–9):**
- The TypeScript 6 compiler bump — TypeScript stays on **5.8.x** here (Phase 7).
- The standalone `tsc --noEmit` typecheck step (TS6-03, Phase 7).
- Forward-compat flags `verbatimModuleSyntax` / `isolatedDeclarations` / `erasableSyntaxOnly` (Phase 8).
- The CI deprecation gate, zero-runtime-dep assertion, Renovate, and WR-01 (Phase 9).

Requirements covered: **TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05** (5 total —
see `.planning/REQUIREMENTS.md`).

</domain>

<decisions>
## Implementation Decisions

### Version bumps (TOOL-03)
- **D-01:** Bump every tool to its **latest stable major** (tsup, vite, vitest,
  happy-dom, Biome). Accept new defaults — Biome formatter/lint-rule changes,
  vitest/vite config-shape changes — and resolve all fallout **inside this phase**.
  Rationale: cleanest baseline for the TS6 (Phase 7) and TS7 (future) jumps; a
  focused modernization pass shouldn't leave half-bumped tooling behind.
- **D-02:** Apply bumps **per-tool, verify each**: one tool per commit
  (bump → `make test` green → commit). Isolates which bump caused any breakage and
  keeps a bisectable history. **Biome's reformat/lint churn lands in its own commit**,
  separate from the version bump itself where practical.
- **D-03:** Keep **caret (`^`) ranges** for devDependencies (do not switch to exact
  pins). `pnpm-lock.yaml` already pins exact resolved versions, and Renovate (Phase 9)
  will own major upgrades. Matches today's convention; lowest churn.
- **D-04:** **TypeScript stays at 5.8.x this phase.** The bumped tool versions must be
  chosen as TS6-*compatible* (won't block the Phase 7 compiler bump), but the compiler
  itself is not touched here.

### Node floor (TOOL-01, TOOL-02)
- **D-05:** Add `engines: { "node": ">=22" }` to **all five** `package.json` files
  (core + auth + wallet + theme + settings).
- **D-06:** Enforce the floor via **`engine-strict`** (new root `.npmrc` with
  `engine-strict=true`) **plus documentation of the expected install failure** on
  Node 18/20. **No dedicated CI negative-install job.** Criterion 1's "proven by a
  negative install test" is interpreted as *engine-strict config + documented expected
  failure* — the planner should scope verification to that (a manual/documented check),
  not build a fails-if-it-succeeds CI job. (A CI negative job was considered and
  deferred — see Deferred Ideas.)
- **D-07:** CI matrix moves from `node-version: [20]` → **`[22, 24]`** (floor +
  current stable). Testing on 24 catches forward-compat breakage early, aligning with
  the milestone's de-risk-the-future-jump thesis. Keep the existing `make build` +
  `make test` steps (no new CI steps this phase — typecheck/lint gates arrive in
  Phases 7/9).

### cz-git swap (TOOL-04)
- **D-08:** Swap the commitizen adapter to **`cz-git` at 1:1 parity** — point
  `config.commitizen.path` (root `package.json`) at `cz-git`, keep the standard
  conventional-commit type list, **no scope enforcement**, no custom prompts. Verify
  the commitizen flow still emits conventional commits. `commit-and-tag-version`
  (versioning/changelog) is a separate tool and is **untouched**. Richer cz-git config
  (monorepo scopes, breaking-change prompts, aliases) is deferred — see Deferred Ideas.

### Build-output verification (TOOL-05)
- **D-09:** After the bumps, confirm all three outputs are **present** per package
  (`dist/index.js`, `dist/index.cjs`, `dist/index.global.js`). This phase only needs
  file-existence/emit confirmation — the deeper artifact *smoke test* (IIFE global
  attach + CJS `require()` interop) is FCT-04 in Phase 8, do not build it here.

### Breaking change
- **D-10:** Raising the Node floor to ≥22 (drops Node 18/20) is a **breaking change**.
  It must carry a `BREAKING CHANGE:` footer + migration note (contributors/consumers
  must be on Node 22 LTS). Plugin lockstep versioning applies — all packages move together.

### Claude's Discretion
- Exact target versions of each tool (pick latest stable at implementation time).
- Wording/placement of the Node-floor migration note and the documented expected-failure steps.
- Whether Biome's reformat is a distinct commit from its version bump vs. combined
  (D-02 prefers separate "where practical").

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & requirements (authoritative)
- `.planning/REQUIREMENTS.md` — TOOL-01..05 exact wording, acceptance framing, and v2 out-of-scope (TS7, tsdown). This is the source of truth for what "done" means.
- `.planning/ROADMAP.md` §"Phase 6: Toolchain Audit & Modernization" (lines ~63–77) — goal, 5 success criteria, dependency framing, breaking-change note.
- `.planning/PROJECT.md` §"Current Milestone: v1.1" + §Constraints + §Key Decisions — locked decisions (Node 22 not 20, cz-git, zero-runtime-deps, IIFE-first), and why TS6 is deferred to Phase 7.

### Codebase baseline
- `.planning/codebase/STACK.md` — current tool versions (tsup 8.4, vite 7.3.6, vitest 4.1.9, happy-dom 20.10.6, Biome 2.5.1, TS 5.8.3, pnpm 10.32.1) — the "from" side of every bump.
- `.planning/codebase/CONVENTIONS.md` — Biome config (2-space, 120-col, single quotes, trailing commas) — the reformat baseline a Biome major must be diffed against.

### Files this phase will touch (confirmed present)
- `package.json` (root) — `engines`, devDeps, `config.commitizen.path`, scripts.
- `plugins/{auth,wallet,theme,settings}/package.json` — `engines` (lockstep).
- `.github/workflows/ci.yml` — matrix `[20]` → `[22, 24]`.
- `.versionrc.json` — bumpFiles list (verify still correct after edits; unchanged expected).
- `.npmrc` (root) — **does not exist yet**; create it for `engine-strict=true`.
- `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` — audit for config-shape changes forced by tool majors.

No external ADRs/specs beyond the `.planning/` docs above — requirements are fully captured there and in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.versionrc.json`** already lists all five package.json bumpFiles for lockstep
  versioning — no change needed for the version model; just verify it survives edits.
- **Single CI workflow** (`.github/workflows/ci.yml`) — minimal (checkout → pnpm →
  setup-node → install → `make build` → `make test`); the only file to edit for the matrix.
- **`config.commitizen` block** lives in root `package.json` (not a separate `.czrc`) —
  the cz-git swap is a one-line path change there (plus adding/removing the devDep).

### Established Patterns
- **Zero runtime dependencies** — everything is a devDependency; cz-git and all bumped
  tools stay in `devDependencies`. Do not introduce any runtime dep (posture is a selling point).
- **Plugin lockstep versioning** — all packages release at one version; `engines` must be
  added to all five together.
- **`make` is the entrypoint** — `make build` / `make test` (test includes lint) are what
  CI runs; keep those the contract, adjust the Makefile only if a tool major renames a command.
- **pnpm workspace** (`pnpm-workspace.yaml`: `.` + `plugins/*`) with a committed
  `pnpm-lock.yaml` — bumps must update the lockfile; CI uses `--frozen-lockfile`.

### Integration Points
- `.npmrc` (to be created) is the enforcement point for `engine-strict`; interacts with
  pnpm install on every environment including CI.
- CI matrix values feed `actions/setup-node`; the `cache: pnpm` option must keep working
  across both Node 22 and 24 legs.

</code_context>

<specifics>
## Specific Ideas

- Observed drift to flag for the planner: `.planning/codebase/STACK.md` and PROJECT.md say
  0.2.0, but the working tree `package.json` is already at **0.2.1** — confirm the real
  current version before any release-tooling assumptions.
- Biome is the highest-fallout bump (can reformat the whole tree and add lint rules); D-02
  isolates it deliberately. Expect the Biome commit to be the largest diff of the phase.

</specifics>

<deferred>
## Deferred Ideas

- **CI negative-install job** (a fails-if-it-succeeds `pnpm install` on Node 20) — considered
  for the Node-floor proof; deferred in favor of engine-strict + documentation (D-06). Could be
  added later if continuous machine-proof of the floor becomes desirable.
- **Exact version pinning** of devDeps (drop caret) — deferred; Renovate (Phase 9) will manage
  majors and the lockfile already pins resolved versions (D-03).
- **Richer cz-git config** — monorepo scope list (core/wallet/auth/theme/settings/build/ci/deps),
  custom type descriptions, breaking-change/issue prompts, alias commands. Deferred to keep the
  swap 1:1 (D-08); a candidate DX improvement for a later pass.
- **Node 26 in the CI matrix** — not actionable until Node 26 exists; revisit when it ships.

None of the above are in Phase 6 scope — discussion stayed within the toolchain-modernization boundary.

</deferred>

---

*Phase: 6-Toolchain Audit & Modernization*
*Context gathered: 2026-07-15*

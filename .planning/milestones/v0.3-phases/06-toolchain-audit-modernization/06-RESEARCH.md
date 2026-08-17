# Phase 6: Toolchain Audit & Modernization - Research

**Researched:** 2026-07-15
**Domain:** Dev-toolchain version modernization (build/test/lint/commit tooling), Node engine floor enforcement, CI matrix
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Bump every tool to its **latest stable major** (tsup, vite, vitest, happy-dom, Biome). Accept new defaults — Biome formatter/lint-rule changes, vitest/vite config-shape changes — and resolve all fallout **inside this phase**. Rationale: cleanest baseline for the TS6 (Phase 7) and TS7 (future) jumps; a focused modernization pass shouldn't leave half-bumped tooling behind.
- **D-02:** Apply bumps **per-tool, verify each**: one tool per commit (bump → `make test` green → commit). Isolates which bump caused any breakage and keeps a bisectable history. **Biome's reformat/lint churn lands in its own commit**, separate from the version bump itself where practical.
- **D-03:** Keep **caret (`^`) ranges** for devDependencies (do not switch to exact pins). `pnpm-lock.yaml` already pins exact resolved versions, and Renovate (Phase 9) will own major upgrades. Matches today's convention; lowest churn.
- **D-04:** **TypeScript stays at 5.8.x this phase.** The bumped tool versions must be chosen as TS6-*compatible* (won't block the Phase 7 compiler bump), but the compiler itself is not touched here.
- **D-05:** Add `engines: { "node": ">=22" }` to **all five** `package.json` files (core + auth + wallet + theme + settings).
- **D-06:** Enforce the floor via **`engine-strict`** (new root `.npmrc` with `engine-strict=true`) **plus documentation of the expected install failure** on Node 18/20. **No dedicated CI negative-install job.** Criterion 1's "proven by a negative install test" is interpreted as *engine-strict config + documented expected failure* — the planner should scope verification to that (a manual/documented check), not build a fails-if-it-succeeds CI job. (A CI negative job was considered and deferred — see Deferred Ideas.)
- **D-07:** CI matrix moves from `node-version: [20]` → **`[22, 24]`** (floor + current stable). Testing on 24 catches forward-compat breakage early, aligning with the milestone's de-risk-the-future-jump thesis. Keep the existing `make build` + `make test` steps (no new CI steps this phase — typecheck/lint gates arrive in Phases 7/9).
- **D-08:** Swap the commitizen adapter to **`cz-git` at 1:1 parity** — point `config.commitizen.path` (root `package.json`) at `cz-git`, keep the standard conventional-commit type list, **no scope enforcement**, no custom prompts. Verify the commitizen flow still emits conventional commits. `commit-and-tag-version` (versioning/changelog) is a separate tool and is **untouched**. Richer cz-git config (monorepo scopes, breaking-change prompts, aliases) is deferred — see Deferred Ideas.
- **D-09:** After the bumps, confirm all three outputs are **present** per package (`dist/index.js`, `dist/index.cjs`, `dist/index.global.js`). This phase only needs file-existence/emit confirmation — the deeper artifact *smoke test* (IIFE global attach + CJS `require()` interop) is FCT-04 in Phase 8, do not build it here.
- **D-10:** Raising the Node floor to ≥22 (drops Node 18/20) is a **breaking change**. It must carry a `BREAKING CHANGE:` footer + migration note (contributors/consumers must be on Node 22 LTS). Plugin lockstep versioning applies — all packages move together.

### Claude's Discretion

- Exact target versions of each tool (pick latest stable at implementation time).
- Wording/placement of the Node-floor migration note and the documented expected-failure steps.
- Whether Biome's reformat is a distinct commit from its version bump vs. combined (D-02 prefers separate "where practical").

### Deferred Ideas (OUT OF SCOPE)

- **CI negative-install job** (a fails-if-it-succeeds `pnpm install` on Node 20) — considered for the Node-floor proof; deferred in favor of engine-strict + documentation (D-06). Could be added later if continuous machine-proof of the floor becomes desirable.
- **Exact version pinning** of devDeps (drop caret) — deferred; Renovate (Phase 9) will manage majors and the lockfile already pins resolved versions (D-03).
- **Richer cz-git config** — monorepo scope list (core/wallet/auth/theme/settings/build/ci/deps), custom type descriptions, breaking-change/issue prompts, alias commands. Deferred to keep the swap 1:1 (D-08); a candidate DX improvement for a later pass.
- **Node 26 in the CI matrix** — not actionable until Node 26 exists as an LTS line; revisit when it ships (research confirms Node 26 is Current/non-LTS until Oct 2026 as of this session — not yet a floor/matrix candidate).

None of the above are in Phase 6 scope — discussion stayed within the toolchain-modernization boundary.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|--------------------|
| TOOL-01 | `engines` in every package.json requires Node ≥22 (Node 22 LTS floor); a wrong-Node install fails fast (engine-strict) | Pattern 2 confirms `engines` alone is advisory in pnpm and `.npmrc engine-strict=true` is the load-bearing mechanism (Pitfall 1); exact `engines` diff shape given in Code Examples; Vite 8's narrower `^20.19.0 \|\| >=22.12.0` sub-range flagged as Pitfall 2 for the migration note |
| TOOL-02 | CI runs on Node 22 and no longer tests EOL Node 18/20 | Node 22 (Maintenance LTS, EOL 2027-04) / Node 24 (Active LTS, EOL 2028-04) status confirmed current; CI matrix diff given in Code Examples; existing `pnpm/action-setup` → `setup-node` ordering already correct (Pitfall 6) |
| TOOL-03 | Build/test/lint tooling (tsup, vite, vitest, happy-dom, Biome) bumped to current TS6-compatible versions with the full test suite green | Standard Stack table gives verified target versions for all 5 tools plus the TS6-compatibility peer-range check; Pitfall 3 corrects the Biome-fallout assumption; Pitfall 4 confirms zero config-shape edits needed in `vitest.config.ts` despite the Vite major bump |
| TOOL-04 | `cz-conventional-changelog` replaced by maintained `cz-git`; the commitizen flow still emits conventional commits | Pattern 3 gives the exact `config.commitizen.path` swap; Package Legitimacy Audit clears `cz-git` (`OK` verdict); Pitfall 5 covers the swap's failure mode and verification step |
| TOOL-05 | All three build outputs (ESM / CJS / IIFE) are still produced per package and verified after the toolchain bumps | Validation Architecture identifies this as a Wave 0 gap (no existing check) and specifies the exact `test -f` command shape to add per package |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Conventional commits required** — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:` (scope optional); use `!` suffix + a `BREAKING CHANGE:` footer for breaking changes. Directly applies to every per-tool bump commit in this phase (use `chore(deps): ...`) and is mandatory for the Node-floor change (D-10 breaking change → needs `feat!:`/`chore!:` + `BREAKING CHANGE:` footer + migration note).
- **Subject line under 72 characters; body explains "why"/shape of change**, not a diff recap — applies to all bump commits, especially the Vite major-bump commit where the "why" (Rolldown default, no config-shape hit in this repo) is worth a line.
- **Reference updated docs in commit body** (`See: docs/<file> (lines x-y)`) if docs changed to reflect the commit — relevant if `docs/development.md` (Node 18+ / CI Node 20 lines, confirmed stale this session) is touched in this phase or left for the ship-gate docs pass.
- **Co-author line required** on every commit — `Co-Authored-By: <model> <noreply@anthropic.com>`.
- **In-line commentary: comment the "why", not the "what"; one line preferred** — applies if any config file (e.g. `.npmrc`, `vitest.config.ts` if ever touched) needs an explanatory comment for a non-obvious choice (e.g. why `engine-strict` exists).
- **Zero runtime dependencies** (from `.claude/CLAUDE.md` constraints) — every package added/bumped this phase (`cz-git` included) must land in `devDependencies` only; already satisfied by this research's recommendations (see Standard Stack).
- **GSD workflow enforcement** — file-changing work for this phase must go through `/gsd-execute-phase` (or an equivalent GSD entry point), not ad hoc edits — a planning-process constraint for whoever executes this phase's plan, not a technical one, but worth the planner's awareness.
- **Documentation Ship Gate** — `/gsd-docs-update` must pass before `/gsd-ship`, and the docs-pass marker requires `verified_against` to be at or after the last source commit. Since this phase touches `docs/development.md`-relevant facts (Node floor, CI matrix, tool versions) even though it isn't a docs phase, the planner should be aware the eventual ship of this phase's branch will need a docs pass reflecting the new Node 22 floor and tool versions — not a Phase 6 task per se, but a downstream gate this phase's changes feed into.

## Summary

This phase is a controlled, verifiable version-bump exercise, not an architecture change. Every
target package was resolved directly against the npm registry `[VERIFIED: npm registry]` on
2026-07-15, and the actual fallout is smaller than CONTEXT.md's working assumption in two of five
cases: **happy-dom is already at the latest published version (20.10.6 → 20.10.6, no change)**, and
**Biome's latest stable is still major `2.x` (2.5.1 → 2.5.4, a patch/minor bump)** — not the major
migration D-01's framing anticipated. The one real major-version jump is **Vite 7.3.6 → 8.1.4**,
which replaces Vite's Rollup-based bundler internals with Rolldown (Rust-based) by default; the
config-shape fallout from that (`build.rollupOptions` → `build.rolldownOptions`, CJS interop,
Lightning CSS default) does **not** touch this repo's `vitest.config.ts`, which only sets
`test` and `resolve.alias` — no `build` key exists to rename. Vitest itself stays on major 4
(4.1.9 → 4.1.10) and its 4.1.x peer range already accepts `vite@^6 || ^7 || ^8`, so the vitest+vite
pairing is compatible out of the box. tsup gets a routine patch bump (8.4.0 → 8.5.1) with a
`typescript: ">=4.5.0"` peer range that imposes no TS6 ceiling. `cz-git` is a genuinely new
dependency; it passed the package-legitimacy gate (`OK`, 2-year-old repo, 64k weekly downloads, no
postinstall script) and its config swap is a one-line `config.commitizen.path` change with no new
required commitizen version.

The Node-floor mechanics need care: pnpm's `engines.node` field is **advisory-only** for the root
project unless `.npmrc` sets `engine-strict=true` — without it, `engines: ">=22"` alone would NOT
block a Node 18/20 install, it would only warn `[CITED: pnpm.io/package_json]`. This makes D-06's
`.npmrc` creation load-bearing, not cosmetic. Separately, Vite 8's own `engines.node` requirement is
`^20.19.0 || >=22.12.0` `[VERIFIED: npm registry]` — narrower than the project's own `>=22` floor —
so a contributor on Node 22.0–22.11 would pass DxKit's engine-strict gate but still fail inside Vite
8 itself; this is worth a one-line callout in the Node-floor migration note.

**Primary recommendation:** Bump tsup/vitest/happy-dom/Biome as routine same-major updates (low
risk, verify via `make test` per D-02); treat Vite 7→8 as the phase's one real major-version risk
and verify it in isolation even though it has no config-shape hit in this repo; add `.npmrc`
`engine-strict=true` as the actual enforcement mechanism behind `engines: ">=22"`; swap `cz-git` in
with a single `config.commitizen.path` line and no dependency-version coupling to `commitizen`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Node version enforcement | Package manager (pnpm + `.npmrc`) | `package.json` `engines` (all 5) | `engines` alone is advisory; `engine-strict` in pnpm config is what actually fails the install |
| ESM/CJS/IIFE build emit | Build tooling (tsup) | — | tsup owns all three output formats per package; unaffected by the Vite bump (tsup uses esbuild, not Vite) |
| Test execution + DOM shim | Test tooling (vitest + happy-dom) | Dev-server/module resolution (Vite) | vitest embeds Vite for transform/resolution; happy-dom is the DOM environment, decoupled from Vite's bundler internals |
| Lint/format | Lint tooling (Biome) | — | Standalone Rust binary, no peer coupling to TS or Vite versions |
| Commit message authoring | Developer CLI (commitizen + cz-git adapter) | `package.json` `config.commitizen.path` | commitizen is the CLI driver; cz-git is a swappable adapter it loads by path — no version coupling between the two |
| Version/changelog bump | Release tooling (commit-and-tag-version) | `.versionrc.json` (bumpFiles) | Explicitly untouched this phase (D-08) — verify it still resolves all 5 `bumpFiles` after edits |
| CI enforcement | CI/CD (GitHub Actions + `actions/setup-node`) | `.github/workflows/ci.yml` matrix | Only file requiring a matrix edit `[20]` → `[22, 24]`; `make build` + `make test` steps stay as-is |

## Standard Stack

### Core (version bumps in scope)

| Library | From (STACK.md) | To (verified latest) | Purpose | Bump Type |
|---------|------------------|----------------------|---------|-----------|
| tsup | 8.4.0 | **8.5.1** `[VERIFIED: npm registry]` | ESM/CJS/IIFE bundler | Patch/minor within major 8 — low risk |
| vite | 7.3.6 | **8.1.4** `[VERIFIED: npm registry]` | vitest's embedded dev-server/transform layer | **Major (7→8)** — Rolldown-based internals; the phase's real risk item |
| vitest | 4.1.9 | **4.1.10** `[VERIFIED: npm registry]` | Test runner | Patch within major 4 — vitest 5 exists only as `beta` dist-tag, do not use |
| happy-dom | 20.10.6 | **20.10.6** `[VERIFIED: npm registry]` | DOM shim for vitest environment | **No change** — already the latest published version |
| @biomejs/biome | 2.5.1 | **2.5.4** `[VERIFIED: npm registry]` | Lint + format | Patch within major 2 — latest stable major is still `2.x`, no `3.x` published |
| cz-git | *(new)* | **1.13.1** `[VERIFIED: npm registry]` | commitizen adapter (replaces `cz-conventional-changelog`) | New devDependency |

**Everything above stays a devDependency** — no runtime-dependency posture change (D-01/zero-dep constraint honored).

### Verified TS6-compatibility (forward-looking, TS itself stays 5.8.x this phase)

| Tool | TS-version peer constraint | TS6 blocker? |
|------|----------------------------|---------------|
| tsup 8.5.1 | `typescript: ">=4.5.0"` `[VERIFIED: npm registry]` | No upper bound — compatible |
| vite 8.1.4 | No direct `typescript` peer dependency `[VERIFIED: npm registry]` | Not applicable |
| vitest 4.1.10 | No direct `typescript` peer dependency; `@types/node: "^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0"` `[VERIFIED: npm registry]` | Not applicable |
| Biome 2.5.4 | Standalone Rust binary, no TS peer at all `[VERIFIED: npm registry]` | Not applicable |
| happy-dom 20.10.6 | No `typescript` peer | Not applicable |
| cz-git 1.13.1 | `dependencies: none`, Node `>=v12.20.0` only `[VERIFIED: npm registry]` | Not applicable |

None of the six tools impose a TypeScript ceiling that would block the Phase 7 TS6 bump — the
choice of "latest stable" for each is safe on that axis. This claim is `[VERIFIED: npm registry]`
for the peer-dependency data itself; whether each tool's *actual runtime behavior* under TS6 is
bug-free is necessarily untested until Phase 7 runs `tsc` against it — flag as an Open Question.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cz-git | Keep `cz-conventional-changelog` | Rejected by CONTEXT.md D-08 — ~6 years unmaintained, TOOL-04 explicitly requires the swap |
| Vite 8 (Rolldown) | Pin Vite at 7.x, defer the major | Contradicts D-01 (bump every tool to latest stable major this phase); would leave a stale peer for vitest's next major |
| `pnpm install` engine gate | GitHub Actions negative-install CI job | Explicitly deferred by D-06 — engine-strict + documentation is the interpretation of Criterion 1 this phase, not a CI job |

**Installation (indicative — actual commands run per-tool per D-02):**
```bash
pnpm add -D tsup@^8.5.1 -w
pnpm add -D vite@^8.1.4 -w
pnpm add -D vitest@^4.1.10 -w
pnpm add -D @biomejs/biome@^2.5.4 -w
pnpm remove cz-conventional-changelog -w && pnpm add -D cz-git@^1.13.1 -w
# happy-dom: no version change required — skip unless D-02 wants a no-op verification commit
```

**Version verification (already performed this session):** All six version numbers above were
confirmed via `npm view <pkg> version` / `npm view <pkg> dist-tags --json` against the live npm
registry on 2026-07-15 — see the raw dist-tags data in Sources.

## Package Legitimacy Audit

| Package | Registry | Latest-version publish date | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|------------------------------|-------------------|--------------|---------|-------------|
| tsup | npm | 2025-11-12 | 6,398,318 | github.com/egoist/tsup | OK | Approved |
| vite | npm | 2026-07-09 | 117,419,398 | github.com/vitejs/vite | SUS (`too-new`) | **Approved — override, see note** |
| vitest | npm | 2026-07-06 | 72,143,771 | github.com/vitest-dev/vitest | SUS (`too-new`) | **Approved — override, see note** |
| happy-dom | npm | 2026-06-17 | 10,756,296 | github.com/capricorn86/happy-dom | SUS (`too-new`) | **Approved — override, see note** |
| @biomejs/biome | npm | 2026-07-15 | 8,267,620 | github.com/biomejs/biome | SUS (`too-new`) | **Approved — override, see note** |
| cz-git | npm | 2026-05-09 | 63,934 | github.com/Zhengqbbb/cz-git | OK | Approved |

**Override note on the four `SUS` verdicts:** the `too-new` signal fires on the *publish date of the
specific latest version string*, not on package age — all four packages are multi-year-established,
official, extremely high-download infrastructure tooling (vite alone: 117M weekly downloads) with no
`postinstall` script and a canonical GitHub repo. This is the expected shape for actively-maintained
tools that ship frequent point releases; treating a same-week patch release as suspicious would flag
nearly every routine devDependency bump. **No `checkpoint:human-verify` task is required for these
four** — D-02's existing per-tool `bump → make test → commit` discipline already provides an
equivalent verification gate (a failing `make test` blocks the commit).

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** vite, vitest, happy-dom, @biomejs/biome — all overridden per the note above (established, high-download, no postinstall, `too-new` is a version-recency false positive, not a package-age concern).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Developer machine / CI runner (Node ≥22, enforced by .npmrc)         │
│                                                                       │
│  pnpm install --frozen-lockfile (CI) / pnpm install (local)          │
│         │                                                            │
│         ├─ engine-strict=true (.npmrc) ──► FAILS FAST on Node <22    │
│         │                                                            │
│         ▼                                                            │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐          │
│  │ make build    │   │ make test     │   │ make commit   │          │
│  │ (tsup 8.5.1)  │   │ (lint: Biome  │   │ (commitizen   │          │
│  │               │   │  2.5.4  →     │   │  4.3.2 loads  │          │
│  │ per package:  │   │  vitest 4.1.10│   │  cz-git 1.13.1│          │
│  │ ESM + CJS +   │   │  → vite 8.1.4 │   │  via          │          │
│  │ IIFE emit     │   │  embedded +   │   │  config.commit│          │
│  │               │   │  happy-dom    │   │  izen.path)   │          │
│  │               │   │  20.10.6 DOM) │   │               │          │
│  └───────┬───────┘   └───────┬───────┘   └───────────────┘          │
│          │                   │                                      │
│          ▼                   ▼                                      │
│   dist/index.js        321 vitest specs                             │
│   dist/index.cjs        (all packages)                              │
│   dist/index.global.js                                              │
│   (per package × 5)                                                 │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
   .github/workflows/ci.yml matrix [22, 24]
   (actions/setup-node + cache: pnpm, per leg)
```

### Recommended Project Structure

No structural changes — this phase edits existing files only:
```
.npmrc                          # NEW — engine-strict=true
package.json                    # engines + devDeps + config.commitizen.path
plugins/{auth,wallet,theme,settings}/package.json   # engines only (lockstep, D-05)
.github/workflows/ci.yml        # matrix [20] -> [22, 24]
pnpm-lock.yaml                  # regenerated by each `pnpm add`/`pnpm remove`
```

### Pattern 1: Per-tool isolated bump commit (D-02)
**What:** Bump one devDependency (or the cz-git swap) → run `make test` → commit before touching the next tool.
**When to use:** Every tool in this phase's scope, including the Biome reformat as its own commit where practical.
**Example sequence:**
```bash
# 1. tsup
pnpm add -D tsup@^8.5.1 -w && make build && make test && git commit -m "chore(deps): bump tsup to 8.5.1"

# 2. vite (verify in isolation — the one real major-version risk)
pnpm add -D vite@^8.1.4 -w && make test && git commit -m "chore(deps): bump vite to 8.1.4"

# 3. vitest
pnpm add -D vitest@^4.1.10 -w && make test && git commit -m "chore(deps): bump vitest to 4.1.10"

# 4. Biome — version bump commit, then a SEPARATE reformat commit if `biome check --write .` changes files
pnpm add -D @biomejs/biome@^2.5.4 -w && make lint && git commit -m "chore(deps): bump biome to 2.5.4"
npx biome check --write . && git commit -m "style: apply biome 2.5.4 formatting" # only if diff is non-empty

# 5. cz-git swap
pnpm remove cz-conventional-changelog -w
pnpm add -D cz-git@^1.13.1 -w
# edit package.json: config.commitizen.path -> "node_modules/cz-git"
npx cz  # manually verify prompt flow still emits a conventional-commit message
git commit -m "chore(deps): replace cz-conventional-changelog with cz-git"
```

### Pattern 2: engine-strict as the actual Node-floor enforcement mechanism
**What:** `engines: {"node": ">=22"}` in `package.json` is advisory-only for the root project by
default. `.npmrc` `engine-strict=true` is what converts the advisory into a hard install failure.
**When to use:** This phase's D-05/D-06 pairing — both files are required together, neither alone
proves the floor.
**Example:**
```ini
# .npmrc (new file, root)
engine-strict=true
```
```json
// package.json (root + all 4 plugins)
{
  "engines": { "node": ">=22" }
}
```
**Documented expected failure (per D-06, manual/documented check, not a CI job):**
```bash
# On a machine with Node 18 or 20 active (e.g. via nvm/fnm):
$ nvm use 20
$ pnpm install
 ERR_PNPM_UNSUPPORTED_ENGINE  Unsupported environment (bad pnpm and/or Node.js version)
Expected version: >=22
Got: 20.x.x
```
Source: `[CITED: pnpm.io/package_json]` — pnpm's own docs state `engines.node` "is advisory only and
will only produce warnings" unless `engineStrict` is set; the error shape above (`ERR_PNPM_UNSUPPORTED_ENGINE`)
matches pnpm's documented engine-check failure family. Exact wording should be captured verbatim when
the planner/executor runs this check for real, since the docs fetch did not return the literal string.

### Pattern 3: cz-git drop-in config swap
**What:** Point `config.commitizen.path` at `cz-git` instead of `cz-conventional-changelog`; no other
package.json changes needed for 1:1 parity.
**When to use:** TOOL-04, per D-08 (no scope enforcement, no custom prompts).
**Example:**
```json
{
  "config": {
    "commitizen": {
      "path": "node_modules/cz-git"
    }
  }
}
```
Source: `[CITED: cz-git.qbb.sh/guide]`. cz-git ships sensible Angular-style conventional-commit
defaults (type list: feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert) out of the box
when no further config block is added — this already matches CLAUDE.md's required commit type set
(`feat`, `fix`, `refactor`, `docs`, `test`, `chore`) with `cz-git`'s defaults being a superset, so no
custom `types` array is needed for 1:1 parity. `commitizen` itself declares `cz-conventional-changelog`
as one of *its own* transitive dependencies `[VERIFIED: npm registry]` (bundled fallback) — removing
it from this project's `devDependencies` does not break `commitizen`'s own internals, it only stops
it from being the *active* adapter.

### Anti-Patterns to Avoid
- **Installing `rolldown-vite` as an interim package:** Some Vite 8 migration guides describe an
  optional pre-migration step (`npm i vite@npm:rolldown-vite` on Vite 7) for teams doing a gradual
  Rolldown opt-in. **Not needed here** — jumping straight from 7.3.6 to the final 8.1.4 release
  already has Rolldown as the default bundler; installing the alias package would be redundant.
- **Pinning `engines` differently per package:** D-05 requires the exact same `>=22` string across
  all 5 `package.json` files (lockstep). Don't let plugin `engines` drift from core's.
- **Skipping the Biome reformat verification:** A `biome check --write .` after the version bump can
  silently reformat files even when the changelog shows "no schema-breaking changes" — always run it
  and diff, even though 2.5.1→2.5.4 introduced no new default-enabled rules `[CITED: biomejs.dev/internals/changelog]`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Node-version gating at install time | A custom preinstall script checking `process.version` | `engines` + `.npmrc engine-strict=true` | pnpm has first-class, well-tested support for this; a custom script duplicates it with worse error messages |
| Conventional-commit prompt UI | A custom inquirer-based commit script | `cz-git` (already chosen, D-08) | Purpose-built, maintained, integrates with existing `commitizen` CLI via the adapter path convention |
| Build-output existence check | A hand-rolled recursive file walker | `test -f dist/index.js && test -f dist/index.cjs && test -f dist/index.global.js` per package, or a short Makefile/shell loop | D-09 scope is file-existence only — a one-line `test -f` chain per package is sufficient; do not build a smoke-test harness here (that's FCT-04, Phase 8) |

**Key insight:** Every "don't hand-roll" surface in this phase already has a locked decision pointing
at the standard tool (pnpm engines, cz-git, simple existence checks) — the risk in this phase is
scope creep into Phase 7/8 territory (typecheck, artifact smoke tests), not under-tooling.

## Common Pitfalls

### Pitfall 1: `engines: ">=22"` alone does not block old-Node installs
**What goes wrong:** Team adds `engines` to all 5 `package.json` files, sees `pnpm install` still
succeed on Node 20, concludes the floor "isn't working."
**Why it happens:** pnpm treats `engines.node` on the root project as advisory (warning-only) unless
`engine-strict=true` is set in `.npmrc` `[CITED: pnpm.io/package_json]`.
**How to avoid:** Create `.npmrc` with `engine-strict=true` in the same commit/PR as the `engines`
field additions — treat them as one unit, not two independent changes.
**Warning signs:** `pnpm install` exits 0 on an old Node version after only adding `engines`.

### Pitfall 2: Vite 8's own Node floor is narrower than DxKit's
**What goes wrong:** A contributor's Node 22.0–22.11 install passes DxKit's `engines: ">=22"` +
engine-strict gate, then `make test` fails inside vitest with a Vite-level Node-version error.
**Why it happens:** Vite 8.1.4 requires `node: "^20.19.0 || >=22.12.0"` `[VERIFIED: npm registry]` —
a stricter sub-range within the "22" major than DxKit's own floor.
**How to avoid:** Document "Node 22.12+ (or Node 24)" in the migration note / `docs/development.md`
prerequisites line, not just "Node 22", to avoid a confusing two-stage failure.
**Warning signs:** `pnpm install` succeeds but `vitest`/`vite`-backed commands fail with an engine or
resolution error specifically on Node 22.0–22.11.

### Pitfall 3: Assuming Biome 2.5.1→2.5.4 is the "big" bump CONTEXT.md flagged
**What goes wrong:** Planner allocates outsized effort/time to the Biome bump expecting a major
schema migration (`biome migrate`, new default-on rules across the tree) because CONTEXT.md called
Biome "the highest-fallout bump."
**Why it happens:** That framing was written before verifying the actual latest-stable version —
Biome's latest published major is still `2.x`; there is no `3.x` on the `latest` dist-tag as of
2026-07-15 `[VERIFIED: npm registry]`.
**How to avoid:** Scope the Biome task as a routine patch/minor bump (3 patch versions: 2.5.2, 2.5.3,
2.5.4) with a small, targeted formatter diff (curried `test.each`-style calls, CSS selector-before-
comment spacing) rather than a full-tree reformat migration.
**Warning signs:** If `biome check --write .` produces a near-total-file-diff, something else is
wrong (e.g. a config change), since the actual 2.5.1→2.5.4 diff is narrow `[CITED: biomejs.dev/internals/changelog]`.

### Pitfall 4: Vite 8's config-shape rename doesn't apply here — don't "fix" it anyway
**What goes wrong:** Planner or executor, following generic Vite 8 migration guides, edits
`vitest.config.ts` to rename a nonexistent `build.rollupOptions` key, or adds `build.cssMinify`
settings that don't apply to a test-only Vite config.
**Why it happens:** Every Vite 8 migration guide leads with `build.rollupOptions` →
`build.rolldownOptions`, `commonjsOptions` no-op, and Lightning CSS defaults — all real for apps that
*build* with Vite. This repo's only Vite consumer is `vitest.config.ts`, which sets only `test` and
`resolve.alias` — no `build` key exists.
**How to avoid:** Confirm via `grep -n "rollupOptions\|build\.\|cssMinify\|commonjsOptions" vitest.config.ts`
returns nothing before/after the bump — expected result is a clean bump with zero config edits.
**Warning signs:** Any edit to `vitest.config.ts` motivated by "the Vite migration guide said to" that
isn't traceable to an actual current key in that file.

### Pitfall 5: `cz-git` swap breaking `make commit` silently
**What goes wrong:** `config.commitizen.path` is updated but `cz-conventional-changelog` removal
leaves a stale `node_modules` cache, or the path string points at the package name instead of the
`node_modules/` resolved path, and `npx cz` throws a module-not-found error that isn't caught until
someone tries to commit.
**Why it happens:** commitizen resolves `config.commitizen.path` relative to the project root at
runtime — a `pnpm install` is required after both the `remove` and the `add` for the path to resolve.
**How to avoid:** After the swap, manually run `npx cz` (or `make commit`) once and confirm the
interactive type-selection prompt appears before committing the change (D-08 verification step).
**Warning signs:** `Error: Cannot find module 'cz-conventional-changelog'` (stale path) or `Cannot
find module 'cz-git'` (install didn't run) when `make commit` is invoked.

### Pitfall 6: CI cache/setup-node ordering on the new `[22, 24]` matrix
**What goes wrong:** `actions/setup-node`'s `cache: pnpm` step fails to resolve a cache key or errors
before pnpm exists on the runner.
**Why it happens:** `setup-node`'s pnpm cache option needs pnpm already available (via
`pnpm/action-setup`, which this workflow already runs *before* `setup-node` — order is currently
correct) `[CITED: WebSearch aggregation of actions/setup-node docs]`. This repo's existing
`.github/workflows/ci.yml` already sequences `pnpm/action-setup@v4` before `actions/setup-node@v4`,
so this pitfall is pre-empted by the existing file — only the `node-version` matrix values change.
**How to avoid:** Do not reorder the existing `pnpm/action-setup` → `setup-node` steps while editing
the matrix.
**Warning signs:** CI cache-restore step errors with "Unable to locate executable file: pnpm" — would
indicate the ordering was accidentally changed, not a Node-24-specific issue.

## Code Examples

### `.github/workflows/ci.yml` matrix diff (D-07)
```yaml
# Source: existing .github/workflows/ci.yml, edited per D-07
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24]   # was: [20]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: make build
      - run: make test
```
No other CI steps change this phase (typecheck/lint gates arrive in Phases 7/9, per D-07).

### Root `package.json` diff shape (engines + cz-git + devDeps)
```json
{
  "engines": { "node": ">=22" },
  "config": {
    "commitizen": {
      "path": "node_modules/cz-git"
    }
  },
  "devDependencies": {
    "@biomejs/biome": "^2.5.4",
    "commit-and-tag-version": "^12.7.3",
    "commitizen": "^4.3.2",
    "cz-git": "^1.13.1",
    "happy-dom": "^20.10.6",
    "tsup": "^8.5.1",
    "typescript": "^5.8.3",
    "vite": "^8.1.4",
    "vitest": "^4.1.10"
  }
}
```
(`cz-conventional-changelog` removed; caret ranges kept per D-03; `typescript` untouched per D-04.)

### Plugin `package.json` diff shape (×4, lockstep D-05)
```json
{
  "engines": { "node": ">=22" }
}
```
Add this key to `plugins/auth/package.json`, `plugins/wallet/package.json`,
`plugins/theme/package.json`, `plugins/settings/package.json` — identical string in all 5 files.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| Vite's dual esbuild(dev)/Rollup(build) bundler | Rolldown (Rust) as the unified default bundler | Vite 8.0 stable, landed ~2026-03 `[ASSUMED — see note]` | Faster builds/HMR; for this repo, zero direct config impact since only `vitest.config.ts` consumes Vite and it has no `build` block |
| `cz-conventional-changelog` (unmaintained ~6 yrs) | `cz-git` (actively maintained, richer feature set available but unused here) | Ongoing; this phase adopts it | Same conventional-commit output shape, maintained upstream |
| Node 18/20 CI matrix | Node 22 (Maintenance LTS, EOL 2027-04) + Node 24 (Active LTS, EOL 2028-04) | Node 22 became Active LTS Oct 2024; Node 24 became Active LTS in 2026 `[CITED: WebSearch aggregation of endoflife.date/nodejs.org]` | Both matrix entries are currently supported LTS lines — no EOL risk within this milestone's horizon |

**Deprecated/outdated:**
- `cz-conventional-changelog`: unmaintained since ~2020 per project's own framing (PROJECT.md); replaced this phase.
- Node 18/20 in CI: both past or approaching EOL; Node 20 exits Active LTS status window relevant to this project's floor decision (D-05 explicitly chose 22 over 20 for this reason, per STATE.md).

**Note on the Vite 8 release date claim above:** the "landed ~2026-03" date came from secondary
WebSearch-aggregated blog sources (nexgismo.com, itacademy.com.ua), not vite.dev itself — the official
migration guide fetch did not surface a publish date. Treat the exact date as `[ASSUMED]`; the
version-and-breaking-changes content from that same fetch (`vite.dev/guide/migration`) is `[CITED]`
since it came from the official docs page directly.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Vite 8.0 stable landed "~March 2026" | State of the Art | Low — cosmetic/contextual only, doesn't affect any task or verification step |
| A2 | pnpm's exact `ERR_PNPM_UNSUPPORTED_ENGINE` error text/format for a root-project engine-strict failure | Pattern 2 / Code Examples | Low-medium — the documented "expected failure" note (D-06) should capture the *actual* error text observed when the check is run for real, not assume the exact string shown here |
| A3 | cz-git's zero-config default type list is a strict superset of CLAUDE.md's required types (feat/fix/refactor/docs/test/chore) with no scope enforcement by default | Pattern 3 | Low — verify empirically with one `npx cz` dry run before declaring D-08 done; if cz-git defaults ever enforce scope selection, add `noScope: true`-equivalent config from cz-git's docs (not yet consulted in depth) |

## Open Questions

1. **Does Vite 8 (Rolldown-based) introduce any subtle vitest transform/resolution behavior change beyond config-shape, even without a `build` key?**
   - What we know: The migration guide's breaking changes are framed around `build`/CSS/CJS-interop, and this repo has no `build` config. vitest 4.1.x explicitly lists `vite: "^6.0.0 || ^7.0.0 || ^8.0.0"` as a supported peer range `[VERIFIED: npm registry]`.
   - What's unclear: Whether Rolldown's dev-time module transform (used by vitest under the hood for `.ts` files) has any edge-case divergence from the old esbuild/Rollup dev path — e.g. around the CJS default-import interop change, which *could* matter for any test file mixing CJS-style requires.
   - Recommendation: Treat the Vite bump as its own isolated commit per D-02 and run the full `make test` (321 specs) as the acceptance gate — that's a sufficient empirical check for this phase's scope; no need to read Rolldown internals further unless `make test` actually fails on that commit.

2. **Exact `.npmrc` error text a contributor sees on a real Node-20 `engine-strict` failure.**
   - What we know: The failure mode exists and is documented at a mechanism level (`[CITED: pnpm.io/package_json]`).
   - What's unclear: The verbatim CLI output (this session did not have a Node 20 environment available to reproduce it directly).
   - Recommendation: Have the plan's D-06 documentation task actually run `nvm use 20 && pnpm install` (or equivalent) once during implementation and paste the real output into the migration note, rather than inventing the exact text.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Everything in this phase | ✓ | v22.22.1 (current shell) | — |
| pnpm | Install/build/test/CI | ✓ | 10.32.1 (matches `packageManager` pin) | — |
| npm registry access | Version verification, `pnpm add`/`remove` | ✓ | — (confirmed via `npm view` calls this session) | — |
| A Node 18 or 20 runtime | D-06's manual documented negative-install check | ✗ (not installed in this sandbox) | — | Use `nvm`/`fnm`/Volta locally, or a throwaway Docker container (`node:20-slim`) at implementation time to capture the real failure text (see Open Question 2) |

**Missing dependencies with no fallback:** none — the phase can execute fully in the current environment.
**Missing dependencies with fallback:** a Node 18/20 runtime for the D-06 documented-failure step — use `nvm`/Docker at implementation time (not blocking for planning).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 → 4.1.10 (bump target), happy-dom 20.10.6 (environment) |
| Config file | `vitest.config.ts` (root; covers `tests/**` + `plugins/*/tests/**` via `include`) |
| Quick run command | `npx vitest run` (or `make test`, which also runs `biome check .` first) |
| Full suite command | `make test` (lint + all 321 vitest specs across core + 4 plugins) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| TOOL-01 | `engines` present in all 5 package.json + engine-strict blocks old Node | manual/documented (per D-06, no CI negative job) | `nvm use 20 && pnpm install` (expect failure) | N/A — documentation step, not a test file |
| TOOL-02 | CI matrix runs Node 22 + 24, no 18/20 | CI config check | `grep node-version .github/workflows/ci.yml` (manual review) or a green CI run itself | N/A — CI file is the artifact |
| TOOL-03 | All 5 tools bumped, `make test` green | integration (existing suite) | `make test` | ✅ existing (321 specs) |
| TOOL-04 | cz-git swap emits conventional commits | manual verification | `npx cz` (interactive, confirm prompt + resulting commit message shape) | N/A — no automated test exists or is needed per D-08 scope |
| TOOL-05 | ESM/CJS/IIFE present per package after bumps | build-output existence check | `for f in dist/index.js dist/index.cjs dist/index.global.js; do test -f "$f" || exit 1; done` (root + each of 4 plugin dirs, after `make build`) | ❌ Wave 0 — no existing script does this; add a short shell check as a task, not a vitest test (D-09 explicitly scopes this to existence, not the FCT-04 artifact smoke test) |

### Sampling Rate
- **Per task commit (D-02, per-tool):** `make test` (lint + full suite — the suite runs fast enough that "quick" and "full" are the same command here; no separate quick-check split exists in this repo today)
- **Per wave merge:** `make build && make test` (adds the build-output existence check for TOOL-05)
- **Phase gate:** Full `make build && make test` green, plus the manual TOOL-01 (engine-strict) and TOOL-04 (`npx cz`) checks documented in the phase's verification evidence, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] A short build-output existence check (shell loop or a small `make` target, e.g. `make verify-outputs`) covering TOOL-05 — does not exist today, needs to be added as part of this phase's plan (not deferred to Phase 8, which is the *deeper* smoke test).
- [ ] No vitest framework changes needed — existing `vitest.config.ts` and `tests/**` layout already covers everything this phase touches at the "does the suite still pass" level.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | Not touched by this phase |
| V3 Session Management | No | Not touched by this phase |
| V4 Access Control | No | Not touched by this phase |
| V5 Input Validation | No | Not touched by this phase |
| V6 Cryptography | No | Not touched by this phase |
| V10 Malicious Code | **Yes** | Package Legitimacy Audit (this document) — new/bumped devDependency provenance, no `postinstall` scripts present on any of the 6 packages `[VERIFIED: npm registry]` |
| V14 Configuration | **Yes** | `.npmrc engine-strict=true` and `engines` fields are configuration-hardening controls (fail-fast on unsupported runtime) — the standard pnpm-native mechanism, not a custom script |

This phase's attack surface is almost entirely supply-chain (devDependency provenance) rather than
runtime application security — DxKit's runtime code paths are untouched. The one genuinely new
dependency, `cz-git`, was run through the package-legitimacy gate and returned `OK` with no
`postinstall` script `[VERIFIED: npm registry]`.

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Dependency confusion / typosquat on a new devDependency (`cz-git`) | Tampering | Package Legitimacy Audit gate (already run this session — `OK` verdict, official repo, high downloads) |
| Malicious `postinstall` script smuggled in via a version bump | Tampering | `npm view <pkg> scripts.postinstall` checked for all 6 packages this session — all `null` `[VERIFIED: npm registry]` |
| Frozen-lockfile bypass in CI masking an unreviewed transitive bump | Tampering | CI already uses `pnpm install --frozen-lockfile` (unchanged this phase) — any lockfile drift from these bumps must be committed intentionally, not regenerated silently in CI |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view <pkg> version/dist-tags/engines/peerDependencies/scripts.postinstall`) — tsup, vite, vitest, happy-dom, @biomejs/biome, cz-git, commitizen, commit-and-tag-version — all version numbers, engine ranges, peer ranges, and postinstall-script checks in this document `[VERIFIED: npm registry]`
- Local repo inspection (`Read`/`Bash cat`) of `package.json` (root + 4 plugins), `.github/workflows/ci.yml`, `.versionrc.json`, `Makefile`, `biome.json`, `tsconfig.json`, `vitest.config.ts`, `tsup.config.ts` (root + wallet + auth), `pnpm-workspace.yaml`, `docs/development.md`, `docs/testing.md` — current-state facts (no `.npmrc` exists yet; no `engines` field exists yet; `vitest.config.ts` has no `build` key; `docs/development.md` still says "Node.js 18+" and "CI ... runs against Node 20")
- `gsd-tools query package-legitimacy check` — tsup, vite, vitest, happy-dom, @biomejs/biome, cz-git

### Secondary (MEDIUM confidence)
- `vite.dev/guide/migration` (official Vite docs, via WebFetch) — Vite 7→8 breaking changes list `[CITED]`
- `biomejs.dev/internals/changelog/version/2-5-1...latest` (official Biome docs, via WebFetch) — 2.5.1→2.5.4 diff `[CITED]`
- `cz-git.qbb.sh/guide` (official cz-git docs, via WebFetch) — `config.commitizen.path` setup `[CITED]`
- `pnpm.io/package_json` (official pnpm docs, via WebFetch) — `engines`/`engineStrict` semantics `[CITED]`
- WebSearch aggregation confirming Node 22 (Maintenance LTS, EOL 2027-04) and Node 24 (Active LTS, EOL 2028-04) status, sourced from endoflife.date/nodejs.org via search snippets `[CITED, secondhand]`

### Tertiary (LOW confidence)
- WebSearch-aggregated blog posts (nexgismo.com, itacademy.com.ua) on the exact Vite 8 stable release date — flagged `[ASSUMED]` in the Assumptions Log (A1), not load-bearing for any task

## Metadata

**Confidence breakdown:**
- Standard stack (version numbers/engines/peers): HIGH — every number directly verified against the live npm registry this session
- Architecture (config-shape impact on this specific repo): HIGH — `vitest.config.ts`/`tsup.config.ts` were read directly; the "no `build` key, so Rolldown rename is a non-issue" finding is a direct file inspection, not an inference
- Pitfalls: HIGH for the pnpm engine-strict mechanics (official docs) and Biome-scope-correction (registry + official changelog); MEDIUM for the exact error-text and CI-cache-ordering claims (aggregated WebSearch, not a live reproduction)

**Research date:** 2026-07-15
**Valid until:** ~7 days (fast-moving devDependency versions — re-check `npm view` numbers immediately before execution if this research is more than a few days old)

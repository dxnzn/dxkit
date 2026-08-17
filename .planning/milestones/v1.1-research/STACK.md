# Stack Research

**Domain:** TypeScript 6 migration + toolchain modernization for a zero-runtime-dep TypeScript library monorepo (DxKit v1.1)
**Researched:** 2026-07-15
**Confidence:** HIGH for version numbers (verified directly against the npm registry API, not just web-search summaries); MEDIUM for maintenance-status/ecosystem claims (cross-checked web sources); see per-section notes.

## Critical Flag Before Anything Else

**Node 20 is already EOL.** Node.js 20 ("Iron") reached end-of-life in Q1 2026 (Mar 24, 2026 per Node's release-schedule data; some trackers list Apr 30, 2026 — sources disagree by ~5 weeks but agree it's past). As of today (2026-07-15) the only supported lines are **Node 22 (Maintenance LTS, EOL ~Jun 2027)** and **Node 24 (Active LTS, EOL ~Jun 2028)**. Node 26 is Current (not yet LTS).

This directly contradicts the milestone's stated plan to "raise the Node floor from EOL Node 18 to Node 20" — that trades one EOL runtime for another. **Recommend raising the floor to Node 22** instead (see `## Node Floor Decision` below for the full tradeoff, because this also changes which tool versions are reachable this milestone).

Confidence: HIGH (verified via nodejs.org release data + cross-checked against `endoflife.date`-style sources; the ~5-week EOL-date discrepancy between sources is noted, not resolved, but doesn't change the conclusion).

## Node Floor Decision

| Floor | Status today (2026-07-15) | What it unlocks | What it blocks |
|-------|---------------------------|------------------|-----------------|
| Node 20 | **EOL** | tsup 8.5.1 (`>=18`), Vite 8.1.x (`^20.19.0`), Vitest 4.1.10 (`^20.0.0`), Biome 2.5.4, pnpm 10.x (`>=18.12`) | pnpm 11.x (`>=22.13`), tsdown 0.22.x (`^22.18.0`) — both **require Node 22+** |
| Node 22 | Maintenance LTS (safe floor) | Everything Node 20 unlocks, **plus** pnpm 11.x and tsdown become reachable | Nothing lost vs. Node 20 for this stack — every tool in this list that supports Node 20 also supports Node 22 |
| Node 24 | Active LTS | Same tools as Node 22 (no additional tool unlocked in this stack today) | Narrows the supported-runtime window for consumers running DxKit-adjacent tooling on older LTS |

**Recommendation: Node 22 as the new floor**, not Node 20. It costs nothing this milestone (every candidate tool version below that runs on Node 20 also runs on Node 22) and avoids landing v1.1 on an already-dead runtime. If the milestone's `engines` decision is locked to "Node 20" for reasons outside this research (e.g. a specific consumer constraint), everything below still works — just skip the pnpm 11 / tsdown rows in the tables, which are the only two items gated on Node 22+.

Confidence: HIGH (engines fields pulled directly from npm registry `dist-tags.latest` metadata for every package below).

## Recommended Stack

### TypeScript

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `typescript` | **6.0.3** | Compiler | This milestone's explicit target (per PROJECT.md — TS7 is out of scope for v1.1). 6.0.3 is the current stable patch on the 6.0.x line, published 2026-04-16, `engines: node >=14.17` (no Node-floor conflict either way). |

**Important context the roadmap needs:** TypeScript 7.0 (the Go-native "Project Corsa" compiler) is **no longer upcoming — it already shipped**. npm's `latest` dist-tag for `typescript` is **7.0.2** (published 2026-07-08, one week before this research). A `7.1.0-dev` prerelease line is already in progress. PROJECT.md's "Next Milestone Goals" note says the TS7 jump is "waiting on a TS7 point release for stable ABI/API" — that condition is now arguably met (7.0.2 is a point release, not just an RC). This doesn't change v1.1's scope (TS6 is still the deliberate, correct target — see rationale below), but it does mean the *next* milestone's blocking condition should be re-evaluated at kickoff, not assumed still pending.

**Why TS6 and not TS7 for this milestone (validates the existing PROJECT.md decision):**
- TS6.0 is the last Strada (JS-based) release and the **deprecation-alignment release** — it turns on `strict: true` by default, removes `moduleResolution: classic`, removes AMD/UMD/SystemJS module targets, deprecates `target: es5` (floor is now ES2015), and makes `esModuleInterop`/`allowSyntheticDefaultImports` non-optional (always the safer behavior). Every one of these is exactly the kind of "resolve every deprecation TS6 surfaces" work the milestone scopes.
- `ignoreDeprecations: "6.0"` exists as an escape hatch for options TS6 deprecated but TS7 will remove entirely — useful during migration, must not ship long-term.
- New flag: `--stableTypeOrdering` — makes 6.0's type-display ordering match 7.0's, explicitly designed to reduce the diff between a 6.0 codebase and a future 7.0 one. **Turn this on** — it's a zero-cost forward-compat measure that fits the milestone's "de-risk the TS 7.1 jump later" goal directly.
- TS7/Corsa is a from-scratch Go reimplementation with a **different API surface** (Strada API vs. Corsa API); linters/formatters/IDE tooling built against Strada (which includes Biome's TS parser, tsup's type-checking path, etc.) are not guaranteed compatible with Corsa yet. Jumping straight to TS7 this milestone would risk breaking the toolchain modernization work being done in parallel. Staying on TS6 first, landing `isolatedDeclarations` + `verbatimModuleSyntax` + the deprecation gate, is the correct sequencing.

**tsconfig changes required/recommended for the 5.8 → 6.0 jump:**

| Setting | 5.8 behavior | 6.0 behavior | Action needed |
|---------|-------------|--------------|----------------|
| `strict` | opt-in | **default `true`** | DxKit already runs `strict: true` explicitly (confirmed in codebase STACK.md) — no change, but remove it as an explicit no-op only if desired; safe either way. |
| `moduleResolution: classic` | supported | **removed** | Not used (DxKit is on `bundler`) — no action. |
| `target: es5` | supported (deprecated in 5.x) | **deprecated, floor is ES2015** | Not used (DxKit targets ES2022) — no action. |
| `esModuleInterop` / `allowSyntheticDefaultImports: false` | allowed | **cannot be `false`** | Confirm neither is explicitly set to `false` anywhere (workspace root + 5 package tsconfigs) — grep before upgrading. |
| Module targets `amd`/`umd`/`systemjs`/`none` | supported | **removed** | Not used — no action. |
| `--stableTypeOrdering` | n/a | new opt-in flag | **Enable it** (forward-compat, see above). |
| `ignoreDeprecations` | n/a | `"6.0"` accepted | Use only as a temporary shim while resolving flagged deprecations; the milestone's CI deprecation gate should fail the build on `tsc --strict` warnings, which supersedes needing this. |

Confidence: HIGH for version numbers (npm registry). HIGH for the strict/moduleResolution/target changes (official TypeScript 6.0 release notes, cross-checked across 3 independent summaries). MEDIUM for the Strada/Corsa API-compatibility claim (web-sourced, directionally consistent across sources but not independently verified against Biome's/tsup's actual TS6 support matrix — flagged as a gap below).

### Build Tooling — tsup vs. tsdown

| Technology | Version | Purpose | Why / Why Not |
|------------|---------|---------|-----------------|
| `tsup` | **8.5.1** (stay, don't touch this milestone) | ESM/CJS/IIFE triple build | Current pinned version is already latest (8.5.1, published 2025-11-12). `engines: node >=18` — compatible with either Node floor. **The GitHub README now states verbatim: "This project is not actively maintained anymore. Please consider using tsdown instead."** The repo is *not archived* (still received a commit 2026-06-14, 406 open issues) — it isn't abandoned-abandoned, but it is explicitly in maintenance-only mode with the maintainer pointing elsewhere. |
| `tsdown` | 0.22.7 (candidate, **not this milestone**) | Rolldown-powered successor to tsup, drop-in migration path | **Blocked by the Node floor.** `tsdown@0.22.7` requires `engines: node ^22.18.0 \|\| >=24.11.0` — even with the Node-22 floor recommended above, 22.18.0 is a fairly recent patch (check exact CI Node version pin). Migration is designed to be low-friction (`tsup` → `tsdown` import swap, output naming changes from `*.global.js` to `*.iife.js` — **this would require updating every consumer-facing doc/example that references the IIFE filename**, a real but bounded cost). |

**Recommendation for v1.1:** Stay on `tsup@8.5.1`. Do not migrate to `tsdown` this milestone — the Node-version gate alone makes it out of scope, and a bundler swap is real "reshaping" risk this milestone (framed as modernization, not a rewrite) shouldn't absorb. **Flag `tsup` → `tsdown` explicitly as a candidate for the milestone *after* v1.1**, gated on the Node floor eventually reaching 22.18+/24.11+ cleanly (which — per the Node Floor Decision above — happens as soon as the recommended Node-22 floor lands, since 22.18 ships within the 22.x line; verify the exact minor at execution time).

**Why this still matters for `isolatedDeclarations` now:** Adopting `isolatedDeclarations` + `verbatimModuleSyntax` this milestone (per the milestone's forward-compat goal) pays off *twice*: it's required TS6→TS7 hygiene regardless of bundler, **and** it's the exact prerequisite that lets a future `tsdown` migration skip `tsc`-based declaration emission entirely in favor of `oxc-transform` (parallel, non-type-checking `.d.ts` generation) — a real build-speed win tsup can't capture today because it still routes `.d.ts` generation through `tsc`/`rollup-plugin-dts`. Doing the source-level annotation work now under tsup means the eventual tsdown migration is a config swap, not another source-wide pass.

Confidence: HIGH for version/engines numbers (npm registry). MEDIUM for the "not actively maintained" framing nuance (directly quoted from the tsup README via WebFetch, cross-checked against GitHub API showing the repo is not archived and has recent commits — both facts are true simultaneously, stated as such above rather than picking one).

### Test Tooling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `vitest` | **4.1.10** | Test runner | Latest is already 4.1.10 (published 2026-07-06, 8 days before this research) — current pin is current, no action beyond a patch bump if the lockfile is behind. `engines: node ^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` — compatible with Node 20 or 22 floor. **Do not jump to Vitest 5** this milestone: peer requirement moves to `Vite >=6.4.0` and `Node >=22.12.0`, which is a bigger coupling change than this milestone needs to take on for a testing upgrade alone. |
| `happy-dom` | **20.10.6** | DOM shim for tests | Already latest (published 2026-06-17). `engines: node >=20.0.0` — **this is the one dependency that already hard-requires Node 20+**, meaning the Node-18 floor was already broken by this dependency before the milestone started. Reinforces that a floor bump is not optional. |
| `vite` | **8.1.4** (upgrade candidate) | Dev server / module resolution, vitest's peer | Current pin (7.3.6) is behind. Vitest 4.1.10's own `peerDependencies` explicitly list `"vite": "^6.0.0 || ^7.0.0 || ^8.0.0"` — **Vite 8 is an officially supported pairing**, not a stretch upgrade. `engines: node ^20.19.0 \|\| >=22.12.0` — compatible with either floor (note the Node-20 sub-range is `20.19.0+`, not all of 20.x). |

**Vite 7 → 8 breaking-change notes (relevant subset):** Vite 8 swaps esbuild/Rollup for Rolldown/Oxc internally. `build.rollupOptions`/`worker.rollupOptions` are renamed to `rolldownOptions` (old names auto-converted via a compatibility shim, deprecated not removed). CSS minification defaults to Lightning CSS instead of esbuild (`build.cssMinify: 'esbuild'` to opt back out). None of DxKit's current `vite.config.ts`/`vitest.config.ts` usage (per codebase STACK.md — used for dev server + path aliases only, no custom `rollupOptions`) appears to hit these breaking surfaces, but **verify the actual config files for `rollupOptions`/`esbuildOptions` usage before the phase that does this bump** — this research didn't grep the live config.

Confidence: HIGH for version/engines/peerDependency numbers (npm registry `dist-tags` + `peerDependencies` field, pulled directly). MEDIUM for "no config hits the breaking surface" (inferred from the codebase STACK.md summary, not independently re-verified against the live `vite.config.ts` files — flagged as a gap).

### Lint/Format

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@biomejs/biome` | **2.5.4** | Lint + format | Current pin (2.5.1) is 3 patches behind; 2.5.4 published 2026-07-15 (today). `engines: node >=14.21.3` — no floor conflict at all. Biome does **not** type-check (syntax-only parser + linter), so TS6's semantic/config changes (strict defaults, removed `moduleResolution`, etc.) don't require a Biome version bump to "support TS6" the way a type-checker would — Biome only needs to *parse* TS6 syntax, and TS6 introduces essentially no new syntax (it's a deprecation/defaults release, not a syntax release). Low risk, straightforward patch bump. |

Confidence: MEDIUM. Version/engines numbers are HIGH (registry-verified). The "Biome doesn't need updating for TS6 syntax" claim is reasoned from Biome's documented syntax-only parsing model plus TS6's own release notes (which list no major new syntax), but was **not independently confirmed against Biome's own TS-version-support changelog entry for 2.5.x** — a targeted check (`biomejs.dev/internals/language-support/`) is recommended before the phase that does this work, flagged as a gap.

### Commit / Release Tooling

| Technology | Version | Purpose | Why / Why Not |
|------------|---------|---------|-----------------|
| `commit-and-tag-version` | **12.7.3** | Versioning + changelog | Current pin is already latest (published 2026-05-08). `engines: node >=18` — no floor conflict. No action. |
| `commitizen` | **4.3.2** | Commit wizard CLI | Current pin is already latest (published 2026-06-12, actively maintained). `engines: node >=18`. No action. |
| `cz-conventional-changelog` | 3.3.0 (current pin) — **flag for replacement, not this milestone's blocker** | Commitizen adapter/prompt config | **Stale: last published 2020-08-26, ~6 years with zero updates.** `engines: node >=10` (itself a sign of age). Still functions (it's a thin prompt-template adapter, low surface area to break), so it is not a hard blocker for TS6/toolchain work — but it's the one piece of the commit toolchain that's genuinely unmaintained (unlike tsup, which is maintained-but-redirecting). |
| `cz-git` | 1.13.1 (replacement candidate) | Modern commitizen adapter, actively maintained | Published 2026-05-09 (i.e., updated within the last 3 months), `engines: node >=12.20.0`. Drop-in adapter swap for `cz-conventional-changelog` under the existing `commitizen` CLI — same conventional-commit workflow the project's `.claude/CLAUDE.md` commit rules already assume, just maintained. Worth a note in REQUIREMENTS even if out of this milestone's explicit scope, since "dependency-freshness automation" (Renovate/Dependabot) will otherwise flag `cz-conventional-changelog` as perpetually stale with no upstream release to update to. |

Confidence: HIGH for version/engines numbers (registry-verified). MEDIUM for the cz-git recommendation (single-source npm registry data point on recency; not cross-checked against community adoption signals like GitHub stars/downloads).

### `@types/node` / lib pairing for Node-20-or-22 + ES2022

| Setting | Recommendation | Why |
|---------|-----------------|-----|
| `@types/node` | **`^20.19.43`** if floor stays Node 20, or **`^22.x`** (check latest 22.x patch at execution time) if floor moves to Node 22 as recommended | Convention: pin `@types/node`'s major to the `engines.node` floor, not to whatever Node the dev machine happens to run — using a newer `@types/node` than the floor risks type-checking against APIs that don't exist on the minimum supported runtime. `@types/node@20.19.43` (latest 20.x, published 2026-06-10) is the correct pairing if the floor is Node 20; per this research's recommendation to move the floor to Node 22, use the latest 22.x line instead. Vitest 4.1.10's own peer range (`^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0`) confirms either major is a supported pairing. |
| `target` / `lib` (tsconfig) | **No change needed** — keep `ES2022` | This is a common misconception worth heading off explicitly: raising the Node floor from 18→20 (or 20→22) does **not** require raising `target`/`lib`. Node 18, 20, 22, and 24 all ship V8 builds with full ES2022 support; ES2022 was never the limiting factor. The floor bump is purely about `engines.node` + `@types/node` + the tool `engines` gates documented above (pnpm 11, tsdown, happy-dom, Vite's `20.19.0` sub-range) — not about the compile target. |

Confidence: HIGH (convention is standard practice; ES2022/Node-version support matrix is a well-established, stable fact not requiring further verification).

### Dependency-Freshness Automation: Renovate vs. Dependabot

| Criterion | Renovate | Dependabot | Recommendation for DxKit |
|-----------|----------|------------|----------------------------|
| pnpm workspace awareness | Natively detects pnpm/Yarn/npm workspaces and Nx/Lerna layouts from a **single root config file** | Requires a **separate config entry per package directory** in `dependabot.yml` — for DxKit's core + 4 plugins, that's 5 directories to declare individually and keep in sync as plugins are added/removed | **Renovate** — DxKit's monorepo shape (1 root config away vs. 5 hand-maintained blocks) is exactly the case Renovate's workspace detection was built for. |
| Grouping devDependencies | `groupSlug`/`packageRules`-based grouping is fine-grained: group by scope, dependency type, update type (patch/minor/major), and can express "group non-major devDeps + automerge after CI, never automerge majors" in one config block | `groups:` key in `dependabot.yml` supports name-pattern/dependency-type grouping but with coarser matching logic | **Renovate** — this project's constraint ("all deps are devDependencies, zero runtime deps must stay zero") is easiest to enforce as a Renovate rule: a `packageRules` entry that matches `depTypees: ["devDependencies"]` for auto-grouping, plus (see below) a rule that blocks any PR introducing a new *non-dev* dependency. |
| Avoiding runtime-dep creep | Both tools update *existing* declared dependencies; **neither tool prevents a human/AI from hand-adding a new runtime dependency in a PR** — that's a review-process control, not a bot feature, in either tool. | Same limitation. | Enforce the zero-runtime-dep constraint via **CI, not the update bot**: a lint step (`pnpm ls --prod` / a package.json-diff check) that fails if `dependencies` (non-dev) is non-empty in any workspace package, independent of which update bot is chosen. |
| Config surface for "current, not bleeding-edge" | `minimumReleaseAge` (formerly `stabilityDays`) config lets you require a package sit N days before Renovate opens a PR — useful for avoiding just-published/malicious-release exposure | Dependabot has no equivalent release-age gate — it will PR the moment a new version is published | **Renovate** — relevant here since `pnpm@11.0.0` itself shipped with "supply-chain protection defaults... newly published packages not resolved for 24 hours" as a first-class feature; Renovate's `minimumReleaseAge` is the direct config-level analog for the dependency bot layer. |

**Recommendation: Renovate**, self-hosted or via the Renovate GitHub App, configured with:
- `"extends": ["config:recommended", "group:monorepos"]` as the base (native pnpm workspace grouping)
- A `packageRules` block grouping all `devDependencies` minor/patch updates into a single PR, with majors (TypeScript, Vite, Vitest, Biome) left ungrouped and requiring individual review given each is a milestone-relevant coupling decision (as this document demonstrates)
- `minimumReleaseAge` set to a few days (e.g. `"3 days"`) as a lightweight supply-chain gate, consistent with pnpm 11's own new default behavior
- A separate CI check (not a Renovate feature) asserting no workspace `package.json` gains a non-dev `dependencies` entry — this is the actual zero-runtime-dep enforcement mechanism

Confidence: MEDIUM. Directional comparison (workspace awareness, grouping granularity) is corroborated across multiple independent 2026-dated web sources and matches Renovate's documented feature set, but was not verified against Renovate's own docs directly (web-search summaries only) — recommend a documentation pass against `docs.renovatebot.com` at implementation time to nail exact config keys (`minimumReleaseAge` naming may have changed from `stabilityDays` — confirm current key name before writing the config file).

## Installation

```bash
# TypeScript (this milestone's actual version bump)
pnpm add -D -w typescript@6.0.3

# Toolchain patch/minor bumps (workspace root)
pnpm add -D -w vite@8.1.4 vitest@4.1.10 happy-dom@20.10.6 @biomejs/biome@2.5.4 commit-and-tag-version@12.7.3 commitizen@4.3.2

# @types/node — pick ONE based on the final Node-floor decision
pnpm add -D -w @types/node@^20.19.43   # if floor stays Node 20
# pnpm add -D -w @types/node@^22        # if floor moves to Node 22 (recommended — check latest 22.x at execution time)

# Commit adapter replacement candidate (flag for REQUIREMENTS, not auto-applied)
# pnpm remove -w cz-conventional-changelog
# pnpm add -D -w cz-git

# tsup stays pinned — already latest, do not touch this milestone
# tsup@8.5.1 (no change)

# pnpm itself: stay on 10.x if floor is Node 20; only pnpm 11.x needs Node 22+
# corepack use pnpm@10.34.5   # if floor stays Node 20
# corepack use pnpm@11.13.0   # if floor moves to Node 22 (optional, not required)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Stay on `tsup@8.5.1` this milestone | `tsdown@0.22.7` | Once the Node floor is cleanly ≥22.18.0/24.11.0 *and* the milestone budget can absorb a bundler swap (output filename changes from `*.global.js` to `*.iife.js` ripple into docs/consumers) — proposed as next-milestone scope, not v1.1. |
| `cz-conventional-changelog` (leave as-is this milestone, flag only) | `cz-git@1.13.1` | If/when the commit-tooling line item gets its own pass — same commitizen CLI, actively maintained adapter, no workflow change for contributors. |
| Node 22 floor | Node 20 floor (as PROJECT.md currently states) | Only if there's an external constraint (e.g. a specific consumer/CI image) pinning to Node 20 specifically — in which case every recommendation above still holds except pnpm 11 and tsdown, which simply stay out of reach until a later floor bump. |
| Vite 8.1.4 | Stay on Vite 7.3.6 | If the phase doing this work can't spend time verifying no `rollupOptions`/`esbuildOptions` usage exists in the live configs — Vite 7.3.6 continues to satisfy Vitest 4.1.10's peer range (`^7.0.0`) and the Node-20/22 engines gate, so deferring this one upgrade specifically is low-risk and easy to split into its own phase. |
| Renovate for dep-freshness automation | Dependabot | If the team wants zero self-hosting/app-install overhead and is fine with the coarser per-directory config for a 5-package monorepo (core + 4 plugins is small enough that Dependabot's per-directory model isn't actually painful at this scale — the Renovate advantage grows with package count). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Node 20 as the "new" floor, framed as future-proofing | Node 20 is already EOL as of this research date (2026-07-15) — it stopped receiving security patches in Q1 2026. Landing v1.1 on it means the "modernization" milestone ships on a dead runtime. | Node 22 (Maintenance LTS through mid-2027) — see Node Floor Decision above; costs nothing in this tool matrix. |
| `typescript@7.x` for this milestone | Different compiler internals (Go/Corsa, separate API surface from Strada); risks breaking Biome/tsup tooling compatibility mid-modernization-pass, and is explicitly out of PROJECT.md's stated v1.1 scope. | `typescript@6.0.3` this milestone; treat TS7 as the *next* milestone's headline item — and note its blocking condition ("wait for a TS7 point release") is now arguably satisfied, so that milestone's kickoff should re-check rather than assume it's still pending. |
| `vitest@5.x` | Peer requirement jumps to `Vite >=6.4.0` and, more importantly, `Node >=22.12.0` — a bigger, less-reversible coupling than this milestone's testing-tool bump needs to take on. | `vitest@4.1.10` (current major, already latest patch). |
| `tsdown` this milestone | `engines: node ^22.18.0 \|\| >=24.11.0` — incompatible with a Node-20 floor outright, and even under the recommended Node-22 floor requires confirming the exact 22.18+ patch is what CI runs. Also a bundler-identity change (filename/output-shape), which is scope creep for a "modernize the existing tools" milestone. | `tsup@8.5.1` (current, latest, functional) — flag tsdown for the milestone after next. |
| `cz-conventional-changelog` left in place indefinitely once dependency-freshness automation lands | It's been unmaintained for ~6 years; a Renovate/Dependabot bot will perpetually report it as outdated with no available fix, generating permanent noise in the "dependency-freshness" guardrail this milestone is building. | `cz-git` — same commitizen workflow, actively maintained, removes the permanent-noise problem before the guardrail even goes live. |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `typescript@6.0.3` | Node `>=14.17` | No floor conflict at either Node 20 or 22; the floor decision is driven entirely by other tools (tsup fine either way, tsdown/pnpm-11 need 22+). |
| `vitest@4.1.10` | `vite: ^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0`; `@types/node: ^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0`; `happy-dom: *` | Confirms Vite 8 + @types/node 20 or 22 are both officially supported pairings — verified directly from the published `peerDependencies` field, not inferred. |
| `vite@8.1.4` | Node `^20.19.0 \|\| >=22.12.0` | Note the Node-20 sub-range starts at `20.19.0`, not `20.0.0` — if the floor stays Node 20, pin `engines.node` to `>=20.19.0`, not a bare `>=20`. |
| `happy-dom@20.10.6` | Node `>=20.0.0` | Already the tightest constraint in the current (pre-migration) toolchain — confirms the Node-18 floor was already effectively broken before this milestone. |
| `pnpm@11.x` | Node `>=22.13` | **Not reachable under a Node-20 floor.** Stay on `pnpm@10.34.5` (latest 10.x, `engines: >=18.12`) unless the floor moves to 22. |
| `tsdown@0.22.7` | Node `^22.18.0 \|\| >=24.11.0` | **Not reachable under a Node-20 floor**, and needs a specific 22.18+ patch even under a Node-22 floor — confirm CI's exact Node minor before ever adopting. |
| `@biomejs/biome@2.5.4` | Node `>=14.21.3` | No coupling concerns at all — safe independent bump regardless of every other decision in this document. |

## Sources

- `registry.npmjs.org` API (direct, per-package `dist-tags`/`engines`/`peerDependencies` queries) — primary source for every version number, `engines` field, and the `vitest` `peerDependencies` table above. Queried 2026-07-15.
- [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) — strict-default, moduleResolution/target removals, `--stableTypeOrdering`, `ignoreDeprecations`.
- [Announcing TypeScript 6.0 — TypeScript DevBlog](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [Progress on TypeScript 7 — December 2025, TypeScript DevBlog](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/) — Project Corsa / Strada-vs-Corsa API distinction.
- [TypeScript 6.0 Ships as Final JavaScript-Based Release — Visual Studio Magazine](https://visualstudiomagazine.com/articles/2026/03/23/typescript-6-0-ships-as-final-javascript-based-release-clears-path-for-go-native-7-0.aspx)
- [tsdown — migrate from tsup guide](https://tsdown.dev/guide/migrate-from-tsup) — output filename convention change (`*.global.js` → `*.iife.js`), oxc-transform + isolatedDeclarations relationship.
- [tsup GitHub repository](https://github.com/egoist/tsup) — README maintenance-status quote, confirmed via WebFetch; GitHub API confirms not archived, last push 2026-06-14.
- [Vite 7.0 announcement](https://vite.dev/blog/announcing-vite7) and [Vite migration guide](https://vite.dev/guide/migration) — Node 20.19+/22.12+ requirement rationale (`require(esm)` support).
- [Vite 8.0 announcement](https://vite.dev/blog/announcing-vite8) — Rolldown/Oxc internals, `rollupOptions` → `rolldownOptions` rename, Lightning CSS default.
- [Node.js previous releases / EOL data](https://nodejs.org/en/about/previous-releases) — Node 20/22/24 status, verified via WebFetch 2026-07-15.
- Renovate vs. Dependabot comparison — synthesized across multiple 2026-dated sources (dev.to, rafter.so, turbostarter.dev, tenthirtyam.org); directional claims cross-checked across ≥3 independent sources but not verified against `docs.renovatebot.com` directly — flagged as MEDIUM confidence, recommend a targeted docs pass before implementation.

---
*Stack research for: TypeScript 6 migration + toolchain modernization (DxKit v1.1)*
*Researched: 2026-07-15*

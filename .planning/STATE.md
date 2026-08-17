---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: On-Chain Deployment (ERC-8244)
status: planning
last_updated: "2026-08-17T03:55:34.322Z"
last_activity: 2026-08-16
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-16)

**Core value:** DxKit stays trustworthy for real use — failures are visible (never silent), documented behavior matches actual behavior, and the alpha is stable enough to build on with confidence.
**Current focus:** v1.2 On-Chain Deployment (ERC-8244) — defining requirements. Three co-equal deployment targets (bundler/webserver, IIFE/IPFS, on-chain); Foundry/Anvil local loop; Sepolia → mainnet as the final two phases.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-08-16 — Milestone v1.2 started

## Milestone Phase Map (v1.2)

_(populated by the roadmap — continues numbering from v1.1, which ended at Phase 10)_

<details>
<summary>v1.1 phase map (archived)</summary>

Continues numbering from v1.0 (which ended at Phase 5).

| Phase | Name | Requirements | Depends on |
|-------|------|--------------|------------|
| 6 | Toolchain Audit & Modernization | TOOL-01..05 | — (v1.0 shipped) |
| 7 | TypeScript 6 Migration & Standalone Typecheck | TS6-01..03 | Phase 6 |
| 8 | Forward-Compat Typing | FCT-01..04 | Phase 7 |
| 9 | Continuous Debt Guardrails & Registry Robustness | GATE-01..03, ROB-05 | Phase 7, Phase 8 |

Key sequencing constraint (all 4 researchers converged): the standalone `tsc --noEmit` step (TS6-03,
Phase 7) is a precondition — it must exist before/with the TS6 bump and before the CI deprecation gate
(GATE-01, Phase 9) can attach to anything.

</details>

## Performance Metrics

**Velocity:**

- Total plans completed: 40 (v1.0)
- Average duration: - min
- Total execution time: 0 hours

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | - | - |
| 02 | 4 | - | - |
| 03 | 3 | - | - |
| 04 | 6 | - | - |
| 05 | 8 | - | - |
| 06 | 6 | - | - |
| 07 | 4 | - | - |
| 08 | 2 | - | - |
| 09 | 4 | - | - |
| 10 | 1 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 4min | 2 tasks | 4 files |
| Phase 01 P02 | 15min | 3 tasks | 6 files |
| Phase 02 P01 | 3min | 2 tasks | 2 files |
| Phase 02 P02 | 4min | 2 tasks | 2 files |
| Phase 02 P03 | 5min | 2 tasks | 2 files |
| Phase 02 P04 | 4min | 2 tasks | 2 files |
| Phase 03 P01 | 8min | 2 tasks | 3 files |
| Phase 03 P02 | 10 min | 3 tasks | 2 files |
| Phase 03 P03 | 10min | 2 tasks | 3 files |
| Phase 04 P01 | 27min | 2 tasks | 4 files |
| Phase 04 P03 | 12min | 2 tasks | 3 files |
| Phase 04 P02 | 15min | 3 tasks | 3 files |
| Phase 04 P04 | 10min | 2 tasks | 2 files |
| Phase 04 P05 | 12min | 2 tasks | 3 files |
| Phase 04 P06 | 8min | 2 tasks | 2 files |
| Phase 05 P01 | 25min | 3 tasks | 5 files |
| Phase 05 P02 | 35min | 2 tasks | 3 files |
| Phase 05 P03 | 15min | 2 tasks | 3 files |
| Phase 05 P04 | 25min | 2 tasks | 3 files |
| Phase 05 P05 | 30min | 2 tasks | 6 files |
| Phase 05 P06 | 35min | 2 tasks | 4 files |
| Phase 05 P07 | 20min | 2 tasks | 2 files |
| Phase 05 P08 | 19min | 3 tasks | 14 files |
| Phase 06 P01 | 6min | 2 tasks | 6 files |
| Phase 06 P02 | 2min | 1 tasks | 1 files |
| Phase 06 P03 | 4min | 3 tasks | 2 files |
| Phase 06 P04 | 6min | 2 tasks | 4 files |
| Phase 06 P05 | 4min | 2 tasks | 1 files |
| Phase 06 P06 | 8min | 3 tasks | 7 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 07 P01 | 25min | 2 tasks | 4 files |
| Phase 07 P02 | 15min | 2 tasks | 8 files |
| Phase 07 P03 | 6min | 1 tasks | 1 files |
| Phase 07 P04 | 15min | 2 tasks | 7 files |
| Phase 08 P01 | 8min | 3 tasks | 2 files |
| Phase 08 P02 | 6min | 2 tasks | 7 files |
| Phase 09 P01 | 8min | 2 tasks | 2 files |
| Phase 09 P03 | 6min | 2 tasks | 2 files |
| Phase 09 P04 | 6min | 2 tasks | 2 files |
| Phase 09 P02 | 8min | 3 tasks | 7 files |
| Phase 10 P01 | 2min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (v1.0 and v1.1 rows are current there).
No active-milestone decisions yet — next milestone not defined.

<details>
<summary>v1.1 phase-level decisions (archived context)</summary>

- v1.1 roadmap: 4-phase structure (Toolchain → TS6 Migration → Forward-Compat Typing → Guardrails), continuing phase numbering at 6 — matches the strong cross-research convergence and keeps the milestone a lean modernization pass.
- v1.1 sequencing: standalone `tsc --noEmit` (TS6-03) lands inside Phase 7 *before* the TS6 version bump, so the migration has a baseline and GATE-01 (Phase 9) has something to gate on.
- v1.1: Node floor moves to Node 22 LTS (not 20 — research found Node 20 is also EOL); enforced via `engines` + engine-strict, verified with a negative install test.
- v1.1: forward-compat flags (verbatimModuleSyntax → isolatedDeclarations → erasableSyntaxOnly) adopted per-package, core-before-plugins, for TS7-readiness discipline only — no build-speed payoff expected under tsup 8.x; FCT-04 requires an IIFE/CJS smoke test on built `dist/` artifacts.
- v1.1: TS7 migration and tsup→tsdown swap are explicitly out of scope (deferred to v2).
- v1.1: WR-01 (ROB-05) bundled into Phase 9 with the guardrails work — it is independent and could land in any phase, placed with the robustness/guardrails cluster for a clean fit.
- v1.1 breaking changes to flag with `BREAKING CHANGE:` footers + migration notes: Node engines bump (Phase 6); isolatedDeclarations requiring explicit export types for consumers augmenting DxKit public types (Phase 8).

<details>
<summary>v1.0 phase-level decisions (archived context)</summary>

- Milestone-wide: Scope as "harden toward beta", ship as 0.2.0 — alpha is field-stable, this is robustness/trust work, not a feature push.
- Milestone-wide: Target all four hardening tracks (diagnostics/silent failures, robustness, security, tests) — a partial pass leaves obvious gaps per the concerns audit.
- Milestone-wide: Docs pass (Phase 5) = verify-against-code + slop cleanup + gap-fill; sequenced last so it reflects final 0.2.0 behavior.
- Milestone-wide: Breaking changes allowed but must be justified and carry `BREAKING CHANGE:` footers + migration notes.
- [Phase 01-01]: shell:mount emit follows the existing shell:manifest wrapped-message convention.
- [Phase 01]: Wallet canUseStorage() guard copied verbatim from settings/theme to preserve D-07 silent-on-unavailable behavior.
- [Phase 02-01]: timeout is per-fetch, 30000ms default ships enabled as a breaking change, timeout: 0/Infinity opt-out restores hang-forever.
- [Phase 02-04]: cacheTemplates defaults to true; cache wraps outermost above the timeout-wrapped loadTemplate loader.
- [Phase 03-01]: TemplateSanitizer captured once at construction, undefined means pass-through unchanged (zero-runtime-deps posture preserved).
- [Phase 04-01]: Mount-generation guard (closure-scoped) fixes last-navigation-wins; never module-level.
- [Phase 04-02]: normalizeAndValidateManifests() runs once in init() after loadManifests() — single choke point for route normalization, tier-uniform validation, and duplicate-route detection.
- [Phase 05-08]: Mechanical tsc-based doc snippet compile-check caught 2 real API-shape bugs eyeball review missed — mechanical verification against real types is strictly more reliable.

</details>

- [Phase 06-01]: Node floor raised to Node >=22 (not 20, since Node 20 is also EOL); engines + .npmrc engine-strict=true landed as one atomic commit since neither alone enforces the floor — engines alone is advisory-only under pnpm; engine-strict is the load-bearing mechanism (D-05/D-06)
- [Phase 06-01]: Migration note for the Node engines bump recommends Node 22.12+ or Node 24 specifically, not just Node 22, because Vite 8's own floor (^20.19.0 || >=22.12.0) is narrower than DxKit's >=22 — avoids a confusing two-stage failure where a contributor passes the engine-strict gate on Node 22.0-22.11 but then fails inside vitest/vite
- [Phase 06-02]: CI matrix set to [22, 24] (D-07) — Node 22 is the new floor (matches Phase 06-01 engines bump), Node 24 is current stable
- [Phase 06-03]: Re-verified tsup/vite/vitest/happy-dom target versions against the live npm registry at execution time (all matched RESEARCH.md exactly, no drift); happy-dom recorded as no-op verification (already latest, no bump/no commit)
- [Phase 06-03]: pnpm add -D reformats untouched package.json keys (engines collapsed to multi-line on every invocation) - reverted incidental formatting before each commit to keep diffs scoped to the actual devDependency bump
- [Phase 06-04]: Split the Biome bump into two commits (version bump, then reformat) per D-02 - 2.5.1->2.5.4 produced one narrow formatting diff (tests/lifecycle.test.ts, curried it.each call) exactly as RESEARCH.md Pitfall 3 predicted
- [Phase 06-04]: Verified the cz-git adapter swap via a non-interactive npx cz smoke run (no TTY in this environment) - confirmed the adapter resolves at node_modules/cz-git and renders the correct type-selection prompt, satisfying Pitfall 5's failure-mode check
- [Phase 06-05]: verify-outputs Makefile target reuses PLUGIN_BUILD_ORDER as the plugin directory list rather than a hardcoded list, keeping the check and the build target from drifting out of sync
- [Phase 06-06]: Tightened engines.node to ^22.12.0 || >=24.0.0 (exact intersection of vite@8.1.4 and vitest@4.1.10 pinned engine ranges) across all 5 package.json, closing CR-01; CI matrix pins exact-floor 22.12.0 leg (WR-02); verify-outputs wired into release/publish/CI (WR-01)
- [Phase 07-01]: DappEntry.overrides switched to DeepPartial<DappManifest> at declaration (src/types/shell.ts), resolving shell.test.ts's shallow-Partial<T> symptom at source rather than the call site
- [Phase ?]: wallet.test.ts Buffer-based hex assertion rewritten to TextEncoder + manual hex encoding (mirrors plugin's own dev-signer implementation) instead of adding @types/node — zero new devDependencies, browser-first posture
- [Phase ?]: theme.test.ts mock settings object was also missing getSections() (not in original RESEARCH catalog) — same shallow-mock root cause as cataloged errors, fixed at source per Rule 1
- [Phase ?]: [Phase 07-03]: typecheck kept standalone (not folded into test) so Phase 9's deprecation gate can call make typecheck directly; lint -> typecheck -> vitest ordering wired with no ci.yml edit needed
- [Phase ?]: typescript devDep range set to caret ^6.0.0 per D-08 (pnpm add wrote back ^6.0.3, manually corrected + resynced lockfile specifier)
- [Phase ?]: tsup 8.5.1's dts:true bundler unconditionally injects baseUrl (TS5101 under TS6); replaced with a direct tsc --emitDeclarationOnly pass via onSuccess across all 5 packages, zero ignoreDeprecations shims
- [Phase ?]: Landed verbatimModuleSyntax + erasableSyntaxOnly as one bisectable commit, isolatedDeclarations as its own commit; all three flags required zero source annotations, matching research prediction exactly
- [Phase ?]: Landed the smoke test infrastructure (Task 1) and Makefile/biome/CI wiring (Task 2) as two bisectable commits; used process.cwd()-relative dist/ path resolution mirroring tests/typecheck-config.test.ts; vm.runInContext against happy-dom Window (never the <script>-element path) verified working for all 5 packages including shared-window coexistence
- [Phase ?]: Named CI step 'Typecheck / deprecation gate (GATE-01)' inserted between make smoke and make test; make test's own typecheck prerequisite (D-05) left untouched — GATE-01 adds CI-level visibility without restructuring local dev wiring
- [Phase ?]: [Phase 09-03]: Skeleton copied from 09-RESEARCH.md Pattern 3 verbatim after re-fetching the live renovate-schema.json at execution time (Pitfall 3) — zero drift found, matchPackagePatterns confirmed fully removed from the schema
- [Phase ?]: [Phase 09-03]: renovate-config.test.ts guard mirrors typecheck-config.test.ts's raw-text + parsed-JSON assertion convention, no new devDependency added
- [Phase ?]: [Phase 09-04]: ROB-05 array guard emit is deliberately ungated by registryUrlExplicit (D-10/P2) — a wrong-shape 200 body is never an expected/benign state, so it must surface even on the default silent /registry.json probe
- [Phase ?]: [Phase 09-04]: Fix scoped entirely to loadManifests()'s res.json() call site; normalizeAndValidateManifests() left untouched as the single choke point for element-level manifest validation
- [Phase ?]: [Phase 09-02]: checkNoRuntimeDeps() is deliberately core-only and unconditional per revised D-08 — any dependencies/peerDependencies/optionalDependencies entry is a violation, no workspace-carveout logic needed since root package.json never declares workspace:* links
- [Phase ?]: [Phase 09-02]: CJS .cjs module loaded via createRequire(import.meta.url) in the new vitest test, reusing smoke/dist-exports.smoke.test.ts's pattern, requiring only a node:module addition to tests/node-builtins.d.ts instead of a new declaration file or @types/node
- [Phase ?]: [Phase 10-01]: coerceManifestArray() extends ROB-05's Array.isArray guard to dapps/manifests tiers - fail-closed on coerced === null (never .length), registry tierLabel is the fully-formed description string to preserve existing /custom-registry.json substring assertions
- [Phase ?]: [Phase 10-01]: Tier-asymmetric fallthrough preserved deliberately - dapps: [] falls through to next tier, manifests: [] stops without probing registryUrl; only the Array.isArray shape check is shared, emptiness semantics per-tier are untouched

</details>

### Pending Todos

None open. (WR-01 → ROB-05 Phase 9; CR-01 → ROB-06 Phase 10; WR-02/03 → Phase 3 — all resolved.)

### Blockers/Concerns

None carried from v1.1 (Phase 8/9 risks were retired by FCT-04 smoke test and the scoped GATE-01).

Open questions for the next milestone (on-chain / ERC-8244 candidate) — to resolve in a spike before tooling investment:

- Does Freedom browser (read-only preview) inject an EIP-1193 provider into `html()`-loaded pages? ERC-8244 forbids network URL fetches, so without `window.ethereum` there is no chain-load path.
- Iframe sandbox posture (`allow-same-origin` or opaque origin) — determines storage availability and whether `pushState` works (hash mode is the safe default).
- Full-document `html()` vs DxKit's fragment-into-`#dx-mount` model — fragment extraction + inline-`<script>` re-execution vs `srcdoc` iframe.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260712-wcu | Implement PR #3 self-review findings: hasPlugin guard, sanitizer timeout, wallet contract-violation error, cause preservation, hasOwn guard | 2026-07-13 | d349ca9 | [260712-wcu-implement-pr3-self-review-findings-haspl](./quick/260712-wcu-implement-pr3-self-review-findings-haspl/) |
| 260714-1lz | Fix stale mountDapp epilogue (subpath swallow/duplicate) and normalizeRoute trim from PR #4 review | 2026-07-14 | 17e863d | [260714-1lz-fix-stale-mountdapp-epilogue-subpath-swa](./quick/260714-1lz-fix-stale-mountdapp-epilogue-subpath-swa/) |

### Roadmap Evolution

- Phase 10 added: Close gap: CR-01 — guard dapps/inline manifests tiers (from v1.1 milestone audit)

## Deferred Items

Items acknowledged and carried forward:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Modernization | TS7.1 migration (TS7-01) | Deferred — awaiting stable TS 7.1 | v1.1 scoping (re-affirmed v1.1 close) |
| Build | tsup → tsdown migration (BUILD-01) | Deferred — pair with TS7 jump | v1.1 scoping (re-affirmed v1.1 close) |
| Security | Storage encryption for persisted state | Deferred | v1.0 close |
| Feature | New routing (wildcard / `:param`) | Deferred | v1.0 close |

## Session Continuity

Last session: 2026-08-16T22:30:00.000Z
Stopped at: v1.1 milestone closed and archived; 0.3.0 tagged (publish/push pending)
Resume file:
None

## Operator Next Steps

- `make publish` then `git push --follow-tags origin main` to release 0.3.0 (tag `v0.3.0` exists locally)
- v1.2 milestone started — continue with requirements → roadmap, then `/gsd-discuss-phase 11`

# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.2 — Beta Hardening

**Shipped:** 2026-07-15
**Phases:** 5 | **Plans:** 23 | **Tasks:** 51

### What Was Built
- **Diagnostics (Phase 1):** silent failures — missing `#dx-mount`, storage read/write errors, post-injection load failures — now surface via `dx:error`, with stale template DOM cleared instead of left behind.
- **Robustness (Phase 2):** per-fetch load timeout (30s default, true-abort) + custom-loader hang guard, router length-sort hoisted to construction, per-manager template cache, and settings-handler cleanup on dapp disable.
- **Security (Phase 3):** optional fail-closed `sanitizeTemplate` hook, configurable `storageKey` isolation across wallet/theme/settings, and the nested `ShellConfig.lifecycle` config group (breaking, D-04/05).
- **Testing (Phase 4):** mount-generation guard fixing last-navigation-wins, a dedicated `tests/stress.test.ts` proving the full concurrency matrix, and manifest/route edge-case + settings-cleanup regressions.
- **Documentation (Phase 5):** full truth pass — every framework/plugin doc + README verified against 0.2.0 code, AI slop removed, a new `docs/security.md` (CSP + DOMPurify + limitations), and a `tsc` compile-check of every doc snippet. 321 tests green.

### What Worked
- **Fixes-first ordering in the docs phase.** Landing the three folded code fixes (D-15/16/17) in Wave 1 before the doc sweep meant every doc described *final* behavior — no re-verification churn.
- **Mechanical compile-check harness** (`tsc --noEmit --strict` over extracted snippets) caught 2 real doc bugs a human read-through would likely have missed. Verification-by-execution beats verification-by-inspection for docs.
- **Adversarial verification caught real gaps.** The Phase 5 verifier found 3 genuine doc inaccuracies (README bundling claim, security.md storageKey, orphan TBD) *after* the executors reported clean — the independent goal-backward check earned its keep.
- **Ship gates did their job.** Both the docs and security ship gates blocked correctly on the first `/gsd-ship` attempt, forcing the SECURITY.md + DOCS.md markers before push.

### What Was Inefficient
- **Worktree isolation auto-degraded to sequential** (origin/HEAD unresolved, #683), so all 8 Phase 5 plans ran serially even where they touched disjoint docs. Setting `worktree.baseRef:"head"` up front would have allowed parallel doc verification.
- **The generic `/gsd-docs-update` generator was a poor fit** for a repo with a mature hand-written docs tree — it would have created duplicate uppercase canonical docs. The project's CLAUDE.md marker contract (verify-and-marker, not generate) had to override the default flow. Worth encoding this project-shape detection upstream.
- **Todos weren't auto-closed** because D-15/16/17 fixes lacked `resolves_phase` frontmatter — 4 resolved items surfaced at milestone-close audit and had to be closed by hand.

### Patterns Established
- **Project-specific ship gates** (docs marker + security threats_open) enforced via CLAUDE.md, blocking `/gsd-ship` exactly like the built-in gates.
- **"Code is truth" doc verification** with a per-doc drift log assembled into a canonical `DRIFT-LOG.md` as auditable requirement proof.
- **Fail-closed everywhere:** sanitizer failures, storage-key isolation, and the `ShellConfig.lifecycle` runtime throw for untyped consumers all fail loud, matching the milestone's "failures are visible, never silent" core value.

### Key Lessons
1. **Order code-before-docs within a documentation phase** when the same phase also lands behavior changes — otherwise docs verify against soon-to-change behavior.
2. **Tag todos with `resolves_phase`** at creation so milestone-close audits stay clean automatically.
3. **A mature docs tree needs verify-not-generate** — a generic doc generator is destructive against hand-written, well-structured docs; detect and branch.
4. **Independent goal-backward verification is not redundant** with executor self-checks — it caught 3 real gaps here.

### Cost Observations
- Model mix: orchestration on Opus (1M context); executors, verifier, reviewer, security auditor on Sonnet (auditor briefly Opus). Roughly Sonnet-dominant by agent count.
- Notable: sequential execution (worktrees degraded) traded wall-clock for simplicity; the compile-check harness was the highest-leverage single technique in the milestone.

---

## Milestone: v0.3 — TypeScript 6 Migration & Toolchain Modernization

**Shipped:** 2026-08-16 (released as 0.3.0)
**Phases:** 5 | **Plans:** 17 | **Tasks:** 32

### What Was Built
- **Toolchain (Phase 6):** Node floor raised to `^22.12.0 || >=24.0.0` with `.npmrc` engine-strict as the load-bearing enforcement (breaking, contributor-facing); CI matrix `[22.12.0, 24]`; tsup/vite 8/vitest/Biome bumped in bisectable commits; `cz-conventional-changelog` → `cz-git`; `make verify-outputs` asserting all 15 build artifacts.
- **TS6 (Phase 7):** standalone per-package `tsc --noEmit` (`make typecheck`) landed *before* the compiler bump; TypeScript 6.0.x with zero `ignoreDeprecations`; dts emission moved from tsup's bundler to `tsc --emitDeclarationOnly` to fix a real TS5101 break at source.
- **Forward-compat (Phase 8):** `verbatimModuleSyntax` + `isolatedDeclarations` + `erasableSyntaxOnly` on across all packages as a pure config flip with a flag-presence guard; `make smoke` exercises real `dist/` IIFE/CJS artifacts via `node:vm`.
- **Guardrails (Phase 9):** named blocking CI typecheck/deprecation gate (GATE-01), machine-enforced core zero-runtime-dep assertion (GATE-02), Renovate with blocked toolchain-major automerge (GATE-03), and the ROB-05 registry array-shape guard.
- **Gap closure (Phase 10):** ROB-06 extends the array guard to the `dapps`/inline `manifests` tiers via one `coerceManifestArray()` helper. 413 tests + 11 smoke specs green.

### What Worked
- **Baseline-before-bump sequencing.** Landing `tsc --noEmit` before the TS6 bump isolated the one real breakage (tsup's dts bundler injecting `baseUrl`) immediately, instead of it surfacing as an opaque build failure.
- **Bisectable dependency commits.** One `chore(deps):` commit per tool (and a separate `style:` reformat for Biome) made every regression trivially attributable; the milestone audit had nothing to untangle.
- **Research predictions held.** The forward-compat flags needed zero source annotations exactly as RESEARCH.md predicted; live re-verification of npm/Renovate schema at execution time found no drift.
- **Milestone audit → inserted gap phase.** The audit's CR-01 finding became Phase 10 via the standard chain rather than an ad-hoc fix, so the closure carries its own plan/verification/docs marker.

### What Was Inefficient
- **Gap-closure churn on the Node floor.** `>=22` shipped in 06-01, then had to be tightened to `^22.12.0 || >=24.0.0` in 06-06 once the pinned vite/vitest engine ranges were checked — the enforceable floor should have been computed as the intersection of tool engines up front.
- **STATE.md decision log lost phase attribution** for a run of entries (`[Phase ?]`) mid-milestone — the log stayed useful but the provenance had to be inferred from content.
- **Release/close-out lag.** Phase 10 merged 2026-07-19 but the milestone wasn't closed or released until 2026-08-16; the README/CLAUDE.md version strings had drifted two releases behind npm (0.1.5 vs 0.2.1) and were only caught at close-out.
- **Summary one-liner extraction is fragile** — one SUMMARY.md one-liner truncated at a parenthesis in the auto-generated MILESTONES.md entry and needed a manual fix.

### Patterns Established
- **Every quality promise gets a machine gate**: build outputs (`verify-outputs`), artifacts (`smoke`), types (`typecheck`), zero deps (`verify-no-runtime-deps`) — all wired into `make release`/`publish`/CI, each with a guard test that fails if the wiring is removed.
- **Fix at source, never shim** — TS6 deprecations resolved by changing how dts is emitted rather than `ignoreDeprecations`.
- **Fail-closed shape guards at every input tier** through a single shared helper (ROB-05/06), matching v0.2's visible-failure throughline.

### Key Lessons
1. **Compute an enforceable floor from tool engine ranges before declaring it** — a declared floor looser than what the pinned tools accept produces a confusing two-stage failure.
2. **Close and release milestones promptly** — the longer the gap, the more version/doc drift accumulates and the harder the retrospective is to reconstruct.
3. **Guard tests for CI/Makefile wiring are cheap and durable** — regex/JSON assertions on `ci.yml`, `Makefile`, `renovate.json`, `tsconfig.json` caught nothing this milestone precisely because they exist; keep adding them.
4. **A dev-toolchain `BREAKING CHANGE` still warrants a minor bump** even when the runtime API is untouched — hence 0.3.0, not 0.2.2.

### Cost Observations
- Model mix: orchestration on Opus/Fable; executors, verifiers, reviewers predominantly Sonnet (adaptive profile). Sonnet-dominant by agent count.
- Notable: the milestone was almost entirely config/tooling — low LOC churn in `src/` (net −29 source lines) but +17k lines across 135 files including planning artifacts and lockfile; the highest-leverage single technique was the `node:vm` artifact smoke test, which turned an unexercised output format into a gated one.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.2 Beta Hardening | 5 | 23 | First milestone; established fixes-first doc ordering, compile-checked docs, and project-specific ship gates |
| v0.3 TS6 & Toolchain | 5 | 17 | Baseline-before-bump sequencing; every quality promise gets a machine gate + wiring guard test; audit-driven inserted gap phase |

### Cumulative Quality

| Milestone | Tests | Source LOC | Zero-Dep Maintained |
|-----------|-------|------------|---------------------|
| v0.2 Beta Hardening | 321 | ~2,986 | Yes |
| v0.3 TS6 & Toolchain | 413 (+11 smoke) | ~2,957 | Yes — now machine-enforced (GATE-02) |

### Top Lessons (Verified Across Milestones)

1. Verification-by-execution (compile-checks, stress suites) beats verification-by-inspection.
2. Fail-closed, visible-failure design is the throughline — worth defending in every phase.
3. Land the measuring instrument (typecheck baseline, artifact smoke) *before* the change it's meant to measure.
4. Close and release promptly after the last phase merges — drift compounds in the gap.

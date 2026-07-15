# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Beta Hardening

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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 Beta Hardening | 5 | 23 | First milestone; established fixes-first doc ordering, compile-checked docs, and project-specific ship gates |

### Cumulative Quality

| Milestone | Tests | Source LOC | Zero-Dep Maintained |
|-----------|-------|------------|---------------------|
| v1.0 Beta Hardening | 321 | ~2,986 | Yes |

### Top Lessons (Verified Across Milestones)

1. Verification-by-execution (compile-checks, stress suites) beats verification-by-inspection.
2. Fail-closed, visible-failure design is the throughline — worth defending in every phase.

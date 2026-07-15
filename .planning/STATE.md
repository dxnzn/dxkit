---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: TypeScript 6 Migration & Toolchain Modernization
current_phase: 06
current_phase_name: toolchain-audit-modernization
status: executing
stopped_at: Completed 06-01-PLAN.md
last_updated: "2026-07-15T16:48:31.761Z"
last_activity: 2026-07-15
last_activity_desc: Phase 06 execution started
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 5
  completed_plans: 2
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-15)

**Core value:** DxKit stays trustworthy for real use — failures are visible (never silent), documented behavior matches actual behavior, and the alpha is stable enough to build on with confidence.
**Current focus:** Phase 06 — toolchain-audit-modernization

## Current Position

Phase: 06 (toolchain-audit-modernization) — EXECUTING
Plan: 3 of 5
Status: Ready to execute
Last activity: 2026-07-15 — Phase 06 execution started

## Milestone Phase Map (v1.1)

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

## Performance Metrics

**Velocity:**

- Total plans completed: 23 (v1.0)
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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

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

### Pending Todos

WR-01 is now scheduled as ROB-05 in Phase 9 (v1.1). The remaining Phase-1 code-review todos below
were resolved in v1.0 Phase 3 (SEC-02):

- ~~WR-01 — surface `loadDappManifest` fetch/parse failures~~ → scheduled as **ROB-05 / Phase 9**
- ~~WR-02 — wallet connect empty-accounts yields `undefined` address~~ → resolved Phase 3 (SEC-02)
- ~~WR-03 — surface wallet auto-reconnect failure on init~~ → resolved Phase 3 (SEC-02)

### Blockers/Concerns

- Phase 8 (Forward-Compat Typing): the IIFE/CJS build boundary is the real risk surface for
  `verbatimModuleSyntax` / `isolatedDeclarations`, and it is the one output format neither `tsc` nor
  the current vitest suite exercises. FCT-04's artifact smoke test must be treated as a required gate,
  not optional (research Pitfalls 4 & 7).

- Phase 9 (Guardrails): the CI deprecation gate must be scoped to `src/`/`plugins/*/src/` only — a gate
  that also fails on transitive `node_modules/` deprecation noise is unfixable-red and gets disabled
  (research Pitfall 6). Renovate must ship with scope rules (no automerge on tool majors) from day one.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260712-wcu | Implement PR #3 self-review findings: hasPlugin guard, sanitizer timeout, wallet contract-violation error, cause preservation, hasOwn guard | 2026-07-13 | d349ca9 | [260712-wcu-implement-pr3-self-review-findings-haspl](./quick/260712-wcu-implement-pr3-self-review-findings-haspl/) |
| 260714-1lz | Fix stale mountDapp epilogue (subpath swallow/duplicate) and normalizeRoute trim from PR #4 review | 2026-07-14 | 17e863d | [260714-1lz-fix-stale-mountdapp-epilogue-subpath-swa](./quick/260714-1lz-fix-stale-mountdapp-epilogue-subpath-swa/) |

## Deferred Items

Items acknowledged and carried forward:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Modernization | TS7.1 migration (TS7-01) | Deferred to v2 | v1.1 scoping |
| Build | tsup → tsdown migration (BUILD-01) | Deferred to v2 | v1.1 scoping |
| Security | Storage encryption for persisted state | Deferred | v1.0 close |
| Feature | New routing (wildcard / `:param`) | Deferred | v1.0 close |

## Session Continuity

Last session: 2026-07-15T16:47:52.740Z
Stopped at: Completed 06-01-PLAN.md
Resume file:
None

## Operator Next Steps

- Plan Phase 6 (Toolchain Audit & Modernization) with `/gsd-plan-phase 6`.
- Phases execute in order 6 → 7 → 8 → 9. Do not start flag work (Phase 8) or the deprecation gate
  (Phase 9) before the `tsc --noEmit` baseline lands in Phase 7.

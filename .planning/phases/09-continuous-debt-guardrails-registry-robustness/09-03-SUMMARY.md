---
phase: 09-continuous-debt-guardrails-registry-robustness
plan: 03
subsystem: infra
tags: [renovate, dependency-automation, supply-chain, pnpm-workspace]

requires:
  - phase: 06-toolchain-audit-modernization
    provides: "The six toolchain devDependencies at their current pinned versions (tsup ^8.5.1, vite ^8.1.4, vitest ^4.1.10, happy-dom ^20.10.6, @biomejs/biome ^2.5.4, typescript ^6.0.0) that this plan's toolchain group names exactly"
provides:
  - "renovate.json (repo root) — GATE-03 config: config:recommended, minimumReleaseAge 3 days, toolchain packageRules group with always-blocked-major automerge, non-major devDep automerge, weekly object-shaped lockFileMaintenance"
  - "tests/renovate-config.test.ts — durable guard locking D-01..D-04 invariants and the P5 deprecated-key prohibitions"
affects: [dependency-freshness-automation, supply-chain-posture]

tech-stack:
  added: []
  patterns: ["Live-schema re-verification at execution time (Pitfall 3): fetched docs.renovatebot.com/renovate-schema.json directly and confirmed matchPackagePatterns is fully removed, matchPackageNames/minimumReleaseAge/lockFileMaintenance shapes match the plan's skeleton exactly — zero drift found"]

key-files:
  created:
    - renovate.json
    - tests/renovate-config.test.ts
  modified: []

key-decisions:
  - "Skeleton copied from 09-RESEARCH.md Pattern 3 verbatim after re-checking the live renovate-schema.json — no adjustments needed, confirming the research's schema facts held at execution time"
  - "Guard test mirrors tests/typecheck-config.test.ts's raw-text + parsed-JSON assertion style (no @types/node, zero new devDependency) for consistency with the existing config-guard convention"

patterns-established:
  - "renovate.json invariant guard: parses the config once per test, asserts each D-01..D-04 shape independently (extends, minimumReleaseAge, lockFileMaintenance object, toolchain packageRules group, non-major automerge exclusion), plus raw-text regex checks for the P5 deprecated tokens (config:base, matchPackagePatterns, boolean lockFileMaintenance) so reintroduction fails the suite immediately"

requirements-completed: [GATE-03]

coverage:
  - id: D1
    description: "renovate.json extends config:recommended, gates on a 3-day minimumReleaseAge, and expresses lockFileMaintenance as an object (not boolean) — D-01, D-03, D-04"
    requirement: "GATE-03"
    verification:
      - kind: unit
        ref: "tests/renovate-config.test.ts#renovate.json invariants (GATE-03 guard) > extends should include config:recommended (D-01)"
        status: pass
      - kind: unit
        ref: "tests/renovate-config.test.ts#renovate.json invariants (GATE-03 guard) > minimumReleaseAge should be exactly \"3 days\" (D-03)"
        status: pass
      - kind: unit
        ref: "tests/renovate-config.test.ts#renovate.json invariants (GATE-03 guard) > lockFileMaintenance should be an object (not boolean) with enabled: true (D-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The toolchain group (tsup, vite, vitest, happy-dom, @biomejs/biome, typescript) always blocks automerge, including majors — D-02"
    requirement: "GATE-03"
    verification:
      - kind: unit
        ref: "tests/renovate-config.test.ts#toolchain packageRules group (D-02: always-blocked majors) > should have at least one packageRules entry naming all six toolchain packages with automerge: false"
        status: pass
      - kind: unit
        ref: "tests/renovate-config.test.ts#toolchain packageRules group (D-02: always-blocked majors) > should always block major toolchain bumps regardless of the general devDep major rule"
        status: pass
      - kind: unit
        ref: "tests/renovate-config.test.ts#toolchain packageRules group (D-02: always-blocked majors) > should not drop any toolchain package from the always-blocked group"
        status: pass
    human_judgment: false
  - id: D3
    description: "Non-major (patch/minor) devDependencies outside the toolchain group automerge after gating (D-02); deprecated config:base/matchPackagePatterns/boolean-lockFileMaintenance never appear (P5)"
    requirement: "GATE-03"
    verification:
      - kind: unit
        ref: "tests/renovate-config.test.ts#renovate.json invariants (GATE-03 guard) > non-major devDependency patch/minor bumps should automerge, excluding toolchain packages"
        status: pass
      - kind: unit
        ref: "tests/renovate-config.test.ts#renovate.json invariants (GATE-03 guard) > should not contain deprecated config:base or matchPackagePatterns tokens (P5)"
        status: pass
      - kind: unit
        ref: "tests/renovate-config.test.ts#renovate.json invariants (GATE-03 guard) > should not encode lockFileMaintenance as a boolean literal (P5)"
        status: pass
      - kind: other
        ref: "Fetched live https://docs.renovatebot.com/renovate-schema.json at execution time and confirmed matchPackagePatterns is absent from the schema definitions, minimumReleaseAge is string-typed, lockFileMaintenance is object-typed — matches the plan skeleton with zero drift"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-18
status: complete
---

# Phase 09 Plan 03: GATE-03 Renovate Dependency-Freshness Automation Summary

**Committed `renovate.json` (config:recommended, 3-day minimumReleaseAge, toolchain-group always-blocked-major automerge, weekly object-shaped lockFileMaintenance) plus a durable invariant guard test, re-verified against the live Renovate schema at execution time.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-18T06:06:00Z
- **Completed:** 2026-07-18T06:06:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `renovate.json` at the repo root expresses D-01 (hosted Mend Renovate GitHub App consumes this config), D-02 (toolchain group + explicit major rule both set `automerge: false`, non-major devDeps outside the toolchain group automerge via PR), D-03 (`minimumReleaseAge: "3 days"`), and D-04 (weekly object-shaped `lockFileMaintenance`, not a boolean).
- Re-fetched the live `renovate-schema.json` from docs.renovatebot.com before finalizing (Pitfall 3) — confirmed `matchPackagePatterns` is fully absent from the current schema definitions, `minimumReleaseAge` is string-typed, and `lockFileMaintenance` is object-typed. The 09-RESEARCH.md Pattern 3 skeleton needed zero adjustments; research and live schema matched exactly.
- `tests/renovate-config.test.ts` (10 specs) locks every load-bearing invariant: `extends` includes `config:recommended`, `minimumReleaseAge` is exactly `"3 days"`, `lockFileMaintenance` is an object with `enabled: true`, the toolchain group names all six packages with `automerge: false` (both the general-group rule and the explicit major-only rule), the non-major automerge rule excludes the toolchain group, and the deprecated `config:base`/`matchPackagePatterns`/boolean-`lockFileMaintenance` tokens never reappear.
- Full suite (389 specs across 14 files) and `make typecheck`-equivalent `tsc --noEmit -p tsconfig.typecheck.json` both stay green; `biome check .` clean across the whole repo.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author renovate.json (D-01..D-04)** - `4c83d77` (feat)
2. **Task 2: Guard test for renovate.json invariants** - `8ce96a8` (test)

## Files Created/Modified
- `renovate.json` - New repo-root config: `config:recommended` extends, `minimumReleaseAge: "3 days"`, 4-rule `packageRules` array (toolchain group, toolchain-major reinforcement, non-major devDep automerge with toolchain exclusion, major devDep block), object-shaped `lockFileMaintenance`
- `tests/renovate-config.test.ts` - New guard test file (10 specs) locking the config's D-01..D-04 invariants and P5 deprecated-key prohibitions

## Decisions Made
- Copied the RESEARCH.md Pattern 3 skeleton verbatim after independently re-fetching and diffing against the live schema — no discretion calls needed beyond what CONTEXT.md/RESEARCH.md already resolved (D-01..D-04 were all explicit).
- Guard test follows the existing `tests/typecheck-config.test.ts` convention (raw-text regex + parsed-JSON assertions, no `@types/node`) rather than introducing a new testing pattern, keeping the config-guard style consistent across the repo.

## Deviations from Plan

None — plan executed exactly as written. The live-schema re-verification called for by Pitfall 3 (task `<read_first>` and `<action>` both flag it) confirmed the skeleton needed zero changes.

## Issues Encountered

None. `npx renovate-config-validator` was considered per the plan's optional note but skipped — it would require an `npx --yes` install of a package not already in the toolchain, and the direct-schema-fetch re-verification already satisfied Pitfall 3's intent without adding any dependency surface (consistent with P4).

## Operator Next Steps

- **Install the Mend Renovate GitHub App** on the `dxkit` repo/org (https://github.com/apps/renovate → Configure → select `dxkit`). Committing `renovate.json` does not make automation live — the hosted app must be installed before any Renovate PRs will appear (D-01, recorded in the plan's `user_setup` block).

## Next Phase Readiness
- GATE-03 config is committed and guard-tested; automation goes live once the operator completes the Mend App install above.
- No shared files with 09-01 (GATE-01) or 09-02 (GATE-02/ROB-05) — this plan's two files (`renovate.json`, `tests/renovate-config.test.ts`) are net-new and don't intersect with the other Phase 9 plans' `files_modified` lists.

---
*Phase: 09-continuous-debt-guardrails-registry-robustness*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: renovate.json
- FOUND: tests/renovate-config.test.ts
- FOUND: .planning/phases/09-continuous-debt-guardrails-registry-robustness/09-03-SUMMARY.md
- FOUND commit: 4c83d77
- FOUND commit: 8ce96a8

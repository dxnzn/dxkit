---
phase: 06-toolchain-audit-modernization
plan: 01
subsystem: infra
tags: [pnpm, engines, engine-strict, node22, toolchain]

requires: []
provides:
  - "Enforced Node >=22 floor across root + 4 plugin package.json (byte-identical engines string)"
  - "Root .npmrc with engine-strict=true (load-bearing enforcement of the engines field)"
  - "Documented expected old-Node install-failure evidence for TOOL-01"
affects: [07-typescript-6-migration, 08-forward-compat-typing, 09-continuous-debt-guardrails]

tech-stack:
  added: []
  patterns:
    - "engine-strict + engines pairing: engines alone is advisory-only under pnpm; .npmrc engine-strict=true is what turns it into a hard install failure — always land both in one atomic commit"
    - "Lockstep engines string (D-05): root + all 4 plugin package.json carry byte-identical `\"node\": \">=22\"` to avoid range drift between core and plugins"

key-files:
  created:
    - .npmrc
  modified:
    - package.json
    - plugins/auth/package.json
    - plugins/wallet/package.json
    - plugins/theme/package.json
    - plugins/settings/package.json

key-decisions:
  - "Node floor raised to >=22 (not 20) since Node 20 is also EOL per Phase 6 research"
  - "engines + engine-strict treated as one atomic commit/unit — neither proves the floor alone (D-06)"
  - "Migration note calls out Node 22.12+ or Node 24 specifically, not just \"22\", because Vite 8's own floor (^20.19.0 || >=22.12.0) is narrower than this workspace's >=22 and would otherwise produce a confusing two-stage failure"
  - "No Node 18/20 runtime available in this sandbox (no nvm/fnm/Volta, no Docker) — verbatim ERR_PNPM_UNSUPPORTED_ENGINE output could not be captured this session; the mechanism-level expectation is documented instead, per D-06's allowance for a documented (not CI-enforced) check"

patterns-established:
  - "Per-tool/per-mechanism atomic commit: Node-floor engines+engine-strict landed as a single feat! commit distinct from later devDependency version bumps (D-02 style isolation)"

requirements-completed: [TOOL-01]

coverage:
  - id: D1
    description: "All five package.json (root + auth/wallet/theme/settings) declare identical engines.node >=22"
    requirement: "TOOL-01"
    verification:
      - kind: other
        ref: "test $(grep -rl '\"node\": \">=22\"' package.json plugins/*/package.json | wc -l) -eq 5"
        status: pass
    human_judgment: false
  - id: D2
    description: "Root .npmrc created with engine-strict=true, converting the advisory engines field into a hard install failure"
    requirement: "TOOL-01"
    verification:
      - kind: other
        ref: "test -f .npmrc && grep -q 'engine-strict=true' .npmrc"
        status: pass
    human_judgment: false
  - id: D3
    description: "Verbatim old-Node (18/20) pnpm install failure output demonstrating engine-strict actually blocks the install"
    verification: []
    human_judgment: true
    rationale: "No Node 18/20 runtime was reachable in this execution environment (no nvm/fnm/Volta, no Docker) — the negative-install check could not be run this session. Per D-06 this is a documented/manual check, not a CI job; capturing the real error text is deferred to whoever next runs pnpm install on old Node, or to the eventual TOOL-02 CI matrix change in a later phase."

duration: 6min
completed: 2026-07-15
status: complete
---

# Phase 6 Plan 1: Node Engines Floor & Engine-Strict Enforcement Summary

**Raised the Node floor to >=22 across all five package.json (root + auth/wallet/theme/settings) with a new root .npmrc engine-strict=true as the load-bearing enforcement mechanism, shipped as a single breaking-change commit.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-15T16:35:00Z
- **Completed:** 2026-07-15T16:41:39Z
- **Tasks:** 2
- **Files modified:** 6 (5 package.json + 1 new .npmrc)

## Accomplishments
- Added `engines: { "node": ">=22" }`, byte-identical across all five package.json files (root + auth/wallet/theme/settings), satisfying the D-05 lockstep requirement.
- Created root `.npmrc` with `engine-strict=true` (plus a one-line explanatory comment) — the mechanism that actually converts the advisory `engines` field into a hard `pnpm install` failure on the wrong Node version.
- Ran `pnpm install` on the current Node 22.22.1 shell to confirm the lockfile still resolves cleanly on the new floor — it does, no resolution changes, `Already up to date`.
- Committed as a single `feat!:` breaking change with a `BREAKING CHANGE:` footer and a migration note that specifically recommends Node 22.12+ or Node 24 (not just "Node 22"), flagging Vite 8's narrower `^20.19.0 || >=22.12.0` sub-range as a known gotcha (RESEARCH Pitfall 2).
- Documented (Task 2) the expected old-Node install-failure evidence for TOOL-01, recording the environment constraint that prevented capturing the verbatim error text this session.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add engines floor to all five package.json (lockstep) and create .npmrc** - `4ce06ff` (feat!)
2. **Task 2: Document the expected engine-strict install failure** - no code commit; documentation-only, evidence recorded below in this SUMMARY (per the task's own scope: "no new source files are written")

**Plan metadata:** commit to follow (docs: complete plan)

## Files Created/Modified
- `.npmrc` - new root file; `engine-strict=true` with a one-line comment explaining it converts the advisory `engines` field into a hard install failure
- `package.json` - added `"engines": { "node": ">=22" }` after `packageManager`
- `plugins/auth/package.json` - added identical `engines` key after `homepage`
- `plugins/wallet/package.json` - added identical `engines` key after `homepage`
- `plugins/theme/package.json` - added identical `engines` key after `homepage`
- `plugins/settings/package.json` - added identical `engines` key after `homepage`

## Decisions Made
- Node floor set to `>=22` (open upper bound), not a narrower pinned range — matches D-05/D-06 research and keeps the range simple; the Vite 8 sub-range gotcha is handled via documentation (migration note) rather than by narrowing DxKit's own `engines` string.
- `engines` and `.npmrc engine-strict=true` landed in the same commit — treating them as one atomic unit per RESEARCH Pattern 2/Pitfall 1 (adding `engines` alone would silently not enforce anything).
- No unrelated keys (`scripts`, `exports`, `devDependencies`, `version`, `pnpm.overrides`) were touched in this task, per the plan's explicit scope boundary — those are addressed in later 06-0x plans (tool version bumps, cz-git swap).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Task 2 — no old-Node runtime available for verbatim failure capture.** The RESEARCH.md Environment Availability table already flagged this risk (no Node 18/20 runtime in the sandbox). This session additionally confirmed no `nvm`, `fnm`, or Docker are available in this environment either, so the throwaway-container fallback RESEARCH suggested was also unavailable. Per the plan's own Task 2 instructions ("If no old-Node runtime is available in the execution environment, record that constraint explicitly and note the mechanism-level expectation... deferring the verbatim capture to whoever runs it on old Node"), this is handled as documented evidence (see `coverage` D3 above and the "Documented old-Node failure evidence" section below) rather than a blocker — D-06 explicitly scopes TOOL-01's negative check as a manual/documented check, not a CI job, this phase.

### Documented old-Node failure evidence (TOOL-01, D-06)

- **Environment constraint:** No Node 18/20 runtime was reachable in this execution environment (checked: `nvm`, `fnm`, Docker — none installed; current shell is Node v22.22.1, pnpm 10.32.1).
- **Mechanism-level expectation (documented, not verbatim-captured this session):** With `.npmrc engine-strict=true` and `engines: { "node": ">=22" }` in place, running `pnpm install` on Node 18 or Node 20 is expected to fail fast with pnpm's `ERR_PNPM_UNSUPPORTED_ENGINE` error family, reporting `Expected version: >=22` against the actual `Got: <old-version>` — per pnpm's own documentation that `engines.node` is advisory-only ("will only produce warnings") unless `engineStrict`/`engine-strict` is set (`[CITED: pnpm.io/package_json]`, RESEARCH.md Pattern 2 / Pitfall 1).
- **Verbatim capture deferred:** The exact error text (RESEARCH Open Question 2) should be captured by whoever next runs `pnpm install` on an actual Node 18/20 environment (e.g. via `nvm use 20 && pnpm install`), or folded into the TOOL-02 CI-matrix change in a later 06-0x plan, which will exercise Node 22/24 in CI and could add a documented negative-check note alongside it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TOOL-01 satisfied: all five package.json enforce Node >=22 via engine-strict; the mechanism is documented and verified to still allow a clean install on the current Node 22 shell.
- Later 06-0x plans in this phase (tool version bumps: tsup/vite/vitest/Biome; cz-git swap; CI matrix bump to Node 22/24) can proceed without conflict — this plan intentionally left `devDependencies`, `scripts`, and the CI workflow untouched.
- No blockers for Plan 06-02 or later plans in this phase.

---
*Phase: 06-toolchain-audit-modernization*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 7 files verified present on disk; commit `4ce06ff` verified in git log.

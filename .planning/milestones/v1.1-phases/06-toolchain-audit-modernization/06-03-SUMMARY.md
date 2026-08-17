---
phase: 06-toolchain-audit-modernization
plan: 03
subsystem: infra
tags: [tsup, vite, vitest, happy-dom, devdeps, toolchain]

requires:
  - phase: 06-toolchain-audit-modernization plan 01
    provides: "Node >=22 engines floor + engine-strict enforcement (Vite 8's own Node floor is narrower than DxKit's, so the Phase 06-01 floor had to land first)"
provides:
  - "tsup bumped 8.4.0 -> 8.5.1 (routine patch, all 3 output formats verified via make build)"
  - "vite bumped 7.3.6 -> 8.1.4 (major version jump, isolated commit, full 321-spec suite green)"
  - "vitest bumped 4.1.9 -> 4.1.10 (routine patch, vitest 5 beta intentionally not used)"
  - "happy-dom confirmed already at latest published version (20.10.6, no-op verification, no commit)"
affects: [07-typescript-6-migration, 08-forward-compat-typing]

tech-stack:
  added: []
  patterns:
    - "Per-tool isolated bisectable commit (D-02): bump one devDependency, run the acceptance gate (make build && make test, or make test alone), commit before touching the next tool — applied identically to tsup, vite, vitest"
    - "pnpm add -D <pkg>@^<version> -w reformats untouched package.json keys (observed: engines collapsed from single-line to multi-line on every pnpm add invocation this session) — always diff package.json after each bump and revert incidental formatting drift on out-of-scope keys before committing, to keep each commit's diff scoped to its actual change"

key-files:
  created: []
  modified:
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Re-verified all four target versions against the live npm registry at execution time before bumping (tsup 8.5.1, vite 8.1.4, vitest 4.1.10, happy-dom 20.10.6) — all matched RESEARCH.md's targets exactly, no re-scoping needed"
  - "happy-dom confirmed already latest (20.10.6) — recorded as a no-op verification per the plan's own instruction, no bump/no commit"
  - "vitest.config.ts confirmed to have zero build-level Vite keys both before and after the Vite 8 bump (grep for rollupOptions/rolldownOptions/cssMinify/commonjsOptions/build. returned nothing both times) — no config edits made, per RESEARCH Pitfall 4"

requirements-completed: [TOOL-03]

coverage:
  - id: D1
    description: "tsup bumped to 8.5.1 in its own bisectable commit; make build (all 5 packages x 3 output formats) and make test (321 specs) both green"
    requirement: "TOOL-03"
    verification:
      - kind: integration
        ref: "make build && make test (executed this session, all green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "vite bumped 7.3.6 -> 8.1.4 (the phase's one real major-version risk) in its own isolated commit; vitest.config.ts confirmed unchanged (no build-shape keys); full 321-spec suite green"
    requirement: "TOOL-03"
    verification:
      - kind: integration
        ref: "make test (321/321 passing on vite 8.1.4); grep -nE 'rollupOptions|rolldownOptions|cssMinify|commonjsOptions|build\\.' vitest.config.ts (zero matches before and after)"
        status: pass
    human_judgment: false
  - id: D3
    description: "vitest bumped 4.1.9 -> 4.1.10 in its own commit (vitest 5 beta intentionally not used); happy-dom confirmed already at latest (20.10.6, no-op, no commit)"
    requirement: "TOOL-03"
    verification:
      - kind: integration
        ref: "make test (321/321 passing on vitest 4.1.10); npm view happy-dom version (20.10.6, matches installed devDependency)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-15
status: complete
---

# Phase 6 Plan 3: Core Build/Test Toolchain Bump (tsup, vite, vitest, happy-dom) Summary

**Bumped tsup 8.4.0->8.5.1, vite 7.3.6->8.1.4 (Rolldown-based major, isolated commit), and vitest 4.1.9->4.1.10, each its own bisectable `chore(deps):` commit, with happy-dom confirmed already at latest (20.10.6, no-op) — full 321-spec suite green throughout.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-15T16:49:00Z
- **Completed:** 2026-07-15T16:51:32Z
- **Tasks:** 3
- **Files modified:** 2 (package.json, pnpm-lock.yaml — touched across all three bump commits)

## Accomplishments
- Re-confirmed all four target versions against the live npm registry at execution time (`npm view <pkg> version`) before bumping — tsup 8.5.1, vite 8.1.4, vitest 4.1.10, happy-dom 20.10.6, all matching RESEARCH.md's targets exactly with no drift since the research session.
- tsup bumped to 8.5.1; `make build` ran clean across all 5 packages (root + auth/wallet/theme/settings), each producing ESM/CJS/IIFE + `.d.ts`/`.d.cts` outputs with no errors, and `make test` (biome + 321 vitest specs) passed.
- Vite bumped 7.3.6 -> 8.1.4 in its own isolated commit per D-02, since this is the phase's one genuine major-version risk (Rolldown-based bundler internals by default). Confirmed via `grep` both before and after the bump that `vitest.config.ts` contains none of the build-shape keys (`rollupOptions`, `rolldownOptions`, `cssMinify`, `commonjsOptions`, any `build.*` key) that Vite 8 migration guides warn about — this repo's only Vite consumer sets just `test` and `resolve.alias`, so zero config edits were needed. Full 321-spec suite green on the new major.
- vitest bumped 4.1.9 -> 4.1.10 (routine patch within major 4; vitest 5 exists only as a `beta` dist-tag and was correctly not used). `make test` green.
- happy-dom checked against the registry and confirmed already at the latest published version (20.10.6, matching the installed devDependency) — recorded as a no-op verification with no bump and no commit, per the plan's explicit instruction for this case.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bump tsup to latest (isolated commit)** - `6d0feb5` (chore(deps))
2. **Task 2: Bump vite 7->8 in isolation (the one real major-version risk)** - `f659f29` (chore(deps))
3. **Task 3: Bump vitest and confirm happy-dom is already latest** - `5aec431` (chore(deps)); happy-dom no-op, no commit

**Plan metadata:** commit to follow (docs: complete plan)

## Files Created/Modified
- `package.json` - devDependency version bumps: `tsup` ^8.4.0->^8.5.1, `vite` ^7.3.6->^8.1.4, `vitest` ^4.1.9->^4.1.10 (each landed in its own commit); `happy-dom` left at ^20.10.6 (already latest)
- `pnpm-lock.yaml` - regenerated once per `pnpm add -D <pkg>@^<version> -w` invocation, matching each devDependency bump

## Decisions Made
- Followed D-02's per-tool isolated-commit discipline exactly: bump -> acceptance gate (`make build && make test` for tsup since it owns build outputs; `make test` alone for vite and vitest) -> commit, before touching the next tool.
- Did not add a no-op commit for happy-dom — the plan explicitly allows recording the no-op verification in the SUMMARY instead of committing when the registry check confirms no version change is needed.
- Kept caret (`^`) ranges throughout (D-03) — no switch to exact pins.
- Left `typescript` untouched at `^5.8.3` (D-04) — not in this plan's scope.

## Deviations from Plan

None - plan executed exactly as written. One minor incidental-formatting correction was made (not a deviation from plan intent, just keeping each commit's diff scoped):

**Incidental formatting side-effect from `pnpm add`:** Each of the three `pnpm add -D <pkg>@^<version> -w` invocations reformatted the untouched `"engines": { "node": ">=22" }` key from single-line to multi-line (pnpm's own JSON writer normalizing whitespace on any write to `package.json`). Since `engines` is out of scope for this plan (owned by Phase 06-01) and the reformat was purely cosmetic pnpm behavior with no semantic change, it was reverted back to single-line before each commit to keep every commit's diff scoped strictly to the devDependency version bump it claims to make. This is standard commit hygiene, not a Rule 1-4 deviation — no behavior, correctness, or scope was affected.

## Issues Encountered

None. All three bumps applied cleanly with zero config-shape fallout, matching RESEARCH.md's prediction that this repo's `vitest.config.ts` has no `build` key for the Vite 8 Rolldown rename to touch.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TOOL-03 satisfied for the core build/test toolchain: tsup, vite, vitest all on current TS6-compatible versions; happy-dom confirmed already latest. Full 321-spec suite green after every bump.
- Remaining Phase 6 scope (Biome bump, cz-git swap, TOOL-05 build-output existence check) is out of this plan's scope and lands in subsequent 06-0x plans.
- No blockers for later 06-0x plans or for Phase 7 (TypeScript 6 Migration), which depends on this phase's tool versions imposing no TS6 ceiling — confirmed by RESEARCH.md's peer-dependency table (none of tsup/vite/vitest/happy-dom carry a TypeScript upper bound).

---
*Phase: 06-toolchain-audit-modernization*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 3 task commits verified present in git log (6d0feb5, f659f29, 5aec431); package.json
verified to contain tsup ^8.5.1, vite ^8.1.4, vitest ^4.1.10; SUMMARY.md verified present
on disk.

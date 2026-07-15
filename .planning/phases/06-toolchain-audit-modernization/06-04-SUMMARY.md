---
phase: 06-toolchain-audit-modernization
plan: 04
subsystem: infra
tags: [biome, cz-git, commitizen, devdeps, toolchain, lint]

requires:
  - phase: 06-toolchain-audit-modernization plan 03
    provides: "Core build/test toolchain already bumped (tsup, vite, vitest, happy-dom) — this plan finishes the lint/commit side"
provides:
  - "Biome bumped 2.5.1 -> 2.5.4 (routine patch within major 2.x, no 3.x published); biome.json $schema bumped in lockstep; one narrow formatting diff isolated to its own style: commit"
  - "cz-conventional-changelog (unmaintained ~6 years) replaced with cz-git 1.13.1 at 1:1 parity; config.commitizen.path repointed to the node_modules-resolved path"
affects: [07-typescript-6-migration]

tech-stack:
  added: ["cz-git@^1.13.1 (devDependency, commitizen adapter)"]
  patterns:
    - "Version-bump commit vs. reformat commit split (D-02): when a Biome bump changes formatting behavior, commit the devDependency/schema bump first (verified to touch zero source files), then separately run biome check --write and commit any resulting reformat as its own style: commit — keeps bisectable history clean"
    - "commitizen resolves config.commitizen.path at runtime; use the node_modules-resolved path (node_modules/cz-git) rather than the bare package name, and always pnpm install after both remove+add before trusting the swap"

key-files:
  created: []
  modified:
    - package.json
    - biome.json
    - pnpm-lock.yaml
    - tests/lifecycle.test.ts

key-decisions:
  - "Re-verified @biomejs/biome and cz-git versions against the live npm registry at execution time (2.5.4, 1.13.1) — both matched RESEARCH.md's targets exactly, no drift"
  - "Confirmed the Biome 2.5.4 reformat was narrow as RESEARCH.md Pitfall 3 predicted: exactly one file (tests/lifecycle.test.ts), one it.each call-formatting change, no rule-config edits"
  - "Verified the cz-git adapter swap by running npx cz directly (non-interactively, no TTY available in this environment): it advanced past commitizen's own module-resolution step and rendered the real interactive type-selection prompt (cz-cli@4.3.2, cz-git@1.13.1 header, standard feat/fix/docs/style/refactor/perf/test... list) before timing out waiting for a keypress — proof config.commitizen.path resolves correctly at runtime, satisfying Pitfall 5's failure-mode check without requiring a completed interactive session"

requirements-completed: [TOOL-03, TOOL-04]

coverage:
  - id: D1
    description: "Biome bumped 2.5.1 -> 2.5.4 with biome.json $schema in lockstep, and the one resulting formatting diff (tests/lifecycle.test.ts) landed in its own separate style: commit per D-02"
    requirement: "TOOL-03"
    verification:
      - kind: integration
        ref: "make lint && make test (executed after both commits; 321/321 vitest specs green, biome check clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "cz-conventional-changelog removed and replaced with cz-git; config.commitizen.path points at node_modules/cz-git; commit-and-tag-version and .versionrc.json untouched; commitizen flow verified to resolve and render the correct prompt"
    requirement: "TOOL-04"
    verification:
      - kind: manual_procedural
        ref: "npx cz (non-interactive smoke run) — rendered cz-cli@4.3.2/cz-git@1.13.1 header and the standard type-selection list before timing out on the missing TTY; grep confirms node_modules/cz-git path, cz-git devDependency present, cz-conventional-changelog absent"
        status: pass
    human_judgment: true
    rationale: "A full interactive commitizen session (selecting a type, typing a subject, confirming) requires a TTY that isn't available to this autonomous executor. The non-interactive smoke run proves the adapter resolves and the prompt renders correctly, but a human completing one real `npx cz` / `make commit` end-to-end is the strongest possible confirmation and is cheap to do."

duration: 6min
completed: 2026-07-15
status: complete
---

# Phase 6 Plan 4: Biome Bump + cz-git Adapter Swap Summary

**Biome bumped 2.5.1->2.5.4 with a bisectable version-bump commit plus a separate one-file style: reformat commit, and the unmaintained cz-conventional-changelog adapter swapped for cz-git 1.13.1 at 1:1 conventional-commit parity.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-15T16:51:00Z
- **Completed:** 2026-07-15T16:57:01Z
- **Tasks:** 2
- **Files modified:** 4 (package.json, biome.json, pnpm-lock.yaml, tests/lifecycle.test.ts)

## Accomplishments
- Re-confirmed both target versions against the live npm registry at execution time (`npm view <pkg> version`) — `@biomejs/biome` 2.5.4 and `cz-git` 1.13.1, both matching RESEARCH.md's targets exactly, plus a zero-postinstall-script re-check on both packages before installing.
- Bumped `@biomejs/biome` 2.5.1 -> 2.5.4 (patch bump within major 2.x — RESEARCH.md Pitfall 3 correctly predicted no 3.x exists) and bumped `biome.json`'s version-pinned `$schema` URL in lockstep, all in one commit that touched only `package.json`/`biome.json`/`pnpm-lock.yaml` (no source reformat bundled in).
- Ran `npx biome check --write .` afterward and confirmed the fallout was exactly as narrow as Pitfall 3 predicted: one file (`tests/lifecycle.test.ts`), one mechanical reformat of a curried `it.each(...)(...)` call — no rule-config changes, no wide-tree reformat. Committed separately as `style: apply biome 2.5.4 formatting` per D-02.
- Swapped `cz-conventional-changelog` for `cz-git@^1.13.1`: `pnpm remove` -> `pnpm add -D` -> updated `config.commitizen.path` to the resolved `node_modules/cz-git` path (not the bare package name, per Pitfall 5) -> `pnpm install` to ensure the path resolves at commit time. Left `commit-and-tag-version` and `.versionrc.json` completely untouched (confirmed via diff-stat and grep).
- Verified the swap by running `npx cz` directly: it advanced past commitizen's adapter-resolution step (proving `node_modules/cz-git` loads correctly) and rendered the actual interactive type-selection prompt (`cz-cli@4.3.2, cz-git@1.13.1` header, standard `feat/fix/docs/style/refactor/perf/test/...` type list matching CLAUDE.md's required set as a superset) before timing out waiting for a keypress (no TTY in this environment). This directly exercises Pitfall 5's failure mode (`Cannot find module 'cz-git'` / stale path) and confirms it does not occur.
- Full suite remained green throughout: `make lint && make test` — 321/321 vitest specs passing, `biome check .` clean, at the end of both tasks.

## Task Commits

Each task was committed atomically (Task 1 split into two commits per D-02's bump-vs-reformat separation):

1. **Task 1a: Bump Biome to 2.5.4 (+ biome.json $schema lockstep)** - `ef8c539` (chore(deps))
2. **Task 1b: Apply the resulting narrow formatting diff separately** - `e232aab` (style)
3. **Task 2: Swap cz-conventional-changelog for cz-git (1:1 parity)** - `60f5ec5` (chore(deps))

**Plan metadata:** commit to follow (docs: complete plan)

## Files Created/Modified
- `package.json` - `@biomejs/biome` `^2.5.1`->`^2.5.4`; `cz-conventional-changelog` removed, `cz-git` `^1.13.1` added; `config.commitizen.path` -> `node_modules/cz-git`
- `biome.json` - `$schema` URL bumped `2.5.1` -> `2.5.4` to match the installed Biome version (no other config-shape changes)
- `pnpm-lock.yaml` - regenerated across the Biome bump and the cz-conventional-changelog remove / cz-git add
- `tests/lifecycle.test.ts` - one `it.each(...)(...)` call reformatted per Biome 2.5.4's updated curried-call formatting rule (mechanical, no behavior change)

## Decisions Made
- Split Task 1 into two commits (version bump, then reformat) exactly per D-02, since the Biome bump alone produced a real (if narrow) formatting diff — confirmed by running `make lint` immediately after the bump and seeing it fail on one file, then isolating that file before committing the version bump itself.
- Used a non-interactive `npx cz` smoke run (piped from `/dev/null`, timeout-bounded) as the executable verification for the cz-git swap, since this autonomous execution context has no TTY to complete a full interactive commit flow. Documented in `coverage` as `human_judgment: true` with rationale, so a human can optionally complete one real interactive `npx cz` / `make commit` session as a final confirmation — the automated evidence (module resolves, exact prompt renders, correct type list) already covers Pitfall 5's real failure mode.
- Left `typescript`, `commit-and-tag-version`, and `.versionrc.json` untouched (out of scope per D-04/D-08) — verified via diff/grep before committing.

## Deviations from Plan

None - plan executed exactly as written, including the expected/predicted narrow Biome reformat (Pitfall 3) and the interactive-prompt verification approach for cz-git (adapted for a non-TTY autonomous environment, but achieving the same "does the adapter resolve and render correctly" evidence the plan's human-check step calls for).

## Issues Encountered

None. Both bumps applied cleanly; the only fallout was the single predicted formatting diff, isolated and committed separately as planned.

## User Setup Required

None - no external service configuration required. Optional: a maintainer may run one interactive `npx cz` / `make commit` session locally to complete a real conventional commit through the new adapter as a final human confirmation (see `coverage` D2 rationale) — not blocking, since the automated evidence already proves the adapter resolves and renders correctly.

## Next Phase Readiness

- TOOL-03 fully satisfied: tsup, vite, vitest, happy-dom (Plan 03) + Biome (this plan) all on current TS6-compatible versions; 321/321 tests green throughout.
- TOOL-04 satisfied: cz-git is the active commitizen adapter at 1:1 conventional-commit parity; `commit-and-tag-version`/`.versionrc.json` untouched.
- Remaining Phase 6 scope: TOOL-05 (build-output existence check across ESM/CJS/IIFE per package) is out of this plan's scope and lands in the next 06-0x plan.
- No blockers for Phase 7 (TypeScript 6 Migration) — none of the tools touched in this plan carry a TypeScript peer-version ceiling.

---
*Phase: 06-toolchain-audit-modernization*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 3 task commits verified present in git log (ef8c539, e232aab, 60f5ec5); package.json,
biome.json, tests/lifecycle.test.ts, and this SUMMARY.md all verified present on disk.

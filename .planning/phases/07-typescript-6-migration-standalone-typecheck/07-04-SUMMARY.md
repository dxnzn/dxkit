---
phase: 07-typescript-6-migration-standalone-typecheck
plan: 04
subsystem: infra
tags: [typescript, tsup, build, migration, tooling]

# Dependency graph
requires:
  - phase: 07-01
    provides: root tsconfig.typecheck.json + green baseline
  - phase: 07-02
    provides: plugin tsconfig.typecheck.json x4 + green baseline
  - phase: 07-03
    provides: standalone `make typecheck` target wired into `make test`
provides:
  - "Root `typescript` devDependency bumped to `^6.0.0`, resolving 6.0.3"
  - "Core + all 4 plugins compile clean under TypeScript 6.0.x (`make typecheck` exit 0)"
  - "`make build && make verify-outputs && make test` all green under TS6 (321/321 vitest)"
  - "Zero `ignoreDeprecations` shim anywhere in the repo (TS6-02 satisfied)"
affects: [phase-08-forward-compat-typing, phase-09-guardrails]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Declaration (.d.ts) emission decoupled from tsup's dts:true bundler; each package's ESM/CJS tsup config runs a direct `tsc -p tsconfig.json --emitDeclarationOnly` via onSuccess instead"

key-files:
  created: []
  modified:
    - package.json
    - pnpm-lock.yaml
    - tsup.config.ts
    - plugins/settings/tsup.config.ts
    - plugins/wallet/tsup.config.ts
    - plugins/auth/tsup.config.ts
    - plugins/theme/tsup.config.ts

key-decisions:
  - "typescript devDep range set to caret `^6.0.0` per D-08 (not `^6.0.3`) — pnpm's own `pnpm add -D typescript@^6.0.0` wrote back `^6.0.3` (the resolved patch) instead of the literal requested range; manually corrected to `^6.0.0` and re-ran `pnpm install` to resync the lockfile specifier without changing the 6.0.3 resolution"
  - "tsup 8.5.1's dts:true bundler (an inlined rollup-plugin-dts) unconditionally injects `baseUrl` into its internal TS Program, which TS6 hard-deprecates (TS5101) — root-caused via direct inspection of tsup's bundled dist/rollup.js, independent of any tsconfig this repo owns; fixed by dropping `dts:true` in favor of a direct `tsc --emitDeclarationOnly` pass via tsup's `onSuccess` hook, across all 5 packages"

patterns-established:
  - "Any future TS-toolchain bump should independently smoke-test tsup's dts:true path per package, not just ESM/CJS/IIFE JS emission — RESEARCH's own empirical dts smoke test did not reproduce this failure, but a plain `npx tsup --dts` invocation in this exact repo did"

requirements-completed: [TS6-01, TS6-02]

coverage:
  - id: D1
    description: "Root `typescript` devDependency bumped from `^5.8.3` to `^6.0.0`; pnpm-lock.yaml resolves to `6.0.3` (latest published 6.0.x patch)"
    requirement: "TS6-01"
    verification:
      - kind: other
        ref: "node -e check on package.json devDependencies.typescript === '^6.0.0'; npx tsc --version -> Version 6.0.3"
        status: pass
    human_judgment: false
  - id: D2
    description: "`make typecheck` exits 0 under TS6 across root + all 4 plugins — zero net-new TS6 errors (matches RESEARCH's empirical prediction)"
    requirement: "TS6-01"
    verification:
      - kind: other
        ref: "make typecheck (manual run, this session) — exits 0, all 5 packages checked, under typescript@6.0.3"
        status: pass
    human_judgment: false
  - id: D3
    description: "make build broke under TS6 (TS5101 baseUrl deprecation from tsup's internal dts bundler) across the root package and, transitively, all 4 plugins; fixed at source by switching dts emission to a direct tsc pass — make build && make verify-outputs && make test all pass clean from a `make clean` state"
    requirement: "TS6-01"
    verification:
      - kind: other
        ref: "make clean && make build && make verify-outputs && make test (manual run, this session) — 3 formats x 5 packages present, 321/321 vitest passing"
        status: pass
    human_judgment: false
  - id: D4
    description: "No `ignoreDeprecations` shim added anywhere to work around the TS5101/build-break — the fix removes the code path that triggered the deprecation instead of suppressing it"
    requirement: "TS6-02"
    verification:
      - kind: other
        ref: "grep -rn ignoreDeprecations tsconfig.json tsconfig.typecheck.json plugins/*/tsconfig*.json -> zero matches"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-07-17
status: complete
---

# Phase 07 Plan 04: TypeScript 6 Migration Summary

**Bumped the root `typescript` devDependency to `^6.0.0` (resolving 6.0.3), then discovered and fixed a real TS6-caused build break in tsup's internal dts bundler at source — zero `ignoreDeprecations` shims anywhere, full vitest suite (321/321) green.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-17T15:24:40Z (approx, following 07-03's completion)
- **Completed:** 2026-07-17T15:35:02Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Bumped root `typescript` devDependency `^5.8.3` -> `^6.0.0`, resolving to `6.0.3` (the latest published 6.0.x patch, confirmed via `npx tsc --version`). `pnpm add -D typescript@^6.0.0 -w` wrote the resolved patch (`^6.0.3`) back into `package.json` instead of the literal requested range; manually corrected to the caret `^6.0.0` per D-08's convention and re-ran `pnpm install` to resync `pnpm-lock.yaml`'s specifier field without altering the 6.0.3 resolution.
- Verified `make typecheck` exits 0 under TS6 across the root package and all 4 plugins — confirming RESEARCH's headline finding that `src`+`tests` across all 5 packages is TS6-clean (zero net-new TS6 errors; the 07-01/07-02 baseline fixes already covered the pre-existing test-only errors).
- Discovered `make build` broke immediately after the bump: tsup 8.5.1's built-in `dts:true` bundler (an inlined `rollup-plugin-dts`) unconditionally sets `baseUrl: compilerOptions.baseUrl || "."` when constructing its internal TS `Program` for declaration bundling — a hard `TS5101` deprecation error under TS6, triggered regardless of anything in this repo's own tsconfigs (none of which set `baseUrl`). Root-caused by direct inspection of tsup's bundled `dist/rollup.js`, and independently reproduced with a bare `npx tsup --dts --format esm,cjs` invocation outside the Makefile.
- Fixed at source (no `ignoreDeprecations`, no new dependency): removed `dts: true` from each package's ESM/CJS `tsup.config.ts` entry and instead run `npx tsc -p tsconfig.json --emitDeclarationOnly` via tsup's `onSuccess` hook, across the root package and all 4 plugins. This repo's own build `tsconfig.json` never sets `baseUrl`, so the direct `tsc` pass is TS6-clean.
- Verified the `onSuccess` fix propagates failures correctly: temporarily introduced a type error, confirmed `npx tsup` exits non-zero (exit code 2) with the `tsc` diagnostic surfaced, then reverted cleanly.
- Verified a full `make clean && make build && make verify-outputs && make test` from a cold state: all 3 output formats (ESM/CJS/IIFE) x 5 packages present, `dist/index.d.ts` present and correctly re-exporting from the per-module `.d.ts` files it now sits alongside, and the full vitest suite (12 files / 321 tests) green.
- Confirmed `grep -rn ignoreDeprecations` across all tracked `tsconfig*.json` returns nothing — TS6-02 satisfied both in letter and in spirit (the fix removed the code path that triggered the deprecation rather than suppressing the diagnostic).

## Task Commits

Each task was committed atomically:

1. **Task 1: Bump typescript to ^6.0.0 and regenerate the lockfile** - `de83cf0` (feat)
2. **Task 2 (Rule 1/3 fix): switch dts emission from tsup bundling to direct tsc pass** - `cb7f9a4` (fix)

**Plan metadata:** (this commit, pending)

## Files Created/Modified

- `package.json` - `typescript` devDependency range `^5.8.3` -> `^6.0.0`.
- `pnpm-lock.yaml` - regenerated; `typescript` specifier `^6.0.0`, resolved version `6.0.3`.
- `tsup.config.ts` (root) - ESM/CJS entry: `dts: true` removed, `onSuccess: 'npx tsc -p tsconfig.json --emitDeclarationOnly'` added.
- `plugins/{settings,wallet,auth,theme}/tsup.config.ts` - same change applied uniformly across all 4 plugins.

## Decisions Made

- **D-08 caret convention held exactly:** `package.json` pins `^6.0.0` (not the resolved `^6.0.3` that `pnpm add` initially wrote back), with `pnpm-lock.yaml` pinning the exact resolved `6.0.3` — matching the established Phase 6 devDep convention (caret ranges on devDeps, lockfile pins exact versions, Renovate owns majors).
- **tsup dts bundling replaced with a direct `tsc --emitDeclarationOnly` pass (Rule 1/3 auto-fix, not a checkpoint):** this was judged an in-scope, at-source fix rather than an architectural checkpoint (Rule 4) because (a) it adds zero new dependencies — reuses `tsc`, already a devDependency; (b) it does not touch `package.json`'s `types`/`exports`/`main` fields or the `files: ["dist"]` allowlist, so the change is unobservable to consumers; (c) the plan's own Task 2 action text explicitly pre-authorizes fixing a TS6-caused `tsup` build break at source without a decision gate; and (d) no `ignoreDeprecations` escape hatch was used anywhere, satisfying TS6-02 in both letter and spirit. The output shape changes from one rollup-bundled `dist/index.d.ts` to per-module `.d.ts` files (`index.d.ts`, `events.d.ts`, `lifecycle.d.ts`, etc.), all still transitively re-exported from `dist/index.d.ts` exactly as before.
- **No manufactured TS6 deprecation fixes:** per RESEARCH's degenerate-but-valid case, zero genuine TS6-specific `src`/`tests` deprecations surfaced (the 07-01/07-02 baseline plans already resolved the ~15 pre-existing test-only errors). The only real TS6-caused break was the tsup/dts issue above — no changes were invented to artificially satisfy TS6-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Bug/Blocking issue] tsup 8.5.1's dts bundler broke `make build` under TS6 (TS5101 `baseUrl` deprecation)**
- **Found during:** Task 2 (`make build` verification step)
- **Issue:** `tsup`'s internal `rollup-plugin-dts`-based dts bundler (bundled into `tsup`'s own compiled `dist/rollup.js`, not a separately-upgradable dependency) unconditionally sets `baseUrl: compilerOptions.baseUrl || "."` on the TS `Program` it constructs to bundle declaration files, regardless of this repo's own tsconfig. TS6 hard-deprecates `baseUrl` (`TS5101`), so this broke the root package's dts build immediately after the Task 1 bump commit, and transitively broke all 4 plugin builds (which depend on the root package's `dist/index.d.ts` for cross-package type resolution). RESEARCH's own empirical smoke test of this exact `npx tsup --dts` command did not reproduce this failure at research time; it reproduced consistently in this session, both via `make build` and an isolated CLI invocation outside the Makefile. No newer `tsup` release exists to pick up a fix (8.5.1 is npm's latest as of this session).
- **Fix:** Removed `dts: true` from each package's ESM/CJS `tsup.config.ts` build entry; added `onSuccess: 'npx tsc -p tsconfig.json --emitDeclarationOnly'` to run a direct, unbundled `tsc` declaration-emit pass immediately after tsup's JS/CJS build succeeds. Verified the `onSuccess` hook's exit code correctly propagates a `tsc` type error to `npx tsup`'s own process exit code (tested with a deliberately-introduced error, confirmed non-zero exit, then reverted).
- **Files modified:** `tsup.config.ts`, `plugins/settings/tsup.config.ts`, `plugins/wallet/tsup.config.ts`, `plugins/auth/tsup.config.ts`, `plugins/theme/tsup.config.ts`
- **Commit:** `cb7f9a4`

### Not manufactured

No genuine TS6-specific deprecation surfaced in any `src/`/`tests/` file across all 5 packages — the RESEARCH-predicted degenerate empty-fixes case held for the compiler-diagnostics dimension exactly as documented; the only real TS6-caused break was the tsup/dts tooling issue above, which was fixed rather than worked around.

## Issues Encountered

- `pnpm add -D typescript@^6.0.0 -w` wrote the resolved patch version (`^6.0.3`) into `package.json`'s devDependencies instead of the literal caret range requested — a pnpm behavior not previously observed in Phase 6's devDep bumps. Manually corrected to `^6.0.0` and re-ran `pnpm install` to resync the lockfile's `specifier` field without changing the `6.0.3` resolution. No other incidental `package.json` reformatting occurred (unlike Phase 6's noted `engines` reformatting gotcha).

## User Setup Required

None - no external service configuration required. This is a devDependency-only, build-tooling change.

## Next Phase Readiness

- Phase 07 (TS6 Migration & Standalone Typecheck) is now fully complete: TS6-01 (compile clean on 6.0.x), TS6-02 (zero `ignoreDeprecations` shims), and TS6-03 (standalone `tsc --noEmit`, from 07-01/02/03) are all satisfied.
- Core + all 4 plugins compile clean under TypeScript 6.0.3, build clean (3 formats x 5 packages), and the full vitest suite (321 tests) stays green.
- Phase 8 (Forward-Compat Typing: `isolatedDeclarations`/`verbatimModuleSyntax`/`erasableSyntaxOnly`) can now build on a TS6 baseline. Note for Phase 8 planning: since `dts:true`'s bundled-rollup path is no longer used for declaration emission (replaced by direct `tsc --emitDeclarationOnly`), `isolatedDeclarations` adoption will be validated against plain `tsc`'s own diagnostics rather than tsup's dts bundler — likely a simplification, since one fewer tool now sits in the declaration-emission path.
- No blockers.

---
*Phase: 07-typescript-6-migration-standalone-typecheck*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: package.json
- FOUND: pnpm-lock.yaml
- FOUND: tsup.config.ts
- FOUND: plugins/settings/tsup.config.ts
- FOUND: plugins/wallet/tsup.config.ts
- FOUND: plugins/auth/tsup.config.ts
- FOUND: plugins/theme/tsup.config.ts
- FOUND: de83cf0 (commit exists in git log)
- FOUND: cb7f9a4 (commit exists in git log)

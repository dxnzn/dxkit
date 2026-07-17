---
phase: 07-typescript-6-migration-standalone-typecheck
plan: 01
subsystem: build-tooling
tags: [typescript, typecheck, tsconfig, deepMerge, type-safety]
dependency graph:
  requires: []
  provides:
    - "tsconfig.typecheck.json (root) — standalone tsc --noEmit config, extends build tsconfig, includes src+tests"
    - "DeepPartial<T> utility type in src/utils.ts"
  affects:
    - "07-02 (plugin tsconfig.typecheck.json files follow this exact pattern)"
    - "07-03 (make typecheck target invokes this config for the root package)"
    - "07-04 (TypeScript 6 bump validates against this green baseline)"
tech-stack:
  added: []
  patterns:
    - "Dedicated *.typecheck.json extends the build tsconfig, sets noEmit + rootDir + paths, never edits the build config (D-02)"
    - "rootDir widened to monorepo root (not package-local) so cross-package paths aliases resolving to sibling src/*.ts don't trip TS6059"
    - "paths block mirrors vitest.config.ts's alias map but omits baseUrl (avoids TS6's TS5101 deprecation)"
key-files:
  created:
    - tsconfig.typecheck.json
  modified:
    - src/utils.ts
    - src/types/shell.ts
    - tests/stress.test.ts
decisions:
  - "DappEntry.overrides switched from Partial<DappManifest> to DeepPartial<DappManifest> at its declaration in src/types/shell.ts, resolving the tests/shell.test.ts:308 symptom at the source type instead of patching the test call site (per plan's explicit guidance to check the declaration first)"
  - "tests/utils.test.ts and tests/shell.test.ts required zero edits — their errors were pure call-site symptoms of deepMerge's/DappEntry's shallow-Partial<T> signatures; fixing the two declarations (src/utils.ts, src/types/shell.ts) resolved all 4 tests/utils.test.ts errors and the 1 tests/shell.test.ts error without touching either test file"
  - "tests/stress.test.ts's 4 CustomEvent-to-EventListener casts fixed via the double-cast-through-unknown option (TypeScript's own suggested fix), not the alternative EventListener-typed-handler-with-inner-narrowing option — smaller diff, same effect"
  - "deepMerge's implementation body was refactored to use a single typed 'overrides' local (Record<string, any>) instead of per-line 'as any' casts — removes 3 as-any casts while keeping behavior identical; this is a simplification enabled by the type fix, not a suppression"
metrics:
  duration: 25min
  completed: 2026-07-17
status: complete
---

# Phase 7 Plan 1: Root Package Standalone Typecheck Baseline Summary

Created the root package's `tsconfig.typecheck.json` and fixed all pre-existing test-only type
errors it surfaced, establishing a green `tsc --noEmit` baseline on the currently-resolved
TypeScript (5.9.3) before the TS6 bump — the root half of the phase's measurable pre-bump
baseline (D-07 step 1).

## What Was Built

**`tsconfig.typecheck.json` (root, new):** Extends `./tsconfig.json` (build config, left
byte-for-byte unchanged), sets `noEmit: true`, `rootDir: "."`, and a `paths` block with the 5
vitest-mirroring aliases (`@dnzn/dxkit` + 4 plugin packages) resolving to real sibling
`src/index.ts` files. `include: ["src", "tests"]` makes `tests/` a first-class typed consumer of
the package's public types for the first time. Deliberately omits `baseUrl` — adding it would
trigger TS6's `TS5101` deprecation error and force a forbidden `ignoreDeprecations` shim.

**`DeepPartial<T>` in `src/utils.ts`:** A recursive mapped type (`T extends object ? { [K in
keyof T]?: DeepPartial<T[K]> } : T`) replacing `deepMerge`'s previously shallow `Partial<T>`
second-parameter type. `Partial<T>` required all of a nested optional object's own properties —
never matching `deepMerge`'s actual recursive runtime contract, even though the implementation
itself was always correct.

**`DappEntry.overrides` (`src/types/shell.ts`):** Switched from `Partial<DappManifest>` to
`DeepPartial<DappManifest>` at its declaration — the same root-cause fix as `deepMerge`,
applied at the one other place in the codebase using the same shallow pattern.

**`tests/stress.test.ts`:** All 4 `CustomEvent`-handler-cast-to-`EventListener` occurrences now
double-cast through `unknown` (`as unknown as EventListener`) — TypeScript's own suggested fix
for casts between insufficiently overlapping types. No runtime behavior change.

## Verification

- `npx tsc --noEmit -p tsconfig.typecheck.json` exits 0 (root src + tests, zero errors)
- `npx vitest run` — 321/321 tests passing (12 files), unchanged from before this plan
- `npx biome check src/utils.ts src/types/shell.ts tests/stress.test.ts` — clean
- Negative check performed: appended `const _negativeCheck: number = 'str';` to
  `tests/utils.test.ts`, confirmed `tsc --noEmit -p tsconfig.typecheck.json` failed with
  `TS2322`, then reverted via `git checkout --` — proves the config actually type-checks tests,
  not just src
- `git diff --stat tsconfig.json` — empty (build config untouched)
- `grep -n baseUrl tsconfig.typecheck.json` — no matches
- `grep -rn ignoreDeprecations tsconfig.json tsconfig.typecheck.json` — no matches

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `DeepPartial<T>`'s conditional type couldn't be indexed by `keyof T` inside `deepMerge`'s generic body**
- **Found during:** Task 2, immediately after switching the signature to `DeepPartial<T>`
- **Issue:** `T extends object ? {...} : T` is deferred when `T` is a generic type parameter, so
  TypeScript rejected indexing it with `keyof T` (`TS2536`) inside `deepMerge`'s own
  implementation, even though the public API type change itself was correct.
- **Fix:** Refactored the loop to widen `b` to a single `Record<string, any>` local
  (`overrides`) for indexing purposes, and typed `result` the same way — removing the 3
  per-line `as any` casts the old implementation needed. Behavior is unchanged; this is a
  simplification, not a suppression.
- **Files modified:** `src/utils.ts`
- **Commit:** `21aa826`

**2. [Scope reduction — smaller diff than planned] `tests/utils.test.ts` and `tests/shell.test.ts` needed zero direct edits**
- **Found during:** Task 2 planning
- **Issue:** The plan's `files_modified` frontmatter listed both test files as files to fix.
  Per the plan's own guidance ("check whether that field can reuse `DeepPartial<T>` at its
  declaration rather than patching the call site"), all 4 `tests/utils.test.ts` errors and the
  1 `tests/shell.test.ts` error were pure call-site symptoms of `deepMerge`'s and
  `DappEntry.overrides`'s shallow-`Partial<T>` declarations. Fixing the two declarations
  (`src/utils.ts`, `src/types/shell.ts`) resolved all 5 of those errors with no test-file edits
  needed.
- **Fix:** No action needed on the test files themselves — confirmed via `tsc --noEmit`
  showing zero errors in either file after the declaration-side fixes.
- **Files modified:** none (test files unchanged)
- **Commit:** n/a (no changes to commit for these two files)

### Process Note (not a code deviation)

The Task 1 commit (`9809549`) omitted the `Co-Authored-By` trailer that this project's
`CLAUDE.md` mandates on every commit. This was an executor oversight, caught only after the
commit landed. Per the git safety protocol's "always create new commits, never amend" rule,
the commit was left as-is rather than amended; the Task 2 commit (`21aa826`) and this plan's
final metadata commit both carry the trailer correctly. Flagging here for visibility — no
functional impact, but worth a maintainer's awareness if commit-message consistency is audited.

## Known Stubs

None — this plan touches build-tooling config and type-signature/test fixes only, no UI or
data-flow code.

## Threat Flags

None — this plan introduces no new runtime attack surface (build-time typecheck config +
type-only signature changes; zero runtime deps preserved), matching the plan's own threat
model disposition (T-07-01, accepted).

## Self-Check: PASSED

- FOUND: tsconfig.typecheck.json
- FOUND: src/utils.ts (DeepPartial<T> present)
- FOUND: src/types/shell.ts (DeepPartial<DappManifest> present)
- FOUND: tests/stress.test.ts (4x `as unknown as EventListener` present)
- FOUND: commit 9809549 (Task 1)
- FOUND: commit 21aa826 (Task 2)

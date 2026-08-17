---
phase: 03-security-sanitization-storage-isolation
plan: 03
subsystem: config
tags: [shell-config, breaking-change, lifecycle, sanitizer, dx]

# Dependency graph
requires:
  - phase: 03-security-sanitization-storage-isolation
    provides: "TemplateSanitizer type + sanitizeTemplate hook on LifecycleManagerOptions (03-01)"
provides:
  - "ShellConfig.lifecycle?: LifecycleManagerOptions — nested group replacing flat scriptLoader/styleLoader/templateLoader"
  - "createShell() runtime guard throwing on the removed flat shape, naming config.lifecycle.*"
  - "SEC-01 sanitizer (and Phase 2 timeout/cacheTemplates) reachable end-to-end from createShell()"
affects: [docs-phase-5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-layer breaking-change enforcement: type removal (compile-time) + runtime `in`-check throw (construction-time) for untyped IIFE consumers"
    - "Config destructure + subsystem forwarding: `lifecycle = {}` destructure, `...lifecycle` spread into the wrapped subsystem's constructor alongside injected fields (hasPlugin)"

key-files:
  created: []
  modified:
    - src/types/shell.ts
    - src/shell.ts
    - tests/shell.test.ts

key-decisions:
  - "Runtime guard runs before the config destructure, checking `key in config` on the raw object — catches presence even when a flat key's value is undefined, which a destructure-based check would miss"
  - "Destructured local renamed to lifecycleOptions (not lifecycle) to avoid shadowing the LifecycleManager instance variable already named `lifecycle` later in the same function"
  - "Fixed the plan's stated import path for LifecycleManagerOptions from './lifecycle.js' to '../lifecycle.js' — src/lifecycle.ts lives one directory above src/types/, the literal path in the plan would not have resolved"

patterns-established:
  - "Nested subsystem-options group on the outer config type, imported from the subsystem's own module and spread wholesale into that subsystem's constructor — the template for any future ShellConfig subsystem grouping (router, plugins, etc.)"

requirements-completed: [SEC-01]

coverage:
  - id: D1
    description: "ShellConfig no longer declares flat scriptLoader/styleLoader/templateLoader; it exposes lifecycle?: LifecycleManagerOptions carrying all lifecycle knobs including sanitizeTemplate"
    requirement: "SEC-01"
    verification:
      - kind: other
        ref: "pnpm exec tsc --noEmit (clean — flat fields removed, lifecycle field present, imports resolve)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Options passed via ShellConfig.lifecycle reach createLifecycleManager — sanitizeTemplate, timeout, and cacheTemplates are all forwarded"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#config.lifecycle passthrough (D-03/D-04) > a lifecycle.sanitizeTemplate configured via createShell runs during a real mount"
        status: pass
    human_judgment: false
  - id: D3
    description: "createShell() throws a descriptive Error naming config.lifecycle.* if any of scriptLoader/styleLoader/templateLoader is present on the config object, before lifecycle construction"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#flat-loader runtime throw (D-05) > throws when scriptLoader/styleLoader/templateLoader is passed at the top level (individually and combined)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A ShellConfig.lifecycle.sanitizeTemplate configured through createShell() runs on template HTML during a real mount, proving the sanitizer reaches shell consumers via the nested group"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/shell.test.ts#config.lifecycle passthrough (D-03/D-04) > a lifecycle.sanitizeTemplate configured via createShell runs during a real mount"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full test suite remains green after the breaking migration — no test file anywhere still constructs a shell with a flat loader key outside the intentional D-05 throw assertions"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "pnpm exec vitest run (full suite, 285/285 passing across 10 files)"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-07-12
status: complete
---

# Phase 3 Plan 3: ShellConfig Lifecycle Restructure Summary

**Nested `ShellConfig.lifecycle?: LifecycleManagerOptions` group replaces the flat scriptLoader/styleLoader/templateLoader fields, with a runtime throw guarding untyped consumers — closing the path for SEC-01's sanitizer (and Phase 2's timeout/cacheTemplates) to reach `createShell()`.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-12T23:12:18Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `ShellConfig` (src/types/shell.ts) drops the three flat loader fields and gains a single `lifecycle?: LifecycleManagerOptions` field, importing the type from `../lifecycle.js`.
- `createShell()` (src/shell.ts) runs a runtime guard — checking `key in config` for each removed flat key — before any destructure or lifecycle construction, throwing a descriptive `Error` naming `config.lifecycle.*` if any are present. This protects untyped JS/IIFE consumers who bypass TypeScript's compile-time removal.
- `createShell()` now destructures `lifecycle = {}` and spreads `...lifecycle` into `createLifecycleManager(events, { hasPlugin, ...lifecycle })`, so every lifecycle knob — `scriptLoader`, `styleLoader`, `templateLoader`, `timeout`, `cacheTemplates`, and the SEC-01 `sanitizeTemplate` from plan 03-01 — now flows end-to-end from `createShell()` config into the lifecycle manager. Previously `timeout`/`cacheTemplates` existed on `LifecycleManagerOptions` (Phase 2) but were structurally unreachable from `createShell()`.
- `tests/shell.test.ts`'s `testLoaders` helper and every one of its ~49 call sites are migrated to the nested `lifecycle` shape (the one inline flat-loader call site, in the mount-de-duplication describe block, was rewritten to `{ lifecycle: { scriptLoader, styleLoader } }`).
- Two new describe blocks added: a passthrough test proving a `lifecycle.sanitizeTemplate` configured through `createShell()` actually runs during a real `init()` + `navigate()` mount and its output reaches `container.innerHTML` (also exercising `timeout`/`cacheTemplates` passthrough in the same call); and a runtime-throw block asserting `createShell()` throws a `config.lifecycle`-referencing `Error` for each of the three flat keys individually and combined.

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure ShellConfig + createShell runtime guard and forwarding** - `0619f9d` (feat!, `BREAKING CHANGE:` footer)
2. **Task 2: Migrate shell tests to nested lifecycle + passthrough and runtime-throw tests** - `0ec1aae` (test)

**Plan metadata:** _pending — recorded in the final metadata commit_

## Files Created/Modified
- `src/types/shell.ts` - `ShellConfig` interface: flat `scriptLoader`/`styleLoader`/`templateLoader` fields removed; `lifecycle?: LifecycleManagerOptions` added, imported from `../lifecycle.js`
- `src/shell.ts` - D-05 runtime guard (throws before lifecycle construction on any flat key present); destructure changed to `lifecycle: lifecycleOptions = {}`; `createLifecycleManager` call now spreads `...lifecycleOptions` alongside `hasPlugin`
- `tests/shell.test.ts` - `testLoaders` helper migrated to nested shape; all call sites updated; two new describe blocks (`config.lifecycle passthrough (D-03/D-04)`, `flat-loader runtime throw (D-05)`)

## Decisions Made
- Fixed the plan's stated import path for `LifecycleManagerOptions` — the plan text said `./lifecycle.js` from `src/types/shell.ts`, but `src/lifecycle.ts` lives one directory above `src/types/`; used `../lifecycle.js` instead. (Rule 1 — the literal path in the plan would not have resolved; `tsc --noEmit` confirms the fix compiles.)
- Renamed the destructured config field to `lifecycleOptions` (not `lifecycle`) in `createShell()` to avoid shadowing the pre-existing `lifecycle` local that holds the `LifecycleManager` instance a few lines later in the same function — same value, safer name.
- The `BREAKING CHANGE:` footer with migration notes was placed on the Task 1 commit (`0619f9d`), since that is where the actual type removal + runtime throw behavior change lands; Task 2 is purely test migration onto the already-breaking shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected LifecycleManagerOptions import path**
- **Found during:** Task 1 (ShellConfig restructure)
- **Issue:** Plan's `<action>` specified `import type { LifecycleManagerOptions } from './lifecycle.js';` in `src/types/shell.ts`, but that file is in `src/types/` while `lifecycle.ts` is in `src/` (one directory up) — the stated relative path does not resolve.
- **Fix:** Used `import type { LifecycleManagerOptions } from '../lifecycle.js';` instead.
- **Files modified:** src/types/shell.ts
- **Verification:** `pnpm exec tsc --noEmit` compiles clean.
- **Committed in:** 0619f9d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — incorrect import path in plan text).
**Impact on plan:** Necessary correction for the plan's stated action to compile at all. No scope creep — the rest of Task 1 and all of Task 2 followed the plan as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- D-04/D-05 fully satisfied: `ShellConfig` exposes the nested `lifecycle` group, the flat fields are gone from the type, and `createShell()` throws at runtime for the old shape.
- SEC-01 is now end-to-end complete across this phase's three plans: the sanitizer hook exists on `LifecycleManagerOptions` (03-01), and it — along with `timeout`/`cacheTemplates` — is reachable all the way from `createShell()` config (03-03).
- `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (full suite, 285/285), and `make lint` are all clean.
- This is the last plan in Phase 3. Docs (`docs/getting-started.md`, `docs/system-internals.md`, `docs/api-reference.md`) still reference the old flat `ShellConfig` shape and are now stale — expected per 03-RESEARCH.md Pitfall 3, explicitly deferred to Phase 5 (docs truth pass). No blockers for phase completion.

---
*Phase: 03-security-sanitization-storage-isolation*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: src/types/shell.ts
- FOUND: src/shell.ts
- FOUND: tests/shell.test.ts
- FOUND commit: 0619f9d
- FOUND commit: 0ec1aae

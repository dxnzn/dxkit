---
phase: 05-documentation-truth-pass
plan: 06
subsystem: docs
tags: [markdown, cookbook, development, testing, tsup, vitest, makefile]

requires:
  - phase: 05-documentation-truth-pass
    provides: "Plan 01's D-15/D-16/D-17 fixed source; the RESEARCH.md Code Truth tables (Event Catalog, Config Defaults, Behavior); Plan 02's declare-module fix pattern (events-reference.md/api-reference.md) that cookbook.md shared the same bug against"
provides:
  - "docs/cookbook.md verified — module-augmentation package name fixed, deepMerge null-replaces rule added, all 13 recipes confirmed 0.2.0-accurate against source"
  - "docs/development.md verified — plugin IIFE bundling claim corrected to match actual tsup.config.ts/dist output, make audit scope corrected, monorepo tree fixed"
  - "docs/testing.md verified — toolchain claims confirmed accurate, one D-13 verify-grep false-positive reworded"
  - "drift/06-low-fanout.md — before/after record for all three docs"
affects: [05-07, 05-08]

tech-stack:
  added: []
  patterns:
    - "Compiled-artifact verification: for build-system claims (bundling behavior), grep the actual dist/*.js output rather than trusting tsup.config.ts intent alone — a noExternal entry with nothing to bundle (type-only imports) produces no artifact evidence of bundling, so the doc claim must describe what the build actually does, not what the config merely permits"

key-files:
  created:
    - .planning/phases/05-documentation-truth-pass/drift/06-low-fanout.md
  modified:
    - docs/cookbook.md
    - docs/development.md
    - docs/testing.md

key-decisions:
  - "Corrected cookbook.md's Custom Events recipe from `declare module 'dxkit'` to `declare module '@dnzn/dxkit'` — the same module-augmentation bug already fixed in events-reference.md/api-reference.md during Plan 05-02 was still present, unfixed, in cookbook.md (a separate file outside that plan's scope)"
  - "Verified development.md's plugin-bundling claim against the built dist/index.global.js artifact, not just tsup.config.ts intent — found `noExternal` lists only `@dnzn/dxkit` (never a sibling plugin package) in every plugin's config, and even that entry bundles nothing in practice since plugins only type-import from `@dnzn/dxkit`; rewrote the paragraph to state the real reason standalone `<script>` tags work (no runtime dependency exists, not 'is inlined')"
  - "Reworded testing.md's 'not just ones that explicitly need one' to 'not only' — a D-13 verify-grep false-positive (legitimate 'not only' usage, not a hedge word) rather than leaving the grep unsatisfied or weakening the sentence's meaning"

requirements-completed: [DOC-01, DOC-02]

coverage:
  - id: D1
    description: "docs/cookbook.md verified against src/*.ts, src/types/*.ts, plugins/*/src/index.ts; module-augmentation package name and deepMerge null-rule fixed; all other recipes (event payloads, plugin APIs, manifest fields, dx:error source/message strings) confirmed already accurate"
    requirement: "DOC-01"
    verification:
      - kind: other
        ref: "bash -c \"! grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' docs/cookbook.md\""
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/development.md verified against Makefile, package.json, plugins/*/package.json, tsup.config.ts, plugins/*/tsup.config.ts, biome.json, vitest.config.ts, .versionrc.json, .github/workflows/ci.yml; plugin IIFE bundling claim and make audit scope corrected"
    requirement: "DOC-01"
    verification:
      - kind: other
        ref: "bash -c \"grep -q 'make ' docs/development.md && ! grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' docs/development.md\""
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/testing.md verified against vitest.config.ts, package.json devDependencies, plugins/*/tests/ directory listing, and representative test files; toolchain claims already accurate, one slop-bar false-positive reworded"
    requirement: "DOC-02"
    verification:
      - kind: other
        ref: "bash -c \"grep -qi 'vitest' docs/testing.md && ! grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' docs/testing.md\""
        status: pass
    human_judgment: false
  - id: D4
    description: "drift/06-low-fanout.md records all three docs' before/after changes with source citations"
    verification:
      - kind: other
        ref: "test -f .planning/phases/05-documentation-truth-pass/drift/06-low-fanout.md"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-07-14
status: complete
---

# Phase 05 Plan 06: Cookbook, Development, Testing Docs Truth Pass Summary

**Verified docs/cookbook.md's 13 recipes, docs/development.md's build/toolchain claims, and docs/testing.md's Vitest/happy-dom setup against source and the built dist/ artifacts — fixed a stale module-augmentation package name shared with two already-corrected docs, a plugin IIFE bundling claim that didn't match the compiled output, and a make audit scope overclaim.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-14T17:05:00Z
- **Tasks:** 2
- **Files modified:** 4 (3 docs + 1 new drift log)

## Accomplishments

- Verified all 13 cookbook.md recipes field-for-field against source: `dx:mount`/`dx:unmount` event payloads (`src/lifecycle.ts:452-464`), `dx:error` source-prefix and message text (`src/lifecycle.ts:328-329`), hash-mode `navigate()` (`src/router.ts:65-81`), `eventRegistry.registerEvent()` shape (`src/events.ts:93`), settings/theme/wallet plugin APIs (`plugins/{settings,theme,wallet}/src/index.ts`), and `ShellConfig`/`DappEntry` shapes (`src/types/shell.ts`). Found two real bugs: `declare module 'dxkit'` (wrong package name — should be `'@dnzn/dxkit'`, the same bug Plan 05-02 already fixed in `events-reference.md`/`api-reference.md` but that cookbook.md still had) and a deep-merge rule line that omitted `deepMerge`'s null-replaces behavior.
- Verified development.md's Build System claim that plugin IIFE builds "bundle `@dnzn/dxkit` (and any intra-plugin dependency, e.g. wallet bundles settings) inline via `noExternal`" against every plugin's actual `tsup.config.ts` and the compiled `dist/index.global.js`/`dist/index.cjs` output. Found the claim false in two ways: no plugin's config lists a sibling plugin package in `noExternal` at all (only `@dnzn/dxkit` itself), and since every plugin only *type*-imports from `@dnzn/dxkit` (compiled away), nothing from core is actually bundled either — confirmed via `grep -c dxkit-settings plugins/wallet/dist/index.global.js` returning `0`, and the CJS build emitting `require("@dnzn/dxkit-settings")` (proving it's left external, not inlined). Rewrote the paragraph to state the real mechanism: standalone `<script>` tags work because plugins have no runtime dependency on `@dnzn/dxkit` or sibling packages, not because anything is bundled in.
- Corrected `make audit`'s table row, which attributed the `src/ plugins/` path scope to all three subcommands (`pnpm audit`, `semgrep`, `gitleaks`) — only `semgrep` actually scopes there per the Makefile; `pnpm audit` takes no path arg and `gitleaks detect --source .` scans the whole repo.
- Fixed a misleading monorepo-layout ASCII tree that nested `src/`/`tests/` only under the last plugin entry (`theme/`), visually implying only that plugin had those subdirectories, when all four do.
- Verified testing.md's Vitest/happy-dom setup, config excerpt, test-location table, `afterEach` teardown pattern, and CI job shape against `vitest.config.ts`, `package.json`, `plugins/*/tests/`, and representative test files — all already accurate. One D-13 slop-bar verify-grep false-positive found: "not just ones that explicitly need one" tripped the `just` check despite being a legitimate "not only" construction; reworded rather than leaving the automated verify unsatisfied.

## Task Commits

1. **Task 1: Verify docs/cookbook.md against source**
   - `9b31d0a` — docs(cookbook): fix module-augmentation package name + deepMerge null rule
2. **Task 2: Verify docs/development.md + docs/testing.md against the toolchain**
   - `96e0946` — docs(development): correct plugin IIFE bundling claim + audit scope
   - `137b9c1` — docs(testing): reword D-13 slop-bar false-positive in environment note

_Note: the drift log file `drift/06-low-fanout.md` was created with Task 1's cookbook.md section and appended with Task 2's development.md and testing.md sections, matching the plan's "log to drift/06-low-fanout.md... append" instruction._

## Files Created/Modified

- `docs/cookbook.md` - Fixed `declare module 'dxkit'` → `'@dnzn/dxkit'` in the Custom Events recipe; added `null`-replaces to the deep-merge rule line.
- `docs/development.md` - Rewrote the plugin IIFE bundling paragraph to match compiled-artifact evidence; corrected `make audit`'s path-scope attribution; fixed the monorepo-layout tree's misleading src/tests nesting.
- `docs/testing.md` - Reworded a D-13 verify-grep false-positive ("not just" → "not only").
- `.planning/phases/05-documentation-truth-pass/drift/06-low-fanout.md` - Before/after record for all three docs, citing source line numbers and compiled-artifact evidence.

## Decisions Made

- Chose to verify the plugin-bundling claim against `dist/index.global.js`/`dist/index.cjs` rather than stopping at `tsup.config.ts` — the config's `noExternal: ['@dnzn/dxkit']` alone would have supported the doc's original (wrong) claim; only checking the compiled output revealed there's nothing to bundle in practice, since every plugin only imports types from core.
- Left the `import '@dnzn/dxkit-settings'`/`import '@dnzn/dxkit-wallet'` side-effect imports (used purely for TS declaration-merging, zero runtime footprint) undocumented in cookbook.md/development.md beyond the one corrected sentence — that implicit contract belongs to `plugin-development.md`'s scope (already covered there per Plan 05-05's duck-typing section), not this plan's three docs.
- Reworded rather than deleted the "not just" phrase in testing.md — the sentence's meaning (DOM applies to every test file, not a subset) is correct and worth keeping; only the specific word choice tripped the automated D-13 gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale module-augmentation package name in cookbook.md**
- **Found during:** Task 1
- **Issue:** The Custom Events Between Dapps recipe used `declare module 'dxkit'` instead of the actual package name `'@dnzn/dxkit'` — TypeScript declaration merging requires the literal module specifier to match, so the snippet as written would not augment `EventMap` at all. Plan 05-02 already fixed the identical bug in `events-reference.md` and `api-reference.md`, but cookbook.md (out of that plan's file scope) still had it.
- **Fix:** Corrected the module specifier to `'@dnzn/dxkit'`.
- **Files modified:** `docs/cookbook.md`
- **Commit:** `9b31d0a`

**2. [Rule 1 - Bug] Fixed false plugin-bundling claim in development.md**
- **Found during:** Task 2
- **Issue:** The Build System section claimed plugin IIFE builds bundle both `@dnzn/dxkit` core and sibling plugin packages (e.g. "wallet bundles settings") inline via `noExternal`. Checked every plugin's `tsup.config.ts` (none list a sibling package in `noExternal`) and the compiled `dist/index.global.js` (zero references to `@dnzn/dxkit-settings`, zero bundled core code beyond an unrelated string literal) — the claim didn't match either the config or the build output.
- **Fix:** Rewrote the paragraph to state the actual mechanism: plugins only type-import from `@dnzn/dxkit`, so there's nothing to bundle either way; standalone `<script>` tags work because the runtime dependency doesn't exist, not because anything is inlined.
- **Files modified:** `docs/development.md`
- **Commit:** `96e0946`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bug fixes)
**Impact on plan:** Both fixes are within the plan's explicit "verify against source" mandate — neither reopens shipped code (D-03), both are doc-only corrections of claims that didn't match `src/`/`plugins/*/src/` or the compiled `tsup` output.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three docs (cookbook.md, development.md, testing.md) are source-and-toolchain accurate and slop-clean; every automated verify grep in the plan passes.
- Cookbook snippets are grounded in current 0.2.0 event/config shapes but not compile-checked in this plan — per this plan's own `<verification>` note, that authoritative compile-check is Plan 08's job (D-04).
- The `declare module '@dnzn/dxkit'` fix now applies consistently across every doc that shows the module-augmentation pattern (`events-reference.md`, `api-reference.md` from Plan 05-02; `cookbook.md` from this plan) — Plan 05-08's cross-doc consistency sweep has no remaining known instance to check for this specific pattern.
- development.md's corrected bundling paragraph is now consistent with the actual zero-runtime-deps posture stated in `README.md`/`.claude/CLAUDE.md` ("Zero runtime deps... the zero-dep posture is a selling point") — the old claim, while not contradicting that constraint outright, described a bundling mechanism that doesn't exist.

---
*Phase: 05-documentation-truth-pass*
*Completed: 2026-07-14*

## Self-Check: PASSED

- FOUND: docs/cookbook.md
- FOUND: docs/development.md
- FOUND: docs/testing.md
- FOUND: .planning/phases/05-documentation-truth-pass/drift/06-low-fanout.md
- FOUND: 9b31d0a (docs(cookbook) commit)
- FOUND: 96e0946 (docs(development) commit)
- FOUND: 137b9c1 (docs(testing) commit)

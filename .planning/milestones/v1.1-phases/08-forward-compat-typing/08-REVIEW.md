---
phase: 08-forward-compat-typing
reviewed: 2026-07-17T19:20:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - .github/workflows/ci.yml
  - smoke/dist-exports.smoke.test.ts
  - smoke/fixtures/expected-exports.ts
  - smoke/node-builtins.d.ts
  - tests/typecheck-config.test.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-07-17T19:20:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the FCT-01/02/03 tsconfig flag-presence guard (`tests/typecheck-config.test.ts` addition), the new FCT-04 build-artifact smoke test infrastructure (`smoke/dist-exports.smoke.test.ts`, `smoke/fixtures/expected-exports.ts`, `smoke/node-builtins.d.ts`), and the CI wiring (`.github/workflows/ci.yml`). All tests were run directly (`make typecheck`, `make build`, `make smoke`, `npx vitest run tests/typecheck-config.test.ts`) and pass cleanly — no functional/runtime defects were found in the currently-exercised code paths.

The one substantive gap: the new `smoke/` directory's own TypeScript files are never passed through `tsc` by any Makefile target or CI step, which undercuts this phase's "forward-compat typing" charter for the code it just added. This was confirmed empirically (`tsc --listFiles` under `tsconfig.typecheck.json` matches zero `smoke/` files). The remaining findings are minor quality/maintainability notes.

## Warnings

### WR-01: `smoke/` TypeScript files are never type-checked by any tsc invocation

**File:** `smoke/node-builtins.d.ts`, `smoke/dist-exports.smoke.test.ts`, `smoke/fixtures/expected-exports.ts`
**Issue:** `tsconfig.typecheck.json:14` sets `"include": ["src", "tests"]` — it does not include `smoke`. `make typecheck` (and therefore `make test`, which depends on it) never parses any file under `smoke/`. `make smoke` only runs `npx vitest run --config vitest.smoke.config.ts`, which transpiles via esbuild (type-stripping only, no type checking). Verified directly:
```
$ npx tsc --noEmit -p tsconfig.typecheck.json --listFiles 2>&1 | grep -i smoke
(no output — zero smoke/ files matched)
```
Practically, this means a type error introduced into `smoke/dist-exports.smoke.test.ts` (e.g. passing the wrong argument type to `vm.runInContext`, indexing `EXPECTED_EXPORTS` with a typo'd key, or a signature drift in `smoke/node-builtins.d.ts`) would pass CI silently — the test would only fail if the mistake also happened to break at runtime, and many type errors (e.g. `any`-typed `createRequire` return, wrong generic argument) would not. This is a real regression-detection gap for a phase whose explicit purpose is durable, CI-enforced type-safety guards (the sibling `tests/typecheck-config.test.ts:228-249` addition in this same phase exists precisely to make flag regressions fail loudly — the `smoke/` directory itself doesn't get that same guarantee for its own code).

Biome's `files.includes` was correctly extended to cover `smoke/**/*.ts` (`biome.json:40`) for lint/format, but linting does not catch type errors (e.g. wrong argument arity/type, incorrect property access) — only `tsc` does.

**Fix:** Add `smoke` to the root typecheck include list (this does not require building `dist/` first, so it doesn't reintroduce the "`make test` never builds" constraint that `vitest.smoke.config.ts`'s header comment protects):
```json
// tsconfig.typecheck.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "...": "..." },
  "include": ["src", "tests", "smoke"]
}
```
Since `smoke/node-builtins.d.ts` isn't included in the root `tsconfig.json`'s "src"-only program, and `smoke/` imports `happy-dom`'s `Window` and Vitest's `describe/expect/it`, confirm the `paths` block still resolves after the change (`make typecheck` should stay green — verified locally that this addition doesn't require any other config change beyond the `include` array).

## Info

### IN-01: Unused `isContext` export in ambient `node:vm` declaration

**File:** `smoke/node-builtins.d.ts:9-13`
**Issue:** The ambient module declares and exports `isContext` (both as a named export and as a property of the `default` export), but nothing in the codebase calls `vm.isContext`:
```
$ grep -rn "isContext" smoke/ tests/ src/ plugins/
smoke/node-builtins.d.ts:10:  function isContext(object: unknown): boolean;
smoke/node-builtins.d.ts:11:  const _default: { runInContext: typeof runInContext; isContext: typeof isContext };
smoke/node-builtins.d.ts:13:  export { isContext, runInContext };
```
This contradicts the file's own header comment ("Minimal ambient declarations for the Node built-ins used by...") and the project's stated "declare only what's used" discipline for these ambient-decl files (mirrored in `tests/node-builtins.d.ts`, which declares nothing unused).
**Fix:** Drop `isContext` from the declaration (and from the `_default` object literal and the named `export {}`) until it's actually consumed:
```typescript
declare module 'node:vm' {
  interface Context {}
  function runInContext(code: string, contextifiedObject: Context, options?: { filename?: string }): unknown;
  const _default: { runInContext: typeof runInContext };
  export default _default;
  export { runInContext };
}
```

### IN-02: `node:fs` / `node:path` / `process` ambient declarations duplicated verbatim across two files

**File:** `smoke/node-builtins.d.ts:22-30` vs. `tests/node-builtins.d.ts:7-15`
**Issue:** `smoke/node-builtins.d.ts` re-declares `node:fs`'s `readFileSync`, `node:path`'s `resolve`, and the global `process` shape identically to `tests/node-builtins.d.ts`, with no shared source of truth. This is a deliberate isolation trade-off documented in `08-PATTERNS.md` ("keeps the `smoke/` directory self-contained"), but it means the two signatures can silently drift out of sync (e.g. one file's `readFileSync` overload gains a new encoding value and the other doesn't), and there's no compiler link between them to catch it — especially relevant once WR-01 is fixed and both files are typechecked in the same `tsc` run (declaration merging across ambient modules with mismatched signatures would then surface as a real type error only for whichever file is compiled second).
**Fix:** Not urgent, but consider a shared `node-builtins.d.ts` at a common ambient-types root (e.g. `types/node-builtins.d.ts`) referenced by both `tsconfig.typecheck.json`'s `include`, rather than two independently-maintained copies — or, at minimum, a comment cross-referencing the sibling file so a future edit to one prompts a check of the other.

### IN-03: `environment: 'happy-dom'` in `vitest.smoke.config.ts` is unused by the test it configures

**File:** `smoke/dist-exports.smoke.test.ts` (config: `vitest.smoke.config.ts:8`)
**Issue:** `dist-exports.smoke.test.ts` never touches Vitest's ambient `window`/`document`/`globalThis` — every DOM-like object it uses is an explicitly-constructed `new Window()` from the imported `happy-dom` package (lines 71, 88). Setting `environment: 'happy-dom'` at the config level appears to be copied from `vitest.config.ts`'s pattern (per `08-PATTERNS.md`'s "same `defineConfig` shape" guidance) without re-justifying it for this file's actual needs — the test would behave identically under the default `node` environment since it never reads the implicit global DOM.
**Fix:** Either drop the `environment` key (defaults to `node`) or add a one-line comment explaining why the ambient happy-dom environment is still needed (if there's a reason not visible from the test code alone, e.g. a future test in this directory that will rely on it) — as-is, it reads as an unexplained/unnecessary carry-over from the `vitest.config.ts` analog.

---

_Reviewed: 2026-07-17T19:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

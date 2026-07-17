---
phase: 07-typescript-6-migration-standalone-typecheck
reviewed: 2026-07-17T15:47:07Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/utils.ts
  - src/types/shell.ts
  - tsup.config.ts
  - plugins/auth/tsup.config.ts
  - plugins/wallet/tsup.config.ts
  - plugins/theme/tsup.config.ts
  - plugins/settings/tsup.config.ts
  - tsconfig.typecheck.json
  - plugins/auth/tsconfig.typecheck.json
  - plugins/wallet/tsconfig.typecheck.json
  - plugins/theme/tsconfig.typecheck.json
  - plugins/settings/tsconfig.typecheck.json
  - Makefile
  - package.json
  - tests/stress.test.ts
  - plugins/auth/tests/auth.test.ts
  - plugins/wallet/tests/wallet.test.ts
  - plugins/theme/tests/theme.test.ts
  - plugins/settings/tests/settings.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-07-17T15:47:07Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

This phase migrates the toolchain to TypeScript `^6.0.0`, adds a standalone `tsc --noEmit`
typecheck pass (root + all 4 plugins, now wired into `make test`/`test-watch`), replaces
tsup's bundled `dts:true` emission with a direct `tsc --emitDeclarationOnly` `onSuccess`
hook (to dodge TS6's TS5101 baseUrl deprecation from `rollup-plugin-dts`), and introduces
`DeepPartial<T>` to correctly type `deepMerge`'s recursive runtime contract.

I verified this empirically rather than just reading it:
- `npx tsc --noEmit -p tsconfig.typecheck.json` passes clean at root and in all 4 plugins.
- `npx tsup` (root + all 4 plugins) produces all three formats (`index.js`, `index.cjs`,
  `index.global.js`) plus a correctly cross-referencing multi-file `.d.ts` tree; ran the
  root build 5x back-to-back with `rm -rf dist` between runs — outputs were consistently
  complete (no reproducible race between the `clean: true` ESM/CJS config entry and the
  `IIFE` entry that runs without `clean`, despite them printing interleaved log lines).
- Built external "consumer" `.ts` files against the emitted `dist/index.d.ts` and
  `plugins/settings/dist/index.d.ts` (module resolution `bundler`, respecting the
  `exports` map) — both resolve `DeepPartial<DappManifest>` and cross-package types with
  zero errors, confirming the dts-emission swap didn't break the public type surface.
  Also confirmed the settings plugin's IIFE bundle contains zero core-package code
  (`createEventBus` etc. — 0 matches), preserving the documented "types-only import from
  core" zero-bundling posture.
  - All 142 tests across the 5 reviewed test files pass; the test-file edits (removing
  now-unused `@ts-expect-error` directives, adding missing mock methods, `Buffer` →
  `TextEncoder`, `as EventListener` → `as unknown as EventListener`) are all
  baseline type-error fixes that make the mocks conform to the real interfaces — none of
  them weaken an assertion or change what's being verified.

The two real findings below are both in `src/utils.ts`'s new `DeepPartial<T>` /
`deepMerge` pairing: the generic recursive-partial type silently breaks on function-valued
fields, and `deepMerge` silently discards special object values (`Date`, `Map`, `Set`,
`RegExp`, class instances) when merged over an existing field of the same shape. Neither
is currently reachable through `DappManifest` (today's only real caller — pure JSON-shaped
data, no functions/Dates/Maps), so nothing is broken in this codebase today, but both are
latent correctness traps for the next person who reuses these exported, generically-named
utilities against a richer type.

## Warnings

### WR-01: `DeepPartial<T>` silently strips callability from function-valued fields

**File:** `src/utils.ts:2`
**Issue:** `DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T`
treats functions as objects (functions satisfy `T extends object`), so any field typed as a
function gets recursively mapped over its own `keyof` (arity/`name`/`call`/`apply`/etc.)
instead of being passed through unchanged. The result is a non-callable type. Verified this
concretely:

```ts
type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
interface WithFn { loader: (src: string) => Promise<void>; name: string; }
declare const dp: DeepPartial<WithFn>;
dp.loader?.('hello');
// error TS2349: This expression is not callable. Type '{}' has no call signatures.
```

`DappManifest` (the only current consumer, via `DappEntry.overrides?: DeepPartial<DappManifest>`
in `src/types/shell.ts:11`) has no function-valued fields today, so this doesn't currently
break anything. But `DeepPartial` is a generically-named, broadly-scoped exported type in a
shared `utils.ts` — the natural next use is against something like
`LifecycleManagerOptions` (which does have function fields: `scriptLoader`, `styleLoader`,
`templateLoader`, `sanitizeTemplate`), where this same pattern would silently produce
non-callable types with no compiler warning pointing at the real cause.

**Fix:** Add a function-type escape hatch before the generic object branch (this is the
standard fix for recursive-partial utility types):
```ts
export type DeepPartial<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
```

### WR-02: `deepMerge` silently discards `Date`/`Map`/`Set`/`RegExp`/class-instance values on override

**File:** `src/utils.ts:13-22`
**Issue:** The recursion guard only checks `typeof val === 'object' && !Array.isArray(val)`
(and the same for the existing `result[key]`) before recursing with `deepMerge(result[key], val)`.
It doesn't distinguish a plain data object from a `Date`/`Map`/`Set`/`RegExp`/other class
instance. Since `Object.keys()` on a `Date` (or similar) returns no own enumerable
properties, recursing into it silently produces a near-empty clone of the *old* value
instead of the *new* one — a silent data-loss bug, not a type error. Verified at runtime:

```js
const a = { createdAt: new Date('2020-01-01') };
const b = { createdAt: new Date('2026-07-17') };
deepMerge(a, b).createdAt; // => {}  (not a Date, not either date's value)
```

`DappManifest` has no such fields today, so this is unreachable through the shell's actual
manifest-override path (`src/shell.ts:230`). But `deepMerge`/`DeepPartial` are generic,
exported utilities with a doc comment ("Deep-merge b into a...") that reads as a
general-purpose contract, not one scoped to plain-JSON manifests — the next caller who
merges a richer options object (e.g. one carrying a `Map`, `Set`, or timestamp) will hit
silent corruption with no error signal.

**Fix:** Guard the recursion with a plain-object check instead of a bare `typeof` test, e.g.:
```ts
function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}
```
and use `isPlainObject(val) && isPlainObject(result[key])` as the recursion condition, so
`Date`/`Map`/`Set`/`RegExp`/class instances fall through to the direct-replace branch
(`result[key] = val`) instead of being merged field-by-field.

## Info

### IN-01: `DeepPartial`/`deepMerge`'s doc comments don't scope the contract to plain-JSON shapes

**File:** `src/utils.ts:1,4`
**Issue:** The one-line doc comments ("Recursive Partial<T>...", "Deep-merge b into a...")
read as general-purpose contracts. Given WR-01/WR-02, the actual safe usage is narrower
(plain, JSON-shaped data only — no functions, no `Date`/`Map`/`Set`/`RegExp`/class
instances).
**Fix:** Either apply the WR-01/WR-02 fixes so the utilities are actually general-purpose,
or tighten the doc comments to explicitly scope them to plain-data types (matching the
"Comment ... implicit contracts" convention in this repo's `CLAUDE.md`), e.g.: "Only safe
for plain JSON-shaped data — functions and non-plain objects (Date, Map, Set, RegExp, class
instances) are not handled correctly."

---

_Reviewed: 2026-07-17T15:47:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

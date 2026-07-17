# Phase 7: TypeScript 6 Migration & Standalone Typecheck - Pattern Map

**Mapped:** 2026-07-17
**Files analyzed:** 12 (5 new tsconfig.typecheck.json, 1 Makefile edit, 1 package.json edit, 1 src/utils.ts fix, ~4 test files with pre-existing errors)
**Analogs found:** 12 / 12 (this phase's own RESEARCH.md already contains verified, working code for every new file — the "analog" for the new configs is the existing build tsconfig + Makefile target it's modeled on)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `tsconfig.typecheck.json` (root, NEW) | config | batch (compile-check) | `tsconfig.json` (root) | exact (extends it) |
| `plugins/{auth,wallet,theme,settings}/tsconfig.typecheck.json` (NEW, x4) | config | batch (compile-check) | `plugins/<name>/tsconfig.json` | exact (extends it) |
| `Makefile` (`typecheck` target, edit) | config | batch | `verify-outputs` target (Makefile:77-95) | exact — identical per-package loop shape |
| `Makefile` (`test`/`test-watch` prereq, edit) | config | batch | `test`/`test-watch` targets (Makefile:33-37) | exact |
| `package.json` (root, `typescript` devDep bump) | config | — | existing `"typescript": "^5.8.3"` line (package.json:51) | exact (same line, new value) |
| `src/utils.ts` (`deepMerge` signature fix) | utility | transform | itself (pre-existing function, signature-only fix) | exact — no external analog needed |
| `tests/utils.test.ts`, `tests/shell.test.ts`, `tests/stress.test.ts` (fix pre-existing type errors) | test | request-response / event-driven (test assertions) | themselves — errors are call-site symptoms of `src/utils.ts`'s type, fixed by consuming `DeepPartial<T>` correctly / adjusting a cast | n/a — in-place fixes, not new patterns |
| `plugins/auth/tests/auth.test.ts`, `plugins/wallet/tests/wallet.test.ts`, `plugins/theme/tests/theme.test.ts`, `plugins/settings/tests/settings.test.ts` (fix pre-existing type errors) | test | request-response | themselves | n/a — in-place fixes |

## Pattern Assignments

### `tsconfig.typecheck.json` (root, NEW)

**Analog:** `tsconfig.json` (root) — read in full above (20 lines).

**Base config being extended** (`tsconfig.json:1-20`):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**New typecheck config to write** (verified working shape, from RESEARCH.md Pattern 1 — empirically tested this session against the real repo under both TS 5.9.3 and 6.0.3):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": ".",
    "paths": {
      "@dnzn/dxkit": ["./src/index.ts"],
      "@dnzn/dxkit-wallet": ["./plugins/wallet/src/index.ts"],
      "@dnzn/dxkit-auth": ["./plugins/auth/src/index.ts"],
      "@dnzn/dxkit-theme": ["./plugins/theme/src/index.ts"],
      "@dnzn/dxkit-settings": ["./plugins/settings/src/index.ts"]
    }
  },
  "include": ["src", "tests"]
}
```
Critical: do NOT add `baseUrl` (triggers `TS5101` deprecation error under TS6 — Pitfall 3). Do NOT leave `rootDir` at the inherited `"src"` (triggers `TS6059` — Pitfalls 1/2); it must be widened to `"."` (root) / `"../.."` (plugins) because cross-package `paths` resolve to real sibling `.ts` source, not built `.d.ts`.

---

### `plugins/{auth,wallet,theme,settings}/tsconfig.typecheck.json` (NEW, x4)

**Analog:** `plugins/auth/tsconfig.json` (read in full — 9 lines; same shape for wallet/theme/settings):
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

**New typecheck config per plugin** (example: `plugins/auth/tsconfig.typecheck.json`; substitute `auth` for `wallet`/`theme`/`settings` and adjust its own self-referencing alias):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "../..",
    "paths": {
      "@dnzn/dxkit": ["../../src/index.ts"],
      "@dnzn/dxkit-wallet": ["../wallet/src/index.ts"],
      "@dnzn/dxkit-auth": ["../auth/src/index.ts"],
      "@dnzn/dxkit-theme": ["../theme/src/index.ts"],
      "@dnzn/dxkit-settings": ["../settings/src/index.ts"]
    }
  },
  "include": ["src", "tests"]
}
```
Note this extends the plugin's own `./tsconfig.json` (which itself extends `../../tsconfig.json`), not the root directly — matches the existing plugin tsconfig's own extends chain.

Verified command per package: `(cd plugins/<name> && npx tsc --noEmit -p tsconfig.typecheck.json)` — already run successfully in RESEARCH.md against the live repo.

---

### `Makefile` — new `typecheck` target + `test`/`test-watch` prereq

**Analog:** `verify-outputs` target (`Makefile:77-95`) — the exact structural template already in the file:
```makefile
verify-outputs:
	@echo
	@echo "VERIFYING BUILD OUTPUTS: ."
	@echo
	@for f in dist/index.js dist/index.cjs dist/index.global.js; do \
		test -f "$$f" || { echo "MISSING: $$f (root package)"; exit 1; }; \
		echo "OK: $$f"; \
	done
	@for dir in $(PLUGIN_BUILD_ORDER); do \
		echo; \
		echo "VERIFYING BUILD OUTPUTS: $$dir"; \
		echo; \
		for f in dist/index.js dist/index.cjs dist/index.global.js; do \
			test -f "$$dir$$f" || { echo "MISSING: $$dir$$f"; exit 1; }; \
			echo "OK: $$dir$$f"; \
		done; \
	done
```

**`PLUGIN_BUILD_ORDER` var already defined** (`Makefile:5`):
```makefile
PLUGIN_BUILD_ORDER := plugins/settings/ plugins/wallet/ plugins/auth/ plugins/theme/
```
Reuse this var verbatim — do not redefine or duplicate the package list (RESEARCH.md "Don't Hand-Roll" table explicitly calls this out).

**New `typecheck` target to add** (verified shape, RESEARCH.md Pattern 2):
```makefile
typecheck:
	@echo
	@echo "TYPECHECKING: ."
	@echo
	@npx tsc --noEmit -p tsconfig.typecheck.json
	@for dir in $(PLUGIN_BUILD_ORDER); do \
		echo; \
		echo "TYPECHECKING: $$dir"; \
		echo; \
		(cd $$dir && npx tsc --noEmit -p tsconfig.typecheck.json) || exit 1; \
	done
```

**Existing `test`/`test-watch` targets to modify** (`Makefile:33-37`, currently `lint`-only prereq):
```makefile
test: lint
	npx vitest run

test-watch: lint
	npx vitest
```
New form (D-06 ordering: lint → typecheck → vitest):
```makefile
test: lint typecheck
	npx vitest run

test-watch: lint typecheck
	npx vitest
```

**`.PHONY` line to update** (`Makefile:7`, currently):
```makefile
.PHONY: setup build test test-watch lint lint-fix format clean superclean audit commit publish release verify-outputs
```
Add `typecheck` to this list.

---

### `package.json` (root) — `typescript` devDep bump

**Current line** (`package.json:51`):
```json
"typescript": "^5.8.3",
```
**New line** (per D-08, caret convention preserved — matches Phase 6's D-03 pattern of caret ranges on devDeps):
```json
"typescript": "^6.0.0",
```
Followed by `pnpm install` to regenerate `pnpm-lock.yaml` pinning the resolved `6.0.3`. Optionally mirror the make target as an npm script (e.g. `"typecheck": "make typecheck"` or equivalent per-package script) — Claude's Discretion per CONTEXT.md.

---

### `src/utils.ts` — `deepMerge` signature fix (baseline commit, not part of the TS6 bump)

**Current (buggy) signature** (`src/utils.ts:2`):
```typescript
export function deepMerge<T extends Record<string, any>>(a: T, b: Partial<T>): T {
```
`Partial<T>` is shallow — nested optional objects still require all their own properties, which is why callers passing a partially-nested override object fail to type-check even though `deepMerge` works correctly at runtime (confirmed empirically in RESEARCH.md against `tests/utils.test.ts:11,16,26,102`).

**Fix** (add a `DeepPartial<T>` utility type in the same file; implementation body unchanged, only the type signature changes):
```typescript
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

export function deepMerge<T extends Record<string, any>>(a: T, b: DeepPartial<T>): T {
  // implementation unchanged
}
```
This is the pattern to copy for any other shallow-`Partial<T>` usage found at plan time (RESEARCH.md flags `tests/shell.test.ts:308`'s `overrides.nav` as very likely rooted in the same underlying field type — check wherever `ShellConfig`'s per-dapp `overrides` is declared and consider reusing `DeepPartial<T>` there too, rather than patching each call site independently).

---

### `tests/stress.test.ts` — `CustomEvent` → `EventListener` cast fix (baseline commit)

**Current (rejected under both TS5.9/TS6) pattern**, 4 occurrences (`tests/stress.test.ts:243,338,366,507`; example at line 243):
```typescript
const onSubpath = ((e: CustomEvent) => subpathEvents.push(e.detail)) as EventListener;
```
**Fix — pick one, apply consistently across all 4 occurrences:**
```typescript
// Option A — double-cast through unknown
const onSubpath = ((e: CustomEvent) => subpathEvents.push(e.detail)) as unknown as EventListener;

// Option B — type the handler as EventListener directly, narrow inside
const onSubpath: EventListener = (e) => subpathEvents.push((e as CustomEvent).detail);
```

---

### Pre-existing test-only errors in plugin test files (baseline commit, not TS6-caused)

These are **not** new patterns to copy from elsewhere — they are one-line, in-place fixes to existing test files, cataloged with exact line numbers by RESEARCH.md's Pitfall 4 table:

| File | Line(s) | Error | Fix shape |
|------|---------|-------|-----------|
| `plugins/auth/tests/auth.test.ts` | 18 | mock `Wallet` missing `getProviders`/`getActiveProvider` | Add the two missing members to the mock object literal |
| `plugins/auth/tests/auth.test.ts` | 53 | `Record<string, Plugin>` rejects `undefined` from conditional spread | Adjust the conditional-spread construction so it doesn't produce `{ wallet?: undefined }`, or type the intermediate as `Partial<Record<...>>` before the final assignment |
| `plugins/wallet/tests/wallet.test.ts` | 254 | `Cannot find name 'Buffer'` (`TS2591` under TS6) | Prefer rewriting to avoid the Node global (e.g. `TextEncoder`/manual hex) per RESEARCH.md's Open Question 1 recommendation — keeps zero new devDeps and browser-first posture |
| `plugins/wallet/tests/wallet.test.ts` | 563 | unused `@ts-expect-error` (`TS2578`) | Remove the now-stale directive |
| `plugins/theme/tests/theme.test.ts` | 425 | unused `@ts-expect-error` (`TS2578`) | Remove the now-stale directive |
| `plugins/theme/tests/theme.test.ts` | 462 | callback return type narrower than declared generic return | Widen the callback's declared return type to match the generic |
| `plugins/settings/tests/settings.test.ts` | 511 | unused `@ts-expect-error` (`TS2578`) | Remove the now-stale directive |

## Shared Patterns

### Per-package Makefile loop
**Source:** `verify-outputs` target, `Makefile:77-95`, using `PLUGIN_BUILD_ORDER` (`Makefile:5`)
**Apply to:** the new `typecheck` target — identical loop shape, only the inner command changes (`tsc --noEmit -p tsconfig.typecheck.json` instead of file-existence checks).

### tsconfig `extends` chain
**Source:** existing `plugins/*/tsconfig.json` files, all of which `extends: "../../tsconfig.json"`
**Apply to:** every new `tsconfig.typecheck.json` — root extends `./tsconfig.json`, each plugin's typecheck config extends its own `./tsconfig.json` (which in turn extends root), never skipping straight to root.

### Caret devDep range convention
**Source:** `package.json:51` (`"typescript": "^5.8.3"`), carried from Phase 6 D-03
**Apply to:** the `typescript` bump to `^6.0.0` — do not pin an exact patch version.

### vitest alias map as the paths-mirroring source of truth
**Source:** `vitest.config.ts:6-11` (the 5-entry `aliases` object)
**Apply to:** the `paths` block in every new `tsconfig.typecheck.json` — same 5 keys, same target files, but expressed as `tsc`-relative arrays without `baseUrl` (vitest's alias map uses absolute `path.resolve()` paths; tsc's `paths` must be relative to the tsconfig file location instead — the two configs necessarily diverge in shape even though they express the same aliases).

## No Analog Found

None. Every file this phase touches either has a directly analogous existing config (tsconfig.json → tsconfig.typecheck.json, Makefile target → Makefile target) or is an in-place fix to an existing file where the "pattern" is the file's own pre-existing (buggy) code, fully cataloged with line numbers in RESEARCH.md's Pitfall 4/Code Examples sections.

## Metadata

**Analog search scope:** repo root (`tsconfig.json`, `Makefile`, `package.json`, `vitest.config.ts`, `src/utils.ts`), `plugins/auth/tsconfig.json`, `tests/utils.test.ts`, `tests/shell.test.ts`, `tests/stress.test.ts` — all read directly; RESEARCH.md's empirical findings (this session, against the live repo) supplied the remaining plugin test file line references without needing separate re-reads.
**Files scanned:** 9 read directly + 3 grepped for line context
**Pattern extraction date:** 2026-07-17

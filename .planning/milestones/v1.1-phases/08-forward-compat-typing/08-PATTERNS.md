# Phase 8: Forward-Compat Typing - Pattern Map

**Mapped:** 2026-07-17
**Files analyzed:** 8
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `tsconfig.json` (root) | config | transform (compiler flags) | itself (existing file, edit in place) | exact |
| `Makefile` — new `smoke` target | config/utility | batch (build → verify) | `verify-outputs` target (`Makefile:77-95`) | exact |
| `.github/workflows/ci.yml` — wire `make smoke` | config | batch (CI pipeline step) | `make verify-outputs` step (`.github/workflows/ci.yml`, after `make build`) | exact |
| `biome.json` — extend `files.includes` | config | transform (lint scope) | existing `files.includes` array (`biome.json:39`) | exact |
| `vitest.smoke.config.ts` (new) | config | request-response (test runner config) | `vitest.config.ts` | exact |
| `smoke/dist-exports.smoke.test.ts` (new) | test | file-I/O + event-driven (reads `dist/`, execs code via vm) | `tests/typecheck-config.test.ts` | role-match (config-reading test) |
| `smoke/fixtures/expected-exports.ts` (new) | utility (fixture) | transform | `tests/node-builtins.d.ts` (adjacent ambient-decl convention, not a fixture itself but same "supporting file next to a config-guard test" pattern) | partial |
| ambient decls for `node:vm` / `node:module` (new, likely `smoke/node-builtins.d.ts` or extend existing) | utility (type decls) | transform | `tests/node-builtins.d.ts` | exact |

## Pattern Assignments

### `tsconfig.json` (config, transform)

**Analog:** itself — edit in place, no external analog needed; the three flags are additive `compilerOptions` keys.

**Current shape** (full file, `tsconfig.json:1-19`):
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
    "declarationMap": false,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```
Per D-01, add `"verbatimModuleSyntax": true`, `"isolatedDeclarations": true`, `"erasableSyntaxOnly": true` inside `compilerOptions`. This is the single source of truth: plugins inherit via `extends: "../../tsconfig.json"` (confirmed pattern from Phase 7), and `tsconfig.typecheck.json` + the `tsc --emitDeclarationOnly -p tsconfig.json` `onSuccess` hook both read this same file.

**No JSON-comment/ordering convention beyond alphabetical-ish grouping observed** — insert the three new flags near `isolatedModules`/`declaration` (logically adjacent strictness/emit flags) to match the existing grouping style.

---

### `Makefile` — new `smoke` target (utility/config, batch)

**Analog:** `verify-outputs` target, `Makefile:77-95`

**Structural template to copy** (full excerpt):
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
	@echo
	@echo "All build outputs present (3 formats x 5 packages)."
```

**Reusable list:** `PLUGIN_BUILD_ORDER := plugins/settings/ plugins/wallet/ plugins/auth/ plugins/theme/` (`Makefile:5`) — the canonical per-package list; reuse verbatim, do not hand-roll a second list (research explicitly calls this out as the reuse point).

**`smoke` target shape** (per D-04, self-builds then runs a separate vitest config):
```makefile
smoke: build
	@echo
	@echo "RUNNING BUILD-ARTIFACT SMOKE TEST"
	@echo
	@npx vitest run --config vitest.smoke.config.ts
```
Register in `.PHONY` (`Makefile:7`) alongside the existing list: `setup build test test-watch lint lint-fix format clean superclean audit commit publish release verify-outputs typecheck smoke`.

**Wiring into `release`/`publish` prerequisite chains** (`Makefile:64,71`):
```makefile
release: build verify-outputs test
publish: build verify-outputs test
```
Per Open Question 2's recommendation, insert `smoke` after `verify-outputs`: `release: build verify-outputs smoke test` / `publish: build verify-outputs smoke test`.

---

### `.github/workflows/ci.yml` — CI wiring (config, batch)

**Analog:** current step order, full file:
```yaml
      - run: pnpm install --frozen-lockfile
      - run: make build
      - run: make verify-outputs
      - run: make test
```

**Pattern to copy:** one `- run: make <target>` line per Makefile target, in the same order the Makefile chains them. Insert `- run: make smoke` immediately after `- run: make verify-outputs` (matches the Makefile `release`/`publish` insertion point and Open Question 2's recommendation — `smoke` self-builds via its own `build` prerequisite but the CI step order should still mirror local dev order).

---

### `biome.json` — extend `files.includes` (config, transform)

**Analog:** existing array, `biome.json:39` (approx, within `"files": { "includes": [...] }` block):
```json
"files": {
  "includes": ["src/**/*.ts", "tests/**/*.ts", "plugins/*/src/**/*.ts", "plugins/*/tests/**/*.ts"]
```

**Pattern to copy:** append a new glob string in the same flat-array style: add `"smoke/**/*.ts"` to the list (Pitfall 3 — Biome's `files.includes` is an allowlist, not an ignore-list; the new `smoke/` directory is invisible to `make lint` until added here).

---

### `vitest.smoke.config.ts` (new) (config, request-response)

**Analog:** `vitest.config.ts` (full file, reproduced above under Environment Availability read)

**Pattern to copy** — same `defineConfig` shape, narrower `include`, no path aliases needed (smoke tests import built `dist/` files directly, not source via alias):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['smoke/**/*.smoke.test.ts'],
  },
});
```
Deviation from `vitest.config.ts`: no `resolve.alias` block (smoke tests target `dist/` artifacts, not `src/` via the `@dnzn/dxkit*` aliases) — per Pitfall 2, this must be a **separate config file**, never merged into `vitest.config.ts`'s `include`, so `make test`'s existing "does not build" guarantee stays intact.

---

### `smoke/dist-exports.smoke.test.ts` (new) (test, file-I/O + event-driven)

**Analog:** `tests/typecheck-config.test.ts` (full file read; role-match as a "config/artifact-reading guard test with its own local ambient-decl file")

**Imports pattern to copy** (`tests/typecheck-config.test.ts:1-9`):
```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Node built-ins used here are typed by tests/node-builtins.d.ts (a fresh ambient declaration),
// so this test needs no @types/node — a devDependency Phase 7 deliberately avoids (07-02 rewrote
// Buffer→TextEncoder for the same reason).
```
Same convention applies to the smoke test: add a one-line comment above the `node:vm` / `node:module` imports explaining the ambient-decl dependency and the zero-`@types/node` posture.

**Structure pattern to copy** (`describe`/`it` nesting, `tests/typecheck-config.test.ts:33-`):
```typescript
describe('TypeScript 6 Config Invariants (TS6-02 Guard)', () => {
  const tsconfigFilePaths = [ /* ... list of paths ... */ ];

  it('should have no ignoreDeprecations in any tsconfig file (TS6-02)', () => {
    for (const filePath of tsconfigFilePaths) {
      const config = readConfigFile(filePath) as Record<string, unknown>;
      expect(config, `${filePath} should not contain ...`).not.toHaveProperty('ignoreDeprecations');
    }
  });
  // ...
});
```
Apply the same "iterate over a package list, assert per-item" shape for the smoke test's per-global (`DxKit`/`DxWallet`/`DxAuth`/`DxTheme`/`DxSettings`) and per-format (CJS/IIFE) assertions, driven by `EXPECTED_EXPORTS` from the fixture file and (for CJS) `PLUGIN_BUILD_ORDER`-equivalent package list.

**Core pattern (from RESEARCH.md, verified this session — treat as canonical, no better in-repo analog exists since this is genuinely new territory):**
```typescript
import { Window } from 'happy-dom';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const code = readFileSync('dist/index.global.js', 'utf-8');
const window = new Window();
vm.runInContext(code, window, { filename: 'dist/index.global.js' });
// window.DxKit now populated — assert Object.keys(window.DxKit).sort() against EXPECTED_EXPORTS.core
```
```typescript
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mod = require('../dist/index.cjs');
// assert Object.keys(mod).sort() against EXPECTED_EXPORTS.core
```
**Do not** use `document.createElement('script')` — verified broken (Pitfall 1, silent failure).

---

### `smoke/fixtures/expected-exports.ts` (new) (utility/fixture, transform)

**No direct in-repo analog** (first fixture file of this kind). Use RESEARCH.md's verified shape directly:
```typescript
export const EXPECTED_EXPORTS = {
  core: ['createEventBus', 'createEventRegistry', 'createLifecycleManager', 'createPluginRegistry', 'createRouter', 'createShell'],
  wallet: ['createEIP1193Provider', 'createEthereumWallet', 'createLocalWalletProvider', 'createWallet'],
  auth: ['createPassthroughAuth'],
  theme: ['createCSSTheme'],
  settings: ['createSettings'],
} as const;
```
Style convention to match project norms: named export, `as const`, `camelCase` factory names — consistent with `Module Design` conventions in `.claude/CLAUDE.md` (named exports only, no default exports).

---

### Ambient decls for `node:vm` / `node:module` (new) (utility/type-decls, transform)

**Analog:** `tests/node-builtins.d.ts` (full file, reproduced above)

**Pattern to copy exactly** (same file header-comment convention, same minimal-surface-only declarations):
```typescript
// Minimal ambient declarations for the Node built-ins used by smoke/dist-exports.smoke.test.ts.
// This lets the smoke test's separate vitest config resolve `node:vm`/`node:module` without
// pulling in @types/node — a devDependency Phase 7 deliberately keeps out of the project.

declare module 'node:vm' {
  interface Context {}
  function runInContext(code: string, contextifiedObject: Context, options?: { filename?: string }): unknown;
  function isContext(object: unknown): boolean;
  const _default: { runInContext: typeof runInContext; isContext: typeof isContext };
  export default _default;
  export { runInContext, isContext };
}

declare module 'node:module' {
  function createRequire(path: string): (id: string) => any;
  export { createRequire };
}
```
Place at `smoke/node-builtins.d.ts` (co-located with the smoke test, mirroring `tests/node-builtins.d.ts`'s co-location with `tests/typecheck-config.test.ts`) rather than extending the existing `tests/` file — keeps the `smoke/` directory self-contained per Pitfall 2's "own top-level directory" isolation goal.

---

## Shared Patterns

### Per-package loop over `PLUGIN_BUILD_ORDER`
**Source:** `Makefile:5,17-22,85-93,102-107` (used identically in `build`, `verify-outputs`, `typecheck`)
**Apply to:** the new `smoke` Makefile target (if it needs its own per-package echo/build step beyond `build`'s own loop) and the smoke test's package-iteration list (as a TS-side mirror, since Makefile vars aren't importable — hardcode the same order: settings, wallet, auth, theme, with core first).
```makefile
@for dir in $(PLUGIN_BUILD_ORDER); do \
	echo; \
	echo "<ACTION>: $$dir"; \
	echo; \
	(cd $$dir && <command>) || exit 1; \
done
```

### `.PHONY` target registration
**Source:** `Makefile:7`
**Apply to:** any new Makefile target (`smoke`) — must be added to the single `.PHONY:` line, not a separate declaration.

### Config-guard test style (read raw JSON/JSONC, assert on shape)
**Source:** `tests/typecheck-config.test.ts` (`parseJsonWithComments`, `readConfigFile` helpers, lines ~15-30)
**Apply to:** an optional Wave-0 companion test (RESEARCH.md flags this as a gap for FCT-01/FCT-03) — a `tsconfig.json` flag-presence guard test asserting `verbatimModuleSyntax`/`isolatedDeclarations`/`erasableSyntaxOnly` are all `true`, using the exact same `readConfigFile` pattern already proven in this file. This could either extend `tests/typecheck-config.test.ts` itself (same file, new `describe` block) or a new adjacent test — both fit the existing pattern; no new analog needed since the source file already contains the reusable helpers.

### Zero-`@types/node` / ambient-decl-per-test-tree convention
**Source:** `tests/node-builtins.d.ts` + its header comment
**Apply to:** `smoke/node-builtins.d.ts` — same rationale (Phase 7's TS6-02 no-`@types/node` posture), same minimal declare-only-what's-used discipline.

## No Analog Found

None — every file in this phase's scope has at least a role-match analog in the existing codebase or a fully research-verified pattern to follow (RESEARCH.md's empirically-tested `vm.runInContext`/`createRequire` code is treated as the canonical source for the two genuinely new mechanisms, since no closer in-repo analog exists for "execute a built artifact and assert its exports").

## Metadata

**Analog search scope:** repo root (`tsconfig.json`, `Makefile`, `biome.json`, `vitest.config.ts`, `.github/workflows/ci.yml`), `tests/` (`typecheck-config.test.ts`, `node-builtins.d.ts`)
**Files scanned:** 8 read in full (all ≤ 130 lines; single-pass reads, no re-reads)
**Pattern extraction date:** 2026-07-17

# Phase 6: Toolchain Audit & Modernization - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 9 (config files, no application source touched)
**Analogs found:** 9 / 9 (all files are edited in place; "analog" = current shape of the same file)

This phase touches only toolchain/config files, not application source. There is no
controller/component/service pattern to map — instead, each file's **own current
content** is the analog: the planner needs the exact current shape to write precise
insertion diffs. One new file (`.npmrc`) has no prior version; its closest analog is
the sibling root dotfile config pattern (`.versionrc.json`) for placement/formatting
conventions.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|------------------|---------------|
| `package.json` (root) | config | batch (install-time) | itself (current content below) | exact |
| `plugins/auth/package.json` | config | batch (install-time) | itself (current content below) | exact |
| `plugins/wallet/package.json` | config | batch (install-time) | `plugins/auth/package.json` shape (near-identical) | exact |
| `plugins/theme/package.json` | config | batch (install-time) | `plugins/auth/package.json` shape (near-identical) | exact |
| `plugins/settings/package.json` | config | batch (install-time) | `plugins/auth/package.json` shape (near-identical) | exact |
| `.npmrc` (new) | config | batch (install-time) | `.versionrc.json` (sibling root dotfile, JSON-esque single-purpose config) | role-match |
| `.github/workflows/ci.yml` | config | event-driven (push/PR trigger) | itself (current content below) | exact |
| `tsconfig.json` / `tsup.config.ts` / `vitest.config.ts` / `biome.json` | config | batch (build/lint/test-time) | itself (current content below); audit-only, likely no edits per Pitfall 4 | exact |
| `.versionrc.json` | config | batch (release-time) | itself — verify unchanged, no edit expected | exact |

## Pattern Assignments

### `package.json` (root) — config, batch

**Current full content** (`/Users/derks/Development/Denizen/dxkit/package.json`):
```json
{
  "name": "@dnzn/dxkit",
  "version": "0.2.1",
  "description": "DxKit — A headless microframework for building composable dapps.",
  "author": "Denizen. <null@dnzn.dev>",
  "license": "MIT",
  "packageManager": "pnpm@10.32.1",
  "repository": {
    "type": "git",
    "url": "https://github.com/dxnzn/dxkit"
  },
  "homepage": "https://dnzn.dev",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "clean": "rm -rf dist"
  },
  "config": {
    "commitizen": {
      "path": "cz-conventional-changelog"
    }
  },
  "devDependencies": {
    "@biomejs/biome": "^2.5.1",
    "commit-and-tag-version": "^12.7.3",
    "commitizen": "^4.3.2",
    "cz-conventional-changelog": "^3.3.0",
    "happy-dom": "^20.10.6",
    "tsup": "^8.4.0",
    "typescript": "^5.8.3",
    "vite": "^7.3.6",
    "vitest": "^4.1.9"
  },
  "pnpm": {
    "overrides": {
      "fast-uri": "^3.1.2",
      "fast-xml-builder": "^1.1.9"
    }
  }
}
```

**Note on version drift:** `.planning/codebase/STACK.md`/PROJECT.md say `0.2.0`; the
real current value is `"version": "0.2.1"` — confirm before any release-tooling
assumption (per CONTEXT.md Specific Ideas).

**Insertion points:**

1. **`engines` field** — new top-level key. Idiomatic placement is directly after
   `"packageManager"` (both are environment/toolchain declarations):
```json
  "packageManager": "pnpm@10.32.1",
  "engines": { "node": ">=22" },
```

2. **`config.commitizen.path` swap** (TOOL-04, D-08) — one-line value change, key
   structure unchanged:
```diff
   "config": {
     "commitizen": {
-      "path": "cz-conventional-changelog"
+      "path": "node_modules/cz-git"
     }
   },
```

3. **`devDependencies` bumps + cz-git swap** (TOOL-03/04) — per RESEARCH.md Standard
   Stack (alphabetical order matches current convention):
```json
  "devDependencies": {
    "@biomejs/biome": "^2.5.4",
    "commit-and-tag-version": "^12.7.3",
    "commitizen": "^4.3.2",
    "cz-git": "^1.13.1",
    "happy-dom": "^20.10.6",
    "tsup": "^8.5.1",
    "typescript": "^5.8.3",
    "vite": "^8.1.4",
    "vitest": "^4.1.10"
  },
```
`cz-conventional-changelog` entry removed entirely (`pnpm remove` handles this — do
not hand-edit if using the CLI per RESEARCH.md Pattern 1).

**Do not touch:** `scripts`, `exports`, `files`, `pnpm.overrides` — none are in scope
this phase.

---

### `plugins/auth/package.json` (config, batch) — representative plugin package.json

**Current full content** (`/Users/derks/Development/Denizen/dxkit/plugins/auth/package.json`):
```json
{
  "name": "@dnzn/dxkit-auth",
  "version": "0.2.1",
  "description": "DxKit auth plugin — wallet passthrough auth",
  "author": "Denizen. <null@dnzn.dev>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/dxnzn/dxkit",
    "directory": "plugins/auth"
  },
  "homepage": "https://dnzn.dev",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@dnzn/dxkit-wallet": "workspace:*",
    "@dnzn/dxkit": "workspace:*"
  }
}
```

**Insertion point** — `engines` after `"homepage"` (plugins have no `packageManager`
field, so `homepage` is the closest neighboring environment-adjacent key):
```json
  "homepage": "https://dnzn.dev",
  "engines": { "node": ">=22" },
```

**Apply identically** (D-05 lockstep — same key, same string, no drift) to:
- `plugins/wallet/package.json`
- `plugins/theme/package.json`
- `plugins/settings/package.json`

Each of these four files has no local `devDependencies` block (they consume the
workspace root's toolchain), so this phase's version bumps do not touch plugin
`package.json` files beyond the `engines` addition.

---

### `.npmrc` (new file) — config, batch

**No analog exists in the repo** — this is a genuinely new file. Closest structural
sibling for "single-purpose root dotfile config" is `.versionrc.json` (root-level,
minimal, single concern). Format is INI-style (npmrc convention), not JSON.

**Full content to create:**
```ini
engine-strict=true
```

Per RESEARCH.md Pattern 2, this is the load-bearing enforcement mechanism — the
`engines` field alone in `package.json` is advisory-only under pnpm. Consider a
one-line `#` comment above it per CLAUDE.md's "document implicit contracts" rule,
e.g.:
```ini
# Converts the advisory `engines` field into a hard install failure (pnpm treats
# engines.node as a warning-only check unless engine-strict is set).
engine-strict=true
```

---

### `.github/workflows/ci.yml` (config, event-driven)

**Current full content:**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: make build
      - run: make test
```

**Single-line diff** (D-07, TOOL-02):
```diff
     strategy:
       matrix:
-        node-version: [20]
+        node-version: [22, 24]
```

**Do not reorder** `pnpm/action-setup@v4` → `actions/setup-node@v4` — this ordering
is already correct (RESEARCH.md Pitfall 6); the `cache: pnpm` option on `setup-node`
depends on pnpm already being installed by the prior step.

**No other lines change** — no new steps this phase (typecheck/lint gates deferred
to Phases 7/9 per D-07).

---

### `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `biome.json` — audit-only

These four are read-only *audit* targets this phase (per RESEARCH.md Pitfall 4 and
`.planning/phases/06.../06-CONTEXT.md` canonical_refs) — confirm no config-shape
break from the tool bumps, edit only if the audit finds an actual required change.

**`vitest.config.ts` full current content** (confirms no `build` key exists — the
Vite 8/Rolldown `build.rollupOptions` rename does not apply here, per Pitfall 4):
```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = path.resolve(__dirname);

const aliases = {
  '@dnzn/dxkit': path.resolve(root, 'src/index.ts'),
  '@dnzn/dxkit-wallet': path.resolve(root, 'plugins/wallet/src/index.ts'),
  '@dnzn/dxkit-auth': path.resolve(root, 'plugins/auth/src/index.ts'),
  '@dnzn/dxkit-theme': path.resolve(root, 'plugins/theme/src/index.ts'),
  '@dnzn/dxkit-settings': path.resolve(root, 'plugins/settings/src/index.ts'),
};

export default defineConfig({
  resolve: { alias: aliases },
  test: {
    environment: 'happy-dom',
    include: [
      'tests/**/*.test.ts',
      'plugins/*/tests/**/*.test.ts',
    ],
  },
});
```
Verification command from Pitfall 4: `grep -n "rollupOptions\|build\.\|cssMinify\|commonjsOptions" vitest.config.ts` — expected to return nothing before/after the Vite bump.

**`tsup.config.ts` full current content** (root; plugin `tsup.config.ts` files follow
the same shape — not reproduced here, same audit applies):
```typescript
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'DxKit',
    outDir: 'dist',
    outExtension: () => ({ js: '.global.js' }),
    sourcemap: true,
    platform: 'browser',
  },
]);
```
No known config-shape fallout expected from tsup 8.4.0 → 8.5.1 (routine patch).

**`biome.json` full current content:**
```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.1/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "assist": { "actions": { "source": { "organizeImports": "on" } } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 120 },
  "linter": {
    "enabled": true,
    "rules": {
      "preset": "recommended",
      "suspicious": { "noExplicitAny": "off" },
      "style": { "noNonNullAssertion": "off" }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "single", "trailingCommas": "all" } },
  "files": { "includes": ["src/**/*.ts", "tests/**/*.ts", "plugins/*/src/**/*.ts", "plugins/*/tests/**/*.ts"] }
}
```
The `$schema` URL is version-pinned to `2.5.1` — bump it to `2.5.4` alongside the
`@biomejs/biome` devDependency bump in `package.json` so the schema reference stays
accurate (small, easy-to-miss diff; not called out explicitly in RESEARCH.md but
follows directly from the version bump).

**`tsconfig.json` full current content** — no changes anticipated this phase (TS
itself stays 5.8.x per D-04; none of the bumped tools touch `compilerOptions`):
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

---

### `.versionrc.json` — verify-only, no edit expected

**Current full content:**
```json
{
  "bumpFiles": [
    { "filename": "package.json", "type": "json" },
    { "filename": "plugins/auth/package.json", "type": "json" },
    { "filename": "plugins/wallet/package.json", "type": "json" },
    { "filename": "plugins/settings/package.json", "type": "json" },
    { "filename": "plugins/theme/package.json", "type": "json" }
  ]
}
```
Already lists all five `package.json` files — no edit needed; the planner's task
here is a verification step (confirm `commit-and-tag-version` still resolves all
five after the `engines`/devDep edits), not a content change.

---

## Shared Patterns

### Per-tool isolated bump commit (D-02)
**Source:** RESEARCH.md Pattern 1 (`.planning/phases/06-toolchain-audit-modernization/06-RESEARCH.md` lines 230–254)
**Apply to:** Every devDependency bump task (tsup, vite, vitest, Biome, cz-git swap)
```bash
pnpm add -D <pkg>@^<version> -w && make test && git commit -m "chore(deps): bump <pkg> to <version>"
```
Biome gets a separate reformat commit if `biome check --write .` produces a non-empty
diff (`style: apply biome <version> formatting`).

### engine-strict + engines pairing (D-05/D-06)
**Source:** RESEARCH.md Pattern 2 (lines 256–284)
**Apply to:** Root `package.json` + all 4 plugin `package.json` + new `.npmrc`
— treat as one atomic unit; `engines` alone does not enforce anything without
`.npmrc engine-strict=true`.

### CI matrix + Makefile contract unchanged
**Source:** `Makefile` (`/Users/derks/Development/Denizen/dxkit/Makefile`) — `test:` target runs `lint` then `vitest run`; `build:` target runs root `tsup` then each plugin's `tsup` in `PLUGIN_BUILD_ORDER` (`plugins/settings/ plugins/wallet/ plugins/auth/ plugins/theme/`).
**Apply to:** TOOL-05 build-output verification — add a `make verify-outputs`-style
target or shell loop, do not bypass the existing `make build`/`make test` contract.
```bash
for f in dist/index.js dist/index.cjs dist/index.global.js; do test -f "$f" || exit 1; done
```
Run once for root and once per plugin dir (using `PLUGIN_BUILD_ORDER` from the
Makefile as the directory list).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.npmrc` | config | batch | Genuinely new file, no prior version in repo — content fully specified above from RESEARCH.md Pattern 2, no codebase analog needed |

## Metadata

**Analog search scope:** repo root (`package.json`, `.npmrc` n/a, `.github/workflows/`, `.versionrc.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `biome.json`), `plugins/auth/package.json` (representative of 4 plugins), `Makefile`
**Files scanned:** 9 config files + Makefile (read in full; all ≤ 60 lines, single-pass reads)
**Pattern extraction date:** 2026-07-15

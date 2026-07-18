[Getting Started](getting-started.md) | [Dapp Development](dapp-development.md) | [Plugin Development](plugin-development.md) | [System Internals](system-internals.md) | [Events Reference](events-reference.md) | [API Reference](api-reference.md) | [Cookbook](cookbook.md) | [Configuration](configuration.md) | **Development** | [Testing](testing.md) | [Security](security.md)

---

# Development

This doc covers the DxKit **repo** itself — the monorepo layout, build system, lint/test tooling, and commit/release conventions for anyone contributing to `@dnzn/dxkit` or its plugins. It is contributor-facing.

If you're building a *dapp* that runs inside DxKit, see [Dapp Development](dapp-development.md) instead. If you're building a DxKit *plugin*, see [Plugin Development](plugin-development.md). This doc is about working on the framework's own source.

[Prerequisites](#prerequisites) | [Local Setup](#local-setup) | [Monorepo Layout](#monorepo-layout) | [Build Commands](#build-commands) | [Build System](#build-system) | [Code Style](#code-style) | [Testing](#testing) | [Commit Conventions](#commit-conventions) | [Versioning & Release](#versioning--release)

---

## Prerequisites

- **Node.js `^22.12.0 || >=24.0.0`** — the workspace declares this floor in every `package.json` `engines` field and enforces it via `.npmrc` `engine-strict=true`, so `pnpm install` fails fast on an unsupported Node (the project targets ES2022 — see `tsconfig.json`). The floor sits inside what the pinned toolchain accepts: Vite requires `^20.19.0 || >=22.12.0` (so it rejects Node 22.0–22.11) and Vitest requires `^20.0.0 || ^22.0.0 || >=24.0.0` (so it rejects the 23.x line) — between them, 22.0–22.11 and 23.x are both out. The project additionally drops the Node 20 line those tools would still accept (EOL, by decision), leaving `^22.12.0 || >=24.0.0`.
- **pnpm 10.32.1** — pinned via the `packageManager` field in `package.json`; use [corepack](https://nodejs.org/api/corepack.html) or install this exact version to avoid lockfile drift
- **make** — all common workflows are wrapped in the root `Makefile`

CI (`.github/workflows/ci.yml`) runs the build + test suite against a Node matrix of `['22.12.0', 24]` on `ubuntu-latest`, triggered on pushes and pull requests to `main`. The pinned `22.12.0` leg exercises the exact declared floor (rather than letting `actions/setup-node` round `22` up to the latest patch), so the `engines` contract is a tested one. Two named guardrail steps run between `make smoke` and `make test`, each failing its own dedicated GitHub Check: `Typecheck / deprecation gate (GATE-01)` (`make typecheck`) surfaces a `tsc`/deprecation regression on its own instead of buried inside `make test`, and `Zero-runtime-dependency assertion (GATE-02)` (`make verify-no-runtime-deps`) fails the build if the core package ever declares a runtime dependency.

Dependency freshness is automated by [Renovate](https://docs.renovatebot.com/) via a committed `renovate.json` (pnpm workspace): it opens grouped update PRs with a 3-day `minimumReleaseAge` (filtering yanked/compromised fresh releases) and always requires human review for major bumps of the toolchain group (tsup, vite, vitest, happy-dom, Biome, TypeScript). Automation only goes live once the Mend Renovate GitHub App is installed on the repo — committing `renovate.json` alone does not activate it.

## Local Setup

```bash
git clone https://github.com/dxnzn/dxkit
cd dxkit
make setup    # pnpm install
make build    # build core + all plugins
make test     # lint + typecheck + run the full test suite
```

`make setup` runs `pnpm install`, which resolves the workspace (root package + `plugins/*`) in one lockfile. There is no `.env` file or environment-based config to set up — DxKit is configured entirely in code (see [Configuration](configuration.md)).

## Monorepo Layout

The repo is a pnpm workspace defined in `pnpm-workspace.yaml`:

```yaml
packages:
  - "."
  - "plugins/*"
```

```
dxkit/
├── src/                  # @dnzn/dxkit core (shell, router, lifecycle, events, registry)
├── tests/                # core unit tests (vitest)
├── plugins/              # each has its own src/, tests/, package.json, tsup.config.ts
│   ├── settings/         # @dnzn/dxkit-settings
│   ├── wallet/           # @dnzn/dxkit-wallet
│   ├── auth/             # @dnzn/dxkit-auth
│   └── theme/            # @dnzn/dxkit-theme
├── docs/                 # this documentation set
├── tsup.config.ts        # core build config
├── vitest.config.ts      # standalone test config (root + all plugins)
├── biome.json            # lint/format config
└── Makefile               # all common dev workflows
```

Each plugin is its own workspace package with its own `package.json`, `src/`, `tests/`, and `tsup.config.ts`. Plugins depend on `@dnzn/dxkit` and, where applicable, on each other via `workspace:*` (e.g. `@dnzn/dxkit-wallet` depends on `@dnzn/dxkit-settings`).

Because of that cross-plugin dependency, the `Makefile` builds plugins in a fixed order rather than in parallel:

```make
PLUGIN_BUILD_ORDER := plugins/settings/ plugins/wallet/ plugins/auth/ plugins/theme/
```

`settings` has no plugin dependencies and builds first; `wallet` depends on `settings`; `auth` and `theme` build last.

## Build Commands

All common workflows are wrapped in the root `Makefile`. Run `make <target>` from the repo root.

| Command | Description |
|---|---|
| `make setup` | Install dependencies (`pnpm install`) and initialize the workspace |
| `make build` | Build `@dnzn/dxkit` core, then each plugin in dependency order, into `dist/` and `plugins/*/dist/` |
| `make test` | Run `make lint`, then `make typecheck`, then the full vitest suite (`vitest run`) across core + all plugins |
| `make test-watch` | Run `make lint`, then `make typecheck`, then vitest in watch mode |
| `make typecheck` | Standalone `tsc --noEmit -p tsconfig.typecheck.json` for the core package and each plugin (5 packages) — a dedicated type-check pass independent of the `tsup` build's declaration emit. Exits non-zero on any type error. |
| `make lint` | `biome check .` — lint check only, no writes |
| `make lint-fix` | `biome check --write .` — auto-fix lint issues |
| `make lint-format` | `biome format --write .` — auto-fix formatting only |
| `make clean` | Remove `dist/` from the core package and every plugin |
| `make superclean` | Remove `dist/` and `node_modules/` from the core package and every plugin |
| `make verify-outputs` | Assert all three build outputs (`dist/index.js`, `dist/index.cjs`, `dist/index.global.js`) exist for the core package and each plugin — 15 checks total; exits non-zero on any missing artifact. Run it after `make build`. |
| `make verify-no-runtime-deps` | Run `scripts/check-no-runtime-deps.cjs` against the core `@dnzn/dxkit` root `package.json` — fails (non-zero) if it declares any external `dependencies`, `peerDependencies`, or `optionalDependencies`, machine-enforcing the zero-runtime-dependency posture (GATE-02). Zero-dep itself (only `node:` builtins); wired into `make release`/`make publish` and CI. |
| `make smoke` | Build first (declared prerequisite), then run the build-artifact smoke test (`vitest run --config vitest.smoke.config.ts`) against the real `dist/` outputs — asserts each IIFE global attaches with its full expected export-key set and CJS `require()` interop returns the same set, for core + all 4 plugins. Deliberately **not** part of `make test`; runs in release/publish/CI after `verify-outputs`. |
| `make audit` | Run `pnpm audit` (dependency vulnerabilities), `semgrep --config p/typescript` (SAST) against `src/` and `plugins/`, and `gitleaks detect` (secret scanning) across the whole repo |
| `make commit` | `npx cz` — open the Commitizen conventional-commit prompt |
| `make release` | `build`, `verify-outputs`, `verify-no-runtime-deps`, `smoke`, `test`, then run `commit-and-tag-version` to bump versions and generate the changelog |
| `make publish` | `build`, `verify-outputs`, `verify-no-runtime-deps`, `smoke`, `test`, then `pnpm publish --access public` for core and each plugin in build order |

`make test` and `make test-watch` run in order — `make lint`, then `make typecheck`, then vitest — so a lint failure or a type error blocks the test run before any specs execute.

Individual packages also expose their own `package.json` scripts (`build`, `clean`, and, on the root package only, `test`, `test:watch`, `lint`, `lint:fix`, `format`) if you prefer to run tools directly with `npx` instead of `make`. Plugin packages only define `build` and `clean` — lint and test are run from the root via the shared `vitest.config.ts` and `biome.json`, not per-plugin.

## Build System

Each package (core + the 4 plugins) builds with [tsup](https://tsup.egoist.dev/) from a single TypeScript entry point (`src/index.ts`) into three output formats:

| Format | Path | Purpose |
|---|---|---|
| ESM | `dist/index.js` | Modern `import`/`export` — bundlers, Node.js, `<script type="module">` |
| CJS | `dist/index.cjs` | CommonJS `require()` — legacy Node.js tooling |
| IIFE | `dist/index.global.js` | Self-contained `<script>` tag — no bundler required, the primary target for IPFS/static hosting |

The `exports` field in each package's `package.json` routes consumers to the right format automatically. Each package's `globalName` for the IIFE build:

| Package | Global |
|---|---|
| `@dnzn/dxkit` | `DxKit` |
| `@dnzn/dxkit-wallet` | `DxWallet` |
| `@dnzn/dxkit-auth` | `DxAuth` |
| `@dnzn/dxkit-theme` | `DxTheme` |
| `@dnzn/dxkit-settings` | `DxSettings` |

Each plugin's `tsup.config.ts` sets `noExternal: ['@dnzn/dxkit']` on its IIFE build (and `external: ['@dnzn/dxkit']` on its ESM/CJS builds, so bundler consumers don't get it duplicated). In practice every plugin imports only *types* from `@dnzn/dxkit`, so nothing from core ends up in any output — the `<script>` tag works standalone because the plugin doesn't need `@dnzn/dxkit`'s runtime at all, not because it's bundled in. Cross-plugin references (e.g. wallet's `import '@dnzn/dxkit-settings'`, used only to pull in that package's ambient type declarations) are left external in every build target and are not inlined. See `tsup.config.ts` (root) and `plugins/*/tsup.config.ts` for the exact per-package config.

TypeScript compiles to `ES2022` with `strict: true` (`tsconfig.json`); `.d.ts` declarations and source maps are emitted for every ESM/CJS build. Declaration emit runs as a dedicated `tsc --emitDeclarationOnly` pass wired into each package's `tsup` `onSuccess` hook (rather than tsup's built-in `dts` bundler) — tsup 8.5's bundled `dts` injects a `baseUrl` that TypeScript 6 deprecates (`TS5101`), so declarations are emitted by `tsc` directly to keep the build free of deprecation shims.

The base `tsconfig.json` also enables three strict forward-compat flags — `verbatimModuleSyntax`, `isolatedDeclarations`, and `erasableSyntaxOnly` — inherited by every package via `extends`. They keep the source ready for a future TS 7.x jump (import elision made explicit, per-file `.d.ts` emit guaranteed, no non-erasable TS-only syntax); a durable guard in `tests/typecheck-config.test.ts` fails the suite if any of the three is silently removed. See [Configuration › `tsconfig.json`](configuration.md) for the per-flag rationale.

## Code Style

Linting and formatting are handled by [Biome](https://biomejs.dev/) (`biome.json`) — there is no ESLint or Prettier config in this repo.

- **Indent:** 2 spaces
- **Line width:** 120 characters
- **Quotes:** single quotes
- **Trailing commas:** all
- **Linter preset:** `recommended`, with `noExplicitAny` and `noNonNullAssertion` turned off
- **Import organization:** Biome's `organizeImports` assist runs on save/check

Biome checks `src/**/*.ts`, `tests/**/*.ts`, `plugins/*/src/**/*.ts`, `plugins/*/tests/**/*.ts`, and `smoke/**/*.ts` (see `biome.json` `files.includes`).

Run it with:

```bash
make lint         # check only
make lint-fix      # auto-fix lint issues
make lint-format    # auto-fix formatting only
```

`make test` and `make test-watch` run `make lint` and `make typecheck` first, so lint failures and type errors are caught before tests execute — both locally and in CI (`make test` is invoked directly in `.github/workflows/ci.yml`).

## Testing

Tests run under [vitest](https://vitest.dev/) with [happy-dom](https://github.com/capricorn86/happy-dom) as the DOM environment, using a single root-level config: `vitest.config.ts`. There is no per-package vitest config — the root config's `include` glob picks up both core and plugin tests:

```ts
include: [
  'tests/**/*.test.ts',
  'plugins/*/tests/**/*.test.ts',
],
```

`vitest.config.ts` also aliases each workspace package name (`@dnzn/dxkit`, `@dnzn/dxkit-wallet`, `@dnzn/dxkit-auth`, `@dnzn/dxkit-theme`, `@dnzn/dxkit-settings`) directly to its `src/index.ts`, so plugin tests can import other packages without a prior build step.

Run the suite:

```bash
make test         # lint + typecheck + vitest run (core + all plugins)
make test-watch    # lint + typecheck + vitest watch mode
```

Or directly from the root, bypassing the lint gate:

```bash
npx vitest run
npx vitest              # watch mode
npx vitest run tests/router.test.ts   # single file
```

Test files live alongside each package's source in a sibling `tests/` directory and follow the `*.test.ts` naming convention:

```
tests/                    # core: events, lifecycle, registry, router, shell, utils
plugins/settings/tests/
plugins/wallet/tests/
plugins/auth/tests/
plugins/theme/tests/
```

There is no separate coverage-threshold configuration in this repo — `make test` gates on lint + typecheck + all tests passing, not a coverage percentage.

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, with an optional scope (`feat(theme): add onApply hook`) and a `!` suffix plus `BREAKING CHANGE:` footer for breaking changes.

The repo is wired for [Commitizen](https://github.com/commitizen/cz-cli) via the `config.commitizen` field in `package.json` (`config.commitizen.path` points at the maintained [`cz-git`](https://github.com/Zhengqbbb/cz-git) adapter) to walk you through building a compliant commit message:

```bash
make commit    # npx cz
```

Keep the subject line under 72 characters; use the body to explain the *why* and the shape of the change, and reference any docs updated alongside the commit.

## Versioning & Release

Releases are cut with [`commit-and-tag-version`](https://github.com/absolute-version/commit-and-tag-version), configured in `.versionrc.json` to bump the version across the root package and all four plugin `package.json` files together:

```json
"bumpFiles": [
  { "filename": "package.json", "type": "json" },
  { "filename": "plugins/auth/package.json", "type": "json" },
  { "filename": "plugins/wallet/package.json", "type": "json" },
  { "filename": "plugins/settings/package.json", "type": "json" },
  { "filename": "plugins/theme/package.json", "type": "json" }
]
```

The full flow, wrapped in `make release` and `make publish`:

```bash
make release    # build + test, then commit-and-tag-version (bumps versions, writes CHANGELOG.md, tags)
# review the generated changelog, then:
git push --follow-tags
make publish     # build + test, then pnpm publish --access public for core + each plugin in build order
```

`commit-and-tag-version` derives the version bump and changelog entries from Conventional Commit history, so accurate commit types/scopes (see [Commit Conventions](#commit-conventions)) directly determine the next release's semver bump.

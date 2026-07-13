<!-- generated-by: gsd-doc-writer -->
# Contributing to DxKit

DxKit is `vibe/alpha` software (see [README](README.md#project-status)). Contributions are
welcome, but expect the API surface to shift — breaking changes are acceptable pre-beta as
long as they're documented with a `BREAKING CHANGE:` footer and migration notes.

## Development Setup

**Prerequisites:**
- Node.js >= 18 (ES2022 target)
- pnpm 10.x (the repo pins `pnpm@10.32.1` via `packageManager` in `package.json`)

**Setup:**

```bash
git clone https://github.com/dxnzn/dxkit
cd dxkit
make setup
```

This is a pnpm workspace ([`pnpm-workspace.yaml`](pnpm-workspace.yaml)) with the core package at
the repo root and each plugin under `plugins/*` (`auth`, `settings`, `theme`, `wallet`).

Common commands (see the [README](README.md#common-helpers) for the full list):

```bash
make build       # Build dxkit + all plugins -> dist/ + plugins/*/dist/
make test        # Lint + run all tests (vitest + happy-dom)
make test-watch  # Lint + run tests in watch mode
make lint         # Run biome check
make lint-fix     # Run biome check with auto-fix
```

## Coding Standards

Code style is enforced by [Biome](https://biomejs.dev) 2.5.1 (`biome.json`) — 2-space indent,
120-character line width, single quotes, trailing commas everywhere.

- Run `make lint` to check, `make lint-fix` to auto-fix, `make lint-format` for formatting only.
- `make test` runs lint before tests, and CI (`.github/workflows/ci.yml`) runs `make build` and
  `make test` on every push and pull request to `main` — lint and test failures block merges.
- **Zero runtime dependencies**: DxKit core and every plugin ship with no runtime dependencies.
  New `dependencies` entries are not accepted; `devDependencies` are fine when scoped to
  tooling/build/test.
- Comment the "why," not the "what" — see the in-line commentary guidance in
  [CLAUDE.md](CLAUDE.md#in-line-commentary) if you're unsure what level of detail is expected.

## Testing

Tests run on [Vitest](https://vitest.dev) with `happy-dom` for DOM APIs, configured in
`vitest.config.ts`. Core tests live in `tests/*.test.ts`; each plugin has its own
`plugins/<name>/tests/*.test.ts`.

```bash
make test        # lint + full suite (core + all plugins)
make test-watch  # lint + watch mode
```

New behavior should ship with tests. If you're touching lifecycle, routing, or event-bus
internals, add or update the corresponding test file rather than relying on manual verification.

## Commit Conventions

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

- Type prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- Scope is optional: `feat(theme): add onApply hook`.
- Breaking changes use a `!` suffix (`feat!: rename entry to entrypoint` or
  `feat(manifest)!: remove styles field`) **and** a `BREAKING CHANGE:` footer in the commit
  body explaining what changed and how consumers should migrate.
- Subject line under 72 characters; use the body to explain the "why" and the shape of the
  change, not a line-by-line diff recap.
- If a commit updates docs to reflect the change, reference them in the body, e.g.
  `See: docs/api-reference.md (lines 40-55)`.

Run `make commit` (wraps `npx cz`, backed by `cz-conventional-changelog` per the `commitizen`
config in `package.json`) for a guided commit message prompt if you'd rather not hand-write one.

## Pull Request Guidelines

There is no `.github/PULL_REQUEST_TEMPLATE.md` in this repo yet, so use the following as a
checklist when opening a PR:

- Branch from `main`; there's no enforced branch-naming convention, but a short descriptive
  name (e.g. `fix/router-hash-mode`) is preferred.
- Keep commits conventional (see above) — squash noisy WIP commits before requesting review.
- Run `make test` locally before pushing; CI re-runs `make build` and `make test` on every PR
  against `main` and must pass.
- Describe the "why" in the PR description, not just the diff — call out any breaking changes,
  new events, or manifest/config shape changes explicitly.
- If your change affects documented behavior, update the relevant file under `docs/` in the
  same PR.

## Reporting Issues

There are no issue templates under `.github/ISSUE_TEMPLATE/` yet. When filing an issue on
[GitHub](https://github.com/dxnzn/dxkit/issues), include:

- DxKit version (and plugin versions, if relevant) from your `package.json`
- Steps to reproduce
- Expected vs. actual behavior
- Runtime context: Node version, browser (if the issue is browser-side), and whether you're
  using the ESM, CJS, or IIFE build

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE) that covers this project.

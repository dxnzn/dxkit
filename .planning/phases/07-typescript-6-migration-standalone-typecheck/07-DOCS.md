---
phase: "07"
status: current
verified_against: 8f1e84600352217aa9e8b1f60264c9c5c6ee6f50
updated: 2026-07-17
---

# Phase 07 — Documentation Update

Scoped docs pass: updated only the developer documentation whose claims drifted from Phase 7's
changes (TypeScript 6 bump, standalone `make typecheck`, and the dts-emission move off tsup's
bundled `dts:true`). Unrelated hand-written docs were left untouched per the `only for what is
relevant to phase 7` request.

## Updated

- **README.md** — added `make typecheck` to Common Helpers; `make test` / `make test-watch`
  descriptions now read "Lint + typecheck + run all tests".
- **docs/development.md** — quickstart + Make-targets table now include `make typecheck` (with a
  dedicated row) and the corrected `make test` order (lint → typecheck → vitest); the build
  section now documents that `.d.ts` is emitted by a `tsc --emitDeclarationOnly` pass in tsup's
  `onSuccess` hook (not tsup's bundled `dts`, which injects a TS6-deprecated `baseUrl`); coverage
  note updated to "lint + typecheck + all tests".
- **docs/testing.md** — `make test` / `make test-watch` and the CI description now include the
  standalone `tsc --noEmit` typecheck step between lint and vitest.
- **docs/configuration.md** — corrected the ESM/CJS build note (declarations via
  `tsc --emitDeclarationOnly` in `onSuccess`, not `dts: true`); added a note describing the new
  per-package `tsconfig.typecheck.json` (extends the build config, `noEmit: true`, includes
  `tests/`, `paths` mirror vitest aliases, no `baseUrl`).

## Review follow-up (PR #7, 2026-07-17)

Re-verified after review-response code changes. `docs/configuration.md`'s tsconfig table updated to
`declarationMap: false` (declaration maps are no longer emitted, since the published package ships
only `dist`). All other doc claims (make targets, `tsc --emitDeclarationOnly` dts approach, typecheck
wiring) remain accurate; `verified_against` bumped to the post-fix HEAD.

## Verified (no drift found)

- No developer doc hardcodes a TypeScript version, so the 5.8.3→6.0.x bump required no version
  edits in README/docs (the stale `TypeScript 5.8.3` lines live only in `.claude/CLAUDE.md`, a
  GSD-managed project-context file outside the developer-docs surface — left untouched).
- All updated claims were cross-checked against the live repo: `Makefile` (`test: lint typecheck`;
  `typecheck` loops root + `PLUGIN_BUILD_ORDER`), `tsup.config.ts` + `plugins/*/tsup.config.ts`
  (`onSuccess: 'npx tsc -p tsconfig.json --emitDeclarationOnly'`), and `tsconfig.typecheck.json`
  (`noEmit: true`, no `baseUrl`, `include: ["src","tests"]`).

---
phase: 08
status: current
verified_against: 71c44491a5ef75ec73a0ae661874d153433aaca3
updated: 2026-07-17
---

# Phase 08 — Documentation Update

Phase-scoped docs pass for the Forward-Compat Typing phase. Phase 8's code changes are
build-tooling scoped — three strict `tsconfig.json` forward-compat flags, a new `make smoke`
build-artifact test target, its `smoke/` infrastructure, biome allowlist, and CI wiring — so
this pass targeted the docs those changes could drift, and verified the rest were unaffected.

## Updated (drift corrected)

- **README.md** — Added `make smoke` to the Common Helpers make-target list.
- **docs/development.md** — Added the `make smoke` row to the Make Targets table; corrected
  `make release` / `make publish` descriptions to include the new `smoke` step (now
  `build → verify-outputs → smoke → test`); added `smoke/**/*.ts` to the documented Biome
  `files.includes` set; documented the three forward-compat flags in the build-system
  narrative with a cross-link to Configuration.
- **docs/testing.md** — Inserted `- run: make smoke` into the CI yaml block (real order is
  `build → verify-outputs → smoke → test`) and updated the surrounding prose; added a `make smoke`
  row to the Running Tests table; added a new **Build-artifact smoke test** section describing
  `smoke/`, `vitest.smoke.config.ts`, the CJS `require()` + IIFE `vm.runInContext` global-attach
  checks, the `build` prerequisite, and its deliberate exclusion from `make test`.
- **docs/configuration.md** — Added `verbatimModuleSyntax`, `isolatedDeclarations`, and
  `erasableSyntaxOnly` rows (with per-flag rationale) to the `tsconfig.json` settings table,
  plus a paragraph on the flag-presence guard test and the smoke gate.

## Verified accurate — no drift (not changed)

- **docs/security.md** — Phase 8's `vm.runInContext` is a test-only build-artifact check
  (repo-local `dist/` only), not a production runtime surface; no security-doc drift.
- **docs/getting-started.md**, **docs/api-reference.md**, **docs/cookbook.md**,
  **docs/dapp-development.md**, **docs/plugin-development.md**, **docs/events-reference.md**,
  **docs/system-internals.md**, **docs/plugins/*.md** — Phase 8 changed no public API, runtime
  behavior, event surface, or plugin contracts (zero `src/` / `plugins/*/src/` churn), so these
  docs remain accurate as written.

## Notes

- CLAUDE.md carries an illustrative copy of the Common Helpers make list that is also missing
  `make smoke`; left untouched as hand-maintained project instructions rather than published docs.
- Verified against live code: `.github/workflows/ci.yml`, `Makefile` (`smoke:`, `release:`,
  `publish:`, `.PHONY`), `biome.json`, `tsconfig.json`, and `smoke/dist-exports.smoke.test.ts`.

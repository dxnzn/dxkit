---
phase: 06
status: current
verified_against: 4620ad1cc71911d5e4d5b2f3f6c97411ce616433
updated: 2026-07-17
---

# Phase 06 — Documentation Ship Gate

Docs pass for Phase 6 (Toolchain Audit & Modernization). Phase 6 changed build/CI
configuration only (Node floor, tool versions, commitizen adapter, CI matrix,
build-output verification), so the drift was confined to the docs that state those
facts. Scanned all shipped developer docs (`docs/`, `README.md`) plus the `.claude/CLAUDE.md`
stack reference for references to the changed values, and corrected every stale one.

## Updated (drift corrected)

- **`docs/development.md`**
  - Prerequisites: `Node.js 18+` → `Node.js ^22.12.0 || >=24.0.0`, with a note that the floor
    is enforced via `.npmrc` `engine-strict=true` and matches the pinned Vite/Vitest ranges
    (22.0–22.11 and 23.x excluded by design).
  - CI line: `runs against Node 20` → `Node matrix ['22.12.0', 24]`, explaining the pinned floor leg.
  - Build-commands table: added `make verify-outputs`; updated `make release` / `make publish` to
    show their new `verify-outputs` prerequisite.
  - Commit Conventions: `cz-conventional-changelog` → maintained `cz-git` adapter (`config.commitizen.path`).
- **`docs/testing.md`**
  - `vitest ^4.1.9` → `^4.1.10`.
  - CI snippet + prose: single-Node `20` matrix → `['22.12.0', 24]`; added the `make verify-outputs`
    step between build and test.
- **`docs/configuration.md`**
  - `Biome 2.5.1` → `Biome 2.5.4`.
- **`.claude/CLAUDE.md`** (stack reference facts)
  - `Node 18+` → `^22.12.0 || >=24.0.0` (3 occurrences).
  - Tool versions: `tsup 8.4.0` → `8.5.1`, `vite 7.3.6` → `8.1.4`, `vitest 4.1.9` → `4.1.10`,
    `Biome 2.5.1` → `2.5.4` (2 occurrences).
  - Commit tooling: `cz-conventional-changelog 3.3.0` → `cz-git 1.13.1`.

## Verified accurate (no change needed)

- `README.md` — states no Node floor, CI matrix, or commitizen-adapter facts; the `make` helper
  list and build-output format table remain correct. No drift.
- `docs/getting-started.md`, `docs/api-reference.md`, `docs/dapp-development.md`,
  `docs/plugin-development.md`, `docs/system-internals.md`, `docs/events-reference.md`,
  `docs/cookbook.md`, `docs/security.md`, and `docs/plugins/*.md` — describe framework
  runtime behavior, not the toolchain versions Phase 6 changed; no Phase-6-relevant claims.

## Intentionally NOT changed (historical record)

- `.planning/ROADMAP.md` Success Criterion 1 and `06-CONTEXT.md` D-05 still read the literal
  `engines: { "node": ">=22" }`. These are the historical planning contract as decided at
  discuss/plan time; the intentional gap-closure tightening to `^22.12.0 || >=24.0.0` is recorded
  in `PROJECT.md` Key Decisions, `06-VERIFICATION.md`, and the ROADMAP completion annotation.
  Rewriting the original criteria text would falsify the record, so it was left intact.

Result: developer documentation is back in truth with the code as of `4620ad1`.

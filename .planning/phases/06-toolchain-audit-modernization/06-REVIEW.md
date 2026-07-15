---
phase: 06-toolchain-audit-modernization
reviewed: 2026-07-15T17:11:53Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - .github/workflows/ci.yml
  - .npmrc
  - Makefile
  - biome.json
  - package.json
  - plugins/auth/package.json
  - plugins/settings/package.json
  - plugins/theme/package.json
  - plugins/wallet/package.json
  - tests/lifecycle.test.ts
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-07-15T17:11:53Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase raised the Node engines floor to `>=22` with `engine-strict=true`, moved CI to Node `[22, 24]`, bumped tsup/vite/vitest/happy-dom/Biome, swapped `cz-conventional-changelog` for `cz-git`, and added a `verify-outputs` Makefile target.

Version consistency across the five `package.json` files is clean: all are `0.2.1`, all declare `engines.node: ">=22"`, all point at the same repo. The Biome schema bump (2.5.1 → 2.5.4) matches the dep bump, and the reformatted `tests/lifecycle.test.ts` is a whitespace-only Biome reflow with no behavioral change. `cz-git` resolves correctly and the commitizen `path` uses cz-git's documented form.

The central defect is in the very thing this phase set out to harden: the declared `engines.node` range is self-contradictory with the toolchain versions pinned this phase, and `engine-strict=true` is exactly the flag that converts that contradiction into a hard `pnpm install` failure. The CI matrix `[22, 24]` happens to sidestep every failing point, so CI stays green while the declared support contract is wrong — the opposite of the milestone's "documented behavior matches actual behavior" goal. Two secondary issues: the new `verify-outputs` safeguard is never invoked by any automated flow, and the toolchain now type-checks against `@types/node@25` while shipping to a Node 22 runtime floor.

## Critical Issues

### CR-01: `engines.node: ">=22"` is self-contradictory with the pinned toolchain under `engine-strict=true`

**File:** `package.json:8-10` (mirrored in all four plugin `package.json` `engines` fields); `.npmrc:3`
**Issue:**
The declared floor `>=22` admits Node versions that the devDependencies bumped this phase explicitly reject, and `.npmrc`'s `engine-strict=true` turns those mismatches into install-time failures — provable directly from `pnpm-lock.yaml`:

- `vite@8.1.4` (and 16 related packages) declare `engines: {node: ^20.19.0 || >=22.12.0}`. Node `22.0.0`–`22.11.x` satisfy the project's `>=22` floor but **fail** vite's constraint. A contributor on, say, Node 22.9 hits an `Unsupported engine` failure on `pnpm install --frozen-lockfile`.
- `vitest@4.1.10` declares `engines: {node: ^20.0.0 || ^22.0.0 || >=24.0.0}`. Node `23.x` is a legitimate release inside the declared `>=22` range, but satisfies **neither** `^22` nor `>=24`, so it also fails under `engine-strict`.

The CI matrix `[22, 24]` masks this entirely: GitHub Actions resolves bare `22` to the latest 22.x (which is `>22.12`) and `24` is fine, so no CI leg ever exercises the broken sub-ranges (`22.0–22.11`, all of `23.x`). The result is a green pipeline over an inaccurate, self-contradictory engines contract — the exact "documented vs. actual" drift this milestone exists to eliminate.

**Fix:**
Tighten the floor to the real minimum the toolchain supports, matching vite's constraint, so `engine-strict` and the declared range agree. Apply to the root and all four plugins:
```json
"engines": {
  "node": "^22.12.0 || >=24.0.0"
}
```
This excludes the pre-`22.12` patch releases (vite) and the unsupported `23.x` line (vitest), and keeps CI's `[22, 24]` legs valid. Update the CI matrix to also pin a lower-bound leg (e.g. `22.12`) so the declared floor is actually exercised rather than silently rounded up to latest.

## Warnings

### WR-01: `verify-outputs` is added but never invoked by CI, `release`, or `publish` — the safeguard is inert

**File:** `Makefile:77-95`; `.github/workflows/ci.yml:22-24`
**Issue:**
The new `verify-outputs` target asserts all three output formats exist for all five packages, but nothing runs it automatically. CI runs `make build` then `make test` (ci.yml:23-24) and never calls `verify-outputs`. `publish: build test` (Makefile:71) and `release: build test` (Makefile:64) also skip it. So if `tsup` silently stops emitting an IIFE (`dist/index.global.js`) for a plugin, CI stays green and `make publish` will ship a package missing a documented format — the precise regression this target was written to catch. A guard that never runs provides no protection.

**Fix:**
Wire it into the automated paths. In CI, add a step after build:
```yaml
      - run: make build
      - run: make verify-outputs
      - run: make test
```
And gate publishing on it so a broken build can't be released:
```makefile
publish: build verify-outputs test
release: build verify-outputs test
```

### WR-02: CI never exercises the declared engines floor, so CR-01 is invisible to the pipeline

**File:** `.github/workflows/ci.yml:12-14`
**Issue:**
The matrix `node-version: [22, 24]` uses bare major versions, which `actions/setup-node` resolves to the latest patch of each line. Combined with `engine-strict=true`, this means CI only ever installs on Node versions that satisfy every dependency's engines — it can never catch a floor that is set too low or a hole in the supported range (both present in CR-01). The engines contract this phase introduced is therefore untested by the phase's own CI.
**Fix:**
Add an explicit lower-bound leg that matches the intended floor so `engine-strict` validates it, e.g. `node-version: ['22.12', 22, 24]` (or whatever floor CR-01 settles on). Pinning at least one exact patch version makes the floor a tested contract rather than an assumption.

### WR-03: Toolchain type-checks against `@types/node@25` while the runtime floor is Node 22

**File:** `package.json:44-54` (transitively; `pnpm-lock.yaml` resolves `@types/node@25.5.0`)
**Issue:**
vite 8, vitest 4, and commitizen all resolve `@types/node@25.5.0`. Type-checking and build tooling therefore see Node 25's API surface, while `engines.node` promises the code runs on Node 22. Any Node 23/24/25-only API used in `src/` or plugin sources would type-check clean yet throw at runtime on the declared floor — a silent hole in the "failures are visible" posture. This is lower severity than CR-01 because `@types/node` is pulled transitively, not declared, and DxKit's runtime is browser/IIFE-oriented, but it still means the type checker is not validating against the supported runtime.
**Fix:**
Pin `@types/node` to the supported major as a direct devDependency so types track the runtime floor:
```json
"devDependencies": {
  "@types/node": "^22.12.0"
}
```
Re-run `pnpm install` to update the lockfile resolution.

---

_Reviewed: 2026-07-15T17:11:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

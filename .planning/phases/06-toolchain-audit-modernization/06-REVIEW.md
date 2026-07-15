---
phase: 06-toolchain-audit-modernization
reviewed: 2026-07-15T19:10:34Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - package.json
  - plugins/auth/package.json
  - plugins/wallet/package.json
  - plugins/theme/package.json
  - plugins/settings/package.json
  - .github/workflows/ci.yml
  - Makefile
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 06: Code Review Report (Gap-Closure Re-Review)

**Reviewed:** 2026-07-15T19:10:34Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This is a re-review of the three gap-closure commits (`13f7766`, `00e586e`, `aaac2c7`) written to
close CR-01, WR-01, and WR-02 from the original `06-REVIEW.md`. All three targeted gaps were
verified directly against the installed toolchain (actual `engines` fields read out of
`node_modules/.pnpm/.../package.json`, not just trusted from commit messages) and against `make`
prerequisite semantics — **all three are cleanly closed with no new Critical/BLOCKER issues.**
Two minor residual findings were surfaced in the same files (below), plus a note on the prior
review's WR-03 (`@types/node`) which remains outstanding but was explicitly out of scope for this
gap-closure cycle.

**CR-01 (engines range) — CLOSED, correctly.** `engines.node` now reads
`^22.12.0 || >=24.0.0` in all five `package.json` files (root + 4 plugins), changed in lockstep in
a single commit (`13f7766`). I confirmed the actual installed ranges rather than trusting the
commit message: `vite@8.1.4` declares `^20.19.0 || >=22.12.0` and `vitest@4.1.10` declares
`^20.0.0 || ^22.0.0 || >=24.0.0`. `^22.12.0` (22.12.0–22.999) is a subset of both `>=22.12.0`
(vite) and `^22.0.0` (vitest, since 22.12.0–22.999 ⊂ 22.0.0–22.999); `>=24.0.0` matches both
exactly. So every Node version the project now declares supported is accepted by both pinned
tools under `engine-strict=true` (`.npmrc:3`) — the original defect (`>=22`, which admitted
22.0.0–22.11.x that vite's `>=22.12.0` floor rejects, and admitted 23.x that vitest rejects) is
narrowed in the *correct* direction: to the actual intersection, not an arbitrary tightening.
`pnpm-lock.yaml` is confirmed unchanged by this commit (`git diff 13f7766~1..13f7766 --
pnpm-lock.yaml` is empty), consistent with a metadata-only edit.

**WR-02 (CI matrix floor pinning) — CLOSED, correctly.** `node-version: ['22.12.0', 24]` pins the
exact floor patch on the low leg (quoting is redundant but harmless — a two-dot value like
`22.12.0` can't be misparsed as a YAML number even unquoted) while `24` stays unquoted/floating to
continue testing "latest 24.x". `pnpm/action-setup@v4` still precedes `actions/setup-node@v4` with
`cache: pnpm` — required ordering, since `setup-node`'s pnpm-cache resolution shells out to `pnpm
store path`, unavailable until `pnpm/action-setup` has installed pnpm. Ordering is intact.

**WR-01 (verify-outputs wiring) — CLOSED, correctly.** `release` and `publish` Makefile targets
now declare `build verify-outputs test` (was `build test`). Because these are ordinary (not
order-only) prerequisites invoked by a single sequential `make` process, GNU Make evaluates them
left-to-right and halts the whole target if any prerequisite's recipe exits non-zero — so a
`verify-outputs` failure blocks `test` and the target's own recipe from ever running.
`verify-outputs` is listed in `.PHONY` so it always executes rather than being skipped due to a
same-named file matching. `.github/workflows/ci.yml` independently adds `make verify-outputs` as
a discrete step between `make build` and `make test`, gating the CI path the same way. I traced
the loop bodies in `Makefile:77-95`: it checks 3 filenames for the root package, then for each of
the 4 `PLUGIN_BUILD_ORDER` entries (which correctly carry a trailing `/`, matching the
`$$dir$$f` string concatenation) — 15 checks total, matching the target's own "3 formats x 5
packages" claim. All three automated paths (CI, release, publish) now fail closed on a dropped
build output.

## Warnings

### WR-01: `Makefile` `.PHONY` lists a nonexistent `format` target and omits the real `lint-format` target

**File:** `Makefile:7,30`
**Issue:** `.PHONY` (line 7) lists `format`, but no target named `format` exists in the Makefile
— the actual target is `lint-format` (line 30, `README.md`'s `make lint-format` refers to it),
which is *not* declared phony. This is pre-existing — unchanged by the three gap-closure commits
(`git diff aaac2c7~1..aaac2c7 -- Makefile` touches only the `release`/`publish` prerequisite
lines) — but it's a real defect in a file under review, and the review brief explicitly asked for
`.PHONY` correctness to be checked. Practical impact: if a file or directory literally named
`lint-format` is ever created at the repo root (editor swap file, generated artifact, etc.), `make
lint-format` would silently no-op instead of running `biome format --write .`, because Make would
treat the target as already up to date against that file. The dangling `format` entry is inert
but misleading, since it names a target that doesn't exist.
**Fix:**
```makefile
.PHONY: setup build test test-watch lint lint-fix lint-format clean superclean audit commit publish release verify-outputs
```

## Info

### IN-01: Inconsistent `engines` field formatting between root and plugin `package.json` files

**File:** `package.json:8-10`, `plugins/auth/package.json:13`, `plugins/wallet/package.json:13`, `plugins/theme/package.json:13`, `plugins/settings/package.json:13`
**Issue:** Root `package.json` formats `engines` as a multi-line block; all four plugin
`package.json` files use a single-line `{ "node": "..." }` form. The gap-closure commit
(`13f7766`) updated the value identically in all five files but preserved this pre-existing split.
`npx biome check package.json ...` reports these paths as ignored by Biome's configuration, so the
inconsistency isn't caught by `make lint`. Purely cosmetic, no functional impact.
**Fix:** Normalize to one style, e.g. matching the plugins' single-line convention in root:
```json
"engines": { "node": "^22.12.0 || >=24.0.0" },
```

### IN-02: Prior WR-03 (`@types/node@25` vs. Node 22 runtime floor) remains open — out of scope for this gap-closure cycle

**File:** `package.json` (transitive; `pnpm-lock.yaml` still resolves `@types/node@25.5.0`)
**Issue:** The original `06-REVIEW.md` WR-03 flagged that vite/vitest/commitizen transitively
pull `@types/node@25.5.0` even though `engines.node` promises a Node 22/24 floor, so type-checking
sees a newer API surface than the runtime guarantee. `@types/node` is still not pinned as a direct
devDependency in the current `package.json`, and the resolved lockfile version is unchanged. This
finding was not one of the three gaps this cycle's commits (`13f7766`, `00e586e`, `aaac2c7`) were
scoped to close, so it is not a defect introduced by this pass — noting it here only so it isn't
silently dropped from tracking.
**Fix:** Unchanged from the original review — pin `@types/node` to the supported major as a
direct devDependency (`"@types/node": "^22.12.0"`) and re-run `pnpm install`, in a future pass.

---

_Reviewed: 2026-07-15T19:10:34Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

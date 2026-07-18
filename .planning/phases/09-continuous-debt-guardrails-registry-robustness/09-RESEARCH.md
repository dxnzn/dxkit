# Phase 9: Continuous Debt Guardrails & Registry Robustness - Research

**Researched:** 2026-07-18
**Domain:** CI supply-chain guardrails (TypeScript deprecation gating, zero-runtime-dep enforcement, Renovate/pnpm-workspace automation) + a client-side JSON-shape robustness fix
**Confidence:** MEDIUM-HIGH (codebase facts are HIGH/VERIFIED via direct read; Renovate schema facts are MEDIUM/CITED via official docs; nothing in this phase required LOW-confidence claims)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**GATE-03 — Renovate posture**
- D-01: Delivery = Mend GitHub App. Ship `renovate.json` in-repo; the hosted Mend Renovate App reads it and opens PRs. App installation on the repo/org is an operator step — record it in the confirmation/next-steps and STATE.md operator notes. Rejected: self-hosted CI action.
- D-02: Automerge = non-major devDeps, after gating. Patch and minor `devDependencies` bumps automerge unattended only after the release-age window passes and CI is green. All major bumps open a PR for review. Toolchain majors (tsup, vite, vitest, @biomejs/biome, typescript, happy-dom) are always blocked from automerge regardless. CI is the safety net for the automerged tier.
- D-03: Release-age gate = 3 days (`minimumReleaseAge`). Rejected: 7 days.
- D-04: Grouping = toolchain-as-one-PR + weekly lockfile-maintenance. One grouped PR moves tsup/vite/vitest/happy-dom/@biomejs/biome/typescript together; weekly `lockFileMaintenance` PR refreshes `pnpm-lock.yaml`. Other devDeps get individual, bisectable PRs. Rejected: one broad "all minor/patch devDeps" group.

**GATE-01 — deprecation gate shape & scope**
- D-05: Dedicated, named CI step. Add an explicit typecheck/deprecation gate step in `.github/workflows/ci.yml` (invoking `make typecheck`) as its own named red check, separate from `make test`. The existing `make test` → `typecheck` dependency stays as a local-dev convenience.
- D-06: Scope = `src/` + `tests/` + `plugins/*/src/`, never `node_modules/`. Keep the existing `tsconfig.typecheck.json` `include` (already covers `src` + `tests`) as-is — no config narrowing. Rejected: narrowing the gate to `src/` only and typechecking `tests/` in a separate leg.

**GATE-02 — zero-runtime-dep assertion**
- D-07: package.json field-check, not a pnpm-tree check. A Makefile target (following the `verify-outputs` loop shape over root + `PLUGIN_BUILD_ORDER`) asserts the invariant directly on each of the 5 `package.json` files. Rejected: `pnpm list --prod` / `pnpm why` tree check.
- D-08: Fail on all three runtime-visible fields. The check fails if any package declares a non-empty `dependencies`, `peerDependencies`, or `optionalDependencies` — all three install a non-dev package into a consumer's tree. *(Research correction below — see Common Pitfall 1: this literal reading conflicts with the current repo state and must be reconciled at plan time.)*

**ROB-05 — registry array-shape fix**
- D-09: `Array.isArray()` guard on the parsed 200 body. After `await res.json()` succeeds in `loadManifests()` (`src/shell.ts` ~line 274), validate the parsed value is an array before returning it. On failure: do not pass the value to `normalizeAndValidateManifests()`.
- D-10: Wrong-shape 200 ALWAYS emits, ungated. Emit `dx:error` (source `shell:manifest`) for a wrong-shape 200 regardless of `registryUrlExplicit`, then `return []` so `init()` still completes and `window.__DXKIT__` is still exposed.

### Claude's Discretion
- Exact Makefile target names for the dep-check gate and the precise CI step ordering.
- Whether GATE-01/GATE-02 also wire into the `release` / `publish` targets alongside CI.
- Exact `renovate.json` key spelling and preset choices.
- `skipLibCheck` posture for GATE-01 — decide only if a `node_modules/` `.d.ts` deprecation actually surfaces.
- Exact `dx:error` message wording for D-10, and whether the array guard lives inline or in a tiny helper.
- Commit granularity: per-concern bisectable commits (GATE-01 / GATE-02 / GATE-03 / ROB-05).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within the Phase 9 guardrails + registry-robustness boundary. Already-scoped-elsewhere: TS7.1 migration (TS7-01) and tsup→tsdown swap (BUILD-01) remain v2; a Biome `@deprecated`-export lint gate is out of scope this milestone (compiler-option deprecations are gated via `tsc`/GATE-01 instead of reintroducing ESLint).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GATE-01 | CI fails the build on `tsc` typecheck/deprecation errors, scoped to project-owned paths only (never `node_modules/`) | Confirmed mechanism: `tsconfig.typecheck.json`'s `include: ["src","tests"]` (root) / `["src","tests"]` with `rootDir: "../.."` (plugins) already excludes `node_modules` by construction — `tsc` only type-checks files reachable from `include`, plus `.d.ts` files referenced by imports. GATE-01 is pure CI wiring (new named step calling `make typecheck`), not new checking logic. See Architecture Patterns + Pitfall 2. |
| GATE-02 | CI asserts the zero-runtime-dependency posture, so an automated bump that pulls in a runtime dep is caught | Verified current package.json state of all 5 packages (Bash `cat`) — **critical finding**: 4 of 5 packages already have non-empty `dependencies` (internal `workspace:*` links), which the D-08 check as literally worded would flag as violations on day one. See Common Pitfall 1 (Critical) and Don't Hand-Roll for the corrected check design. |
| GATE-03 | Dependency-freshness automation (Renovate) configured for the pnpm workspace — grouped PRs, release-age gating, automerge policy blocking unreviewed major toolchain bumps | Verified current Renovate config schema (docs.renovatebot.com, MEDIUM/CITED): `minimumReleaseAge`, `packageRules` w/ `matchPackageNames`/`matchDepTypes`/`matchUpdateTypes`, `automerge`/`automergeType`, `lockFileMaintenance` (object, not boolean), `config:recommended` (successor to deprecated `config:base`), and pnpm-workspace auto-detection (no special config needed). See Code Examples for a ready-to-adapt skeleton. |
| ROB-05 | `loadManifests()` validates registry.json is an array; wrong-shape 200 emits `dx:error` (`shell:manifest`) instead of throwing | Confirmed exact failure path by reading `src/shell.ts` lines 259–290 and 311–355 — today's `return await res.json();` at line 274 passes whatever shape `res.json()` produces straight into `normalizeAndValidateManifests()`'s `for (const m of list)`, which throws `TypeError: list is not iterable` for any non-iterable (object, `null`, number, boolean) before `init()` reaches `window.__DXKIT__ = context` (line 397). See Architecture Patterns + Code Examples. |
</phase_requirements>

## Summary

Phase 9 is four small, independent, mostly-mechanical changes with almost no new external
surface area: two are pure CI wiring around tooling that already exists (Phase 7's `make
typecheck`, Phase 8's final pipeline), one is a new Makefile assertion over static JSON files
(no npm install required), one is an in-repo config file for a hosted GitHub App, and the last
is a four-line runtime guard in `src/shell.ts`. No new npm packages are installed by this phase
at all — Renovate is delivered as a committed `renovate.json` consumed by the already-installed
Mend GitHub App (an operator-side install, not a repo dependency), and the dep-check (GATE-02)
is implemented with the Makefile's own shell/node primitives, not a new tool.

The single highest-value finding from this research is a **contradiction between CONTEXT.md
D-08 and the current repository state**: D-08 says "today all 5 packages have none of [`dependencies`/
`peerDependencies`/`optionalDependencies`]," but a direct read of all 5 `package.json` files shows
4 of 5 (wallet, auth, theme, settings) *do* have a non-empty `dependencies` field — populated
entirely with intra-monorepo `workspace:*` links (e.g. `plugins/wallet/package.json` depends on
`@dnzn/dxkit-settings: workspace:*` and `@dnzn/dxkit: workspace:*`). If GATE-02 is implemented as
literally worded ("fail if the field is non-empty"), it fails the build immediately and
permanently for every plugin, on the very commit that adds it. The fix that preserves D-07/D-08's
actual intent — "no external, bump-able runtime package can sneak in" — is to allow `workspace:`-
protocol values and fail only on anything else. This is documented in full in Common Pitfall 1 and
must be resolved at plan time, not discovered at execution time.

For Renovate (GATE-03), the current schema confirms every key named in CONTEXT.md's discretion
list still exists with the spelling assumed, with one correction: `lockFileMaintenance` is an
**object** (`{ enabled, schedule, automerge, commitMessageAction, ... }`), not a boolean toggle —
D-04's "weekly lockfile-maintenance" intent is expressed as `lockFileMaintenance: { enabled:
true, schedule: [...] }`. `config:base` (an older base preset sometimes seen in tutorials) was
renamed to `config:recommended` in Renovate v36 and should not be used in a newly-authored config.
`matchPackagePatterns` is deprecated in favor of `matchPackageNames`, which now accepts exact,
glob, regex, and negation patterns in one field — the toolchain-group `packageRules` entry should
use `matchPackageNames` with an explicit array, not a glob, since the six toolchain packages are
named exactly and don't need pattern matching. pnpm workspaces need no special Renovate
configuration beyond what's already present (`pnpm-workspace.yaml` + root `package.json`'s
`packageManager` field, both already in place) — Renovate auto-detects the workspace and
excludes internal `workspace:*` links from its own update scanning (reinforcing why GATE-02 must
not flag them either).

For GATE-01, the mechanism is already fully built by Phase 7: `tsconfig.typecheck.json`'s
`include: ["src", "tests"]` means `tsc --noEmit -p tsconfig.typecheck.json` only ever
type-checks files under those two directories (plus whatever `.d.ts` files those files
transitively import — which is where a `node_modules`-authored declaration file's error could,
in principle, leak in). `skipLibCheck` is the correct, narrowly-scoped escape hatch for that one
scenario (it skips checking of `.d.ts` files specifically, never `.ts` source), and should be
added reactively, only if such a leak is actually observed — not preemptively.

For ROB-05, the current code's exact crash path was confirmed by reading `src/shell.ts`: a
non-OK-guarded `await res.json()` (line 274) returns directly, and whatever it returns — including
a non-array — flows straight into `normalizeAndValidateManifests()`'s `for (const m of list)`
(line 314), which throws `TypeError` on any non-iterable value before `window.__DXKIT__` is ever
assigned (line 397). This confirms all four D-09/D-10 acceptance criteria are achievable with a
minimal, localized `Array.isArray()` guard placed immediately after the `res.json()` call, using
the exact same `dx:error`/`source: 'shell:manifest'` emit convention already used four times in
the same function.

**Primary recommendation:** Implement GATE-01/GATE-02/ROB-05 as small, additive, config-and-code
changes with zero new dependencies; implement GATE-03 as a single `renovate.json` using
`config:recommended`, `matchPackageNames` (not the deprecated `matchPackagePatterns`), an object-
shaped `lockFileMaintenance`, and — critically — fix GATE-02's check to allow `workspace:`-
prefixed dependency values before landing it, or it will red the build on arrival.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CI deprecation gate (GATE-01) | Build/CI tooling | — | Pure CI-config concern; wraps an existing `tsc` invocation, no application code involved |
| Zero-runtime-dep assertion (GATE-02) | Build/CI tooling | — | Static analysis of `package.json` metadata at build time, never touches runtime code |
| Dependency-freshness automation (GATE-03) | Build/CI tooling (external) | — | Hosted GitHub App (Mend Renovate) reading a committed config; operates entirely outside the app runtime |
| Registry array-shape guard (ROB-05) | API/Backend-equivalent (Shell init/data-loading layer) | Browser/Client (consumes `dx:error` via the event bus) | `loadManifests()` is DxKit's "fetch untrusted remote JSON and validate its shape" boundary — the same tier that owns `loadDappManifest()`'s existing validation; the fix belongs where the parse happens, not in a UI layer |

## Standard Stack

No new libraries are introduced by this phase. All four requirements are satisfied with tooling
already present in the repo (`tsc`, `make`, `node`'s built-in `JSON`/`fs`, `Array.isArray`) plus
one new committed config file consumed by an externally-hosted service (Mend Renovate App).

### Core (existing, reused — no version changes)
| Tool | Version (repo-pinned) | Purpose in this phase | Why standard |
|------|------------------------|------------------------|---------------|
| `typescript` | `^6.0.0` (resolved 6.0.3, Phase 7) [VERIFIED: repo `package.json`] | `tsc --noEmit -p tsconfig.typecheck.json` is the mechanism GATE-01 wires into CI | Already the project's typecheck baseline; GATE-01 only makes its failures a distinct named CI check |
| `make` | n/a (POSIX Make via existing `Makefile`) | Both GATE-01 (new CI step invoking `make typecheck`) and GATE-02 (new `make` target) follow the `verify-outputs`/`typecheck` per-package-loop convention | `make` is already "the CI contract" per `.claude/CLAUDE.md` architecture notes — every gate is a make target |
| Node.js built-ins (`fs`, `JSON`, or a one-line `node -e`) | Node `^22.12.0 \|\| >=24.0.0` (repo floor) | GATE-02's dep-check reads each `package.json` and inspects `dependencies`/`peerDependencies`/`optionalDependencies` — no parsing library needed | Zero-runtime-deps posture; D-07 explicitly rejects any tool requiring `pnpm install`/tree resolution |

### Supporting (new, external, no npm install)
| Tool | Delivery | Purpose | When to use |
|------|----------|---------|-------------|
| Mend Renovate (GitHub App) [ASSUMED — operator install, not verifiable from this session] | Hosted GitHub App, reads committed `renovate.json` | Automated dependency-freshness PRs for the pnpm workspace | Configured this phase (D-01); **the app installation on the GitHub repo/org is a manual operator step outside this codebase** — the config being committed does not mean automation is live |

### Alternatives Considered
| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Mend-hosted Renovate App | Self-hosted `renovate` CLI in a scheduled GitHub Actions workflow | Rejected in CONTEXT.md D-01 — adds a cron workflow, a token secret, and CI minutes for a low-velocity, all-devDependency repo; config content is nearly identical either way |
| Makefile `package.json` field-check (GATE-02) | `pnpm list --prod` / `pnpm why` tree walk | Rejected in D-07 — requires a prior `pnpm install`, slower, and its output format is not designed to be parsed programmatically; the posture is defined by *not declaring* deps, so assert that directly on the JSON |
| `matchPackageNames` exact-name array for the toolchain group | `matchPackagePatterns` glob | `matchPackagePatterns` is deprecated in current Renovate; `matchPackageNames` is the only supported field going forward and also accepts glob/regex if ever needed |

**Installation:** None — this phase adds zero new `dependencies`/`devDependencies` to any `package.json`.

**Version verification:** `typescript` is already pinned at `^6.0.0` (Phase 7, resolved `6.0.3` in the lockfile) — not touched by this phase. `npm view typescript version` currently returns `7.0.2` on the registry, confirming the repo is intentionally holding at the TS6 stepping-stone per the milestone's explicit TS7 deferral — do not let this phase's Renovate config accidentally automerge a TypeScript major (it's in the always-blocked toolchain group, D-02).

## Package Legitimacy Audit

**N/A — this phase installs zero new npm packages.** GATE-01/GATE-02 use only already-installed
`typescript`/`make`/Node built-ins; GATE-03 delivers a configuration file (`renovate.json`)
consumed by an externally-hosted GitHub App, not an npm dependency; ROB-05 is a source-code
change with no new imports. The Package Legitimacy Gate protocol is not applicable to this phase.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  GitHub: push / pull_request                                        │
└───────────────┬───────────────────────────────────────────────────--┘
                 ▼
         .github/workflows/ci.yml  (Node matrix [22.12.0, 24])
                 │
                 ├──▶ make build            (existing, Phase 6/8)
                 ├──▶ make verify-outputs   (existing, Phase 6)
                 ├──▶ make smoke            (existing, Phase 8)
                 ├──▶ make test             (existing: lint → typecheck → vitest)
                 ├──▶ [NEW] typecheck-gate step → `make typecheck`      (GATE-01: named, red-on-deprecation)
                 └──▶ [NEW] dep-check step  → `make verify-no-runtime-deps` (GATE-02: named, red-on-runtime-dep)
                 │
                 ▼
         tsconfig.typecheck.json (×5, unchanged, Phase 7)
           include: ["src","tests"]  ──▶  tsc never reaches node_modules/*.ts,
                                          only .d.ts files reachable via import
                                          (skipLibCheck is the escape hatch IF one leaks)

┌─────────────────────────────────────────────────────────────────────┐
│  Mend Renovate GitHub App (hosted, operator-installed — outside CI)  │
└───────────────┬───────────────────────────────────────────────────--┘
                 ▼
         reads [NEW] renovate.json (repo root)
                 │
                 ├──▶ toolchain group PR (tsup, vite, vitest, happy-dom,
                 │      @biomejs/biome, typescript) — major NEVER automerges
                 ├──▶ individual devDep PRs (other tools) — patch/minor
                 │      automerge after minimumReleaseAge (3 days) + green CI
                 ├──▶ weekly lockFileMaintenance PR (pnpm-lock.yaml refresh)
                 └──▶ (pnpm-workspace.yaml auto-detected; internal
                        workspace:* deps excluded from scanning — never opens
                        a PR to "update" @dnzn/dxkit-wallet inside @dnzn/dxkit-auth)

┌─────────────────────────────────────────────────────────────────────┐
│  Browser runtime: shell.init() — ROB-05                              │
└───────────────┬───────────────────────────────────────────────────--┘
                 ▼
       loadManifests() [src/shell.ts:249]
                 │
                 ├─ dappEntries present? → loadDappManifest() per entry (unaffected by ROB-05)
                 ├─ inlineManifests present? → return as-is (unaffected by ROB-05)
                 └─ else: fetch(registryUrl)
                         │
                         ├─ !res.ok → existing D-15 gated dx:error, return []
                         └─ res.ok → await res.json()
                                 │
                                 ├─ [NEW] Array.isArray(parsed)? NO
                                 │     → emit dx:error (source: shell:manifest, UNGATED — D-10)
                                 │     → return []   (init() continues → window.__DXKIT__ exposed)
                                 │
                                 └─ YES → return parsed  (flows into
                                          normalizeAndValidateManifests() as before,
                                          per-manifest validation unchanged)
```

### Recommended Project Structure
No new directories. Touched files only:
```
Makefile                          # + typecheck CI-facing wiring note, + new dep-check target
.github/workflows/ci.yml          # + 2 new named steps (typecheck-gate, dep-check)
renovate.json                     # NEW — GATE-03 config, repo root
src/shell.ts                      # + Array.isArray guard in loadManifests() (~line 274)
tests/shell.test.ts               # + ROB-05 regression test(s)
tests/typecheck-config.test.ts    # (optional) + GATE-01/02 Makefile/CI guard assertions, mirroring existing style
```

### Pattern 1: Named, standalone CI step wrapping an existing make target (GATE-01)
**What:** Add a CI step whose displayed name is unambiguously about the deprecation gate,
invoking `make typecheck` directly — not folded into the generic `make test` step.
**When to use:** Whenever a specific class of failure (here: TS6 deprecations/type errors) needs
to read as its own red X in the GitHub Checks UI, distinguishing it from a generic test failure.
**Example:**
```yaml
# Source: .github/workflows/ci.yml (existing steps shown for convention; new step follows the pattern)
      - run: pnpm install --frozen-lockfile
      - run: make build
      - run: make verify-outputs
      - run: make smoke
      - name: Typecheck / deprecation gate (GATE-01)
        run: make typecheck
      - name: Zero-runtime-dependency assertion (GATE-02)
        run: make verify-no-runtime-deps
      - run: make test
```
Note `make test` already runs `typecheck` as a prerequisite (Phase 7 D-06) — running it again as
a standalone step is intentional duplication for CI-check naming/visibility (D-05), not wasted
work in practice since `tsc` is fast and idempotent; if CI minutes become a concern later, the
`make test` internal prerequisite could be dropped in favor of the standalone step alone, but that
is out of scope for this phase.

### Pattern 2: Makefile field-presence loop over `package.json`, mirroring `verify-outputs` (GATE-02)
**What:** A `make` target loops root + `PLUGIN_BUILD_ORDER`, reads each `package.json` with a
zero-dependency JSON read (Node's own `JSON.parse`, invoked via `node -e` or a tiny inline script
— no `jq`, no new devDependency), and exits 1 if any of `dependencies`/`peerDependencies`/
`optionalDependencies` contains a disallowed entry.
**When to use:** Any invariant that can be checked from static repo metadata without installing
or resolving a dependency tree.
**Example:**
```makefile
# Source: Makefile (existing verify-outputs shown for the structural template GATE-02 follows)
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

# NEW target — same loop shape, checks package.json metadata instead of dist/ files.
# IMPORTANT: see Common Pitfall 1 — must allow "workspace:" values, not reject any non-empty field.
verify-no-runtime-deps:
	@echo
	@echo "VERIFYING ZERO-RUNTIME-DEPENDENCY POSTURE: ."
	@echo
	@node ./scripts/check-no-runtime-deps.cjs package.json
	@for dir in $(PLUGIN_BUILD_ORDER); do \
		node ./scripts/check-no-runtime-deps.cjs $$dir/package.json || exit 1; \
	done
```
```javascript
// scripts/check-no-runtime-deps.cjs — illustrative shape, not a prescribed final implementation.
// Source: derived from D-07/D-08 intent + the corrected workspace: carve-out (Common Pitfall 1).
const fs = require('node:fs');
const pkgPath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const fields = ['dependencies', 'peerDependencies', 'optionalDependencies'];
let failed = false;
for (const field of fields) {
  const entries = Object.entries(pkg[field] ?? {});
  for (const [name, range] of entries) {
    // workspace:* / workspace:^ / workspace:~ are intra-monorepo links, not installable
    // external runtime deps — Renovate never touches these, so they're not a bump vector.
    if (typeof range === 'string' && range.startsWith('workspace:')) continue;
    console.error(`FAIL: ${pkgPath} declares ${field}.${name} = "${range}" (not a workspace: link)`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`OK: ${pkgPath} has no external runtime-visible dependencies`);
```

### Pattern 3: Renovate `renovate.json` for a pnpm workspace with toolchain grouping (GATE-03)
**What:** A single committed config expressing D-01–D-04: 3-day release-age gate, toolchain
group that never automerges majors, individually-bisectable other devDep PRs, weekly lockfile
maintenance.
**When to use:** GATE-03's exact deliverable.
**Example:**
```jsonc
// Source: docs.renovatebot.com/configuration-options (CITED — key names/types verified this session)
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "minimumReleaseAge": "3 days",
  "packageRules": [
    {
      "groupName": "toolchain",
      "matchPackageNames": ["tsup", "vite", "vitest", "happy-dom", "@biomejs/biome", "typescript"],
      "matchDepTypes": ["devDependencies"],
      "automerge": false
    },
    {
      "matchPackageNames": ["tsup", "vite", "vitest", "happy-dom", "@biomejs/biome", "typescript"],
      "matchUpdateTypes": ["major"],
      "automerge": false
    },
    {
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["patch", "minor"],
      "excludePackageNames": ["tsup", "vite", "vitest", "happy-dom", "@biomejs/biome", "typescript"],
      "automerge": true,
      "automergeType": "pr"
    },
    {
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["major"],
      "automerge": false
    }
  ],
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["before 4am on monday"],
    "automerge": false
  }
}
```
Notes on this skeleton (verify at plan/execute time against the live schema, since Renovate ships
frequent schema updates — see Common Pitfall 3):
- `matchDepTypes: ["devDependencies"]` is redundant-but-explicit given every one of DxKit's 5
  `package.json` files puts every tool in `devDependencies` already — included for clarity/defense
  in depth in case a future package ever adds a real runtime dep.
- The toolchain group's first rule sets `automerge: false` unconditionally (belt) and the second
  rule reinforces `matchUpdateTypes: ["major"]` specifically (suspenders) — CONTEXT.md D-02
  requires the toolchain majors to be **always** blocked, so both the general group rule and an
  explicit major-only rule are included; the planner may collapse these into one rule provided the
  always-blocked behavior for major toolchain bumps is preserved.
- `lockFileMaintenance.automerge: false` is a discretion call (not explicitly locked by D-04) —
  since this refreshes `pnpm-lock.yaml` for the *whole* workspace including plugin lockstep
  entries, review-then-merge is the safer default; automerging it is a reasonable alternative if
  CI is treated as sufficient (mirrors D-02's non-major-devDep automerge stance) — confirm intent
  during planning.
- No `packageManager` or pnpm-specific top-level key is required — Renovate auto-detects
  `pnpm-workspace.yaml` + the root `package.json`'s existing `"packageManager": "pnpm@10.32.1"`
  field (already present, unrelated to this phase) and excludes internal `workspace:*` links from
  scanning without any extra config [CITED: docs.renovatebot.com + GitHub discussion #25330].

### Pattern 4: Array-shape guard at the untrusted-JSON boundary (ROB-05)
**What:** Validate the parsed shape of an externally-fetched JSON payload before handing it to a
function that assumes a specific shape (`for...of` assumes iterable).
**When to use:** Any `res.json()` call whose result flows into iteration/array methods without a
prior shape check — this is the second instance of the pattern in this file (`loadDappManifest`
already validates per-manifest shape via `isValidManifest`); ROB-05 adds the missing *top-level*
array check for the registry-array path specifically.
**Example:**
```typescript
// Source: src/shell.ts current code (lines 259-290), with the ROB-05 fix inserted.
// Current (today, pre-fix):
    try {
      const res = await fetch(registryUrl);
      if (!res.ok) {
        /* ...existing D-15 gated dx:error... */
        return [];
      }
      return await res.json();   // <-- whatever shape this is, flows straight into
                                  //     normalizeAndValidateManifests()'s `for...of`
    } catch (err) { /* ... */ }

// Fixed (ROB-05 / D-09, D-10):
    try {
      const res = await fetch(registryUrl);
      if (!res.ok) {
        /* ...existing D-15 gated dx:error, unchanged... */
        return [];
      }
      const parsed = await res.json();
      if (!Array.isArray(parsed)) {
        // D-10: ALWAYS emits (not gated by registryUrlExplicit) — a 200 response means a
        // registry IS present but malformed, categorically different from the absence case
        // the registryUrlExplicit gate deliberately keeps silent.
        events.emit('dx:error', {
          source: 'shell:manifest',
          error: new Error(
            `Registry from ${registryUrl} must be a JSON array of manifests — received ${typeof parsed}`,
          ),
        });
        return [];
      }
      return parsed;
    } catch (err) { /* ...existing D-15 gated dx:error, unchanged... */ }
```

### Anti-Patterns to Avoid
- **Narrowing `tsconfig.typecheck.json`'s `include` to guard against `node_modules` noise:**
  Rejected explicitly by D-06 — the `include` array already excludes `node_modules` by
  construction (it only lists `src`/`tests`); adding exclusion config would be solving an
  already-solved problem and diverging from Phase 7's standardized shape for no benefit.
- **Implementing GATE-02 as a `pnpm why`/`pnpm list --prod` wrapper:** Rejected by D-07 — requires
  a prior install, slower, and the tree-walk output isn't designed for scripted parsing; assert
  the intent directly on the JSON source of truth instead.
- **Treating `dependencies` field non-emptiness as the sole GATE-02 signal without a
  `workspace:` carve-out:** See Common Pitfall 1 — this breaks the build immediately on 4 of 5
  packages today.
- **Using `matchPackagePatterns` in the new `renovate.json`:** Deprecated; use `matchPackageNames`
  (which also supports glob/regex/negation) instead — a freshly-authored config should never ship
  with an already-superseded key.
- **Passing the parsed registry body to `normalizeAndValidateManifests()` before the array check:**
  That function's `for...of` is the exact TypeError site today (see Code Examples) — the guard
  must run *before* that call, not inside it, per D-09's explicit ordering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency-freshness / update PRs | A custom scheduled GitHub Action that diffs `package.json` versions against the npm registry | Mend Renovate GitHub App + committed `renovate.json` | Renovate already solves release-age gating, grouping, automerge policy, lockfile maintenance, and pnpm-workspace internal-link exclusion — a hand-rolled version would re-implement all of this with none of Renovate's edge-case handling (D-01 already made this call) |
| JSON-shape validation for the registry array | A generic schema-validation library (zod/ajv/etc.) | `Array.isArray()` — a single native built-in check | The requirement is exactly "is this an array" (D-09); per-element shape is already handled by the existing `isValidManifest` in `normalizeAndValidateManifests`. Reaching for a schema library here would be the first runtime dependency this zero-dep project has ever added, for a one-line check |
| Zero-runtime-dep enforcement | A dependency-tree-walking tool (`depcheck`, `npm-check`, etc.) | A ~15-line Node script reading `package.json` fields directly (D-07) | The posture is *defined* by absence of declared fields — checking the declared fields directly is both simpler and faster than resolving and walking an install tree |

**Key insight:** Every "don't hand-roll" temptation in this phase points toward adding either a
new npm devDependency or a new CI service integration beyond what's already decided. The
zero-runtime-dep posture this phase enforces (GATE-02) is itself a constraint on how GATE-01/02
should be *built* — prefer built-ins and existing tooling (`tsc`, `make`, `node`) over reaching
for a new package, even a devDependency, unless one is already justified elsewhere in the repo.

## Common Pitfalls

### Pitfall 1 (CRITICAL — must resolve before/during planning): GATE-02 as literally worded in D-08 will fail the build immediately
**What goes wrong:** D-08 states "today all 5 packages have none of [`dependencies`, `peerDependencies`,
`optionalDependencies`]" and instructs the check to fail on any non-empty occurrence of these
fields. A direct read of the repo (`plugins/wallet/package.json`, `plugins/auth/package.json`,
`plugins/theme/package.json`, `plugins/settings/package.json`) shows all four already have a
non-empty `dependencies` field containing `workspace:*`-protocol links to sibling packages (e.g.
`"@dnzn/dxkit": "workspace:*"`). Only the root `package.json` truly has zero entries in all three
fields. Implementing the check literally means `make verify-no-runtime-deps` (or equivalent) fails
on 4 of 5 packages the moment it's added — a self-inflicted permanent-red CI check.
**Why it happens:** The CONTEXT.md discussion evaluated the *intent* ("no external package can
sneak a runtime dependency in") without re-verifying the current field contents against the live
repo at discussion time; `workspace:*` links are semantically different from installable external
packages (pnpm resolves them to local paths, not registry downloads) but are syntactically
indistinguishable from a naive non-empty-field check.
**How to avoid:** Scope the check to reject only entries whose declared range is **not** a
`workspace:` protocol value (see Code Examples, Pattern 2, for a concrete implementation). This
preserves D-07/D-08's actual intent — Renovate (D-02) only ever proposes bumps to
`devDependencies`, and it explicitly excludes internal `workspace:*` links from its scanning
(confirmed this session), so there is no automated path by which a `workspace:` entry could ever
become an external package. The residual risk D-08 is actually guarding against — a human or a
future automation adding a real external package to `dependencies` — is still caught by rejecting
any non-`workspace:` value.
**Warning signs:** If the planner or executor writes the check as `Object.keys(pkg.dependencies
?? {}).length > 0` (or the shell/Makefile equivalent) without a value-based `workspace:` filter,
the very first `make test`/CI run after landing GATE-02 will fail on `plugins/wallet`,
`plugins/auth`, `plugins/theme`, and `plugins/settings`.

### Pitfall 2: Believing GATE-01 requires new type-checking logic
**What goes wrong:** Reading "CI deprecation gate" as a request to build new deprecation-detection
tooling, when Phase 7 already produces exactly this signal via `make typecheck` — the only gap is
CI *visibility* (a distinct named check vs. buried inside the generic `make test` step).
**Why it happens:** The requirement's phrasing ("CI fails the build on `tsc` typecheck/deprecation
errors") sounds like new functionality; it is actually a wiring/visibility change (D-05 makes this
explicit).
**How to avoid:** Confirm `make typecheck`'s existing exit-code behavior (non-zero on any `tsc`
error, including deprecation errors under TS6 — deprecations are compiler errors under TS6, not
warnings) is sufficient, then add only the CI step invocation. No source or tsconfig changes are
required unless `skipLibCheck` is later needed (Pitfall 4).
**Warning signs:** A plan that touches `tsconfig.typecheck.json`'s `include`/`exclude` fields for
GATE-01 is over-scoped — D-06 explicitly keeps that file untouched.

### Pitfall 3: Renovate schema drift between research time and execution time
**What goes wrong:** Renovate ships config-schema changes reasonably often (e.g. the
`config:base` → `config:recommended` rename in v36, and `matchPackagePatterns` →
`matchPackageNames` consolidation); a config authored from stale memory can commit an
already-deprecated key on day one.
**Why it happens:** Renovate's documentation and schema evolve faster than most tooling; AI
training data and cached knowledge lag behind.
**How to avoid:** Before finalizing `renovate.json`, re-check `https://docs.renovatebot.com/renovate-schema.json`
(the live JSON schema) and `docs.renovatebot.com/configuration-options` at plan/execute time —
this research already did so and confirmed `config:recommended` + `matchPackageNames` +
`lockFileMaintenance`-as-object as current, but Renovate's own release cadence means a re-check at
execute time is cheap insurance.
**Warning signs:** Any config using `config:base`, `matchPackagePatterns`, or a boolean
`lockFileMaintenance: true` should be treated as stale.

### Pitfall 4: Assuming `skipLibCheck` is needed pre-emptively
**What goes wrong:** Adding `skipLibCheck: true` to `tsconfig.typecheck.json` "just in case" a
`node_modules` deprecation might surface, when today's `include: ["src","tests"]` scoping already
prevents `tsc` from directly type-checking any `node_modules/*.ts` file — the only residual leak
vector is a `.d.ts` file transitively referenced by an `import`, which has not been observed to
happen in this codebase (Phase 7 landed TS6 with zero `ignoreDeprecations` shims and a clean
baseline).
**Why it happens:** `skipLibCheck` is a well-known TypeScript escape hatch, making it tempting to
add defensively.
**How to avoid:** Per CONTEXT.md's own discretion note, only add `skipLibCheck` reactively, if a
real `node_modules`-sourced deprecation is actually observed after GATE-01 lands. Note also that
`skipLibCheck` is all-or-nothing for `.d.ts` files (it cannot be scoped to only third-party
`.d.ts` files vs. the project's own emitted `.d.ts` files) — a broader tradeoff to weigh if it
ever does become necessary.
**Warning signs:** A plan task titled "add skipLibCheck for GATE-01" with no concrete deprecation
being fixed is speculative work outside this phase's mechanical, low-risk framing.

### Pitfall 5: `registryUrlExplicit` gating creeping into the ROB-05 fix
**What goes wrong:** Copy-pasting the existing `if (registryUrlExplicit) { events.emit(...) }`
pattern (used for the 404/non-OK and catch-block cases in the same function) onto the new
array-shape check, which would make the wrong-shape-200 error silent on the default
`/registry.json` probe — directly contradicting D-10's "ALWAYS emits, ungated" requirement.
**Why it happens:** The array-shape check sits in the same function, adjacent to two other checks
that *are* gated by `registryUrlExplicit`, making the gating pattern look like local convention to
copy.
**How to avoid:** D-10 is explicit that this is the one deliberate exception to the
`registryUrlExplicit` convention — a 200 response proves a registry is present but malformed,
which is categorically different from the absence case the gate protects. The regression test
should assert the array-guard's `dx:error` fires even with `registryUrl` omitted (the default
probe), distinguishing it from the existing 404-stays-silent test at `tests/shell.test.ts:460`.
**Warning signs:** A test that only exercises the wrong-shape-200 case with an *explicit*
`registryUrl` would miss this distinction — the test suite needs the default-probe case too (see
Validation Architecture below).

### Pitfall 6 (carried from STATE.md Blockers/Concerns): unfixable-red CI from unscoped deprecation gating
**What goes wrong:** A gate that fails on transitive `node_modules/` deprecation noise (not just
project-owned code) becomes permanently red and gets disabled/ignored by the team — defeating its
own purpose.
**Why it happens:** Naive `tsc` invocations without a scoped `include`, or a `--strict` mode
applied repo-wide instead of via the existing scoped `tsconfig.typecheck.json`.
**How to avoid:** This is already solved by Phase 7's `include: ["src","tests"]` scoping (D-06
explicitly keeps it as-is) — GATE-01 must not regress this by widening scope or removing the
scoped config in favor of a repo-root `tsc .` invocation.
**Warning signs:** Any CI step that runs `tsc` without `-p tsconfig.typecheck.json` (i.e., against
the default/root `tsconfig.json` or with no project file at all) bypasses the scoping entirely.

## Code Examples

### Confirmed current crash path (ROB-05) — read directly from `src/shell.ts`
```typescript
// src/shell.ts, loadManifests() — lines 259-290 (current, pre-fix)
    try {
      const res = await fetch(registryUrl);
      if (!res.ok) {
        if (registryUrlExplicit) {
          const statusInfo = typeof res.status === 'number' ? ` (status ${res.status})` : '';
          events.emit('dx:error', {
            source: 'shell:manifest',
            error: new Error(`Failed to fetch registry from ${registryUrl}${statusInfo} — non-OK response`),
          });
        }
        return [];
      }
      return await res.json();   // <-- unguarded; any shape flows to init()'s
                                  //     normalizeAndValidateManifests(await loadManifests())
    } catch (err) {
      if (registryUrlExplicit) {
        events.emit('dx:error', {
          source: 'shell:manifest',
          error: new Error(
            `Failed to load registry from ${registryUrl} — request failed or response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
            { cause: err },
          ),
        });
      }
    }
    return [];
```
```typescript
// src/shell.ts, normalizeAndValidateManifests() — line 314, the actual TypeError site
// (`list` is typed DappManifest[], but at runtime it is whatever loadManifests() returned)
    for (const m of list) {   // <-- TypeError: list is not iterable, if list is an object/null/number/boolean
      ...
    }
```
```typescript
// src/shell.ts, init() — line 367, the exact call chain that crashes before window.__DXKIT__ is set (line 397)
    manifests = normalizeAndValidateManifests(await loadManifests());
    // ... plugin init ...
    // ... router setup ...
    Object.freeze(context);
    window.__DXKIT__ = context;   // <-- never reached if the line above throws
```

### Existing `dx:error` emission convention this fix must match (mirrors 3 existing call sites)
```typescript
// Source: src/shell.ts loadDappManifest() (lines 213-217) — the message-shape convention ROB-05's
// new error should follow: `Failed to <verb> <noun> from <url><optional context> — <reason>`
events.emit('dx:error', {
  source: 'shell:manifest',
  error: new Error(`Failed to fetch manifest from ${entry.manifest}${statusInfo} — non-OK response`),
});
```

### Existing guard-test style (mirrors Phase 8's flag-presence pattern, for GATE-01/GATE-02 CI-wiring tests)
```typescript
// Source: tests/typecheck-config.test.ts (lines 178-225) — the exact style a
// GATE-01/GATE-02 Makefile/ci.yml-presence guard test should mirror.
it('should reference PLUGIN_BUILD_ORDER in typecheck target', () => {
  const makefileContent = readFileSync(resolve(process.cwd(), 'Makefile'), 'utf-8');
  const typecheckMatch = makefileContent.match(/^typecheck:\s*$([\s\S]*?)^[a-z]/m);
  expect(typecheckMatch).toBeTruthy();
  expect(typecheckMatch![1]).toMatch(/\$\(PLUGIN_BUILD_ORDER\)/);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Renovate `config:base` preset | `config:recommended` | Renovate v36 [CITED: GitHub issue #23326, docs.renovatebot.com] | A freshly-authored `renovate.json` should extend `config:recommended`, not `config:base` |
| Renovate `matchPackagePatterns` | `matchPackageNames` (supports exact/glob/regex/negation in one field) | Ongoing consolidation, confirmed current [CITED: docs.renovatebot.com/string-pattern-matching] | Use `matchPackageNames` for the toolchain group; `matchPackagePatterns` should not appear in new configs |
| TS5.x `dts:true` bundler-based declaration emit (this repo, pre-Phase-7) | Direct `tsc --emitDeclarationOnly` `onSuccess` pass (landed Phase 7) | Phase 7 (this milestone) | Not re-litigated here; noted only because it's the emit pass whose `tsconfig.json` inherits the same forward-compat flags GATE-01 type-checks against |

**Deprecated/outdated:**
- `config:base` (Renovate): superseded by `config:recommended`; still resolves today but flagged
  in Renovate's own deprecation warnings.
- `matchPackagePatterns` (Renovate): superseded by `matchPackageNames`; do not introduce it in a
  new config.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Mend Renovate GitHub App install is purely an operator/GitHub-settings action outside this codebase, with no repo-side config beyond `renovate.json` | Standard Stack, Architecture Patterns | Low — if some additional repo-side wiring (e.g. a required status check name, a GitHub Actions permission) turns out to be needed for Renovate to actually open PRs, that would be an operator-side follow-up, not a code change; does not block committing `renovate.json` itself |
| A2 | `lockFileMaintenance.automerge: false` is the safer default absent an explicit D-04 instruction on lockfile-PR automerge | Code Examples Pattern 3 | Low-Medium — if the team actually wants the weekly lockfile PR to automerge like other non-major devDeps, this is a one-line config flip; confirm during planning, not a structural risk |

**If this table is empty:** N/A — two low-risk assumptions logged above; both are easily corrected without touching source code.

## Open Questions

1. **Does GATE-02's corrected `workspace:`-carve-out check need to be a durable regression test, or is the Makefile target itself sufficient?**
   - What we know: The Makefile target is the CI-enforced gate; Phase 8's `typecheck-config.test.ts` establishes a precedent of also adding a vitest-based guard test for config/Makefile invariants (belt-and-suspenders — a vitest guard runs in `make test`, catching regressions even if someone forgets to run the Makefile target in a given CI leg).
   - What's unclear: Whether the planner wants a mirrored vitest guard test for GATE-01/GATE-02's Makefile+CI wiring (like `typecheck-config.test.ts` does for Phase 7/8), or considers the Makefile target + CI step sufficient on their own.
   - Recommendation: Add a lightweight guard test (mirrors the Code Examples "Existing guard-test style" pattern) asserting (a) the new Makefile target exists and loops `PLUGIN_BUILD_ORDER`, (b) `ci.yml` invokes it as a named step, and (c) — most importantly — a fixture-based unit test of the dep-check script itself asserting it passes on a `workspace:`-only `dependencies` object and fails on a real external package name. This closes Pitfall 1 with an automated regression, not just manual review.

2. **Should `make release`/`make publish` also depend on `verify-no-runtime-deps` (GATE-02) and the typecheck gate?**
   - What we know: CONTEXT.md's discretion list flags this explicitly ("Whether GATE-01/GATE-02 also wire into the `release`/`publish` targets alongside CI"); the `verify-outputs`/`smoke` precedent (Phase 6 D-?/Phase 8 D-04) wires those into `release`/`publish` already (`Makefile` lines 64/71: `release: build verify-outputs smoke test` / `publish: build verify-outputs smoke test`).
   - What's unclear: Whether `typecheck` and the new dep-check target should join that prerequisite chain, given `test` already depends on `typecheck` (Phase 7 D-06) — so `release`/`publish` already transitively run `typecheck` via `test`. The dep-check target does not yet have any such transitive inclusion.
   - Recommendation: Given `release`/`publish` already transitively typecheck via `test`, no explicit change is needed for GATE-01 there. For GATE-02, add `verify-no-runtime-deps` as an explicit prerequisite of `release`/`publish` (mirroring `verify-outputs`) since nothing else in that chain currently checks it — this closes the same gap `verify-outputs` closed for build-output completeness.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | GATE-02 dep-check script, all `make` targets | ✓ [VERIFIED: repo `.npmrc`/`package.json` engines] | `^22.12.0 \|\| >=24.0.0` (repo floor, Phase 6) | — |
| `make` (POSIX Make) | Every gate in this phase | ✓ [VERIFIED: existing `Makefile` in repo] | n/a (already used by CI) | — |
| GitHub Actions (`ubuntu-latest` runner) | CI wiring for GATE-01/GATE-02 | ✓ [VERIFIED: existing `.github/workflows/ci.yml`] | n/a | — |
| Mend Renovate GitHub App | GATE-03's PRs actually opening | ✗ (not verifiable from this session — requires a GitHub org/repo-admin action) [ASSUMED not yet installed] | — | Committing `renovate.json` is still valid/complete work for this phase; the app install is an explicit operator next-step (D-01), not a blocker to landing the config |

**Missing dependencies with no fallback:** None — the one "missing" item (Mend App install) has an
explicit, already-agreed fallback: ship the config now, install the app as a documented operator
step.

**Missing dependencies with fallback:** Mend Renovate GitHub App installation — config lands this
phase regardless; automation goes live once an operator installs the app (record this prominently
in the phase's confirmation/next-steps and `STATE.md` operator notes, per D-01).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 + happy-dom 20.10.6 [VERIFIED: repo `package.json`] |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npx vitest run tests/shell.test.ts` |
| Full suite command | `make test` (lint → typecheck → vitest) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| GATE-01 | `make typecheck` runs as its own named CI step and fails the build on a `tsc` error | integration (CI config assertion) + manual CI-run confirmation | `grep -A2 "GATE-01\|typecheck" .github/workflows/ci.yml` / a guard test mirroring `typecheck-config.test.ts`'s Makefile-parsing style | ❌ Wave 0 (new guard test, optional per Open Question 1) |
| GATE-02 | `make verify-no-runtime-deps` (or chosen name) exits 1 if any package.json has a non-`workspace:` entry in `dependencies`/`peerDependencies`/`optionalDependencies` | unit (script logic) + integration (Makefile wiring) | `make verify-no-runtime-deps` (must pass on current repo state, including the 4 packages with `workspace:*` deps) + a fixture-based unit test of the check script | ❌ Wave 0 — both the script and its test are new |
| GATE-03 | `renovate.json` validates against Renovate's schema and encodes D-01–D-04 | manual/config validation (no CI-runnable test — Renovate itself is external) | `npx --yes renovate-config-validator renovate.json` (if acceptable as a one-off local check; not wired into CI since it would add a new devDependency for a config-only concern) OR manual schema diff against `https://docs.renovatebot.com/renovate-schema.json` | ❌ N/A — see note below |
| ROB-05 | A 200 response with a non-array body emits `dx:error` (`shell:manifest`), does not throw, `init()` completes, `window.__DXKIT__` is exposed — and this holds even on the default silent registry probe (no explicit `registryUrl`) | unit (vitest, mirrors existing `tests/shell.test.ts` registry tests) | `npx vitest run tests/shell.test.ts -t "registry"` | ❌ Wave 0 — new test case(s) needed, see below |

**Note on GATE-03 validation:** Renovate config correctness cannot be proven by this repo's own
CI (Renovate runs externally, on Mend's infrastructure, only after app install). The
`renovate-config-validator` npm package is Renovate's own official schema-validation CLI, runnable
via `npx` with no persistent devDependency add — recommended as a manual pre-commit sanity check
during planning/execution, not a wired CI gate (adding it as a permanent CI step would require a
judgment call on whether a `npx`-invoked, non-installed tool is consistent with the zero-dep
posture; since it never resolves into any `package.json`, it is consistent, but is optional/
discretionary for this phase).

### Sampling Rate
- **Per task commit:** `npx vitest run tests/shell.test.ts` (ROB-05) or the specific new
  Makefile target invocation (GATE-01/GATE-02) — fast, scoped feedback per bisectable commit.
- **Per wave merge:** `make test` (full lint → typecheck → vitest) + `make verify-no-runtime-deps`
  + `make typecheck` as standalone invocations (matching how CI will call them).
- **Phase gate:** Full `make build && make verify-outputs && make smoke && make test && make
  verify-no-runtime-deps` green, plus a manual read of the committed `renovate.json` against the
  live schema, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/shell.test.ts` — add ROB-05 regression test(s): (a) explicit `registryUrl` + 200
  response with a non-array body (object, string, number, `null`) → `dx:error` source
  `shell:manifest`, no throw, `getManifests()` empty; (b) **critically**, the same wrong-shape-200
  case with `registryUrl` *omitted* (default probe) → `dx:error` still fires (proving D-10's
  "ALWAYS emits, ungated" is distinct from the existing silent-404-on-default-probe test at line
  460); (c) assert `shell.init()` resolves (doesn't reject/throw) and — if feasible in the test's
  DOM setup — that `window.__DXKIT__` is defined after `init()` in this scenario.
- [ ] `scripts/check-no-runtime-deps.cjs` (or equivalent) + a unit test fixture proving it passes
  on a `workspace:`-only `dependencies` object and fails on any other entry — covers Pitfall 1 with
  an automated regression rather than relying on manual review.
- [ ] (Optional, per Open Question 1) A `typecheck-config.test.ts`-style guard test asserting the
  new Makefile targets exist, loop `PLUGIN_BUILD_ORDER`, and are invoked as named steps in
  `ci.yml` — mirrors the existing Phase 7/8 precedent for config/wiring regression protection.
- [ ] No new test framework/config needed — `vitest.config.ts` and the existing `tests/`
  structure fully cover this phase's testable surface (ROB-05); GATE-01/02/03 are primarily
  config/wiring changes validated by manual + light guard-test coverage as above.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Not touched by this phase |
| V3 Session Management | No | Not touched by this phase |
| V4 Access Control | No | Not touched by this phase |
| V5 Input Validation | Yes | ROB-05's `Array.isArray()` guard is exactly a V5 control — validating the shape of untrusted, network-sourced JSON before it is consumed by application logic, mirroring the existing `isValidManifest()` per-element validation already in the same file |
| V6 Cryptography | No | Not touched by this phase |
| V10 Malicious Code / Supply Chain | Yes | GATE-02 (zero-runtime-dep assertion) and GATE-03 (Renovate release-age gating + blocked-major-automerge for the toolchain) are both supply-chain integrity controls: GATE-02 prevents a runtime-visible dependency from being silently introduced; GATE-03's `minimumReleaseAge: "3 days"` mitigates the "freshly-published/compromised package" attack window (a documented supply-chain risk pattern — malicious or compromised packages are most often caught within their first few days) |
| V14 Configuration | Yes | GATE-01/GATE-02 are both CI configuration-hardening controls ensuring the build fails loudly (never silently) on a regression in type-safety or dependency posture — directly serving this project's stated Core Value ("failures are visible, never silent") |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Malformed/attacker-influenced `registry.json` response causing an uncaught exception that prevents `window.__DXKIT__` from ever being exposed (a client-side denial-of-service against the shell's own init sequence) | Denial of Service | ROB-05's `Array.isArray()` guard — fail closed to an empty manifest list + a visible `dx:error`, never an uncaught throw |
| A freshly-published or compromised npm package version being auto-merged into the toolchain before the community/registry has had time to flag it | Tampering / Supply Chain | GATE-03's `minimumReleaseAge: "3 days"` + the toolchain group's always-blocked-major-automerge policy (D-02/D-03) |
| An automated dependency bump silently introducing a new runtime-visible dependency into a published package (expanding DxKit's own supply-chain surface for downstream consumers) | Tampering / Elevation of Privilege (via transitive supply chain) | GATE-02's zero-runtime-dep assertion, corrected per Pitfall 1 to allow only `workspace:` internal links |

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `src/shell.ts` (this repo) — confirmed exact `loadManifests()`/`normalizeAndValidateManifests()`/`init()` crash path for ROB-05
- `Makefile`, `.github/workflows/ci.yml`, `tsconfig.typecheck.json` (root + ×4 plugins) (this repo) — confirmed existing GATE-01 attach point and `verify-outputs` structural template for GATE-02
- `package.json` (root + 4 plugins) (this repo) — confirmed the D-08 contradiction (workspace:* deps present in 4/5 packages)
- `tests/shell.test.ts`, `tests/typecheck-config.test.ts` (this repo) — confirmed existing test conventions for `dx:error` assertions and Makefile/config guard tests
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/09-.../09-CONTEXT.md` (this repo) — locked decisions, traceability, load-bearing GATE-01 scoping constraint

### Secondary (MEDIUM confidence — WebSearch/WebFetch cross-checked against official docs)
- [Renovate Configuration Options](https://docs.renovatebot.com/configuration-options/) — `minimumReleaseAge`, `packageRules` (`matchPackageNames`/`matchDepTypes`/`matchUpdateTypes`), `automerge`/`automergeType`, `lockFileMaintenance` object shape, `schedule`
- [Renovate String Pattern Matching](https://docs.renovatebot.com/string-pattern-matching/) — `matchPackageNames` exact/glob/regex/negation support, `matchPackagePatterns` deprecation
- [GitHub: Replace config:base with config:recommended](https://github.com/renovatebot/renovate/issues/23326) — `config:base` → `config:recommended` rename (Renovate v36)
- [Renovate pnpm workspace support discussion #25330](https://github.com/renovatebot/renovate/discussions/25330) — pnpm-workspace.yaml auto-detection, internal `workspace:*` link exclusion from scanning
- [TypeScript skipLibCheck tsconfig reference](https://www.typescriptlang.org/tsconfig/skipLibCheck.html) — `skipLibCheck` scoping to `.d.ts` files only, not `.ts` source

### Tertiary (LOW confidence — none used)
- None — every claim in this document is either a direct codebase read (HIGH) or cross-checked against official Renovate/TypeScript documentation (MEDIUM). No LOW-confidence/unverified claims were required for this phase's scope.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all tooling versions confirmed by direct repo read
- Architecture: HIGH — all four requirements' mechanisms confirmed by direct codebase read (`src/shell.ts`, `Makefile`, `ci.yml`, `tsconfig.typecheck.json`, all 5 `package.json`)
- Pitfalls: HIGH for Pitfalls 1, 2, 5, 6 (codebase-verified); MEDIUM for Pitfalls 3, 4 (Renovate/TypeScript external-doc-verified)
- Renovate schema specifics: MEDIUM — official docs cross-checked this session, but Renovate's schema evolves; a plan/execute-time re-check is cheap and recommended (Pitfall 3)

**Research date:** 2026-07-18
**Valid until:** 2026-08-17 (30 days — stable domain: codebase facts don't expire; Renovate schema specifics carry the shorter effective shelf life within that window per Pitfall 3)

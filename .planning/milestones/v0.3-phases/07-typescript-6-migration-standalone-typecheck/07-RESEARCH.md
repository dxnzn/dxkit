# Phase 7: TypeScript 6 Migration & Standalone Typecheck - Research

**Researched:** 2026-07-17
**Domain:** TypeScript compiler migration (5.x → 6.0.x) + monorepo `tsc --noEmit` typecheck wiring
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Typecheck scope (TS6-03) — D-01:** The standalone `tsc --noEmit` covers **`src` + `tests`**
  per package — not `src` only. Tests (~5,900 LOC: core `tests/` = 7 files; each plugin has its
  own `plugins/<name>/tests/`) are type-checked by nothing today, so this is the largest
  untyped surface and the place TS6 deprecations would otherwise hide. Tests become a
  first-class consumer of each package's public types.
  - Accepted risk: widening to tests may surface *pre-existing* test-only type errors that were
    never checked. Fixing them is in-scope for this phase — that is the point of establishing a
    real baseline.
  - Root config files (`tsup.config.ts`, `vitest.config.ts`) are **out of scope** for the
    typecheck — they sit under no package `rootDir` and add config churn for low value.
- **Typecheck config shape (TS6-03) — D-02:** Add a **dedicated `tsconfig.typecheck.json` per
  package** (5 total). Each extends the package's base tsconfig and sets `noEmit: true` with
  `include: ["src", "tests"]`. The existing build tsconfigs (`declaration: true`, `outDir`,
  `include: ["src"]`) are left **completely untouched** — typecheck and emit concerns stay
  separated so tsup's `dts:true` never picks up test files.
- **D-03:** Plugin tests import core across packages via vitest path aliases
  (`@dnzn/dxkit` → `src/index.ts`, etc. — see `vitest.config.ts:7-11`) that `tsc` does not
  understand. The typecheck configs must resolve these — add `paths` mappings mirroring the
  vitest aliases so plugin tests resolve `@dnzn/dxkit`/`@dnzn/dxkit-*` to each package's `src`
  (not to unbuilt `dist/*.d.ts`). This keeps typecheck runnable without a prior build.
- **D-04:** Project references (`tsc -b`, `composite: true`) were considered and **rejected**
  for this phase — they reshape how the whole repo builds and exceed what a per-package
  `--noEmit` needs.
- **make/CI wiring (TS6-03) — D-05:** Add a new **`make typecheck`** target that loops the root
  package + the four plugins (reuse the existing `PLUGIN_BUILD_ORDER` var, mirroring the
  `verify-outputs` target's per-package loop) running `tsc --noEmit -p tsconfig.typecheck.json`
  for each.
- **D-06:** Make `typecheck` a **prerequisite of `make test`** so the existing CI (which runs
  `make build` + `make test`) picks it up with **no `ci.yml` edit required**. Keep it a
  distinct, standalone target so **Phase 9's deprecation gate can call `make typecheck`
  directly**. Ordering: **lint → typecheck → vitest** (fast static checks first, then the
  suite; final lint-vs-typecheck micro-ordering is Claude's discretion).
- **Migration sequencing & commit strategy (TS6-01, TS6-02) — D-07:** Commit in the
  **baseline / bump / fixes** split (matches Phase 6's D-02 bisectable discipline):
  1. **Baseline** — typecheck infra (`tsconfig.typecheck.json` × 5, `make typecheck`, wiring
     into `make test`) committed **green on TS 5.8.3**. This *is* the measurable baseline —
     "green on 5.8.3" is sufficient; no separate snapshot artifact is needed.
  2. **Bump** — TypeScript root devDep `^5.8.3` → `^6.0.0` as its own commit (may go red).
  3. **Fixes** — deprecation/error resolutions as follow-up commit(s), grouped logically (per
     package or per deprecation class), each fixing at source. No `ignoreDeprecations`.
- **D-08:** TypeScript version range uses a **caret `^6.0.0`** per Phase 6's D-03 convention
  (keep carets on devDeps; `pnpm-lock.yaml` pins the exact resolved version; Renovate owns
  majors). TS6-01's "6.0.x" is satisfied by the resolved lockfile version at adoption time.

### Claude's Discretion

- Exact TS6.0.x patch resolved at implementation time (pick latest stable 6.0.x).
- Precise `make test` prerequisite ordering of `lint` vs `typecheck` (both must run before
  vitest; lint is faster so likely first).
- The specific set of `paths` entries and `baseUrl`/`rootDir` details in each
  `tsconfig.typecheck.json`, and whether a shared base typecheck fragment is factored out.
- Exact commit boundaries within the "fixes" step (per package vs per deprecation class), and
  the degenerate case where **zero deprecations surface** — then TS6-02 is trivially satisfied
  and the fixes step may be empty (baseline + bump commits only).

### Deferred Ideas (OUT OF SCOPE)

- **CI deprecation gate scoped to `src/`+`plugins/*/src/`** (GATE-01) — Phase 9. This phase
  only builds the `make typecheck` step it attaches to; do NOT add error-scoping/filtering of
  `node_modules/` deprecation noise here.
- **Type-checking root config files** (`tsup.config.ts`, `vitest.config.ts`) — considered for
  typecheck scope; deferred (D-01) as low-value config churn outside any package rootDir.
- **Project references / solution-style build** (`tsc -b`, `composite`) — rejected for this
  phase (D-04); a candidate if incremental typecheck perf ever matters.
- **Forward-compat flags** (`verbatimModuleSyntax` / `isolatedDeclarations` /
  `erasableSyntaxOnly`) and the **IIFE/CJS artifact smoke test** — Phase 8.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| TS6-01 | Core and all four plugins compile under TypeScript 6.0.x with zero type errors | Empirically verified: `src/` across all 5 packages already compiles clean under `typescript@6.0.3` today (zero TS6-specific errors). The only errors found are pre-existing test-only errors (Pitfall 4 catalog, 15 total) that exist identically under current TS 5.9.3 — these must be fixed at the baseline step, not attributed to the version bump. Latest published `6.0.x` patch confirmed via live `npm view` as `6.0.3`. |
| TS6-02 | Every deprecation TS6 surfaces is resolved at the source — no `ignoreDeprecations` shim remains in any tsconfig | Empirically verified: the repo's current tsconfigs (`target: ES2022`, `module: ES2022`, `moduleResolution: bundler`, `strict: true`, `esModuleInterop: true`) already avoid every TS6-deprecated option — zero deprecation errors reproduced against `src`/existing tsconfigs. The one deprecation actually triggered in this research (`TS5101` for `baseUrl`) was self-inflicted by a config approach this research explicitly recommends *against* (Pitfall 3) — avoiding it means the "fixes" step may legitimately be empty per CONTEXT.md's documented degenerate case. |
| TS6-03 | A standalone `tsc --noEmit` typecheck runs per package, independent of tsup's `dts:true` emit | Full working `tsconfig.typecheck.json` shape verified for both the root package and a plugin package (Architecture Patterns → Pattern 1), including the exact `rootDir`/`paths` values needed to avoid `TS6059` (Pitfalls 1–2) and `TS5101` (Pitfall 3). `make typecheck` Makefile target and `make test` wiring specified (Pattern 2), reusing the existing `PLUGIN_BUILD_ORDER` var and `verify-outputs` structural template — requires no `ci.yml` edit since CI already calls `make test`. |
</phase_requirements>

## Summary

This research is unusually well-grounded: rather than relying on release notes alone, the
actual TypeScript 6.0.3 compiler was installed (via `npx --package=typescript@6.0.3`) and run
directly against this repo's real `src/` and `tests/` trees, using the exact tsconfig shape
CONTEXT.md's decisions (D-01 through D-08) describe. The results settle almost every open
question a planner would otherwise have to guess at.

**Headline finding:** under TS 6.0.3, `src/` across all 5 packages is already 100% clean —
zero TS6-specific errors. The *only* errors that surface are pre-existing test-only type
errors that exist **identically under today's TS 5.9.3** — meaning TS6 itself introduces
**zero net-new compile errors** for this codebase, once the typecheck config avoids one
specific trap (`baseUrl`, detailed below). The "fixes" step (D-07 step 3) is very likely to
be dominated by pre-existing test-fixture fixes, not real TS6 deprecations — but per D-01/D-07,
those pre-existing errors must still be fixed as part of the **baseline** step, before the
version bump, since they surface the moment tests become type-checked at all (regardless of
compiler version).

**Actual currently-resolved TypeScript is 5.9.3, not 5.8.3.** `package.json` pins
`"typescript": "^5.8.3"`, but `pnpm-lock.yaml` and `node_modules/typescript/package.json` both
resolve to `5.9.3` (caret range permits it). CONTEXT.md's "baseline on TS 5.8.3" language should
be read as "baseline on whatever `^5.8.3` currently resolves to" — that's 5.9.3 in practice.

**Primary recommendation:** Build the 5 `tsconfig.typecheck.json` files exactly as D-02/D-03
describe, but (1) widen `rootDir` to the **monorepo root** (not the package's own base
`rootDir: "src"`, and not just adding `tests` to `include`) so cross-package `paths` aliases
don't trip `TS6059`, and (2) **do not set `baseUrl`** in the `paths` config — modern TypeScript
resolves `paths` relative to the tsconfig file without it, and setting `baseUrl` explicitly
triggers `ignoreDeprecations`-requiring error `TS5101` under TS6. Fix the ~15 pre-existing
test-only type errors (cataloged below, root-caused mostly to a single shallow-`Partial<T>`
pattern) as part of the baseline commit. `tsup@8.5.1` and the full `vitest` suite were both
empirically verified to work unmodified under TS 6.0.3 — no forward-compat flag work is
needed for *this* phase (that's Phase 8).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Type compilation correctness (`tsc --noEmit`) | Build/Tooling | — | Pure devDependency/compiler concern; no runtime tier owns this |
| Declaration (`.d.ts`) emission | Build/Tooling (tsup) | — | Already owned by `tsup`'s `dts:true`; typecheck is deliberately independent (D-02) |
| CI gating | CI/Build | Build/Tooling | `make test` is the single choke point CI already calls (D-06) |
| Cross-package type resolution (paths aliases) | Build/Tooling | — | Mirrors vitest's alias resolution but enforced by `tsc`'s stricter `rootDir` model |
| Test-code type safety | Build/Tooling | Source (src/) | Tests consume `src`'s public types; errors here are either test-fixture bugs or under-specified `src` types (see deepMerge finding) |

This phase touches zero browser/API/database tiers — it is a pure build-tooling phase.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typescript` | `^6.0.0` (resolves to `6.0.3` today) [VERIFIED: npm registry `npm view typescript dist-tags` — `latest: 7.0.2`, `6.0.3` is the newest 6.0.x] | Compiler used for both `tsup`'s dts emit and the new standalone typecheck | Already the project's compiler; this phase is the version bump itself |

No new libraries are introduced by this phase — it is a version bump plus new tsconfig files
and a Makefile target, not a new dependency.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsup` | `^8.5.1` (unchanged) | dts/ESM/CJS/IIFE build | [VERIFIED: empirical] `npx tsup --dts` produces identical output (ESM+CJS+`.d.ts`/`.d.cts`) when `node_modules/typescript` is swapped to `6.0.3` — no tsup version change needed this phase |
| `vitest` | `^4.1.10` (unchanged) | Test runner | [VERIFIED: empirical] Full suite (12 files / 321 tests) stays green with `typescript@6.0.3` installed — vitest transforms via esbuild, not `tsc`, so it is insensitive to the compiler bump at runtime |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-package `tsconfig.typecheck.json` (D-02) | TS Project References (`tsc -b`, `composite: true`) | Rejected in CONTEXT.md (D-04) — reshapes the whole build; only worth it if incremental typecheck perf becomes a problem later |
| `paths` without `baseUrl` (this research's recommendation) | `paths` + `baseUrl: "."` | `baseUrl` is **deprecated in TS6** (`TS5101`) and removed entirely in TS7 — using it now creates work Phase 8/9 would just have to undo |

**Installation:**
```bash
pnpm add -D typescript@^6.0.0 -w
```
No other installation changes required.

**Version verification:** [VERIFIED: npm registry, checked live 2026-07-17]
```bash
npm view typescript dist-tags --json
# { "latest": "7.0.2", "next": "7.1.0-dev...", "rc": "7.0.1-rc", "beta": "6.0.0-beta", ... }
npm view typescript versions --json | grep '"6\.0\.'
# "6.0.0-beta", "6.0.0-dev...", "6.0.1-rc", "6.0.2", "6.0.3"
```
`6.0.3` is the latest published `6.0.x` patch as of this research. TS6-01 says "6.0.x" is
satisfied at whatever patch resolves at implementation time (Claude's Discretion, D-08) — at
time of writing that is `6.0.3`.

## Package Legitimacy Audit

This phase does not install any new package — it bumps an existing, long-standing
devDependency (`typescript`) to a new major version already used as the resolved compiler.
No `[SLOP]`/`[SUS]` audit is needed; `typescript` is the official Microsoft package with
20M+/week downloads and has been a project devDependency since inception.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| typescript | npm | 13+ yrs | very high | github.com/microsoft/TypeScript | OK | Approved (existing devDep, version bump only) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ make test  (D-06: lint -> typecheck -> vitest)                       │
│                                                                       │
│   ┌────────┐      ┌──────────────────┐      ┌───────────────────┐   │
│   │  lint  │ ───▶ │    typecheck     │ ───▶ │      vitest        │   │
│   │(biome) │      │ (this phase, new)│      │  (unchanged)        │   │
│   └────────┘      └──────────────────┘      └───────────────────┘   │
│                          │                                           │
│                          ▼                                           │
│           for pkg in [root, settings, wallet, auth, theme]:          │
│             tsc --noEmit -p <pkg>/tsconfig.typecheck.json            │
│                          │                                           │
│           each config: extends <pkg>/tsconfig.json (build config,    │
│           UNTOUCHED) + noEmit:true + rootDir:<monorepo root> +       │
│           include:[src,tests] + paths:{mirror vitest aliases,        │
│           NO baseUrl}                                                │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼  (separate, pre-existing, untouched path)
              tsup --dts  (declaration emission for publishing)
              uses <pkg>/tsconfig.json directly, include:["src"] only
```

The critical design point this diagram encodes: **typecheck and dts-emit are two independent
programs reading two different tsconfig files** that both `extend` the same base — exactly
per D-02. Nothing about wiring `typecheck` into `make test` touches the `build` target's
`tsup` invocation.

### Recommended Project Structure
```
tsconfig.json                          # unchanged (root build config)
tsconfig.typecheck.json                # NEW — root package typecheck
Makefile                               # + new `typecheck` target
plugins/
├── auth/
│   ├── tsconfig.json                  # unchanged (build config)
│   └── tsconfig.typecheck.json        # NEW
├── wallet/    (same pattern)
├── theme/     (same pattern)
└── settings/  (same pattern)
```

### Pattern 1: Typecheck config that widens rootDir to the monorepo root
**What:** Each `tsconfig.typecheck.json` sets `rootDir` to the directory that is a common
ancestor of every file the program will actually load — not just the package's own `src`+`tests`,
but every sibling-package `src/index.ts` that gets pulled in via `paths`.
**When to use:** Any package whose typecheck config resolves `paths` to another package's real
`.ts` source (D-03's requirement) rather than to that package's built `.d.ts`.
**Example (root/core package):**
```json
// tsconfig.typecheck.json (root) — Source: empirical verification, this session
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": ".",
    "paths": {
      "@dnzn/dxkit": ["./src/index.ts"],
      "@dnzn/dxkit-wallet": ["./plugins/wallet/src/index.ts"],
      "@dnzn/dxkit-auth": ["./plugins/auth/src/index.ts"],
      "@dnzn/dxkit-theme": ["./plugins/theme/src/index.ts"],
      "@dnzn/dxkit-settings": ["./plugins/settings/src/index.ts"]
    }
  },
  "include": ["src", "tests"]
}
```
**Example (plugin package, e.g. auth):**
```json
// plugins/auth/tsconfig.typecheck.json — Source: empirical verification, this session
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "../..",
    "paths": {
      "@dnzn/dxkit": ["../../src/index.ts"],
      "@dnzn/dxkit-wallet": ["../wallet/src/index.ts"],
      "@dnzn/dxkit-auth": ["../auth/src/index.ts"],
      "@dnzn/dxkit-theme": ["../theme/src/index.ts"],
      "@dnzn/dxkit-settings": ["../settings/src/index.ts"]
    }
  },
  "include": ["src", "tests"]
}
```
Verified command for each: `(cd plugins/<name> && npx tsc --noEmit -p tsconfig.typecheck.json)`.

### Pattern 2: `make typecheck` target reusing `PLUGIN_BUILD_ORDER`
**What:** Loop the root package + `PLUGIN_BUILD_ORDER`, running `tsc --noEmit -p tsconfig.typecheck.json` in each directory — structurally identical to `verify-outputs`.
**When to use:** This is exactly D-05's prescribed shape.
**Example:**
```makefile
# Source: pattern mirrors existing verify-outputs target (Makefile:77-93)
typecheck:
	@echo
	@echo "TYPECHECKING: ."
	@echo
	@npx tsc --noEmit -p tsconfig.typecheck.json
	@for dir in $(PLUGIN_BUILD_ORDER); do \
		echo; \
		echo "TYPECHECKING: $$dir"; \
		echo; \
		(cd $$dir && npx tsc --noEmit -p tsconfig.typecheck.json) || exit 1; \
	done
```
And per D-06:
```makefile
test: lint typecheck
	npx vitest run

test-watch: lint typecheck
	npx vitest
```
Update `.PHONY` to include `typecheck`.

### Anti-Patterns to Avoid
- **Setting `baseUrl` to support `paths`:** Not needed since TS 4.1 (paths resolve relative to
  the tsconfig file), and under TS6 it's a live `TS5101` deprecation error requiring
  `ignoreDeprecations` — which D-02/TS6-02 explicitly forbid. [VERIFIED: empirical — this exact
  error was reproduced and resolved this session]
- **Just adding `tests` to the existing base tsconfig's `include`:** Breaks immediately with
  `TS6059` because the base config's `rootDir: "src"` doesn't cover `tests/`. This is why a
  *separate* typecheck config (D-02) — not an edit to the build config — is required.
- **Copying the vitest alias map's `baseUrl`-relative shape 1:1:** vitest/vite has no `rootDir`
  concept, so its alias resolution silently tolerates paths that `tsc` will reject. The two
  configs necessarily diverge in shape even though they express "the same" aliases.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Recursive/nested partial override typing | A custom recursive mapped type from scratch for `deepMerge`'s second param | A single shared `DeepPartial<T>` utility type (see Code Examples) | The bug isn't really "hand-rolling" risk here — it's that `Partial<T>` was used where the function's actual runtime contract is recursive; introduce the *correct* standard mapped-type pattern once, reuse everywhere |
| Detecting per-package `tsconfig` drift | A custom script diffing tsconfigs | Reuse `PLUGIN_BUILD_ORDER` for the Makefile loop (already exists) | Same rationale as `verify-outputs` — one source of truth for "which packages exist" |

**Key insight:** This phase's main risk isn't "reinventing a wheel" — it's a config-shape trap
(`rootDir`/`baseUrl` interplay with cross-package `paths`) that's been fully characterized and
solved above.

## Common Pitfalls

### Pitfall 1: `TS6059` — file not under `rootDir` when adding `tests` to include
**What goes wrong:** Extending the package's build tsconfig (which has `rootDir: "src"`) and
adding `"tests"` to `include` fails immediately for every test file.
**Why it happens:** `rootDir` is inherited from the base config via `extends`; TS enforces that
every included file lives under it.
**How to avoid:** The typecheck config must explicitly override `rootDir` — and for plugin
packages, it must be widened past just "this package" because `paths` also pulls in
sibling-package source.
**Warning signs:** `error TS6059: File '.../tests/x.test.ts' is not under 'rootDir'`.
[VERIFIED: empirical, reproduced this session against the real repo]

### Pitfall 2: `TS6059` recurring even after fixing `rootDir` to the package's own tests dir
**What goes wrong:** Setting `rootDir` to `"."` (the plugin's own directory) still fails, this
time citing sibling-package files like `../../src/index.ts` or `../wallet/src/index.ts`.
**Why it happens:** D-03's cross-package `paths` mapping resolves `@dnzn/dxkit` etc. to the
*actual* `.ts` source of other packages (not their built `.d.ts`), and those files are outside
even a widened-to-"." rootDir.
**How to avoid:** `rootDir` must be the monorepo root (`.` for the core package, `../..` from
each plugin directory) — wide enough to contain every file any package's `paths` might resolve
to.
**Warning signs:** `TS6059` errors citing paths like `../../src/index.ts` rather than the
package's own `tests/`. [VERIFIED: empirical, reproduced and fixed this session]

### Pitfall 3: `TS5101` — `baseUrl` deprecated under TS6
**What goes wrong:** If `baseUrl` is added to make `paths` resolution "feel" more explicit, TS
6.0.3 immediately errors: `Option 'baseUrl' is deprecated and will stop functioning in
TypeScript 7.0. Specify compilerOption "ignoreDeprecations": "6.0" to silence this error.`
**Why it happens:** TS6 deprecates `baseUrl` outright (confirmed in official TS 6.0 release
notes and reproduced empirically).
**How to avoid:** Omit `baseUrl`. `paths` without `baseUrl` resolves relative to the directory
containing the tsconfig file itself — this has worked since TypeScript 4.1 and was empirically
verified to still resolve all 5 cross-package aliases correctly under both 5.9.3 and 6.0.3.
**Warning signs:** Any `TS5101` diagnostic — this is a hard signal the D-02/TS6-02 "no
`ignoreDeprecations` shim" rule is about to be violated to work around a self-inflicted config
choice, not a real TS6 migration blocker.
**Directly relevant to TS6-02:** since `ignoreDeprecations` is explicitly forbidden, this
pitfall is a genuine gate risk if the typecheck config is built the "obvious" way (with
`baseUrl`) instead of the verified-working way (without it).

### Pitfall 4: Pre-existing test-only type errors surfacing at baseline (not TS6-caused)
**What goes wrong:** The moment `tests/` becomes type-checked at all (independent of TS version
— reproduced identically under both 5.9.3 and 6.0.3), ~15 real type errors surface across 5
test files. None are TS6 deprecations; all are latent test-code type issues never checked
before.
**Why it happens:** Per CONTEXT.md's D-01 "accepted risk" — tests were never a `tsc` input
before this phase.
**How to avoid:** Budget the baseline commit (D-07 step 1) to include these fixes; do not treat
them as part of the TS6 "fixes" step (D-07 step 3) — they exist on 5.9.3 too and must be green
*before* the bump per Success Criterion 1's sequencing.
**Warning signs / full catalog (empirically verified, both TS versions, 2026-07-17):**

| Package | File:Line | Error | Root cause |
|---------|-----------|-------|-------------|
| root | `tests/shell.test.ts:308` | `TS2741` missing `label` | Shallow `Partial<T>` on nested `overrides.nav` (see Code Examples) |
| root | `tests/utils.test.ts:11,16,26` | `TS2741` (3x) missing nested required fields | Same shallow-`Partial<T>` pattern in `deepMerge`'s signature |
| root | `tests/utils.test.ts:102` | `TS2345` | Same root cause, call-site symptom |
| root | `tests/stress.test.ts:243,338,366,507` | `TS2352` `CustomEvent` handler cast to `EventListener` | Handler typed `(e: CustomEvent) => number`, cast directly to `EventListener` (expects `Event`) — needs a two-step cast through `unknown` or a differently-typed helper |
| auth | `tests/auth.test.ts:18` | `TS2322` mock `Wallet` missing `getProviders`/`getActiveProvider` | Mock object literal predates those `Wallet` interface members |
| auth | `tests/auth.test.ts:53` | `TS2322` `Record<string, Plugin>` rejects `undefined` | Conditional-spread pattern producing `{ wallet?: undefined }` doesn't satisfy `Record<string, Plugin>`'s index signature |
| wallet | `tests/wallet.test.ts:254` | `TS2580`/`TS2591` `Cannot find name 'Buffer'` | Node global used in browser-first test code; see Open Questions |
| wallet | `tests/wallet.test.ts:563` | `TS2578` unused `@ts-expect-error` | Directive no longer matches a real error (deleting a property typed `any` never errors) |
| theme | `tests/theme.test.ts:425` | `TS2578` unused `@ts-expect-error` | Same pattern as above |
| theme | `tests/theme.test.ts:462` | `TS2322` | Callback return type narrower than declared generic return |
| settings | `tests/settings.test.ts:511` | `TS2578` unused `@ts-expect-error` | Same pattern as wallet/theme |

**Total: 15 errors across 5 files.** Zero errors in any `src/` file in any package, under
either TS version — `src` is already TS6-clean. [VERIFIED: empirical, both `typescript@5.9.3`
(currently installed) and `typescript@6.0.3` (via `npx --package=typescript@6.0.3`), same
command/config, same result set]

### Pitfall 5: `types: []` new TS6 default interacting with ambient `Buffer`/Node globals
**What goes wrong:** TS6's error message for the `Buffer` issue above changed from generic
"cannot find name" (`TS2580` under 5.9.3) to one that explicitly mentions the new `types` field
default (`TS2591` under 6.0.3): *"Cannot find name 'Buffer'... add 'node' to the types field in
your tsconfig."* This reflects TS6's `types` defaulting to `[]` instead of auto-discovering all
`@types/*` packages in `node_modules`.
**Why it happens:** `@types/node` is present in `node_modules` today only as a *transitive* peer
dependency of `vite`/`vitest`/`commitizen` (confirmed via `pnpm-lock.yaml`, resolved to
`@types/node@25.5.0`) — it is not a direct devDependency. Under TS5's old auto-discovery
default it was picked up incidentally; under TS6's new `types: []` default it would not be,
regardless of the version bump, unless a package explicitly opts in.
**How to avoid:** This is a real decision point, not just a mechanical fix — see Open Questions.
**Warning signs:** Any `Buffer`/`process`/`__dirname` use in test code with no explicit
`@types/node` devDependency.

## Runtime State Inventory

Not applicable — this is a build-tooling/config phase (compiler version bump, new tsconfig
files, new Makefile target), not a rename/refactor/migration of runtime-persisted names or
service configuration. No stored data, live service config, OS-registered state, secrets, or
build artifacts carry a name that this phase changes.

**Nothing found in any category** — verified by reviewing the phase's confirmed file-touch
list in CONTEXT.md's `<canonical_refs>` (tsconfigs, Makefile, root `package.json`,
`pnpm-lock.yaml`); none of these are read by any external service, OS scheduler, or datastore.

## Code Examples

### `DeepPartial<T>` fix for `deepMerge` (resolves 5 of the 8 root-package errors)
```typescript
// Source: empirical investigation this session — src/utils.ts:2 currently reads:
// export function deepMerge<T extends Record<string, any>>(a: T, b: Partial<T>): T
// Partial<T> is shallow — nested optional objects still require ALL their own properties,
// which is why `deepMerge({ nav: { label: 'Test', order: 0 } }, { nav: { order: 5 } })`
// fails to type-check even though it works correctly at runtime.

type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

export function deepMerge<T extends Record<string, any>>(a: T, b: DeepPartial<T>): T {
  // implementation unchanged — only the type signature was ever wrong
}
```
This same shallow-`Partial<T>` pattern is very likely also the root cause of
`tests/shell.test.ts:308`'s `overrides: { nav: { order: 5 } }` error (wherever `ShellConfig`'s
per-dapp `overrides` field is typed) — the planner should check whether that field can reuse
the same `DeepPartial<T>` utility rather than fixing each call site independently.

### `CustomEvent` handler cast fix (resolves the 4 `stress.test.ts` errors)
```typescript
// Source: empirical investigation this session — tests/stress.test.ts:243 currently reads:
const onSubpath = ((e: CustomEvent) => subpathEvents.push(e.detail)) as EventListener;
// TS6/5.9 both reject the direct cast because CustomEvent and Event aren't sufficiently
// overlapping. Two valid at-source fixes:

// Option A — double-cast through unknown (TS's own suggested fix in the error message):
const onSubpath = ((e: CustomEvent) => subpathEvents.push(e.detail)) as unknown as EventListener;

// Option B — type the handler correctly as an EventListener and narrow inside:
const onSubpath: EventListener = (e) => subpathEvents.push((e as CustomEvent).detail);
```

### Verified minimal per-package typecheck invocation
```bash
# Source: this session — commands run against the live repo, both TS versions
npx tsc --noEmit -p tsconfig.typecheck.json                       # root
(cd plugins/settings && npx tsc --noEmit -p tsconfig.typecheck.json)
(cd plugins/wallet   && npx tsc --noEmit -p tsconfig.typecheck.json)
(cd plugins/auth     && npx tsc --noEmit -p tsconfig.typecheck.json)
(cd plugins/theme    && npx tsc --noEmit -p tsconfig.typecheck.json)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `tsup`'s `dts:true` as the only type-signal (no dedicated typecheck) | Standalone `tsc --noEmit` per package, independent program | This phase (TS6-03) | Tests become type-checked for the first time; declaration-emit and correctness-checking are now decoupled per D-02 |
| TS5.x permissive legacy options (`baseUrl`, `moduleResolution: node`, `target: es5`, etc.) | TS6 either deprecates (warns, `ignoreDeprecations` required) or removes these outright | TypeScript 6.0 (stable; `latest` npm dist-tag is already `7.0.2`) | This repo's tsconfigs (`target: ES2022`, `module: ES2022`, `moduleResolution: bundler`, `strict: true`, `esModuleInterop: true`) already avoid every deprecated option — [VERIFIED: empirical, zero TS6-specific deprecation errors reproduced against the real repo's existing tsconfigs] |
| `types` auto-discovers all `@types/*` packages | `types` defaults to `[]` | TypeScript 6.0 | Low risk here — no package in `src`/`tests` relies on ambient `@types/node` types except the one `Buffer` reference in `wallet.test.ts` (see Pitfall 5 / Open Questions) |

**Deprecated/outdated:**
- `ignoreDeprecations: "6.0"` — technically available as an escape hatch in TS6, but
  **explicitly forbidden by TS6-02 and D-02** for this migration; not used anywhere in this
  research's verified working configs, and none currently exist in any tsconfig in the repo
  (confirmed via `grep -rn "ignoreDeprecations" **/*.json` — zero matches).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tsup@8.5.1`'s dts generation will continue to work correctly across the *full* build matrix (all 5 packages, both IIFE/CJS/ESM targets) under TS 6.0.3, not just the single root-package smoke test performed here | Standard Stack / Supporting | Low — only the root package's ESM+CJS+dts build was smoke-tested this session (not the 4 plugins, not the IIFE target); if a plugin's build breaks under TS6 it would surface immediately at the "Bump" commit (D-07 step 2), which is explicitly allowed to go red and is diffed against the green baseline |
| A2 | `@types/node` should be added as an explicit devDependency (rather than rewriting the one `Buffer` usage in `wallet.test.ts` to avoid the Node global) | Pitfall 5 / Open Questions | Low-medium — either path resolves TS6-03 cleanly; choosing devDependency-add vs. test-rewrite is a legitimate implementation decision, not a research gap, but the choice affects `types` field configuration (see Open Questions) |

**All other claims in this research were either verified via direct npm registry queries
(`npm view typescript ...`) or via empirical `tsc`/`tsup`/`vitest` execution against the real
repository in this session** — no user confirmation is required for those.

## Open Questions

1. **Should `wallet.test.ts`'s `Buffer` usage be fixed by adding `@types/node`, or by rewriting
   the test to avoid the Node global?**
   - What we know: `Buffer` works at runtime today (vitest test files execute in the Node
     process even though the *simulated environment* is `happy-dom`), so the test currently
     passes; it's purely a typecheck-time gap. `@types/node` is not a direct devDependency
     today — it's present transitively (`@types/node@25.5.0` via `vite`/`vitest`/`commitizen`
     per `pnpm-lock.yaml`) but under TS6's new `types: []` default it will not be picked up
     automatically regardless.
   - What's unclear: Whether the project prefers "add `@types/node` as an explicit
     devDependency + `"types": ["node"]` in the root typecheck config" (quick, but a new
     devDependency in a zero-runtime-dep, browser-first project) vs. "rewrite the one
     assertion to avoid `Buffer`" (e.g., using `TextEncoder`/manual hex encoding — zero new
     devDeps, arguably more consistent with the project's browser-first posture since
     `Buffer` is Node-only and this is testing a *wallet* provider that must also work in
     browsers).
   - Recommendation: Prefer the test-rewrite (avoid `Buffer`) to keep zero new devDependencies
     and stay consistent with the "zero runtime deps / browser-first" project posture — but
     this is a one-line implementation choice the planner/executor can make directly; it does
     not need a `checkpoint:human-verify`.

2. **Does the TS6 bump affect the 4 plugin packages' `tsup` builds (all 3 output formats), not
   just the root package's ESM/CJS smoke test performed here?**
   - What we know: The root package's ESM+CJS+dts build was verified clean under `tsup@8.5.1`
     + `typescript@6.0.3`. `tsup`'s own `peerDependencies` declare `typescript: ">=4.5.0"` with
     no upper bound, and each plugin's `tsup.config.ts` follows an identical shape to root's.
   - What's unclear: Whether any plugin-specific type pattern (e.g. `wallet`'s EIP-1193 typing,
     `theme`'s DOM-heavy code) hits an edge case root's simpler surface didn't exercise.
   - Recommendation: Not a blocker — per D-07's bisectable commit split, the "Bump" commit
     (step 2) is explicitly allowed to go red; `make build` + `make verify-outputs` running in
     CI on that commit will surface any plugin-specific build break immediately, and it's
     fixed in the "Fixes" step (step 3) alongside any real TS6 deprecations.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Toolchain floor (Phase 6) | ✓ | v22.22.1 | — |
| pnpm | Package manager | ✓ | 10.32.1 (per `packageManager` field) | — |
| `typescript` (current) | Baseline typecheck | ✓ | 5.9.3 (resolved; `package.json` pins `^5.8.3`) | — |
| `typescript@6.0.3` | Post-bump typecheck | ✓ [VERIFIED: `npx --package=typescript@6.0.3 tsc --version` → `Version 6.0.3`] | 6.0.3 | — |
| `tsup` | Build (dts emit) | ✓ | 8.5.1 | — |
| `vitest` | Test suite | ✓ | 4.1.10 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — everything this phase needs is already
installed or trivially installable from the public npm registry.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (unchanged by this phase) |
| Config file | `vitest.config.ts` (read-only reference for this phase, per CONTEXT.md) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` (whole suite already runs in ~1.1s; no sampling split needed) |

This phase's *actual* new validation surface is the typecheck step itself, not vitest —
vitest's role here is just "stay green," which was empirically confirmed (321/321 passing
under `typescript@6.0.3`).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| TS6-01 | Core + all 4 plugins compile clean under TS 6.0.x | typecheck | `make typecheck` | ❌ Wave 0 (this phase creates it) |
| TS6-02 | No `ignoreDeprecations` shim in any tsconfig | static grep | `grep -rn "ignoreDeprecations" tsconfig.json plugins/*/tsconfig*.json` (should return nothing) | ❌ Wave 0 — not a test file, but should be an explicit verification step in the plan |
| TS6-03 | Standalone `tsc --noEmit` per package, wired into `make test`/CI | integration (Makefile) | `make test` (invokes `typecheck` as a prereq per D-06) | ❌ Wave 0 (this phase creates `tsconfig.typecheck.json` x5 + Makefile target) |
| (all) | Full vitest suite stays green after the bump | unit/integration | `npx vitest run` | ✅ exists today (12 files, 321 tests) |

### Sampling Rate
- **Per task commit:** run the specific package's `tsc --noEmit -p tsconfig.typecheck.json`
  being worked on, plus `npx vitest run` for that package's tests.
- **Per wave merge:** `make typecheck` (all 5 packages) + `make test` (full suite).
- **Phase gate:** `make build && make verify-outputs && make test` all green — mirrors what CI
  already runs (`ci.yml`), so no workflow file edit is needed (confirmed: `ci.yml` currently
  runs exactly `pnpm install --frozen-lockfile`, `make build`, `make verify-outputs`, `make test`
  on the `[22.12.0, 24]` matrix).

### Wave 0 Gaps
- [ ] `tsconfig.typecheck.json` (root) — new, per Pattern 1 above
- [ ] `plugins/{auth,wallet,theme,settings}/tsconfig.typecheck.json` — new, per Pattern 1 above
- [ ] `Makefile` `typecheck` target + `.PHONY` update + `test`/`test-watch` prerequisite update
- [ ] Baseline fixes to `src/utils.ts` (`DeepPartial<T>`) and the ~15 cataloged pre-existing
      test-only errors (Pitfall 4) — required before the baseline commit can be green

## Security Domain

This phase has no application-level security surface — it is a compiler/build-tooling version
bump with no new inputs, no auth/session/crypto code, and no new runtime dependency (TypeScript
remains a devDependency; the compiled output is unaffected in terms of runtime dependency
posture).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Not touched by this phase |
| V3 Session Management | No | Not touched by this phase |
| V4 Access Control | No | Not touched by this phase |
| V5 Input Validation | No | No new input-handling code; only type-level (compile-time) changes |
| V6 Cryptography | No | Not touched by this phase |
| V14 Configuration (supply chain) | Yes | `typescript` is bumped via `pnpm add -D typescript@^6.0.0`, updating `pnpm-lock.yaml`'s pinned resolution — standard pnpm lockfile integrity (hash-pinned) is the control; no new registry/package is introduced |

### Known Threat Patterns for {stack}

Not applicable — no new attack surface is introduced. The one supply-chain-adjacent
consideration (bumping `typescript` itself) is mitigated by pnpm's lockfile hash pinning, which
is unchanged process from every other devDependency bump this project has already done in
Phase 6.

## Sources

### Primary (HIGH confidence — empirical, this session)
- `npx --package=typescript@6.0.3 tsc --noEmit -p <config>` run against the real repo's `src`
  and `tests` trees, for the root package and all 4 plugins, both with and without the
  `baseUrl`/`rootDir` variations documented in the Pitfalls section.
- `npx tsup --dts --format esm,cjs` run against `src/index.ts` with `node_modules/typescript`
  swapped to `6.0.3` — confirmed successful ESM+CJS+`.d.ts`/`.d.cts` emission.
- `npx vitest run` executed with `typescript@6.0.3` installed — 12 files / 321 tests, all
  green.
- `npm view typescript dist-tags --json` / `npm view typescript versions --json` — confirmed
  `6.0.3` is the newest published `6.0.x` patch; `latest` dist-tag is already `7.0.2`.
- `node_modules/.bin/tsc --version` / `pnpm-lock.yaml` grep — confirmed currently-resolved
  TypeScript is `5.9.3`, not `5.8.3` as `package.json`'s caret range might suggest.
- `grep -rn "ignoreDeprecations"` across all tracked `tsconfig*.json` — zero matches today.

### Secondary (MEDIUM confidence)
- [TypeScript 6.0 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) — official docs, fetched directly; cross-checked deprecation list matches what was empirically reproduced (`baseUrl` → `TS5101`).
- [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) — official Microsoft DevBlogs announcement, fetched directly; corroborates the release notes.

### Tertiary (LOW confidence)
- None used as a basis for any recommendation in this document — all WebSearch-only results
  were either confirmed against the two official sources above or superseded by direct
  empirical verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — version bump only, confirmed live against npm registry
- Architecture (typecheck config shape): HIGH — every claim reproduced empirically against the real repo, not just reasoned from docs
- Pitfalls: HIGH — all 5 pitfalls were actually triggered and then resolved in this session, not inferred
- Security: N/A — no security-relevant surface in this phase

**Research date:** 2026-07-17
**Valid until:** 2026-08-16 (30 days — TS 6.0.x patch releases may land, but the migration
shape/pitfalls documented here are structural and won't go stale with a patch bump; re-verify
if `latest` moves further past `7.0.2` in a way that affects `6.0.x` npm availability)

# Pitfalls Research

**Domain:** TypeScript 5.8 → TS6 migration + toolchain modernization for a shipped, zero-runtime-dep, 3-format (ESM/CJS/IIFE) tsup monorepo (DxKit core + 4 plugins, ~2,986 LOC, 321 tests)
**Researched:** 2026-07-15
**Confidence:** HIGH (repo facts verified directly against source; TS6/isolatedDeclarations/verbatimModuleSyntax facts cross-checked against official TypeScript docs + GitHub issues; toolchain-risk items are MEDIUM where they depend on future bot behavior)

## Codebase Baseline (verified 2026-07-15, informs every pitfall below)

These facts change the risk profile from "generic TS6 migration" to "this specific migration" — read before the pitfalls:

- **No `tsc --noEmit` step exists anywhere** (not in `Makefile`, not in `package.json` scripts, not in `.github/workflows/ci.yml`). Type checking today happens only as a side effect of `tsup`'s `dts: true` step. This is the single biggest gap for the "CI deprecation gate" requirement — there is currently nothing to attach a gate *to*.
- Source is **already verbatimModuleSyntax-clean**: every plugin imports core types via `import type { ... } from '@dnzn/dxkit'` (checked `plugins/{auth,wallet,settings,theme}/src/index.ts:1`), `settings/src/index.ts:264` re-exports types via `export type { ... } from`, there are zero default imports, zero `import * as` namespace imports, zero `require(`/`module.exports` in `src/`/`plugins/*/src/`. `isolatedModules: true` is already set in the root `tsconfig.json`.
- **Exported factory functions already have explicit return-type annotations** (`createShell(): Shell`, `createRouter(): Router`, `createEventBus(): EventBus`, `createLifecycleManager(): LifecycleManager`, `createPluginRegistry(): PluginRegistry`, `deepMerge<T>(): T`) — the pattern `isolatedDeclarations` most commonly breaks (bare inferred-return exports) is largely absent already.
- CI (`.github/workflows/ci.yml`) already runs on **Node 20 only** (single-entry matrix), and `pnpm-lock.yaml` already resolves a transitive `@types/node@25.5.0` (via vite) — ahead of, not behind, the stated Node 20 floor.
- No `engines` field exists yet in any of the 5 `package.json` files.
- No Renovate/Dependabot config exists yet — "dependency-freshness automation" is greenfield for this repo, not a tune-up of an existing bot.
- No separate release/publish GitHub Actions workflow — publishing is a manual `make`/`commit-and-tag-version` flow, so a bad automated bump can't auto-publish; it can only merge into `main`.
- `tsup.config.ts` (root + each plugin) is unchanged since 0.1.x: `dts: true` for ESM/CJS, `format: ['iife']` with `noExternal: ['@dnzn/dxkit']` per-plugin, `platform: 'browser'` for the IIFE build.

## Critical Pitfalls

### Pitfall 1: TS6 removes/deprecates options with no `tsc` step to catch it

**What goes wrong:**
TS6 hard-removes `module: "amd"|"umd"|"systemjs"|"none"` and `--outFile`, and deprecates `target: "es5"`, `baseUrl`, and `module: "amd"|"umd"|"systemjs"` (warning now, removed in TS7). None of these are used in this repo's `tsconfig.json` (`target: ES2022`, `module: ES2022`, `moduleResolution: bundler`) — so on paper the migration is a no-op. The actual danger is different: because there is **no `tsc --noEmit` step in CI or `make test`**, a TS6 upgrade could land, `tsup`'s bundled dts-emit could silently downgrade to a permissive/errored-but-ignored state, and nobody would notice until a consumer's `import` breaks. `esModuleInterop`/`allowSyntheticDefaultImports` also flip their *default* to `true` in TS6 — harmless here since they're already explicitly `true`, but worth confirming they stay explicit rather than relying on the new default (explicit config survives a later `ignoreDeprecations` cliff; implicit defaults don't self-document).

**Why it happens:**
The repo's `tsconfig.json` is already modern (ES2022/bundler resolution), so the temptation is to bump the `typescript` devDependency and call the migration "done" without ever adding the verification step that would prove it.

**How to avoid:**
Add a real `tsc --noEmit --project <pkg>/tsconfig.json` step (or a root script that loops all 5) to CI *before* touching the TS6 version bump, so there's a baseline to diff against. Then bump `typescript` and re-run; treat any new diagnostic as the actual migration surface, not the tsconfig audit.

**Warning signs:**
`make test` and CI stay green across the TS6 bump with zero diagnostics changed — that's not a clean migration, that's an untested one.

**Phase to address:**
TS6 Migration phase (must land the `tsc --noEmit` step in this phase, not defer it to the guardrails phase — the guardrails phase needs it as a precondition).

---

### Pitfall 2: `isolatedDeclarations` churn is real but concentrated — misjudging where it bites wastes the phase

**What goes wrong:**
`isolatedDeclarations` requires every *exported* function to have an explicit return type and every exported `const`/object to have an explicit type; it cannot infer across files, cannot infer through spreads on exported values, and only widens `const` arrays/tuples for free (mutable arrays need annotation). Teams that haven't audited their exports first tend to either (a) over-annotate the entire file including private/internal symbols that the flag never asked for, or (b) hit a wall on one specific pattern — barrel re-exports of imported types (`export type { X } from` — already used in `settings/src/index.ts:264`), object-literal-returning arrow consts assigned to `Router`/`Shell`-shaped interfaces without an explicit annotation, and any exported constant built with `{ ...a, ...b }` spread — and burn the whole phase debugging that wall instead of scoping it.

**Why it happens:**
Because this repo's *factory functions* are already fully annotated, the risk is not "explosion of churn" — the risk is under-estimating the long tail: helper exports, `export type { ... } from` barrels, and any `as const` usage (present in `plugins/settings/src/index.ts` and `src/shell.ts`) where the const-asserted value is directly re-exported rather than consumed internally.

**How to avoid:**
Turn `isolatedDeclarations: true` on per-package (not repo-wide) and let `tsc` enumerate every error before writing a line of annotation — treat the diagnostic list as the actual scope, not intuition. Given the already-explicit factory return types, realistic churn for ~2,986 LOC / 5 packages is **low-to-moderate**: expect single-digit-to-low-double-digit annotation additions per package concentrated in `src/types/*.ts` barrels, `utils.ts` (generic `deepMerge<T>`), and any `as const`-derived exports — not a rewrite. Budget the phase for "find and annotate the tail," not "rewrite every export."

**Warning signs:**
`tsc` diagnostic count on first enable is in the hundreds rather than dozens — that means something structural is off (likely a wide barrel `export *` or an exported value built by spread), not that the flag is simply "strict." (Repo currently has zero `export *` — if one gets introduced during this migration, that's the signal to stop and re-scope.)

**Phase to address:**
Forward-Compat Typing phase, scoped per-package with `tsc` diagnostics as the acceptance gate — not "turn it on everywhere and fix until vitest passes" (vitest won't catch declaration-emit failures at all, since tests run against `src/*.ts` via path aliases, never against `dist/*.d.ts`).

---

### Pitfall 3: tsup's `dts: true` doesn't get faster or safer just because `isolatedDeclarations` is on

**What goes wrong:**
`isolatedDeclarations`'s headline benefit — parallel, per-file `.d.ts` emission without cross-file type inference — is realized by bundlers that specifically adopted an isolated-declarations-aware emitter (e.g. tsdown/rolldown-plugin-dts via oxc-transform). `tsup` 8.x's `dts: true` still shells out to a full `tsc` declaration-emit/rollup pass regardless of the flag. Enabling `isolatedDeclarations` in this repo's `tsup`-driven build gets the *type-checking* discipline (forces explicit annotations) but **not** any build-speed or emit-robustness win from tsup itself. If the roadmap phase is scoped assuming a build-speed payoff, it will report a false regression/non-result.

**Why it happens:**
The isolatedDeclarations pitch is inseparable in most blog coverage from "faster builds" — that claim is about the newer generation of bundlers (tsdown, rolldown), not tsup.

**How to avoid:**
Frame this phase's isolatedDeclarations work purely as **TS7-readiness type discipline**, matching PROJECT.md's own stated rationale ("de-risk the eventual TS7 jump") — not as a tsup performance improvement. Don't gate phase success on build-time deltas; gate it on `tsc` passing with the flag on, per package.

**Warning signs:**
A verification criterion in the phase plan that measures `make build` wall-clock time before/after — that's testing the wrong thing for this bundler.

**Phase to address:**
Forward-Compat Typing phase — set expectations in the phase's success criteria before work starts, not after a confusing benchmark.

---

### Pitfall 4: `verbatimModuleSyntax` looks like a rewrite but the real risk is the IIFE/CJS *build* config, not the source

**What goes wrong:**
`verbatimModuleSyntax` forces every import/export to explicitly say `type` or be treated as a value that must exist at runtime — code without the modifier is left completely alone (not elided) under this flag, versus the old `isolatedModules`-driven implicit elision. Because this repo's source is already 100% `import type` clean (verified: every plugin's cross-package import already uses `import type`), the *source-level* churn is minimal. The real edge case for this specific repo is the **3-format build boundary**: `tsup`'s IIFE build (`noExternal: ['@dnzn/dxkit']` per plugin) and CJS build both rely on esbuild's own import-elision heuristics honoring the source's `import type` annotations to correctly drop core's types from the bundle. If `verbatimModuleSyntax` is turned on in `tsconfig.json` but a *future* contributor adds a same-name type+value export from the same module (a real TS6-era foot-gun — e.g., exporting both a `Wallet` interface and a `Wallet` runtime const from the same barrel) verbatimModuleSyntax will force them to disambiguate with the `type` keyword at the import site or the build silently keeps (or drops) the wrong one. There is no `export =` or CJS-authored source anywhere in `src/`/`plugins/*/src/`, so the "breaks CJS interop" failure mode described in TS's own docs (forcing `export =` instead of `export default` for CJS output) does not apply here — this repo emits CJS purely as a `tsup` *output format* from ESM *source*, never authors `.cts`/`require()` by hand.

**Why it happens:**
Generic "verbatimModuleSyntax migration guide" content assumes a codebase with default exports, namespace imports, or hand-authored CJS — none of which exist here, so most of the internet's warnings about this flag don't transfer 1:1 to DxKit's situation. The actual DxKit-specific risk is narrower and easy to miss precisely because the generic warnings are loud and don't match.

**How to avoid:**
Enable `verbatimModuleSyntax` per-package and run the *full* 3-format build (`make build`) plus the IIFE smoke path (load `dist/index.global.js` in a bare HTML page, or add it to the vitest happy-dom setup) as the acceptance gate — not just `tsc --noEmit`. Add a lint rule (Biome's `noExportedImports`/import-organization or a custom check) that flags any type-and-value export sharing a name, since that's the one pattern this flag can't paper over safely at the plugin/core boundary.

**Warning signs:**
A plugin's IIFE global (`DxWallet`, `DxTheme`, etc.) is missing an expected property after the flag is enabled, but ESM/CJS builds look fine — that's the noExternal-bundling-with-strict-type-elision interaction, and it will only show up in the IIFE artifact, not in `tsc` or vitest.

**Phase to address:**
Forward-Compat Typing phase — but the *verification* step must explicitly include building and loading the IIFE bundle, since that's the one artifact neither `tsc` nor the existing vitest suite exercises.

---

### Pitfall 5: Node 20 floor is stated but not enforced — `engines` field is missing everywhere

**What goes wrong:**
PROJECT.md and CI already assume Node 20, but none of the 5 `package.json` files declare `"engines": { "node": ">=20" }`. Without it, `pnpm install` on Node 18 (EOL, but still installed on some contributor/CI machines) succeeds silently and only fails later with a cryptic runtime or type error — exactly the "silent failure" class this project's v1.0 milestone spent a whole phase eliminating from the *runtime*. Shipping a v1.1 that raises the floor without an `engines` guard reintroduces that same failure class at the *tooling* layer.
A second, subtler risk: bumping `@types/node` (currently transitive-only, resolved to `25.5.0` via vite) to an explicit devDependency pinned to `^20` is necessary — if it's left unpinned or bumped to `latest`/`^25` to "match" what's already in the lockfile, contributors get autocomplete/typechecking for Node 22+/25 APIs (e.g. newer `fs`/`util` additions) that don't exist on the Node 20 floor consumers are told to target, and nothing catches the mismatch until a consumer on real Node 20 hits a `TypeError: X is not a function`.

**Why it happens:**
`engines` is easy to forget because nothing breaks locally — pnpm doesn't enforce it by default (`engine-strict` isn't set), so the omission is invisible until someone actually runs an old Node binary.

**How to avoid:**
Add `"engines": { "node": ">=20" }` to all 5 `package.json` files in the same commit that bumps the CI matrix / docs to Node 20, and set `pnpm.overrides` or a root `.npmrc` with `engine-strict=true` so local installs fail fast on the wrong Node version too. Add `@types/node` as an explicit devDependency pinned to `^20`, not left as a transitive resolution, and not bumped past the stated floor.

**Warning signs:**
`pnpm install` succeeds on a contributor's Node 18 machine after the floor is "raised" — that means the guard isn't actually in place yet, regardless of what the docs say.

**Phase to address:**
Toolchain Audit & Modernization phase (Node floor line item) — verify with `engine-strict=true` plus a CI step that actually attempts install on the *old* floor and expects it to fail (a negative test), not just a matrix entry for the new floor.

---

### Pitfall 6: The CI deprecation gate has nothing real to gate without a dedicated typecheck script, and will drown in transitive-dependency deprecation noise if scoped too broadly

**What goes wrong:**
Two failure modes converge here. First (see Pitfall 1): "fail the build on `tsc`/lint deprecation warnings" presumes a `tsc` invocation exists to attach `--strict`/deprecation flags to — today there isn't one. Second, once added, a naive `tsc --noEmit` across the whole workspace (or `pnpm audit`-style deprecation scanning) will surface deprecation warnings from **devDependencies' own transitive graph** (e.g., a sub-dependency of `vite`/`vitest`/`biome` using a deprecated Node API or a deprecated `@types/*` package) that this project cannot fix directly. A gate that fails CI on *any* deprecation warning, scoped too broadly, will go red on a transitive package update with zero action available to the maintainer except waiting on an upstream fix — exactly the kind of unfixable-red-CI that gets `--no-verify`'d or the gate gets disabled entirely (the opposite of the goal).

**Why it happens:**
"Fail on deprecation warnings" sounds like a simple flag, but `tsc`'s own deprecation diagnostics (`ignoreDeprecations`, TS6/TS7's own deprecated-option warnings) are scoped to *this project's* `tsconfig.json`, while a broader "lint deprecation" gate (e.g. `npm ls --depth` style checks, or Biome linting node_modules) pulls in noise the project doesn't control.

**How to avoid:**
Scope the gate narrowly and explicitly:
1. `tsc --noEmit` per package with the project's own `tsconfig.json` — this only surfaces *this repo's* deprecated compiler-option usage and code patterns, which is fully actionable.
2. Do NOT gate on `pnpm audit`/deprecation warnings from transitive devDependencies in the same CI job that blocks merges — route those to a separate, non-blocking "dependency health" report (or the dependency-freshness bot's own PR flow) so a red build always means "something in *our* code/config needs fixing."
3. If Biome or `tsc` add a "deprecated API used" diagnostic category later, allowlist/`// biome-ignore` known third-party-forced patterns explicitly rather than turning the rule off wholesale.

**Warning signs:**
CI goes red with a diagnostic pointing at a path under `node_modules/` rather than `src/`/`plugins/*/src/` — that's the gate scoped too broadly; fix the gate's scope, not the dependency.

**Phase to address:**
Continuous Debt Guardrails phase — but explicitly sequenced *after* the TS6 Migration phase adds the baseline `tsc --noEmit` step (Pitfall 1), since the gate has nothing to enforce without it.

---

### Pitfall 7: Dependency-freshness automation can silently reintroduce a runtime dependency or break the 3-format build unreviewed

**What goes wrong:**
This is a zero-runtime-dependency project where that posture is an explicit selling point (README, PROJECT.md constraints). A default Renovate/Dependabot config has no concept of "this repo promises zero runtime deps" — it will happily propose (and, if automerge is misconfigured, merge) a devDependency bump that *transitively* pulls a new runtime dependency into `tsup`/`vite`/`vitest`'s own dependency tree, or bump `tsup`/`esbuild` to a major version that changes IIFE/CJS output shape (esbuild has changed default behaviors around `platform`/`format` interactions and CJS interop shims across majors before) — and because there's no separate publish gate beyond `make build && make test` in CI, a bad major bump only gets caught if someone actually inspects the built artifact, which CI's `make test` doesn't do (it runs source-level vitest against path aliases, not against `dist/`).

**Why it happens:**
Automation is scoped by default to "keep deps current," not to "protect specific architectural invariants" — that mapping has to be configured explicitly, and it's easy to ship the bot with defaults and assume CI is a sufficient safety net when CI doesn't actually exercise the built IIFE artifact at all today.

**How to avoid:**
- Configure the bot (Renovate preferred over Dependabot for this — supports grouping + major-version separation natively) to: never automerge `major` version bumps for `tsup`, `vite`, `vitest`, `@biomejs/biome`, or `typescript`; group `minor`/`patch` bumps per tool; and require a human review on anything touching `tsup.config.ts`-adjacent tooling.
- Add a CI check that runs `pnpm why` (or an explicit `pnpm licenses`/dependency-tree assertion) to confirm zero non-dev, non-type packages resolve — enforceable as a real gate, not a policy statement in a README.
- Add a build artifact smoke test: after `make build`, load `dist/index.global.js` (and each plugin's `.global.js`) and assert the expected global (`DxKit`, `DxWallet`, etc.) exists with its expected top-level keys — catches esbuild/tsup major-version output-shape changes that source-level vitest can't see.

**Warning signs:**
A Renovate/Dependabot PR touches `pnpm-lock.yaml` with a diff that adds new packages *not* already present as transitive deps of the bumped tool, or the diff includes anything outside `devDependencies` — either is a signal to stop and hand-review before merge, automerge or not.

**Phase to address:**
Continuous Debt Guardrails phase (dependency-freshness automation line item) — configure the bot's scoping rules and add the build-artifact smoke test in the *same* phase, not as a follow-up; an unscoped bot is worse than no bot for a zero-dep project.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems for this migration.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Enable `isolatedDeclarations`/`verbatimModuleSyntax` repo-wide via the root `tsconfig.json` instead of per-package | One flag flip, looks "done" fast | Masks which package actually has the annotation debt; a plugin-only failure blocks core's build too, widening blast radius | Never for this milestone — per-package enablement is nearly free here since each package already has its own `tsconfig.json` extending root |
| Add `"ignoreDeprecations": "6.0"` to suppress TS6 deprecation errors instead of fixing them | Unblocks the version bump immediately | TS7 removes `ignoreDeprecations` entirely — this just moves the debt to the next milestone, defeating the stated "de-risk TS7" goal | Only as a temporary flag during active migration work, never committed to `main` |
| Configure the dependency bot with default settings and "see what happens" | Fast setup, no upfront config effort | First unreviewed major bump to `tsup`/esbuild risks breaking the IIFE artifact with no test catching it (see Pitfall 7) | Never for the initial rollout of this milestone — scope rules must ship with the bot, not after an incident |
| Skip the IIFE-artifact smoke test because vitest is already green | Saves writing one more test file | The IIFE build is the primary deployment target (IPFS/static) per README, and it's the one output format with zero current test coverage of its actual bundled shape | Never — this is a pre-existing gap this milestone should close, not carry forward |

## Integration Gotchas

Cross-boundary mistakes specific to this monorepo's core↔plugin↔build-tool seams.

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Plugin → core type imports under `verbatimModuleSyntax` | Assuming the flag requires rewriting existing `import type` statements | No rewrite needed — plugins already use `import type` exclusively; just verify the *build* (IIFE) still elides correctly (Pitfall 4) |
| `tsup` `dts: true` + `isolatedDeclarations` | Assuming the flag makes `tsup`'s dts step faster | It doesn't for tsup 8.x (Pitfall 3) — treat it as type discipline, not a perf lever |
| Renovate/Dependabot PR → CI | Assuming green CI on a bot PR means the built artifact is safe to merge | `make test` never touches `dist/`; add the IIFE artifact smoke test as an explicit, separate CI step so bot PRs are actually gated on it |
| Node floor bump → consumer installs | Assuming stating "Node 20+" in docs is sufficient | Must ship as an enforced `engines` field + `engine-strict`, or downstream consumers on Node 18 get a silent, late failure instead of an install-time error (Pitfall 5) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Expecting `isolatedDeclarations` to shrink `make build` time on tsup 8.x | Benchmarks show flat or worse build time after enabling the flag | Don't gate the phase on build-time deltas (Pitfall 3); the payoff is TS7-readiness, not speed, until/unless the project migrates off tsup to an oxc/rolldown-based bundler | Immediately — there's no scale threshold, tsup's dts path doesn't change behavior regardless of package count |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating a devDependency bump as automatically safe because "it's not a runtime dep" | A compromised or vulnerable dev-tool package (tsup/vite/biome/vitest transitive graph) still runs arbitrary code during `pnpm install`/`make build`/CI, with access to the repo and CI secrets | Keep `pnpm audit`/gitleaks/semgrep (`make audit`) in the loop for devDependency bumps too, not just runtime deps; don't let "zero runtime deps" become an excuse to skip supply-chain review on tooling |
| Auto-merging dependency-bot PRs without lockfile diff review | A transitive dependency substitution (typosquat, hijacked maintainer account) lands unreviewed | No automerge for anything beyond patch-level, low-risk tooling bumps (Pitfall 7); require lockfile diff review as part of the bot's PR template |

## Developer Experience Pitfalls

(Adapted from "UX Pitfalls" — this migration's "users" are contributors and downstream consumers of the published packages.)

| Pitfall | Developer Impact | Better Approach |
|---------|-------------------|-------------------|
| Bumping the Node floor and TS version in the same commit as unrelated toolchain bumps (vite/vitest/biome) | A contributor hitting a build failure can't tell which change caused it; bisecting becomes expensive | Land TS6 migration, Node floor, and toolchain-version bumps as separate, individually-revertible commits/PRs even within the same phase |
| Publishing v1.1 with `isolatedDeclarations`/`verbatimModuleSyntax` on but no migration note for consumers who extend DxKit's types (module augmentation on `Context`/`__DXKIT__`) | A consumer's own `declare global` augmentation (a documented, supported pattern per `src/types/context.ts`) could hit new type-only-export requirements they don't control | Explicitly test/document the module-augmentation path under the new flags before shipping; add a migration note only if consumer-visible type behavior changes |

## "Looks Done But Isn't" Checklist

- [ ] **TS6 migration:** Often missing a real `tsc --noEmit` CI step — verify the migration wasn't just "bump the version number and see vitest stay green" (Pitfall 1).
- [ ] **`isolatedDeclarations` adoption:** Often missing coverage of `export type { } from` barrels and `as const`-derived exports — verify by enabling the flag per-package and reading the full `tsc` diagnostic list, not just fixing until it compiles (Pitfall 2).
- [ ] **`verbatimModuleSyntax` adoption:** Often missing verification of the actual IIFE build artifact — verify by loading `dist/index.global.js` and each plugin's `.global.js`, not just `tsc --noEmit` passing (Pitfall 4).
- [ ] **Node 20 floor:** Often missing the `engines` field and `engine-strict` enforcement — verify by attempting `pnpm install` on Node 18 and confirming it *fails* (Pitfall 5).
- [ ] **CI deprecation gate:** Often missing a scope boundary between "our code" and "transitive dependency noise" — verify by intentionally introducing a deprecated-but-necessary transitive pattern and confirming it does NOT block CI (Pitfall 6).
- [ ] **Dependency-freshness automation:** Often missing scoping rules (major-version automerge blocks, zero-runtime-dep assertion) — verify by checking the bot config explicitly denies automerge for `tsup`/`vite`/`vitest`/`biome`/`typescript` majors (Pitfall 7).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| CI deprecation gate goes red on unfixable transitive noise (Pitfall 6) | LOW | Narrow the gate's scope to project-owned `tsconfig.json`/source paths only; move transitive-dependency deprecation reporting to a non-blocking job |
| A dependency-bot PR breaks the IIFE build unreviewed and merges (Pitfall 7) | MEDIUM | Revert the merge commit, pin the offending tool to its prior major in `package.json`, add the missing IIFE artifact smoke test before re-attempting the bump |
| `isolatedDeclarations` diagnostic count is far higher than expected, phase stalls (Pitfall 2) | LOW–MEDIUM | Re-scope: enable the flag on one package first (start with the smallest plugin, e.g. `auth`), fix its diagnostics fully, extract the annotation patterns learned, then apply to the rest — don't debug all 5 packages simultaneously |
| Node 18 install succeeds silently despite the stated floor bump (Pitfall 5) | LOW | Add `engines` + `engine-strict=true` retroactively; this is a config-only fix with no code migration required |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1. TS6 deprecated options + no typecheck baseline | TS6 Migration | `tsc --noEmit` added to CI/`make test` *before* the TS6 version bump; diagnostic diff reviewed across the bump |
| 2. `isolatedDeclarations` churn misjudged | Forward-Compat Typing | Per-package `tsc` diagnostic count tracked; flag enabled package-by-package starting with the smallest plugin |
| 3. No tsup build-speed payoff from `isolatedDeclarations` | Forward-Compat Typing | Phase success criteria explicitly exclude build-time deltas; framed as TS7-readiness only |
| 4. `verbatimModuleSyntax` + IIFE/CJS build boundary | Forward-Compat Typing | `make build` run and each `dist/*.global.js` loaded/asserted after the flag is enabled, not just `tsc --noEmit` |
| 5. Node 20 floor unenforced | Toolchain Audit & Modernization | `engines` field in all 5 `package.json`s + `engine-strict=true`; negative-case install test on Node 18 expected to fail |
| 6. CI deprecation gate scope/flakiness | Continuous Debt Guardrails (sequenced after TS6 Migration) | Gate fails only on diagnostics under `src/`/`plugins/*/src/`, never on `node_modules/`-path diagnostics |
| 7. Dependency-freshness automation risk | Continuous Debt Guardrails | Bot config denies automerge on tool majors; zero-runtime-dep CI assertion (`pnpm why`-style check) added same phase as the bot |
| WR-01 (registry.json array validation) — not a migration pitfall but shares this milestone | Robustness Carryover (can run independently/parallel to the TS/toolchain phases — no dependency between them) | Existing test pattern from v1.0's DIAG/ROB phases (malformed-input → `dx:error`, no throw before `window.__DXKIT__` is exposed) |

## Sources

- [TypeScript 6.0 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) — HIGH confidence, official
- [6.0 Deprecation List · microsoft/TypeScript#54500](https://github.com/microsoft/TypeScript/issues/54500) — HIGH confidence, official tracking issue
- [TypeScript 5.x to 6.0 Migration Guide (privatenumber)](https://gist.github.com/privatenumber/3d2e80da28f84ee30b77d53e1693378f) — MEDIUM confidence, community-authored but widely cited
- [TSConfig Option: verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html) — HIGH confidence, official
- [TypeScript Modules — ESM/CJS Interoperability](https://www.typescriptlang.org/docs/handbook/modules/appendices/esm-cjs-interop.html) — HIGH confidence, official
- [`--isolatedDeclarations` for standalone DTS emit · microsoft/TypeScript#47947](https://github.com/microsoft/TypeScript/issues/47947) — HIGH confidence, official design issue
- [Isolated declarations errors · microsoft/TypeScript PR#58201](https://github.com/microsoft/TypeScript/pull/58201) — HIGH confidence, official implementation PR
- [tsdown dts options docs](https://tsdown.dev/options/dts) — MEDIUM confidence, documents the oxc-transform/isolatedDeclarations-aware emitter that tsup 8.x does not use
- Direct repository inspection (`tsconfig.json`, `tsup.config.ts` × 5, `.github/workflows/ci.yml`, `Makefile`, `package.json` × 5, `biome.json`, `pnpm-lock.yaml`, `src/**/*.ts`, `plugins/*/src/**/*.ts`) — HIGH confidence, ground truth as of 2026-07-15

---
*Pitfalls research for: DxKit v1.1 TypeScript 6 Migration & Toolchain Modernization*
*Researched: 2026-07-15*

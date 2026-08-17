# Feature Research

**Domain:** Toolchain / build-integrity modernization for a zero-dep TypeScript library monorepo (DxKit core + 4 plugins, tsup 3-format builds)
**Researched:** 2026-07-15
**Confidence:** HIGH (compiler options, TS6 deprecations, tsup/dts tooling — official TS docs + current release notes) / MEDIUM (CI deprecation-gate patterns, dependency-freshness bot behavior — synthesized from community sources, no single canonical "how-to")

## Feature Landscape

### Table Stakes (Expected for a Credible TS6 / Forward-Compat Milestone)

These are the capabilities a TS-library maintainer would consider non-negotiable once you've announced "TS6 migration + forward-compat guardrails." Skipping any of them leaves the milestone's stated goal ("clean TS7 jump") unmet.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| TS6 compiler upgrade, `ignoreDeprecations` removed | The milestone's headline claim; leaving `ignoreDeprecations: "6.0"` in place is a lie — it just defers the work to the TS7 cliff | LOW–MEDIUM | DxKit's `tsconfig.json` uses no deprecated options today (`moduleResolution: bundler`, `module: ES2022`, `esModuleInterop: true`, `strict: true` already default-true in 6.0) — audit is the real work, not rewriting config |
| `isolatedDeclarations: true` on every package's `tsconfig.json` | Table stakes for "forward-compat typing" as scoped in PROJECT.md; also the direct enabler of parallel/non-tsc `.d.ts` emit | LOW (this codebase) – MEDIUM (general case) | DxKit's factories already return named interfaces (`createEventBus(): EventBus`, `createPluginRegistry(): PluginRegistry`) per its own CLAUDE.md conventions — the annotation discipline this flag demands is *already the house style*. Real work is auditing default-parameter object literals and the frozen `Context` object built in `shell.ts` |
| `verbatimModuleSyntax: true` on every package's `tsconfig.json` | Table stakes per PROJECT.md scope; also required for `import type`/`export type` correctness once `isolatedDeclarations` starts caring about type-only re-exports | LOW (this codebase) | `src/index.ts` already separates `export type { ... }` from value exports and `events.ts`/`registry.ts` already use `import type { ... }` — again, existing convention, not a new pattern. CJS output needs a build-time check (see Pitfalls below) |
| `tsc --noEmit` (or full build) passing cleanly with zero deprecation errors, `ignoreDeprecations` absent from every `tsconfig.json` | The actual definition of "TS6 migration done" — TS6 makes deprecated-option usage a **build-breaking error by default**, not a warning, so this is mechanically enforced already if you don't add the escape hatch | LOW | No extra tooling needed — just don't add `ignoreDeprecations` anywhere and let `tsc`'s own exit code (2) fail CI |
| CI step that runs `tsc --noEmit` (or `tsc -b`) on every package and fails the pipeline on any error | This is the actual "deprecation gate" mechanism — there is no separate `--fail-on-deprecation` flag; tsc already treats deprecated-option and deprecated-syntax usage as errors, so the gate *is* "run tsc in CI and check exit code" | LOW | If DxKit doesn't already run `tsc --noEmit` per-package in CI (only builds via tsup, which uses esbuild and may not surface all tsc diagnostics), this is a genuinely new CI step, not just a config flag |
| Dependency-freshness bot (Renovate) with a schedule + grouped PRs | PROJECT.md explicitly scopes "Renovate/Dependabot-style" automation; for a 5-package pnpm workspace (core + 4 plugins) with only devDependencies, ungrouped one-PR-per-package noise is worse than no automation | LOW–MEDIUM | Renovate is the stronger fit for pnpm workspaces specifically — see Differentiators for why over Dependabot |
| WR-01: `registry.json` array-shape validation before use | Listed explicitly in PROJECT.md scope; unrelated to TS6 but bundled into this milestone as the last open robustness item | LOW | Not a TS6/toolchain concept — straightforward runtime guard (`Array.isArray(data)`) with `dx:error` emission per existing error-visibility convention |

### Differentiators (Worth Doing Well, Not Just "Checked Off")

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Native/`oxc`-backed `.d.ts` emit path once `isolatedDeclarations` is adopted | The entire *point* of `isolatedDeclarations` per its design doc is enabling non-tsc, parallelizable `.d.ts` generation (3×–15×, some reports up to ~85× on large repos) — DxKit is small (~2,986 LOC) so wall-clock gain is modest, but the milestone is explicitly framed as "de-risk the TS7 jump," and TS7 (Go-native `tsgo`) is exactly this same isolated/parallel-emit model | LOW–MEDIUM | **Caveat:** `tsup`'s built-in `dts: true` still drives its `.d.ts` bundling through `rollup-plugin-dts`/the TS compiler API, not `oxc-transform` — enabling `isolatedDeclarations` in `tsconfig.json` does **not** automatically make `tsup` faster. The speed payoff requires either (a) switching the dts step to a tool that explicitly detects and uses `isolatedDeclarations` (e.g. `tsdown`/`rolldown-plugin-dts`, which use `oxc-transform` when the flag is set), or (b) treating the flag purely as a *type-safety/forward-compat* gate now and revisiting the build-speed win as a follow-on. Given the "stay on tsup" implication of PROJECT.md's constraints (no bundler-assumption changes, zero-dep posture), recommend scoping this milestone to (b) — adopt the flag for its enforcement value, explicitly defer any tsup→tsdown swap to a future milestone |
| `verbatimModuleSyntax` + `erasableSyntaxOnly` combo | `erasableSyntaxOnly` (TS 5.8+) additionally forbids `enum`, `namespace`, and parameter-property constructor sugar — the two flags together are Microsoft's own documented recommendation for "code guaranteed to run under Node's native type-stripping" (`node --experimental-strip-types`), which is the direct precursor to what TS7's erasable-syntax model assumes | LOW (audit only) | DxKit's CLAUDE.md conventions already forbid enums/namespaces implicitly (interfaces + union types are the documented pattern) and the codebase uses factory functions, not classes with parameter properties — this is very likely a zero-diff audit. Worth adding `erasableSyntaxOnly: true` alongside the two PROJECT.md-scoped flags since the cost is near-zero and the forward-compat signal is strong (explicitly recommended pairing in TS 5.8 docs) |
| Renovate config tuned for a lockstep-versioned plugin monorepo | PROJECT.md notes core + all 4 plugins release at the same version via `.versionrc.json` — generic Renovate defaults would open per-package PRs that don't respect that invariant | MEDIUM | Configure Renovate to (a) group all devDependency bumps into one PR per "family" (e.g. all `@biomejs/*`, all `vite*`/`vitest*`, all `tsup`/build-tool bumps) on a weekly/monthly schedule, (b) automerge patch/minor devDependency bumps once CI (tests + lint + the new deprecation gate) is green, (c) require manual review for majors — this is the actual differentiator over "just turn Dependabot on" |
| CI deprecation gate extended beyond `tsc` to catch *internal* `@deprecated` JSDoc usage | `tsc`'s built-in deprecation errors only cover **compiler-option** deprecations (e.g. `moduleResolution: node`), not usage of your own `@deprecated`-tagged exports — that's an editor-only strikethrough today, with no CLI enforcement | MEDIUM–HIGH | Biome (v2.5.1, this project's linter) has **no equivalent to `@typescript-eslint/no-deprecated`** — confirmed via an open Biome feature-request discussion; ESLint's plugin exists but adding ESLint back in conflicts with the project's "Biome replaces ESLint/Prettier" stance. If DxKit doesn't currently tag any internal exports `@deprecated`, this differentiator may be moot for v1.1 — flag as a gap rather than building speculative tooling for it (see Anti-Features) |

### Anti-Features (Commonly Reached For, Wrong Fit Here)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Swapping `tsup` → `tsdown`/`rolldown` to "unlock" `isolatedDeclarations` speed this milestone | Search results consistently frame `isolatedDeclarations` + `oxc`/`tsdown` as a package deal with dramatic build-time wins | PROJECT.md constraints are explicit: stay on the established stack this milestone, don't introduce bundler assumptions, keep the milestone "a focused modernization pass." `tsdown` is still a fast-moving, comparatively young tool (relative to `tsup`) — swapping the build tool *and* migrating TS6 *and* adding two new strict flags in one milestone stacks three independent risk surfaces | Adopt `isolatedDeclarations` now for its *type-safety/enforcement* value (forces explicit annotations, is a TS7 prerequisite regardless of bundler). Defer any tsup→tsdown evaluation to the "TS 7.1 migration" next-milestone candidate already listed in PROJECT.md, where the build-speed payoff can be measured together with the native compiler |
| Re-introducing ESLint (even scoped to just `@typescript-eslint/no-deprecated`) to plug Biome's deprecation-rule gap | The gap is real and the ESLint rule is the closest existing solution | Reintroducing a second linter fragments tooling (`.claude/CLAUDE.md` explicitly documents Biome as *replacing* ESLint/Prettier), adds a devDependency surface for a rule that may currently have zero applicable call sites in a ~2,986 LOC framework with no internal `@deprecated` tags yet | Track this as an explicit gap in the deprecation-gate scope (tsc-option deprecations only, not JSDoc `@deprecated` usage) rather than solving it with new tooling; revisit only if/when the codebase actually starts accumulating `@deprecated`-tagged internal APIs |
| Dependabot for this specific repo | It's the "default" GitHub-native option, zero setup | Dependabot has no native pnpm-workspace grouping (one PR per package.json location is its default), so a 5-`package.json` monorepo (root + 4 plugins) with mostly-identical devDependency sets would produce 5× redundant PRs for the same version bump — exactly the noise problem Renovate's workspace-awareness solves | Use Renovate; its native pnpm-workspace + Lerna/Nx-style monorepo detection was built for this exact topology |
| Auto-merging *all* dependency updates including majors | "Freshness automation" sounds like it should mean "always current" | Major devDependency bumps (e.g. a hypothetical tsup 9, Biome 3, vitest 5) routinely carry breaking config/API changes; auto-merging them risks silently breaking `make build`/`make test` on a schedule with no human in the loop, directly contradicting the "trustworthy" Core Value from PROJECT.md | Automerge patch/minor only, gated on green CI (including the new deprecation gate); require manual review + a changelog read for majors |
| Treating `ignoreDeprecations: "6.0"` as a valid *interim* migration step to "get to green faster" | It's the sanctioned TS escape hatch and looks like a reasonable staging tool | It is explicitly documented as **temporary and removed entirely in TS7** — using it as a milestone deliverable means the milestone's own stated purpose ("de-risk the TS7 jump") is unmet; it just relocates the debt one version later, which is precisely the debt this milestone exists to close | Fix every deprecated option/syntax directly; use `ignoreDeprecations` only transiently, file-by-file, during active migration work, and confirm it's absent from every `tsconfig.json` before calling the migration phase done |

## Feature Dependencies

```
TS6 compiler upgrade (tsc 5.8 → 6.0, tsconfig audit, ignoreDeprecations removed)
    └──prerequisite for──> isolatedDeclarations adoption
                                (isolatedDeclarations is a TS5.5+ flag, but its
                                 diagnostics are re-verified/tightened per compiler
                                 version — do the TS6 bump first so annotation
                                 fixes are made once, against the final compiler)
    └──prerequisite for──> verbatimModuleSyntax adoption
                                (same reasoning — avoid fixing import/export
                                 syntax twice across two compiler upgrades)

verbatimModuleSyntax adoption
    └──should land before/alongside──> isolatedDeclarations adoption
        (PROJECT.md's own ordering hint). Rationale: isolatedDeclarations'
        type-only-export inference interacts with how import/export
        elision works — landing verbatimModuleSyntax first means every
        `import type`/`export type` boundary is already explicit before
        isolatedDeclarations starts requiring annotations on top of it,
        avoiding compounding fixes in one PR.

verbatimModuleSyntax adoption
    └──requires build-format check──> tsup CJS/IIFE output validation
        (verbatimModuleSyntax refuses to let TS auto-rewrite `import`/`export`
         to `require`/`module.exports`; DxKit's ESM/CJS dual output is
         emitted by tsup's esbuild-based transform, NOT tsc's emitter, so
         this constraint applies to *tsc's own emit* — since DxKit only uses
         tsc for type-checking/`.d.ts` and tsup/esbuild for JS emit, this is
         low-risk, but must be explicitly verified, not assumed)

CI deprecation gate (tsc --noEmit in CI)
    └──depends on──> TS6 compiler upgrade being complete
        (gate is meaningless — and would immediately fail — if run before
         the migration itself is done; sequence as: migrate → then gate)

isolatedDeclarations adoption ──enables (future milestone)──> faster/parallel .d.ts emit
    (the speed payoff needs a dts tool that specifically recognizes the flag
     — tsup as configured today does not benefit automatically; see Anti-Features)

Dependency-freshness automation (Renovate) ──independent of──> all TS-flag work
    (no code dependency; can land in parallel or first — but its CI checks
     should run against the *post-migration* pipeline including the new
     deprecation gate, so sequencing it last avoids reconfiguring automerge
     gates twice)

WR-01 (registry.json array validation) ──independent of──> all TS6/toolchain items
    (pure runtime robustness fix, no compiler-flag relationship)
```

### Dependency Notes

- **TS6 upgrade is the root prerequisite** for both new strict flags: fixing annotation/import-syntax gaps against TS 5.8 and then re-fixing against TS 6.0 is wasted work if the flags are adopted before the compiler bump.
- **`verbatimModuleSyntax` before/with `isolatedDeclarations`:** this is the ordering PROJECT.md itself calls out as a risk to watch (downstream-consumer note). The concrete reason: `isolatedDeclarations` diagnostics get *cleaner* once type-only import/export boundaries are already unambiguous — doing them together in a single pass, `verbatimModuleSyntax` first, keeps the fix set additive rather than requiring re-touching the same import lines twice.
- **CI deprecation gate depends on migration completion**, not the reverse — it's a regression-prevention mechanism, not a discovery mechanism (though running `tsc --noEmit` early, before it's wired into CI as a hard gate, is exactly how you *discover* the deprecations to fix during migration).
- **Renovate is decoupled** from the TS-flag work entirely; sequence it last only so its automerge gate can be configured against the final CI pipeline (tests + lint + deprecation gate) in one pass instead of two.
- **`isolatedDeclarations` → parallel `.d.ts` emit is an *enables*, not an automatic result** — flagged explicitly because this is the most likely place a downstream requirements doc could overstate what "adopting isolatedDeclarations" delivers this milestone if the tsup-vs-tsdown nuance isn't carried forward.

## MVP Definition

### Launch With (v1.1, as scoped in PROJECT.md)

- [ ] TS6 compiler upgrade across core + 4 plugins, zero `ignoreDeprecations` remaining — the milestone's core claim
- [ ] `verbatimModuleSyntax: true` in every package's `tsconfig.json`, landed first/together with isolatedDeclarations
- [ ] `isolatedDeclarations: true` in every package's `tsconfig.json` — adopted for its type-safety/TS7-prerequisite value; explicitly NOT paired with a tsup→tsdown swap this milestone
- [ ] CI step running `tsc --noEmit` (or `-b`) per package, wired as a required check — the actual "deprecation gate," since there is no standalone flag for it
- [ ] Renovate configured for the pnpm workspace: grouped PRs by tool family, scheduled cadence, automerge patch/minor on green CI, manual review for majors
- [ ] WR-01 — `registry.json` array-shape guard with `dx:error` on wrong shape

### Add After Validation (v1.x, once TS6 flags are proven stable)

- [ ] Evaluate `erasableSyntaxOnly: true` as a low-cost addition once `verbatimModuleSyntax`/`isolatedDeclarations` are settled (near-zero expected diff given existing no-enum/no-namespace conventions, but sequencing it after the two PROJECT.md-scoped flags avoids conflating three new flags' worth of CI failures in one PR)
- [ ] Re-evaluate whether Biome has since added a `no-deprecated`-equivalent rule (tracked via the open Biome discussion) before deciding whether the deprecation gate needs to cover internal `@deprecated` JSDoc usage

### Future Consideration (v2+ / TS7 milestone)

- [ ] tsup → `tsdown`/`rolldown-plugin-dts` evaluation, to actually cash in the parallel/`oxc`-backed `.d.ts` emit speed `isolatedDeclarations` enables — deferred because it's a build-tool change, not a compiler-flag change, and PROJECT.md scopes this milestone to avoid bundler-assumption churn
- [ ] TypeScript 7.1 migration itself — explicitly named in PROJECT.md as waiting on a stable ABI/API point release

## Feature Prioritization Matrix

| Feature | User Value (maintainer/consumer trust) | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| TS6 upgrade, `ignoreDeprecations` removed | HIGH | LOW–MEDIUM | P1 |
| `verbatimModuleSyntax` adoption | HIGH (forward-compat) | LOW (existing conventions) | P1 |
| `isolatedDeclarations` adoption | HIGH (forward-compat) | LOW–MEDIUM (existing conventions, but default-param/object-literal audit needed) | P1 |
| CI deprecation gate (`tsc --noEmit` required check) | HIGH (prevents regression) | LOW | P1 |
| Renovate setup (grouped, scheduled, gated automerge) | MEDIUM–HIGH (ongoing maintenance burden reduction) | MEDIUM | P1 |
| WR-01 registry.json validation | MEDIUM (closes a known crash path) | LOW | P1 |
| `erasableSyntaxOnly` addition | MEDIUM (extra forward-compat signal) | LOW | P2 |
| Internal `@deprecated`-usage lint coverage | LOW today (no known call sites) | MEDIUM–HIGH (needs ESLint reintroduction or custom tooling) | P3 |
| tsup → tsdown swap for real dts speed gains | MEDIUM (nice-to-have build speed) | HIGH (new build tool, re-validate IIFE/global output) | P3 (next milestone) |

**Priority key:**
- P1: Must have — directly named in PROJECT.md's Active requirements
- P2: Should have, low-cost forward-compat addition worth folding in if time allows
- P3: Defer — explicitly out of this milestone's focused scope per PROJECT.md constraints

## Sources

- [TypeScript: TSConfig Option: isolatedDeclarations](https://www.typescriptlang.org/tsconfig/isolatedDeclarations.html) — HIGH confidence, official docs
- [TypeScript 5.5 Release Notes — Isolated Declarations](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html) — HIGH confidence, official docs, exact annotation requirements/exemptions
- [TypeScript: TSConfig Option: verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html) — HIGH confidence, official docs
- [TypeScript: TSConfig Option: erasableSyntaxOnly](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html) — HIGH confidence, official docs
- [TypeScript 5.8 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html) — HIGH confidence, official docs (erasableSyntaxOnly origin, Node type-stripping alignment)
- [TypeScript: Documentation - TypeScript 6.0](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) / [Announcing TypeScript 6.0 (devblogs.microsoft.com)](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) — HIGH confidence, official; confirms TS6.0 is the final JS-based release, deprecation list, `ignoreDeprecations: "6.0"` mechanics, `strict`-by-default
- [TypeScript 6.0 Released: Every Breaking Change (jsmanifest)](https://jsmanifest.com/typescript-6-breaking-changes) — MEDIUM confidence, secondary summary, cross-checked against official release notes
- [microsoft/TypeScript#62916 — ignoreDeprecations 6.0 discussion](https://github.com/microsoft/TypeScript/issues/62916) — MEDIUM confidence, maintainer/community thread, confirms exit-code-2 behavior on unresolved deprecations
- [Biome Linter docs — error-on-warnings](https://biomejs.dev/linter/) — HIGH confidence, official Biome docs, confirms `--error-on-warnings` CI-gate mechanism
- [biomejs/biome Discussion #7514 — no-deprecated rule gap](https://github.com/biomejs/biome/discussions/7514) — MEDIUM confidence, open community discussion, confirms Biome has no `@typescript-eslint/no-deprecated` equivalent for JS/TS as of this research date
- [tsdown Declaration Files (dts) docs](https://tsdown.dev/options/dts) — MEDIUM confidence, official docs of an adjacent tool, used to establish that `isolatedDeclarations`-aware fast dts emission is a tool-specific opt-in (oxc-transform), not automatic under tsup
- [Rollup dts file using TSUP (dev.to/egoist, tsup maintainer)](https://dev.to/egoist/rollup-dts-file-using-tsup-2579) — MEDIUM confidence, written by tsup's author, establishes tsup's dts pipeline is rollup-plugin-dts/tsc-based
- [Renovate Docs — Noise Reduction](https://docs.renovatebot.com/noise-reduction/) — HIGH confidence, official Renovate docs, grouping/scheduling mechanisms
- [Renovate vs Dependabot 2026 comparisons — DevOpsBoys, dev.to, tomodahinata.com] — MEDIUM confidence, multiple independent 2026 community sources converging on the same pnpm-workspace-support conclusion (cross-checked across 3+ independent sources → treated as reliable for the monorepo-fit claim specifically)
- Direct repository inspection (`tsconfig.json`, `tsup.config.ts`, `package.json`, `src/events.ts`, `src/registry.ts`, `src/index.ts`) — HIGH confidence, primary source, used to ground complexity ratings in DxKit's actual existing conventions rather than generic library assumptions

---
*Feature research for: TypeScript 6 migration + forward-compat guardrails (isolatedDeclarations, verbatimModuleSyntax, CI deprecation gate, dependency-freshness automation) on DxKit, a zero-runtime-dep TS library monorepo*
*Researched: 2026-07-15*

# DxKit

## What This Is

DxKit is a headless microframework for building composable dapps — routing, lifecycle
management, a typed event bus, and a plugin registry, with zero DOM ownership. It ships a
core package (`@dnzn/dxkit`) plus four optional plugins (wallet, auth, theme, settings),
and targets static/IPFS deployment via IIFE builds alongside ESM/CJS for bundlers. It is
for developers assembling small, decoupled dapps (mounted one at a time into `#dx-mount`)
that talk to the shell only through `window.__DXKIT__`.

The v1.0 "Beta Hardening" milestone shipped as 0.2.0: previously silent failures are now
visible via `dx:error`, the shell can't hang or leak state across disabled dapps, an optional
template sanitizer and configurable storage keys close the two concrete security risks, a stress
suite proves last-navigation-wins, and every doc is verified against the final code. Still
alpha-track by version, but meaningfully more robust and fully documentation-truthful.

The v1.1 "TypeScript 6 Migration & Toolchain Modernization" milestone shipped as 0.3.0: a
runtime-invisible modernization pass — Node 22 LTS floor (breaking for contributors, not
consumers), TypeScript 6 with a standalone `tsc --noEmit` gate and zero deprecation shims, TS7
forward-compat flags on, a build-artifact smoke test, a machine-enforced zero-runtime-dep gate,
Renovate, and fail-closed manifest-shape guards across all three `loadManifests()` tiers.

## Core Value

DxKit stays trustworthy for real use: failures are visible (never silent), the documented
behavior matches the actual behavior, and the alpha is stable enough to build on with
confidence.

## Current Milestone

_(none — v1.1 shipped 2026-08-16 as 0.3.0; next milestone to be defined via `/gsd-new-milestone`. See **Next Milestone Goals** below.)_

<details>
<summary>Shipped: v1.1 TypeScript 6 Migration & Toolchain Modernization (0.3.0)</summary>

**Goal:** Migrate core + all plugins to TypeScript 6, audit and modernize the full toolchain,
and put continuous forward-compat guardrails in place so the eventual jump to TS 7.1 is clean.

**Target features:**
- **TS6 migration** — core + 4 plugins onto TypeScript 6, resolving every deprecation TS6 surfaces.
- **Toolchain audit & modernization** — bump tsup / vite / vitest / Biome / commit tooling to current;
  raise the Node floor from EOL Node 18 to **Node 22 LTS** (research found Node 20 is also EOL);
  swap the ~6-years-unmaintained `cz-conventional-changelog` for the maintained `cz-git`.
- **Forward-compat typing** — adopt `isolatedDeclarations`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`
  across all packages.
- **Continuous debt guardrails** — CI deprecation gate (fail on `tsc`/lint deprecation warnings) plus
  dependency-freshness automation (Renovate/Dependabot-style).
- **WR-01 robustness fix** — validate `registry.json` is an array so a wrong-shape `200` can't throw an
  uncaught `TypeError` in `init()` before `window.__DXKIT__` is exposed (closes the last open Phase-1 todo).

**Why now:** TS6 is the transitional/deprecation-alignment release before the native compiler (TS7). This
milestone treats it as a stepping stone — every measure is chosen to de-risk the TS 7.1 jump later (waiting
on a TS7 point release for stable ABI/API). Storage encryption and new routing features are deferred again
to keep this a focused modernization pass.

</details>

## Requirements

### Validated

<!-- Inferred from the existing codebase (v0.1.5) via .planning/codebase/. These ship today. -->

- ✓ Path routing with longest-prefix matching, history + hash modes — existing
- ✓ Dapp lifecycle: mount/unmount, ordered asset loading (styles → template → deps → entry) — existing
- ✓ Typed event bus (emit/on/once/off, pause/resume) over CustomEvent — existing
- ✓ Event registry with namespace validation (`dx:*` reserved) — existing
- ✓ Plugin registry with init/destroy lifecycle and duck-typed interop — existing
- ✓ Declarative dapp manifests (registry.json / entries / inline) — existing
- ✓ Frozen public context API on `window.__DXKIT__` — existing
- ✓ Wallet plugin (EIP-1193 provider coordination) — existing
- ✓ Auth plugin (passthrough / wallet-bridged) — existing
- ✓ Theme plugin (light/dark/system, persisted) — existing
- ✓ Settings plugin (per-dapp key/value persistence) — existing
- ✓ Triple build output per package (ESM / CJS / IIFE) via tsup — existing
- ✓ Test suite on vitest + happy-dom — existing

<!-- Validated in Phase 1: Diagnostics — Surface Silent Failures (0.2.0) -->
- ✓ Emit `dx:error` (source `shell:mount`) when `#dx-mount` container can't be resolved — validated Phase 1
- ✓ Emit `dx:error` on `localStorage` read/write failures (wallet, theme, settings) — validated Phase 1
- ✓ Emit `dx:error` and clear the mount container on post-injection (entry/dependency) load failure — validated Phase 1

<!-- Validated in Phase 2: Robustness — Load Guards, Caching & Handler Cleanup (0.2.0) -->
- ✓ Optional per-fetch load timeout with true abort (script/style/template; 30s default, `timeout: 0`/`Infinity` opt-out) — validated Phase 2
- ✓ Router length-sort hoisted to construction; `resolve()` reuses the cached sort — validated Phase 2
- ✓ Template caching by URL with `clearTemplateCache()` / `invalidateTemplate(url)` — validated Phase 2
- ✓ Settings handlers registered via `onChange()`/`onAnyChange()` pruned when a dapp is disabled — validated Phase 2

<!-- Validated in Phase 3: Security — Sanitization & Storage Isolation (0.2.0) -->
- ✓ Optional fail-closed `sanitizeTemplate` hook on the lifecycle manager, run on fetched template HTML before `innerHTML` injection (unchanged behavior when unconfigured) — validated Phase 3
- ✓ Configurable wallet `storageKey` so multiple DxKit apps on one origin persist wallet selection independently — validated Phase 3
- ✓ Wallet connect throws on empty accounts (no `undefined` address) and auto-reconnect failures surface via `dx:error` — validated Phase 3
- ✓ `ShellConfig.lifecycle` nested options group replaces flat loader passthrough (breaking, D-04/D-05); sanitizer/timeout/cacheTemplates now reachable from `createShell()` — validated Phase 3

<!-- Validated in Phase 4: Testing — Stress, Edge-Case & Regression Coverage (0.2.0) -->
- ✓ Stress suite (`tests/stress.test.ts`, 9 scenarios) drives rapid A→B→A navigation with slow loaders; shell honors last-navigation-wins (no double-mount, no lost-unmount, no stale-mount commit) via mount-generation guard + call-scoped pending-mount dedupe token — validated Phase 4
- ✓ Manifest/route validation edge-case tests: invalid route formats rejected with `dx:error`, multi-match/duplicate routes resolved deterministically, deep-merge override semantics locked — validated Phase 4
- ✓ Full-shell regression proves settings handlers registered by a dapp stop firing after `disableDapp()` — validated Phase 4

<!-- Validated in Phase 6: Toolchain Audit & Modernization (v1.1) -->
- ✓ Build/test/lint tooling bumped to current TS6-compatible versions (tsup ^8.5, vite ^8.1, vitest ^4.1, happy-dom ^20.10, Biome ^2.5), `make test` green (321 specs) — validated Phase 6 (TOOL-03)
- ✓ Node floor raised to 22 LTS via `engines.node: "^22.12.0 || >=24.0.0"` (tightened to match pinned vite/vitest ranges) + `.npmrc` engine-strict + CI matrix `['22.12.0', 24]`; negative install on Node 20 confirmed to fail-fast (UAT) — validated Phase 6 (TOOL-01, TOOL-02)
- ✓ Commitizen adapter swapped to maintained `cz-git` (`cz-conventional-changelog` removed); interactive flow confirmed to emit conventional commits (UAT) — validated Phase 6 (TOOL-04)
- ✓ All three build outputs (ESM/CJS/IIFE) confirmed present per package post-bump; `verify-outputs` wired into release/publish/CI so a dropped output fails automatically — validated Phase 6 (TOOL-05)

<!-- Validated in Phase 7: TypeScript 6 Migration & Standalone Typecheck (v1.1) -->
- ✓ Standalone per-package `tsc --noEmit` typecheck (`tsconfig.typecheck.json` ×5 + `make typecheck`, independent of tsup's dts emit), wired into `make test`/CI as a green baseline before the bump — validated Phase 7 (TS6-03)
- ✓ Core + all 4 plugins compile clean under TypeScript 6.0.3; dts emission switched from tsup's `dts:true` to `tsc --emitDeclarationOnly` to avoid TS6's `TS5101` baseUrl deprecation — validated Phase 7 (TS6-01)
- ✓ No `ignoreDeprecations` shim in any tsconfig; every TS6 deprecation resolved at source; full vitest suite (321) green under TS6 — validated Phase 7 (TS6-02)

<!-- Validated in Phase 8: Forward-Compat Typing (v1.1) -->
- ✓ `verbatimModuleSyntax`, `isolatedDeclarations`, and `erasableSyntaxOnly` all enabled in the root base `tsconfig.json`, inherited by all 4 plugin tsconfigs via `extends`; enabled with zero at-source churn (no `src/` or `plugins/*/src/` changes), `.d.ts` emit succeeds for every package, and a durable flag-presence guard test fails the suite on silent flag removal — validated Phase 8 (FCT-01, FCT-02, FCT-03)
- ✓ `make smoke` build-artifact gate: builds, then runs a separate vitest config against real `dist/` artifacts asserting each IIFE global attaches to a happy-dom Window with its full expected export-key set and CJS `require()` interop returns the same set (all 5 packages); wired into release/publish/CI after `verify-outputs`, never into `make test` — validated Phase 8 (FCT-04)

<!-- Validated in Phase 9: Continuous Debt Guardrails & Registry Robustness (v1.1) -->
- ✓ Named, distinct, blocking CI `Typecheck / deprecation gate (GATE-01)` step running `make typecheck` (scoped to `src`/`tests` via `tsconfig.typecheck.json`), separated from `make test` so a `tsc` deprecation/type error fails its own dedicated GitHub Check — validated Phase 9 (GATE-01)
- ✓ Machine-enforced zero-runtime-dependency posture for the core `@dnzn/dxkit` package: `scripts/check-no-runtime-deps.cjs` (zero-dep, `node:fs` only) + `make verify-no-runtime-deps` + named CI step + release/publish prerequisites; guard test locks the wiring — validated Phase 9 (GATE-02)
- ✓ Renovate automation for the pnpm workspace via committed `renovate.json` — `config:recommended`, `minimumReleaseAge: "3 days"`, toolchain group always blocking major automerge, weekly `lockFileMaintenance`; invariant guard test — validated Phase 9 (GATE-03)
- ✓ WR-01/ROB-05 — `loadManifests()` `Array.isArray()`-guards the `registry.json` 200 body, fail-closing to `[]` with an ungated `dx:error` instead of an uncaught `TypeError` before `window.__DXKIT__` is exposed — validated Phase 9 (ROB-05)

<!-- Validated in Phase 10: Close gap CR-01 — guard dapps/inline manifests tiers (v1.1) -->
- ✓ CR-01/ROB-06 — a shared closure-local `coerceManifestArray()` helper extends ROB-05's array-shape guard to the `dapps` and inline `manifests` tiers of `loadManifests()`; all three tiers fail closed on a wrong-shape value (`coerced === null` → `[]`) with a single coherent `dx:error` (source `shell:manifest`) instead of an uncaught `TypeError`, while preserving each tier's asymmetric empty-array fallthrough — validated Phase 10 (ROB-06)

### Active

<!-- v1.1 shipped (0.3.0). CR-01 follow-up closed by Phase 10 (ROB-06). The next milestone
     (on-chain / ERC-8244 deployment — see Next Milestone Goals) will populate this section. -->

_(none — v1.1 milestone shipped; next milestone not yet defined)_

### Out of Scope

<!-- Deferred, not dropped — each is a candidate for a later milestone. -->

- TypeScript 7.x migration — the payoff of v1.1's forward-compat groundwork; waiting on a stable TS 7.1 point release (ABI/API)
- tsup → tsdown swap — needs Node ≥22.18; deferred until the TS7 jump makes the build-tool churn worth it
- New routing features (wildcard / regex / `:param` routes) — a feature, not hardening
- Storage encryption for persisted settings/wallet state — larger design effort; defer
- Built-in cross-dapp state sharing — conflicts with the headless, event-only design; reject/defer

## Context

- **Brownfield.** Full codebase map exists at `.planning/codebase/` (ARCHITECTURE, CONCERNS,
  STACK, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS). CONCERNS.md is the primary source
  of hardening candidates and was used to scope this milestone.
- **Field-tested stability.** The maintainer runs DxKit in their own projects and has needed
  only one fix so far (commit 419a0c7, hash-mode double-mount) — the alpha is already fairly
  stable, which is why the goal is hardening rather than reshaping.
- **Zero runtime dependencies.** All tooling is devDependencies; the framework exports only
  types and factory functions.
- **Plugin lockstep versioning.** Core + all plugins release at the same version (enforced by
  `.versionrc.json`) — a 0.2.0 bump moves everything together.
- **Shipped state (v1.0 / 0.2.0).** ~2,986 LOC TypeScript source (core + 4 plugins), ~5,932 LOC
  tests across 321 passing vitest specs. 15/15 milestone requirements validated across 5 phases
  (DIAG, ROB, SEC, TEST, DOC). Three breaking changes shipped with migration notes (nested
  `ShellConfig.lifecycle`, load-timeout defaults, sanitizer hook).
- **Shipped state (v1.1 / 0.3.0).** ~2,957 LOC TypeScript source, ~6,790 LOC tests across 413 passing
  vitest specs + an 11-spec `make smoke` artifact suite. TypeScript 6.0.x, Node `^22.12.0 || >=24.0.0`
  (engine-strict), vite 8 / vitest 4.1 / tsup 8.5 / Biome 2.5, `verbatimModuleSyntax` +
  `isolatedDeclarations` + `erasableSyntaxOnly` on. Zero runtime deps now machine-enforced for core
  (`make verify-no-runtime-deps`). 16/16 milestone requirements + CR-01 gap closure validated. One
  breaking change (Node floor) — contributor-facing only; the runtime API surface is unchanged from 0.2.1.
- **Deployment reality check (Aug 2026).** Built IIFEs are small: core ≈7.0 KB gzipped, plugins 1.1–2.6 KB
  each (~15 KB total) — comfortably under the 24,576-byte EIP-170 contract-code limit, which makes
  fully on-chain hosting (ERC-8244 `html()`) a realistic next target rather than a stretch.

## Next Milestone Goals

Candidate scope for the milestone after v1.1 (not yet committed — to be defined via `/gsd-new-milestone`):

- **On-chain / ERC-8244 deployment (leading candidate).** Make DxKit dapps loadable from contract
  `html()` (ERC-8244) as first-class alongside IPFS/static, and publish DxKit core + plugins themselves
  as versioned, immutable on-chain artifacts that a dapp's `html()` chain-loads — the target being
  ENS-addressed dapps in browsers like Freedom that resolve `name.eth` → `html()`.
  - *Resolver layer* (near-zero core change): a `web3://`-style (ERC-6860) URL resolver providing
    `templateLoader`/`scriptLoader`/`styleLoader` that `eth_call` the target, ABI-decode `string`,
    optionally gunzip (native `DecompressionStream`), and verify a keccak pin — DxKit's loaders are
    already opaque `(src: string) => Promise` seams, so manifests keep their schema and just carry
    `web3://` strings in `entry`/`template`/`styles`.
  - *Sandbox hardening in core* (small, additive): inline `<style>` instead of `<link href>`, script
    text injection via `blob:`/`textContent`, full-document `html()` → fragment extraction with
    inline-`<script>` re-execution, `entry` optional when `template` is on-chain, hash-mode default
    under `srcdoc`/opaque origins, storage-unavailable degradation for settings.
  - *Publish tooling*: gzip + chunk (≤24 KB) + SSTORE2-style data contracts + a versioned facade
    contract per package exposing `html()`/`source()`; foundry deploy scripts (dev-only — zero
    runtime deps preserved); a ~1 KB bootstrap snippet dapp authors paste into their own `html()`.
  - *Hard external dependencies to verify first*: ERC-8244 forbids any network URL fetch (only
    `data:`/`blob:`), so chain-loading is `eth_call` via `window.ethereum` — Freedom's current
    read-only preview may not inject a provider; a spike must confirm before tooling investment.
- **TypeScript 7.1 migration** — waiting on a stable TS7 point release; the forward-compat flags are already on.
- **Storage encryption** for persisted settings/wallet state — larger design effort, deferred twice.
- Possible new routing features (wildcard / `:param`) if consumer demand appears.

## Constraints

- **Tech stack**: TypeScript 6.0.x, Node `^22.12.0 || >=24.0.0` (engine-strict) / ES2022, pnpm 10.32.1, tsup 8.5, vite 8, vitest 4.1 + happy-dom, Biome 2.5 — established as of v1.1; TS7/tsdown deferred until a stable TS 7.1.
- **Compatibility**: Breaking changes are acceptable (still alpha) *only where they clearly
  improve the API*; each must carry a `BREAKING CHANGE:` footer and migration notes. Prefer
  additive (new events / optional config) wherever it's equivalent.
- **Zero runtime deps**: Hardening must not introduce runtime dependencies — the zero-dep
  posture is a selling point.
- **Deployment**: IIFE / static / IPFS remains a first-class target; changes must not assume a bundler.
  On-chain (ERC-8244) hosting is the candidate next target — it additionally forbids any network URL
  fetch at runtime, so new loader work must not assume `fetch()`/`<script src>` reachability.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scope milestone as "harden toward beta", ship as 0.2.0 | Alpha is field-stable; increase robustness + doc trust without a feature push | ✓ Good — shipped v1.0, 5 phases, 15/15 reqs, 321 tests green |
| Target all four hardening tracks (silent failures, robustness, tests, security) | Concerns audit shows they're interrelated; a partial pass leaves obvious gaps | ✓ Good — all four tracks landed and verified |
| Docs pass = verify-against-code + slop cleanup + gap-fill | "Code is truth"; drift and AI slop erode trust as much as bugs | ✓ Good — every doc snippet compile-checked; drift log is DOC-01 proof |
| Breaking changes allowed but justified + migration-documented | Still alpha, but consumers exist; churn must earn its keep | ✓ Good — nested `ShellConfig.lifecycle` (D-04/05) shipped with migration section |
| `ShellConfig.lifecycle` nested group replaces flat loader passthrough | Only way to reach the sanitizer/timeout/cache config from `createShell()` | ✓ Good — runtime throw guards untyped consumers |
| Defer TS6, new routing, encryption, cross-dapp state | Each is a feature/large effort orthogonal to hardening; keep the milestone focused | ✓ Good — kept the milestone focused; carried to next-milestone candidates |
| Tighten Node floor to `^22.12.0 \|\| >=24.0.0` (not literal `>=22`) | Gap closure found `>=22` admitted Node 22.0–22.11/23.x that the pinned vite/vitest engines reject under engine-strict — the declared floor must equal the *enforceable* floor | ✓ Good (Phase 6) — declared floor now internally consistent; shipped as BREAKING CHANGE; docs aligned in the Phase 6 docs pass; released in 0.3.0 |
| Land the standalone `tsc --noEmit` step *before* the TS6 bump (TS6-03 → TS6-01) | Type checking only existed as a side effect of tsup's dts emit; a deprecation gate needs a real baseline to attach to | ✓ Good (Phase 7) — the bump surfaced a real tsup dts-bundler break that the standalone gate isolated; zero `ignoreDeprecations` shims |
| Switch dts emission from tsup `dts:true` to `tsc --emitDeclarationOnly` | tsup's bundler tripped TS6's `TS5101` baseUrl deprecation; fixing at source rather than shimming | ✓ Good (Phase 7) — clean under TS6, and positions the build for tsdown later |
| Turn on all three TS7 forward-compat flags as a pure config flip | Research predicted zero source churn; a flag-presence guard test prevents silent regression | ✓ Good (Phase 8) — zero `src/` changes across 5 packages |
| Artifact smoke test via `node:vm`, not happy-dom `<script>` | happy-dom's script-element path is broken for IIFE global-attach; the point is to exercise the real `dist/` outputs | ✓ Good (Phase 8) — 11-spec `make smoke` gate wired into release/publish/CI |
| Zero-runtime-dep gate scoped to core only | Plugins depend on `@dnzn/dxkit` types (workspace); the selling point is the core package | ✓ Good (Phase 9) — GATE-02 enforces exactly the promise the README makes |
| Fail-closed array-shape guard at every `loadManifests()` tier via one helper | Untyped IIFE consumers get no compile-time protection; an uncaught `TypeError` before `window.__DXKIT__` is the worst silent failure | ✓ Good (Phase 9/10) — ROB-05 + ROB-06, single `dx:error` source `shell:manifest` |
| Release v1.1 as **0.3.0** (minor, not patch) | Node-floor bump is a `BREAKING CHANGE` for the dev toolchain even though the runtime API is unchanged from 0.2.1 | ✓ Good — tagged `v0.3.0` 2026-08-16 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-16 after v1.1 milestone (TypeScript 6 Migration & Toolchain Modernization) shipped as 0.3.0 — 5 phases (6–10), 17 plans, 16/16 requirements + CR-01 gap closure validated. Next milestone candidate: on-chain / ERC-8244 deployment (see Next Milestone Goals).*

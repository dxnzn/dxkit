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

## Core Value

DxKit stays trustworthy for real use: failures are visible (never silent), the documented
behavior matches the actual behavior, and the alpha is stable enough to build on with
confidence.

## Current Milestone: v1.1 TypeScript 6 Migration & Toolchain Modernization

**Goal:** Migrate core + all plugins to TypeScript 6, audit and modernize the full toolchain,
and put continuous forward-compat guardrails in place so the eventual jump to TS 7.1 is clean.

**Target features:**
- **TS6 migration** — core + 4 plugins onto TypeScript 6, resolving every deprecation TS6 surfaces.
- **Toolchain audit & modernization** — bump tsup / vite / vitest / Biome / commit tooling to current;
  raise the Node floor from EOL Node 18 to **Node 20**.
- **Forward-compat typing** — adopt `isolatedDeclarations` and `verbatimModuleSyntax` across all packages.
- **Continuous debt guardrails** — CI deprecation gate (fail on `tsc`/lint deprecation warnings) plus
  dependency-freshness automation (Renovate/Dependabot-style).
- **WR-01 robustness fix** — validate `registry.json` is an array so a wrong-shape `200` can't throw an
  uncaught `TypeError` in `init()` before `window.__DXKIT__` is exposed (closes the last open Phase-1 todo).

**Why now:** TS6 is the transitional/deprecation-alignment release before the native compiler (TS7). This
milestone treats it as a stepping stone — every measure is chosen to de-risk the TS 7.1 jump later (waiting
on a TS7 point release for stable ABI/API). Storage encryption and new routing features are deferred again
to keep this a focused modernization pass.

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

### Active

<!-- The v1.1 TS6 + toolchain modernization milestone. Hypotheses until shipped and validated.
     Detailed, REQ-ID'd scope lives in .planning/REQUIREMENTS.md. -->

**TS6 migration**
- [ ] Migrate core + 4 plugins to TypeScript 6; resolve every deprecation TS6 surfaces

**Toolchain audit & modernization**
- [ ] Bump build/test/lint/commit tooling (tsup, vite, vitest, Biome, commit tooling) to current
- [ ] Raise the Node floor from EOL Node 18 to Node 20 (`engines` + CI matrix)

**Forward-compat typing**
- [ ] Adopt `isolatedDeclarations` across all packages
- [ ] Adopt `verbatimModuleSyntax` across all packages

**Continuous debt guardrails**
- [ ] CI deprecation gate — fail the build on `tsc`/lint deprecation warnings
- [ ] Dependency-freshness automation (Renovate/Dependabot-style)

**Robustness carryover**
- [ ] WR-01 — validate `registry.json` is an array (no uncaught `TypeError` before `window.__DXKIT__`)

### Out of Scope

<!-- Deferred, not dropped — each is a candidate for a later milestone. -->

- TypeScript 6 migration — separate milestone; already tracked in docs/plans TODO, distinct from hardening
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
  tests across 321 passing vitest specs. Zero runtime dependencies maintained. 15/15 milestone
  requirements validated across 5 phases (DIAG, ROB, SEC, TEST, DOC). Three breaking changes
  shipped with migration notes (nested `ShellConfig.lifecycle`, load-timeout defaults, sanitizer hook).

## Next Milestone Goals

Candidate scope for the milestone *after* v1.1 (not yet committed):

- **TypeScript 7.1 migration** — the payoff of v1.1's forward-compat groundwork; waiting on a TS7 point
  release for stable ABI/API before committing.
- **Storage encryption** for persisted settings/wallet state (STOR-01 territory) — larger design effort;
  deferred again out of v1.1 to keep it a focused modernization pass.
- Possible new routing features (wildcard / `:param`) if consumer demand appears — a feature, not modernization.

*(TS6 migration and the WR-01 robustness fix moved into the committed v1.1 milestone above.)*

## Constraints

- **Tech stack**: TypeScript 5.8.3, Node 18+ / ES2022, pnpm 10.32.1, tsup, vitest + happy-dom, Biome — established; stay on TS 5.x this milestone (TS6 deferred).
- **Compatibility**: Breaking changes are acceptable (still alpha) *only where they clearly
  improve the API*; each must carry a `BREAKING CHANGE:` footer and migration notes. Prefer
  additive (new events / optional config) wherever it's equivalent.
- **Zero runtime deps**: Hardening must not introduce runtime dependencies — the zero-dep
  posture is a selling point.
- **Deployment**: IIFE / static / IPFS remains a first-class target; changes must not assume a bundler.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scope milestone as "harden toward beta", ship as 0.2.0 | Alpha is field-stable; increase robustness + doc trust without a feature push | ✓ Good — shipped v1.0, 5 phases, 15/15 reqs, 321 tests green |
| Target all four hardening tracks (silent failures, robustness, tests, security) | Concerns audit shows they're interrelated; a partial pass leaves obvious gaps | ✓ Good — all four tracks landed and verified |
| Docs pass = verify-against-code + slop cleanup + gap-fill | "Code is truth"; drift and AI slop erode trust as much as bugs | ✓ Good — every doc snippet compile-checked; drift log is DOC-01 proof |
| Breaking changes allowed but justified + migration-documented | Still alpha, but consumers exist; churn must earn its keep | ✓ Good — nested `ShellConfig.lifecycle` (D-04/05) shipped with migration section |
| `ShellConfig.lifecycle` nested group replaces flat loader passthrough | Only way to reach the sanitizer/timeout/cache config from `createShell()` | ✓ Good — runtime throw guards untyped consumers |
| Defer TS6, new routing, encryption, cross-dapp state | Each is a feature/large effort orthogonal to hardening; keep the milestone focused | ✓ Good — kept the milestone focused; carried to next-milestone candidates |

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
*Last updated: 2026-07-15 after starting v1.1 milestone (TypeScript 6 Migration & Toolchain Modernization) — TS6 + toolchain audit + forward-compat guardrails (isolatedDeclarations, verbatimModuleSyntax, CI deprecation gate, dep-freshness automation) + WR-01, aimed at a clean TS 7.1 jump. Continues phase numbering from v1.0.*

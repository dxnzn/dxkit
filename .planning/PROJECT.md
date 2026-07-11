# DxKit

## What This Is

DxKit is a headless microframework for building composable dapps — routing, lifecycle
management, a typed event bus, and a plugin registry, with zero DOM ownership. It ships a
core package (`@dnzn/dxkit`) plus four optional plugins (wallet, auth, theme, settings),
and targets static/IPFS deployment via IIFE builds alongside ESM/CJS for bundlers. It is
for developers assembling small, decoupled dapps (mounted one at a time into `#dx-mount`)
that talk to the shell only through `window.__DXKIT__`.

The framework is in alpha (0.1.5). This milestone hardens it toward beta — not beta yet,
but meaningfully more robust — and brings all documentation back into truth with the code.

## Core Value

DxKit stays trustworthy for real use: failures are visible (never silent), the documented
behavior matches the actual behavior, and the alpha is stable enough to build on with
confidence.

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

### Active

<!-- The 0.2.0 hardening + docs-truth milestone. Hypotheses until shipped and validated. -->

**Hardening — robustness guards**
- [ ] Optional load timeouts for script/style/template fetches (no hang-forever mounts)
- [ ] Cache sorted manifests in the router (avoid re-sort on every resolve)
- [ ] Template caching by URL with explicit invalidation

**Hardening — test coverage**
- [ ] Stress tests for concurrent navigation and mount races (fast A→B→A with slow loaders)
- [ ] Manifest-validation edge-case tests (bad route formats, merge behavior)
- [ ] Settings handler cleanup + tests for `disableDapp()` (no handler leaks / firing on disabled dapps)

**Hardening — security posture**
- [ ] Optional template sanitizer hook on the lifecycle manager
- [ ] Configurable wallet storage key (avoid same-origin collisions)
- [ ] CSP guidance documented for `innerHTML` templates + external scripts

**Docs — truth pass**
- [ ] Verify every framework + plugin doc and README against code (code is truth); correct drift
- [ ] Remove "AI tells" / slop from docs (filler, hedging, restated obviousness, invented detail)
- [ ] Fill documentation gaps surfaced by the concerns audit (CSP guide, security/limitations notes)

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
| Scope milestone as "harden toward beta", ship as 0.2.0 | Alpha is field-stable; increase robustness + doc trust without a feature push | — Pending |
| Target all four hardening tracks (silent failures, robustness, tests, security) | Concerns audit shows they're interrelated; a partial pass leaves obvious gaps | — Pending |
| Docs pass = verify-against-code + slop cleanup + gap-fill | "Code is truth"; drift and AI slop erode trust as much as bugs | — Pending |
| Breaking changes allowed but justified + migration-documented | Still alpha, but consumers exist; churn must earn its keep | — Pending |
| Defer TS6, new routing, encryption, cross-dapp state | Each is a feature/large effort orthogonal to hardening; keep the milestone focused | — Pending |

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
*Last updated: 2026-07-11 — Phase 1 complete (diagnostics: silent failures now surface via `dx:error`)*

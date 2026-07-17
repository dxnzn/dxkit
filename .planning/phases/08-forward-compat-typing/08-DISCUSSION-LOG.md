# Phase 8: Forward-Compat Typing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 8-Forward-Compat Typing
**Areas discussed:** Flag config placement, isolatedDeclarations policy, FCT-04 smoke test (placement + assertion depth), Rollout & commit order

---

## Flag config placement

| Option | Description | Selected |
|--------|-------------|----------|
| Base tsconfig.json | All three flags in root base config, inherited by the `tsc --emitDeclarationOnly` emit pass, the typecheck configs, and all 4 plugins via `extends`. Single source of truth; emit + typecheck in lockstep. | ✓ |
| Split by where each bites | isolatedDeclarations in build/emit config only; verbatim + erasable in base. | |
| Typecheck config only | Flags enforced in `make typecheck` but NOT during emit — isolatedDeclarations wouldn't guard `.d.ts` generation. | |

**User's choice:** Base tsconfig.json
**Notes:** isolatedDeclarations must live where the emit pass reads it; base placement gives plugins the flags via `extends` for free.

---

## isolatedDeclarations policy

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal + note only if real | Explicit annotations only where the flag demands them, at source; BREAKING CHANGE / module-augmentation note only if a public type shape actually changes. No manufactured churn. | ✓ |
| Full public-API audit + always note | Deliberate pass over the whole exported type surface; always ship the migration note as a heads-up. | |
| You decide | Claude's discretion, guided by fix-at-source philosophy. | |

**User's choice:** Minimal + note only if real
**Notes:** Consistent with Phase 7's no-shim / no-invented-changes posture. Factory returns are already typed, so surface expected small.

---

## FCT-04 smoke test — placement & runner

| Option | Description | Selected |
|--------|-------------|----------|
| Separate target, builds first | `make` target runs `make build` then a vitest pass against real `dist/` (CJS require + IIFE in happy-dom); wired into build/release/CI, NOT `make test`. | ✓ |
| Fold into `make test` | Add smoke spec to the vitest suite with a build prerequisite; couples every test run to a full build. | |
| Standalone node script | Plain node script (no vitest) next to `verify-outputs`. | |

**User's choice:** Separate target, builds first
**Notes:** Respects the Phase 7 constraint that `make test` never builds. Reuses happy-dom + vitest already in the stack.

---

## FCT-04 smoke test — assertion depth

| Option | Description | Selected |
|--------|-------------|----------|
| Exhaustive expected-key list | Each IIFE global attaches with its full expected top-level export keys; CJS require() returns the same set. Catches dropped/renamed exports. | ✓ |
| Presence smoke only | Assert each global attaches / require() returns non-empty, without pinning the exact export surface. | |

**User's choice:** Exhaustive expected-key list
**Notes:** Expected-key list becomes a maintained fixture — intended; its value is going red on unexpected export-surface drift.

---

## Rollout & commit order

| Option | Description | Selected |
|--------|-------------|----------|
| No-ops first, isolatedDecl last | One commit per flag: verbatim + erasable first (near/actual no-ops), then isolatedDeclarations core-before-plugins, then the smoke test. Isolates real churn. | ✓ |
| One package at a time | All three flags per package together, core first then each plugin. | |
| You decide | Claude's discretion honoring bisectability + core-before-plugins. | |

**User's choice:** No-ops first, isolatedDecl last
**Notes:** Matches Phase 6 D-02 / Phase 7 D-07 per-tool bisectable discipline.

---

## Claude's Discretion

- Exact smoke-target name and precise CI/release/publish wiring point (mirror `verify-outputs`).
- Whether verbatim + erasable land as one combined no-op commit or two.
- Exact happy-dom vs node mechanism for loading the IIFE global.
- Degenerate case where isolatedDeclarations needs zero annotations (flag-on commit only — no invented annotations).
- Whether expected-export-key fixtures are inlined per-package or centralized in the smoke spec.

## Deferred Ideas

- Phase 9: CI deprecation gate (GATE-01), zero-runtime-dep assertion (GATE-02), Renovate (GATE-03), WR-01 registry fix (ROB-05).
- v2: TS7 migration, tsup→tsdown swap.

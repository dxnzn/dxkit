# Roadmap: DxKit

## Milestones

- ✅ **v1.0 Beta Hardening** — Phases 1–5 (shipped 2026-07-15, released as 0.2.0)
- ✅ **v1.1 TypeScript 6 Migration & Toolchain Modernization** — Phases 6–10 (shipped 2026-08-16, released as 0.3.0)

Detail archived in [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md) and
[`milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md).

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- Each milestone continues numbering from the previous one (v1.0 ended at Phase 5, v1.1 at Phase 10)

<details>
<summary>✅ v1.0 Beta Hardening (Phases 1–5) — SHIPPED 2026-07-15</summary>

Hardened DxKit 0.1.5 → 0.2.0 without expanding the feature surface: silent failures made
visible via `dx:error`, load/hang/leak guards, an optional template sanitizer + configurable
storage keys, a stress/edge-case/regression test suite, and a full documentation truth pass.

- [x] Phase 1: Diagnostics — Surface Silent Failures (2/2 plans) — completed 2026-07-11
- [x] Phase 2: Robustness — Load Guards, Caching & Handler Cleanup (4/4 plans) — completed 2026-07-12
- [x] Phase 3: Security — Sanitization & Storage Isolation (3/3 plans) — completed 2026-07-12
- [x] Phase 4: Testing — Stress, Edge-Case & Regression Coverage (6/6 plans) — completed 2026-07-14
- [x] Phase 5: Documentation — Truth Pass (8/8 plans) — completed 2026-07-14

</details>

<details>
<summary>✅ v1.1 TypeScript 6 Migration & Toolchain Modernization (Phases 6–10) — SHIPPED 2026-08-16</summary>

Modernized the dev toolchain 0.2.1 → 0.3.0 without touching the runtime surface: Node 22 LTS floor
(`^22.12.0 || >=24.0.0`, engine-strict, breaking), TypeScript 6 with a standalone per-package
`tsc --noEmit` gate and zero deprecation shims, TS7 forward-compat flags on, build-artifact smoke
test, machine-enforced zero-runtime-dep assertion, Renovate, and the ROB-05/06 manifest-shape guards.

- [x] Phase 6: Toolchain Audit & Modernization (6/6 plans) — completed 2026-07-17
- [x] Phase 7: TypeScript 6 Migration & Standalone Typecheck (4/4 plans) — completed 2026-07-17
- [x] Phase 8: Forward-Compat Typing (2/2 plans) — completed 2026-07-17
- [x] Phase 9: Continuous Debt Guardrails & Registry Robustness (4/4 plans) — completed 2026-07-18
- [x] Phase 10: Close gap: CR-01 — guard dapps/inline manifests tiers (1/1 plan) — completed 2026-07-19

</details>

_Next milestone not yet defined — run `/gsd-new-milestone`._

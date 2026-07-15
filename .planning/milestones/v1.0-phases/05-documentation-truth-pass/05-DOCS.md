---
phase: 05
status: current
verified_against: 2711945dc94a7f07e5c8129a3b76b424e1a54898
updated: 2026-07-14
---

# Phase 05 — Documentation Ship-Gate Marker

Documentation for Phase 5 (documentation-truth-pass) is verified current against HEAD
`2711945`. This phase *was* the documentation truth pass, so the docs were brought into
truth against 0.2.0 code as the phase's primary deliverable — this marker records that the
ship-gate verification holds and no drift remains.

## Verification basis

- **Full phase verification** (`05-VERIFICATION.md`) passed **7/7 must-haves** — every event
  name, config option, and behavior claim checked against 0.2.0 code; filler/hedging swept;
  CSP + limitations note confirmed present.
- **Mechanical compile-check** (Plan 05-08, D-04): every TS snippet across all 15 docs compiled
  against real 0.2.0 exported types via a `tsc --noEmit --strict` harness (2 real bugs caught + fixed).
- **Canonical drift log** assembled at `05-DRIFT-LOG.md` (DOC-01 proof, 17/17 units checked).
- **Freshness:** `git log <verified_against>..HEAD -- src/ plugins/*/src/` is empty — no source
  has changed since verification (last source commit was `aa1098a`, Wave 1). All commits after
  the phase closeout are docs/planning only.
- **Spot re-verification at marker time** confirmed key cross-doc claims still hold against source:
  `timeout ?? 30000` (`src/lifecycle.ts:253`), theme/settings `storageKey` configurable
  (`plugins/{theme,settings}/src/index.ts`), D-16 `router.navigate('/')` (`src/shell.ts`),
  `ShellConfig.lifecycle = Omit<LifecycleManagerOptions, 'hasPlugin'>` (`src/types/shell.ts:32`).

## Docs verified / updated this phase

| Doc | Result |
|-----|--------|
| `README.md` | Updated — doc index reconciled (4 new rows), false IIFE-bundling claim corrected |
| `docs/events-reference.md` | Updated — `dx:error` catalog rewritten (23 source rows) |
| `docs/api-reference.md` | Updated — verified against 0.2.0 public type surface |
| `docs/configuration.md` | Updated — timeless-present drift fixed, custom-loader timeout caveat added |
| `docs/getting-started.md` | Updated — verified vs source, 0.1.5→0.2.0 migration section added |
| `docs/dapp-development.md` | Updated — single disable-while-active outcome rule (D-16) |
| `docs/system-internals.md` | Updated — normalization, duplicate routes, container-clear, caching |
| `docs/plugin-development.md` | Updated — duck-typing attribution + init-order truth |
| `docs/plugins/wallet.md` | Updated — `storageKey`, WR-02/WR-03, `dx:error` sources |
| `docs/plugins/auth.md` | Updated — graceful degradation when wallet plugin absent |
| `docs/plugins/theme.md` | Updated — init-sync ordering, `dx:error` sources, `storageKey` |
| `docs/plugins/settings.md` | Updated — handler cleanup, register-order truth, `storageKey`, TBD removed |
| `docs/cookbook.md` | Updated — module-augmentation package name + `deepMerge` null rule |
| `docs/development.md` | Updated — plugin IIFE bundling claim + audit scope corrected |
| `docs/testing.md` | Verified accurate — one slop-bar false-positive reworded |
| `docs/security.md` | **New** — CSP guidance + DOMPurify recipes + limitations inventory; storageKey bullet corrected |

**Result: no drift found (all docs current against HEAD) — ship gate satisfied.**

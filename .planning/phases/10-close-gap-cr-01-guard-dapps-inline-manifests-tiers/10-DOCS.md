---
phase: 10
status: current
verified_against: c94a99d64ec15616915d2d459598307586df3d83
updated: 2026-07-19
---

# Phase 10 — Documentation Update

Targeted drift pass for the ROB-06 change (the shared `coerceManifestArray()` guard
extending ROB-05's array-shape check from the `registryUrl` tier to the `dapps` and inline
`manifests` tiers of `loadManifests()`). This is a mature, hand-authored doc set (Phase 5
truth pass), so only the docs whose *claims* the change affects were touched — the generative
canonical-doc workflow was deliberately not run.

## Docs updated

- **`docs/events-reference.md`** — generalized the `shell:manifest` error catalog row that
  previously documented the wrong-shape guard for the `registryUrl` tier only (ROB-05). It now
  states that all three manifest tiers (`dapps`, inline `manifests`, `registryUrl`-fetched
  body) are shape-checked by the shared `coerceManifestArray()` guard, each emitting one
  `dx:error` and fail-closing that tier to an empty list instead of throwing an uncaught
  `TypeError` before `window.__DXKIT__` is exposed. The registry `200`-body check remains noted
  as firing ungated; the `dapps`/`manifests` checks are noted as guarding developer-supplied
  config for untyped IIFE/static-HTML consumers.
- **`docs/configuration.md`** — added a note alongside the existing loader-shape guard note,
  documenting that `dapps`, `manifests`, and a fetched `registryUrl` body must each be an array,
  and that a wrong-shape value emits a `dx:error` (source `shell:manifest`) and fail-closes to an
  empty manifest list rather than throwing (same untyped-consumer rationale as the loader guard).

## Self-review refinement (PR #11)

Both notes above were tightened after a cross-agent self-review flagged that nullish
(`null`/`undefined`) `dapps`/`manifests` now fall through as "unset" (they don't fail closed) —
only a *present* non-array value emits. `events-reference.md` and `configuration.md` now state
the nullish-vs-present distinction explicitly.

## Docs verified as already accurate (no drift)

- **`docs/api-reference.md`** — `ShellConfig`/`DappEntry` type signatures for `dapps`/`manifests`
  are unchanged by ROB-06; no behavioral claim to correct.
- **`docs/security.md`** — CSP/injection guidance and the template/entry-script trust limitations
  are unaffected; the ROB-06 guard is an availability (DoS) mitigation on config shape, not an
  injection surface, and nothing in the doc is falsified.
- **`docs/system-internals.md`** — the `loadManifests()` → `normalizeAndValidateManifests()`
  sequence and the duplicate-route `shell:manifest` emit description remain accurate; the
  illustrative `fetch(registryUrl).then(r => r.json())` snippet is a simplified sequence aid, not
  a literal source excerpt, so it was left as-is.
- Other docs referencing `dapps`/`manifests` (cookbook, getting-started, dapp-development,
  plugin-development, plugins/settings) use them only in usage examples and make no claim about
  wrong-shape error behavior — no change needed.

All claims added above were verified against `src/shell.ts` (the `coerceManifestArray()` helper
and the three-tier `loadManifests()` flow) and the passing `tests/shell.test.ts` ROB-06 suite.
No VERIFY markers required — every claim is discoverable from the repository.

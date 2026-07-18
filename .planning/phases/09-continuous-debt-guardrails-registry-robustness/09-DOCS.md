---
phase: 09
status: current
verified_against: 61cf32f87379e60672810b258c04ec0ad13873f5
updated: 2026-07-18
---

# Phase 09 — Documentation Truth Pass

Targeted drift pass against phase 09's changes (GATE-01/02/03 + ROB-05). Phase 09 touched
5 files (`.github/workflows/ci.yml`, `Makefile`, `renovate.json`, `scripts/check-no-runtime-deps.cjs`,
`src/shell.ts`, +108 lines). The 19-doc curated set was reviewed against these surfaces;
only genuinely drifted claims were edited — no mass regeneration.

## Docs updated

- **README.md** — added `make verify-no-runtime-deps` to the Common Helpers table (GATE-02).
- **docs/development.md** — added the `make verify-no-runtime-deps` row to the make-targets table;
  corrected the `make release`/`make publish` prerequisite chains to include `verify-no-runtime-deps`
  (actual order: `build → verify-outputs → verify-no-runtime-deps → smoke → test`); expanded the CI
  description to cover the two named guardrail steps (GATE-01 typecheck gate, GATE-02 zero-dep
  assertion) and added a Renovate dependency-automation paragraph (`renovate.json`, 3-day
  `minimumReleaseAge`, toolchain-major human-review, Mend App install requirement).
- **docs/testing.md** — updated the CI Integration YAML block and prose to include the two named
  steps between `make smoke` and `make test`.
- **docs/events-reference.md** — added the `shell:manifest` trigger for a `registryUrl` `200`
  non-array body (ROB-05); flagged it as **ungated** (fires even on the default `/registry.json`
  probe, unlike the non-OK/parse cases), correcting the prior "default probe stays silent" claim
  which became incomplete.

## Verified as already accurate (no drift)

- **docs/configuration.md** — registry/`registryUrl` config semantics unchanged by ROB-05 (the fix
  is additive fail-closed error behavior, not a config-surface change).
- **docs/security.md** — CSP/sanitization/limitations content unaffected; no falsified claim (the
  zero-runtime-dep posture is a build-time supply-chain guard, out of this doc's runtime scope).
- **docs/getting-started.md** — three-tier manifest fallback description still accurate (registry is
  still "a JSON array of manifests").
- Remaining curated docs (api-reference, cookbook, dapp-development, plugin-development,
  system-internals, plugins/*) — no phase-09 surface touched.

No stale `dependabot` references found (Renovate is the chosen tool). Secret scan clean.

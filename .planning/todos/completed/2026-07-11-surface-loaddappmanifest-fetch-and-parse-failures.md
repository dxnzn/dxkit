---
created: 2026-07-11T22:31:56.740Z
updated: 2026-07-14
title: Surface registry.json fetch/parse failures (remaining WR-01 tier)
area: general
source: 01-REVIEW.md (WR-01); narrowed by PR #4 external review
files:
  - src/shell.ts:237-244
---

## Problem

The original WR-01 (loadDappManifest silently swallowing fetch/HTTP/JSON failures) was fixed
in phase 4 (plan 04-02): the dapp-entry tier now emits `dx:error` on fetch throw, non-2xx,
and JSON-parse failure, with regression tests.

One tier remains: the registry.json fallback in `loadManifests` (src/shell.ts:237-244) still
swallows fetch throws, non-OK responses, AND `res.json()` parse failures via the
`// No registry.json — that's fine` catch. That silence is defensible for the default
`/registry.json` probe (absence is expected), but when a developer explicitly configures
`registryUrl`, a 404 or corrupt JSON is exactly the invisible misconfiguration WR-01 targets.

Re-surfaced by the PR #4 external code review.

## Solution

Emit `dx:error` (source `shell:manifest`, consistent with the D-02 taxonomy) on registry
fetch/HTTP/parse failure **at least when `registryUrl` was explicitly passed in ShellConfig**;
keep the default-probe silence. Distinguish "explicitly configured" from the default at
config-capture time. Add regression tests for 404 and malformed-JSON registry responses in
both the explicit and default cases (explicit → emits; default → stays silent).

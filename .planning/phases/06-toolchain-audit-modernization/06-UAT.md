---
status: testing
phase: 06-toolchain-audit-modernization
source: [06-VERIFICATION.md]
started: 2026-07-15T19:20:00Z
updated: 2026-07-15T19:20:00Z
---

## Current Test

number: 1
name: Negative install test on Node 18/20
expected: |
  On a Node 18 or Node 20 runtime (nvm/fnm/Volta/Docker), `pnpm install` against this repo
  fails fast with an ERR_PNPM_UNSUPPORTED_ENGINE-family error citing the required Node floor
  (`^22.12.0 || >=24.0.0`), before any packages resolve.
awaiting: user response

## Tests

### 1. Negative install test on Node 18/20
expected: On a Node 18 or Node 20 runtime, `pnpm install` (or `pnpm install --frozen-lockfile`) fails fast with an ERR_PNPM_UNSUPPORTED_ENGINE-family error naming the required Node floor, before resolving/downloading packages. Proves engine-strict + engines enforcement works against a real old-Node runtime (Success Criterion 1's literal negative-install proof; scoped as a documented check by decision D-06).
result: [pending]

### 2. Complete interactive commitizen flow
expected: Running `make commit` (`npx cz`) on a real TTY presents cz-git's interactive type-selection prompt; selecting a type, writing a subject, and confirming produces a valid conventional-commit message in `git log`. Proves the cz-git adapter swap (TOOL-04) works end-to-end interactively, not just at module-resolution.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

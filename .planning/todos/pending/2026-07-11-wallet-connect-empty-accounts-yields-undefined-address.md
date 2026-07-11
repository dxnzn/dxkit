---
created: 2026-07-11T22:31:56.740Z
title: Wallet connect empty accounts yields undefined address
area: wallet
source: 01-REVIEW.md (WR-02)
files:
  - plugins/wallet/src/index.ts:46-50
  - plugins/wallet/src/index.ts:214
---

## Problem

Data-integrity bug: `eth_requestAccounts` returning an empty array `[]` produces a state of
`connected: true, address: undefined`. The coordinator's `address!` non-null assertion then
propagates `undefined` to every subscriber of the `{ address: string }` contract — a type
lie that downstream dapps will trust.

An empty accounts array is a real provider response (user rejects / no account selected), so
this is reachable in normal operation, not just adversarial input.

Surfaced by the Phase 1 code review — see
`.planning/phases/01-diagnostics-surface-silent-failures/01-REVIEW.md` (WR-02).

## Solution

Treat an empty accounts array as "not connected": do not set `connected: true` without a
valid address; either keep `connected: false` or emit `dx:error` for the failed connect.
Remove the `address!` assertion so the type contract can't be violated. Add a regression test
for the empty-accounts path. TBD whether this rides along with the Phase 3 wallet work
(SEC-02) or lands as a standalone correctness fix first.

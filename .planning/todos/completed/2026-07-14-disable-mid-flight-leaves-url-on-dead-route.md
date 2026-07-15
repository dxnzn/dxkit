---
created: 2026-07-14
title: Decide disable-mid-flight URL behavior (parked on dead route vs navigate('/'))
area: general
source: PR #4 external code review (minor 4)
files:
  - src/shell.ts:110-116
  - src/shell.ts:129-146
---

## Problem

Disabling a dapp whose mount has **committed** unmounts it and navigates to `/`
(rebuildRouter, src/shell.ts:110-116). Disabling a dapp whose mount is still **in flight**
abandons the mount (invalidatePendingMount + releasePendingMount) but leaves the browser
parked on the now-unmatched route with an empty container — no navigate('/').

The divergence is real (verified against current code). Not a correctness bug — the phase 4
invariants (no stale commit, dedupe liveness) all hold — but the two "disable while its route
is active" paths end in different user-visible states.

## Solution

Make a deliberate decision and encode it: either (a) mirror the committed path — after
invalidating an in-flight mount for the dapp whose route matches the current path, navigate
to `/`; or (b) keep the parked behavior and document it (dapp-development.md / system-internals.md).
Either way, add a test asserting the chosen behavior so it can't drift silently.

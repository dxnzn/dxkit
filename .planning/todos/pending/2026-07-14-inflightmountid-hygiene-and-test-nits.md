---
created: 2026-07-14
title: inFlightMountId hygiene after external invalidation + minor test nits
area: general
source: PR #4 external code review (minor 3 + test nits)
files:
  - src/lifecycle.ts:348
  - src/lifecycle.ts:392
  - tests/shell.test.ts
  - tests/router.test.ts
---

## Problem

Low-priority hygiene items from the PR #4 external review, all verified but benign today:

1. **inFlightMountId lingers after external invalidation.** Bare `if (isStale()) return;`
   gates (src/lifecycle.ts:348, 392) never clear `inFlightMountId`, so when
   invalidatePendingMount/invalidateAnyPendingMount abandons the newest call, the id stays
   set. Consequence today: a later `invalidateAnyPendingMount()` sees non-null and bumps
   mountGeneration spuriously (harmless — nothing in flight). But the code comment "No-op
   when nothing is in flight" overstates the invariant. Fix: clear only when the returning
   call is the one that set it (track the generation alongside the id).

2. **Test nit — dx:error listener accumulation.** The WR-01/validation suites in
   tests/shell.test.ts register `dx:error` listeners without removing them (each pushes to a
   per-test array, so no cross-contamination — but listeners accumulate for the file's
   remaining tests). Align with the file's other tests' cleanup pattern.

3. **Test nit — confusing ids in router duplicate-route test.** The "reversed input order"
   test in tests/router.test.ts asserts correct first-registered-wins behavior, but the
   manifest naming makes the assertion read like a contradiction. Rename ids or add a comment.

## Solution

Fold into any future touch of these files (or a phase-5+ hygiene pass) — none warrants a
standalone fix cycle. Item 1 should come with a small unit test locking the tightened invariant.

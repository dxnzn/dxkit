# Phase 4: Testing — Stress, Edge-Case & Regression Coverage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 4-testing-stress-edge-case-regression-coverage
**Areas discussed:** Todo cross-reference, Race semantics & invariants, Bug-fix policy, Manifest validation expectations, Suite organization & technique

---

## Todo Cross-Reference

| Option | Description | Selected |
|--------|-------------|----------|
| Fold it in | WR-01 fix + regression test lands alongside TEST-02's manifest edge-case suite — one touch of the manifest-load path | ✓ |
| Keep phase test-only | WR-01 stays a pending todo; Phase 4 tests only assert current behavior | |

**User's choice:** Fold WR-01 (surface `loadDappManifest` fetch/parse failures) into Phase 4.
**Notes:** Presented with the caveat that it makes the phase not purely test-authoring; single-touch economics won.

---

## Race Semantics & Invariants

### Q1 — Invariant under rapid A→B→A with slow loaders

| Option | Description | Selected |
|--------|-------------|----------|
| Last navigation wins | Final DOM + getCurrentDapp() match the most recent route; stale in-flight mounts must not complete or emit dx:mount — implies a fix | ✓ |
| Assert current behavior only | Characterization tests pinning last-finisher-wins semantics | |
| Eventual consistency, weaker | Only no-duplicate-dx:mount and no orphaned DOM after settling | |

**User's choice:** Last navigation wins.
**Notes:** Discussion surfaced that `lifecycle.mount()` sets `currentDappId` only after async loading while `pendingMountId` dedupes same-dapp only — so current code is last-finisher-wins and will fail this invariant.

### Q2 — Strictness of the dx:mount/dx:unmount event contract

| Option | Description | Selected |
|--------|-------------|----------|
| Strict alternation | Every dx:mount followed by its dapp's dx:unmount before any other dx:mount; superseded mounts emit neither | ✓ |
| Final-state only | Assert end-state, tolerate intermediate orderings | |

**User's choice:** Strict alternation.

### Q3 — Additional race interleavings (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| disableDapp mid-mount | Disable racing an in-flight mount (router rebuild + unmount path) | ✓ |
| Timeout racing navigation | Phase 2's 30s timeout firing after navigation away — no clobbering the new dapp's DOM, no misattributed dx:error | ✓ |
| Sub-path nav during mount | dx:route:subpath vs pendingMountId interaction | ✓ |
| Init-mount racing first nav | shell.init() initial mount vs immediate navigation | ✓ |

**User's choice:** All four scenarios.

---

## Bug-Fix Policy

### Q1 — How the known mount-race fix lands

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in-phase | Race fix (e.g. mount-generation token) + stress tests land together; suite green | ✓ |
| Tests first, fix separate | Known-failing tests + todo + follow-up fix | |

**User's choice:** Fix in-phase.

### Q2 — Standing policy for other surfaced bugs

| Option | Description | Selected |
|--------|-------------|----------|
| Fix correctness bugs in-phase | Races/correctness/lost-event bugs fixed with their tests; out-of-scope findings become todos | ✓ |
| Triage each to a todo | Every bug filed and decided individually; known-failing tests | |
| Fix all, no exceptions | Everything fixed in-phase even if it grows into design work | |

**User's choice:** Fix correctness bugs in-phase.

---

## Manifest Validation Expectations

### Q1 — Malformed route formats

| Option | Description | Selected |
|--------|-------------|----------|
| Normalize + reject unfixable | Slash issues normalized at construction (normalizePath rules); empty/garbage rejected with dx:error | ✓ |
| Reject all malformed + dx:error | Strict canonical-form-or-discard | |
| Characterize current behavior | Pin the validate-but-never-match trap without changing it | |

**User's choice:** Normalize + reject unfixable.
**Notes:** Discussion surfaced that routes are matched verbatim against normalized paths, so `"blog"` / `"/blog/"` are silently dead today.

### Q2 — Validation tier parity

| Option | Description | Selected |
|--------|-------------|----------|
| Validate all three tiers | registry.json + inline manifests pass through isValidManifest; invalid discarded with shell:manifest dx:error | ✓ |
| Entries tier only | Keep validation where it is; characterize the trust gap | |

**User's choice:** Validate all three tiers.
**Notes:** Discussion surfaced that only the dapp-entries tier validates today.

### Q3 — Exact-duplicate routes

| Option | Description | Selected |
|--------|-------------|----------|
| First wins + dx:error | Deterministic first-registered-wins + emit naming conflicting ids | ✓ |
| First wins, silent | Document and assert insertion-order precedence only | |
| Reject the duplicate | Later manifest discarded with dx:error | |

**User's choice:** First wins + dx:error.

---

## Suite Organization & Technique

### Q1 — Test placement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated stress file | New tests/stress.test.ts for concurrency; manifest cases extend shell/router test files | ✓ |
| Fold into existing files | Race tests join shell.test.ts | |

**User's choice:** Dedicated stress file.

### Q2 — Slow-loader simulation

| Option | Description | Selected |
|--------|-------------|----------|
| Deferred promises + fake timers where needed | Manually-resolved deferreds for interleaving control; vi.useFakeTimers only for the timeout-race scenario | ✓ |
| Fake timers everywhere | All delays via advance-by-ms | |
| Real short delays | setTimeout(5ms) real time — flaky-prone | |

**User's choice:** Deferred promises + fake timers where needed.

### Q3 — TEST-03 depth vs Phase 2's existing tests

| Option | Description | Selected |
|--------|-------------|----------|
| Full-shell integration regression | createShell → mount → register handlers → disableDapp() → assert no fire/no leak, through real dx:dapp:disabled wiring | ✓ |
| Audit + gap-fill only | Review Phase 2 tests against TEST-03 wording, add plugin-level gaps | |

**User's choice:** Full-shell integration regression.

---

## Claude's Discretion

- Race-fix mechanism (generation token vs abort plumbing vs queue), within zero-dep / no-bundler constraints.
- Where route normalization/rejection executes and exact new dx:error source strings (follow the colon taxonomy).
- Stress-file naming and describe-block structure.
- WR-01 error-source/message wording, mirroring the existing validation emit.
- Per-commit judgment on `BREAKING CHANGE:` footers for the behavior changes (route normalization, tier validation, duplicate emit); race fix treated as a plain bug fix.

## Deferred Ideas

- Docs for new/changed behavior → Phase 5 (DOC-01); migration notes still ship with any breaking commits.
- Coverage thresholds/reporters in vitest config — no requirement backs it.
- Wildcard/regex/`:param` routes — out of milestone (ROUTE-01, v2).

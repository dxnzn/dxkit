# Phase 6: Toolchain Audit & Modernization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 6-Toolchain Audit & Modernization
**Areas discussed:** Bump scope & majors, CI matrix shape, cz-git config depth
**Area offered but not selected:** Node-floor proof (folded into the CI discussion and decided anyway)

---

## Gray-area selection

| Area | Description | Selected |
|------|-------------|----------|
| Bump scope & majors | Latest majors vs. known-safe; all-at-once vs. per-tool | ✓ |
| Node-floor proof | How to prove Node 18/20 install fails | (not pre-selected; decided during CI discussion) |
| CI matrix shape | Node 22 only vs. 22 + 24; extra CI steps | ✓ |
| cz-git config depth | 1:1 parity vs. richer monorepo config | ✓ |

---

## Bump scope & majors

### Bump target

| Option | Description | Selected |
|--------|-------------|----------|
| Latest stable, all majors | Newest stable everywhere; accept new Biome/vitest/vite defaults, fix fallout in-phase | ✓ |
| Newest known-safe | Hold back a major if it forces behavior change | |
| Latest, but freeze Biome style | Latest majors but pin Biome formatter/lint config | |

**User's choice:** Latest stable, all majors.
**Notes:** Cleanest baseline for the TS6 (Phase 7) and future TS7 jump.

### Bump method

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tool, verify each | One tool per commit, bump → test → commit; bisectable | ✓ |
| All-at-once, one commit | Bump everything, single commit | |
| Grouped by risk | Low-risk together, high-fallout isolated | |

**User's choice:** Per-tool, verify each.
**Notes:** Biome reformat isolated in its own commit.

### Range style

| Option | Description | Selected |
|--------|-------------|----------|
| Keep caret (^) | Stay with ^-ranges; lockfile pins exact; Renovate owns majors | ✓ |
| Exact pins | Drop ^; every bump an explicit Renovate PR | |

**User's choice:** Keep caret (^).
**Notes:** Interacts with Renovate work in Phase 9.

---

## CI matrix shape

| Option | Description | Selected |
|--------|-------------|----------|
| 22 + 24 | Floor (22 LTS) + current stable (24) | ✓ |
| 22 only | Just the floor; literal roadmap wording | |
| 22 + 24 + 26 | 26 not out yet; effectively same as 22 + 24 today | |

**User's choice:** 22 + 24.
**Notes:** Catches forward-compat breakage early, aligns with de-risk thesis.

### Node-floor proof (asked as CI follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated CI job | fails-if-it-succeeds `pnpm install` on Node 20 | |
| Local script + doc | Checked-in script + docs, run manually | |
| engine-strict only | `.npmrc` engine-strict + documented expected failure; trust pnpm | ✓ |

**User's choice:** engine-strict only.
**Notes:** Criterion 1's "negative install test" is satisfied by config + documentation, not a CI job. Planner should scope verification accordingly.

---

## cz-git config depth

| Option | Description | Selected |
|--------|-------------|----------|
| 1:1 parity | Same behavior as today's conventional-changelog; no scope enforcement | ✓ |
| Add monorepo scopes | Optional scope list matching the repo | |
| Full cz-git config | Scopes + custom types + breaking/issue prompts + aliases | |

**User's choice:** 1:1 parity.
**Notes:** Honors the "focused modernization pass" framing; richer config deferred.

---

## Claude's Discretion

- Exact target version of each tool (pick latest stable at implementation time).
- Wording/placement of the Node-floor migration note and documented expected-failure steps.
- Whether Biome's reformat is a distinct commit from its version bump vs. combined.

## Deferred Ideas

- CI negative-install job (deferred in favor of engine-strict + docs).
- Exact version pinning of devDeps (Renovate + lockfile cover it).
- Richer cz-git config (monorepo scopes, custom types, prompts, aliases).
- Node 26 in the CI matrix (not actionable until it ships).

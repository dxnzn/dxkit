# Phase 9: Continuous Debt Guardrails & Registry Robustness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 9-continuous-debt-guardrails-registry-robustness
**Areas discussed:** Renovate posture (GATE-03), GATE-01 gate shape, GATE-02 dep assertion, ROB-05 emit behavior

---

## Renovate posture (GATE-03)

### Delivery mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Mend GitHub App | Hosted app reads renovate.json, opens PRs. Zero CI cost. App-install is a one-time operator step. | ✓ |
| Self-hosted CI action | Scheduled Actions workflow runs Renovate on cron with a token. In-repo, but adds workflow + secret + CI minutes. | |
| You decide | (Recommended Mend App.) | |

**User's choice:** Mend GitHub App
**Notes:** Config ships in-repo; app installation recorded as an operator next-step (config is inert until the app is installed).

### Automerge aggressiveness

| Option | Description | Selected |
|--------|-------------|----------|
| Automerge non-major devDeps | Patch/minor devDep bumps automerge after release-age + green CI; all majors + toolchain majors open a PR. | ✓ |
| PR-only, no automerge | Every update opens a PR a human merges. Safest; automerge policy becomes "disabled". | |
| Automerge patch only | Only patch devDeps automerge; minors + majors open PRs. | |

**User's choice:** Automerge non-major devDeps
**Notes:** Toolchain majors (tsup/vite/vitest/Biome/TypeScript) always blocked, per requirement lock. CI is the safety net for the automerged tier.

### Release-age window

| Option | Description | Selected |
|--------|-------------|----------|
| 3 days | Filters most yanked/hotfixed releases; keeps pipeline fresh. Fits a dev-only dep set. | ✓ |
| 7 days | More conservative supply-chain guard; slower freshness. | |
| You decide | (Recommended 3 days.) | |

**User's choice:** 3 days (`minimumReleaseAge`)
**Notes:** Justified by all-devDependency profile (no runtime blast radius) + CI gating every bump.

### Grouping granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Group toolchain + lockfile-only | Toolchain moves as one PR; weekly lockfile-maintenance PR; other devDeps individual. | ✓ |
| Group all devDeps by type | One broad minor/patch group + separate majors. Fewest PRs, harder to bisect. | |
| You decide | (Recommended group-toolchain + lockfile-maintenance.) | |

**User's choice:** Group toolchain + lockfile-only
**Notes:** Toolchain packages must stay TS6-compatible in lockstep; individual PRs elsewhere preserve per-concern bisectability.

---

## GATE-01 gate shape

### Gate visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated CI step | Explicit named typecheck/deprecation gate step in ci.yml, separate from make test. | ✓ |
| Lean on make test | Rely on the existing make test → typecheck chain; no new CI step. | |
| You decide | (Recommended dedicated CI step.) | |

**User's choice:** Dedicated CI step
**Notes:** Mirrors how verify-outputs/smoke are broken out; makes the guardrail legible.

### Gate scope

| Option | Description | Selected |
|--------|-------------|----------|
| Keep tests/ in scope | Gate keeps typechecking src + tests (existing tsconfig include). "Never node_modules/" is the real constraint. | ✓ |
| src/ only, tests/ separate | Scope strictly to src/ + plugins/*/src/ per literal requirement; typecheck tests/ separately. | |
| You decide | (Recommended keep tests/ in scope.) | |

**User's choice:** Keep tests/ in scope
**Notes:** Requirement's real intent (STATE.md) is "never node_modules noise", not "exclude tests"; tests/ is project-owned and TS6-clean, so gating it is more coverage for zero config change.

---

## GATE-02 dep assertion

### Assertion mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| package.json field check | Makefile target asserts each package.json has empty/absent runtime dep fields. Fast, offline, deterministic. | ✓ |
| pnpm-tree check | pnpm list --prod / pnpm why assertion that the prod tree is empty. Closer to "what ships"; slower, brittle. | |
| You decide | (Recommended field check.) | |

**User's choice:** package.json field check
**Notes:** The posture is defined by not declaring deps, so assert that directly; fits the verify-outputs Makefile-loop pattern.

### Fields checked

| Option | Description | Selected |
|--------|-------------|----------|
| All three fields | Fail on dependencies, peerDependencies, OR optionalDependencies in any package. | ✓ |
| dependencies only | Fail only on non-empty dependencies. Matches literal "runtime dependency" phrase; leaves side-doors open. | |
| You decide | (Recommended all three.) | |

**User's choice:** All three fields
**Notes:** All three install a non-dev package into a consumer tree; trivial extension of the same loop, no gap left for an automated bump.

---

## ROB-05 emit behavior

### Wrong-shape 200 handling

| Option | Description | Selected |
|--------|-------------|----------|
| Always emit (ungated) | Wrong-shape 200 emits dx:error (source shell:manifest) regardless of registryUrlExplicit, then returns []. | ✓ |
| Gate like other failures | Only emit when registryUrlExplicit; default probe stays silent, returns []. | |
| You decide | (Recommended always emit.) | |

**User's choice:** Always emit (ungated)
**Notes:** A wrong-shape 200 is a present-but-malformed registry — a real misconfig, categorically unlike a 404/absence, which the registryUrlExplicit gate keeps silent on purpose. Return [] after emitting so init() still exposes window.__DXKIT__. Guard via Array.isArray(); element-level validation stays in normalizeAndValidateManifests().

---

## Claude's Discretion

- Exact Makefile target names (dep-check, gate) and precise CI step ordering — mirror verify-outputs/smoke intent.
- Whether GATE-01/GATE-02 also wire into release/publish (verify-outputs/smoke precedent suggests yes).
- Exact renovate.json key spelling / preset choices implementing D-01..D-04.
- skipLibCheck posture for GATE-01 if a node_modules/ .d.ts deprecation surfaces (escape hatch only if it actually appears).
- ROB-05 dx:error message wording (follow existing shell:manifest style); inline guard vs. tiny helper.
- Per-concern bisectable commit granularity (one each: GATE-01 / GATE-02 / GATE-03 / ROB-05).

## Deferred Ideas

None — discussion stayed within phase scope. (TS7.1/tsdown remain v2; a Biome @deprecated-export lint gate is out of scope this milestone — compiler-option deprecations are gated via tsc/GATE-01.)

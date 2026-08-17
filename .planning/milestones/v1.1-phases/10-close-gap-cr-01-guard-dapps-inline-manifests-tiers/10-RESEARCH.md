# Phase 10: Close gap: CR-01 — guard dapps/inline manifests tiers - Research

**Researched:** 2026-07-19
**Domain:** Internal TypeScript refactor — input-shape validation for `src/shell.ts`'s `loadManifests()` (zero new external dependencies, zero new libraries)
**Confidence:** HIGH

## Summary

This phase closes a scope-extension gap the v1.1 milestone audit flagged as CR-01: ROB-05
(Phase 9) added an `Array.isArray()` guard to only the `registryUrl`-fetch tier of
`loadManifests()`. The other two tiers — `dapps` (`DappEntry[]`) and inline `manifests`
(`DappManifest[]`) — still trust the raw config value's shape. All findings below come from a
direct read of `src/shell.ts` (lines 249–307) and `tests/shell.test.ts` (lines 380–579,
the existing ROB-05 regression suite) in this repository — there is no external library or
API surface to research; this is a pure code-shape/logic problem.

Two distinct crash modes exist today, not one uniform "throws a TypeError":

- **`dapps` tier** (`if (dappEntries?.length) { ... dappEntries.map(loadDappManifest) ... }`):
  throws only when the wrong-shape value has a **truthy `.length`** but no `.map` (e.g.
  `dapps: "a-string"` → `"a-string".length` is truthy → `.map` is not a function → uncaught
  `TypeError`). A wrong-shape value with a **falsy/undefined `.length`** (e.g. `dapps: 42`,
  `dapps: {}`) does not throw — it silently falls through to the next tier with no error
  emitted at all. Both are bugs; only the first is a hard crash.
- **inline `manifests` tier** (`if (inlineManifests) { return inlineManifests; }`): has **zero**
  shape validation. It returns whatever truthy value was passed straight through to
  `normalizeAndValidateManifests()`'s `for (const m of list)` in `init()`. A non-iterable value
  (plain object, number) throws `TypeError: list is not iterable`. An iterable-but-wrong-shape
  value (a string) does *not* throw — it iterates character-by-character, and each character
  fails `isValidManifest()`, emitting one `dx:error` per character (noisy but non-fatal).

**Primary recommendation:** Extract a closure-local `coerceManifestArray<T>(value, tierLabel)`
helper inside `createShell()` (not module-level — it needs `events` from closure, matching the
existing pattern of `isValidManifest`/`normalizeRoute`/`normalizeAndValidateManifests`). Give it
a `T[] | null` return: `null` after emitting `dx:error` on wrong shape, the array unchanged on a
valid shape (including a valid empty array — must not be conflated with the `null`/failure
case). Route all three `loadManifests()` tiers through it, using the `null` sentinel — not
`.length` — to decide "fail closed for this tier, don't try the next tier" vs. "this tier's
existing fallthrough-on-empty-array semantics apply unchanged." This preserves the two tiers'
already-asymmetric fallthrough behavior (see Common Pitfalls) while giving both new tiers the
same fail-closed-and-visible guarantee ROB-05 gave the registry tier.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Config-shape validation (`dapps`/`manifests`/registry array check) | API/Backend-equivalent (shell orchestration layer, `src/shell.ts`) | — | `loadManifests()` is the single boundary where untyped/external config (developer JSON, fetched registry.json) enters the typed system — validation belongs exactly here, not in the browser/DOM layer or inside `normalizeAndValidateManifests()` (which validates *elements*, not top-level shape) |
| Error surfacing (`dx:error`) | API/Backend-equivalent (Event Bus, `src/events.ts`) | — | All manifest-tier failures already funnel through `events.emit('dx:error', { source: 'shell:manifest', ... })` — this phase adds emit call sites, not a new mechanism |
| Element-level manifest validation (`isValidManifest`, route normalization, duplicate-route detection) | API/Backend-equivalent (`normalizeAndValidateManifests()`) | — | Explicitly out of scope — Phase 09-02 decision log states this stays the single choke point and must not be touched |

This is a headless, DOM-agnostic microframework; there is no browser/CDN/database tier
distinction relevant here — everything in scope lives in `src/shell.ts`'s orchestration layer.

## Standard Stack

No new libraries. Zero-runtime-deps posture (a hard project constraint) means this is
hand-written validation logic, not a schema library (`zod`, `ajv`, etc. would violate the
zero-dep posture and are explicitly the wrong tool here — see Don't Hand-Roll below for the
inverse case).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| — | — | — | No new runtime dependency; `Array.isArray()` is a native JS builtin, consistent with the existing ROB-05 pattern |

### Supporting
N/A — no new devDependencies required either; this is a pure `src/shell.ts` + `tests/shell.test.ts` change.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written `coerceManifestArray()` helper | A runtime schema validator (`zod`, `valibot`, `ajv`) | Would violate the project's zero-runtime-deps constraint (`CLAUDE.md`/`.claude/CLAUDE.md` — "Hardening must not introduce runtime dependencies"). Also overkill: the only invariant being checked is "is this a JS Array", not a deep schema |

**Installation:** None — no packages to install this phase.

**Version verification:** N/A — no packages recommended.

## Package Legitimacy Audit

**N/A — this phase installs zero external packages.** The Package Legitimacy Gate protocol
(`gsd-tools query package-legitimacy check`) is skipped per its own trigger condition ("every
phase that installs external packages"). No package table is produced.

## Architecture Patterns

### System Architecture Diagram

```text
createShell(config) config-time closures
                        │
                        ▼
                 init() called
                        │
                        ▼
              ┌── loadManifests() ──┐
              │                     │
   config.dapps present?      config.manifests present?    (neither) → fetch(registryUrl)
   (DappEntry[] expected)     (DappManifest[] expected)      (JSON array expected)
              │                     │                              │
              ▼                     ▼                              ▼
   coerceManifestArray<DappEntry>()  coerceManifestArray<DappManifest>()  coerceManifestArray<DappManifest>()
   (NEW — Array.isArray guard)      (NEW — Array.isArray guard)         (EXISTING — ROB-05, refactor to reuse helper)
              │                     │                              │
      null? ──┴─ emit dx:error,     null? ──┴─ emit dx:error,       null? ──┴─ emit dx:error,
      fail closed → []              fail closed → []                fail closed → []
              │                     │                              │
      valid array (maybe [])       valid array (maybe [])          valid array (maybe [])
              │                     │                              │
              ▼                     ▼                              ▼
   Promise.all(.map(loadDappManifest))   return as-is         return as-is
              │                     │                              │
              └─────────────────────┴──────────────────────────────┘
                                     │
                                     ▼
                    manifests[] returned to init()
                                     │
                                     ▼
              normalizeAndValidateManifests(manifests)   (UNTOUCHED — element-level
                                     │                     validation, route normalize,
                                     ▼                     duplicate-route detection)
                    window.__DXKIT__ = context (frozen)
                    ─── only reached AFTER the above resolves ───
```

The critical property this diagram must make visually obvious to the planner: **every
`coerceManifestArray()` call site sits strictly before `normalizeAndValidateManifests()`, which
sits strictly before `window.__DXKIT__` is assigned.** A guard added anywhere downstream of the
`window.__DXKIT__` assignment does not satisfy the phase goal ("never hit an uncaught TypeError
*before* `window.__DXKIT__` is exposed").

### Recommended Project Structure

No new files or directories. Single-file change:

```
src/
└── shell.ts   # loadManifests() restructured; new closure-local coerceManifestArray() helper added
tests/
└── shell.test.ts   # new regression tests appended near the existing ROB-05 block (lines ~481-579)
```

### Pattern 1: Closure-local shared coercion helper

**What:** A single `coerceManifestArray<T>(value: unknown, tierLabel: string): T[] | null`
function defined inside `createShell()`'s closure (after `events` is created, alongside
`isValidManifest`), used by all three `loadManifests()` tiers.

**When to use:** Any point where an external/untyped config value is expected to be a JS Array
before it's safe to call `.map()`/`.filter()`/`for...of` on it.

**Why closure-local, not module-level:** Every other manifest-adjacent helper in `shell.ts`
(`isValidManifest`, `normalizeRoute`, `normalizeAndValidateManifests`) is already closure-local
because they need `events.emit(...)` from the closure. Making `coerceManifestArray` the one
exception (module-level, taking `events` as a parameter) would be inconsistent with the file's
established factory-closure convention (`.claude/CLAUDE.md` — "Encapsulation via factory
function closures (no classes)") without buying anything, since nothing outside `createShell()`
needs to call it.

**Example (illustrative — planner/executor should verify exact message wording against the
Common Pitfalls section before finalizing):**

```typescript
// Source: pattern derived from ROB-05's existing inline check (src/shell.ts:275-290),
// generalized to a shared helper per the CR-01 audit recommendation.
// Returns null (after emitting dx:error) when `value` is not an Array; returns `value`
// unchanged — including an empty array — on a valid shape. Callers must branch on `=== null`,
// not on `.length`, to distinguish "wrong shape, stop trying this config source" from
// "valid but empty, this tier's own fallthrough rule applies."
function coerceManifestArray<T>(value: unknown, tierLabel: string): T[] | null {
  if (Array.isArray(value)) return value;
  events.emit('dx:error', {
    source: 'shell:manifest',
    error: new Error(
      // typeof null is 'object' — disambiguate explicitly, mirrors ROB-05's existing check.
      `Invalid ${tierLabel} config — expected an array, got ${value === null ? 'null' : typeof value}`,
    ),
  });
  return null;
}
```

### Anti-Patterns to Avoid

- **Homogenizing the two tiers' fallthrough conditions during refactor:** `dapps` currently
  gates on `dappEntries?.length` (truthy non-empty length), while inline `manifests` gates on
  `if (inlineManifests)` (any truthy value, including `[]`, which is truthy in JS). These are
  *not* the same rule today. A `manifests: []` config intentionally stops at that tier (never
  probes `registryUrl`); a `dapps: []` config intentionally falls through to try
  `manifests`/`registryUrl` next. Normalizing both to the same length-based or truthiness-based
  check during this refactor silently changes shipped behavior for valid-array configs — exactly
  what research_focus point 6 says must not happen. See Common Pitfalls for the concrete
  regression this causes if missed.
- **Letting a wrong-shape tier value silently fall through to the next tier:** if
  `coerceManifestArray()` returns `null` (wrong shape) and the caller then checks
  `coerced?.length` truthy/falsy (both fail the truthy check), a malformed `dapps: "x"` would
  silently be treated exactly like "no dapps configured" and fall through to try `manifests`/
  `registryUrl` next. That is a second, worse silent failure mode: the developer's config is
  simply ignored and a different manifest source loads instead, with no indication anything was
  wrong beyond the (easy-to-miss) `dx:error`. Branch on `coerced === null` explicitly and
  `return []` immediately for that tier — do not fall through.
- **Reusing `.length`-based checks with the coerced value instead of the raw value:** the
  fallthrough decision (does *this* tier apply at all, and if it does apply-but-is-empty does it
  stop or fall through) must be made from the **raw config value's presence/shape**, not from
  the post-coercion array, because the coercion step deliberately collapses "wrong shape" and
  "valid empty array" to visually similar falsy-ish states (`null` vs `[]`) that need different
  handling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep schema validation of `DappManifest`/`DappEntry` shape | A hand-rolled recursive validator, or reaching for `zod`/`ajv` | Nothing — out of scope. `isValidManifest()` (existing, untouched) already does shallow required-field validation *after* this phase's array-shape guard runs. This phase only adds a top-level `Array.isArray()` check, not element-level schema validation | Element validation is `normalizeAndValidateManifests()`'s explicit, already-decided responsibility (Phase 04-02 decision log) — re-deriving or duplicating it here would violate the single-choke-point design and risk double-emitting errors for the same bad manifest |

**Key insight:** The entire fix is one built-in check (`Array.isArray`) reused at two more call
sites — there is no complexity here that warrants a library, and the zero-runtime-deps
constraint would forbid one anyway.

## Common Pitfalls

### Pitfall 1: Breaking the existing ROB-05 test message-substring assertions

**What goes wrong:** Three existing tests in `tests/shell.test.ts` (lines 481, 506, 532) assert
`e.error.message.includes('/custom-registry.json')` on the wrong-shape-registry error. If
`coerceManifestArray()`'s message template drops the registry URL (e.g. becomes a generic
`"Invalid registry config — expected an array, got object"` with no URL), these three tests
fail.
**Why it happens:** The registry tier's current message
(`` `Failed to load registry from ${registryUrl} — expected a JSON array of manifests, got ${...}` ``)
is more specific than a generic tier label — it interpolates `registryUrl` inline. A naive
`coerceManifestArray(value, 'registry')` call would lose that.
**How to avoid:** Pass a fully-formed *description string* as the `tierLabel` argument for the
registry call site (e.g. `` `Failed to load registry from ${registryUrl}` ``), not a bare word
like `'registry'`, so the existing substring assertions keep passing verbatim. For the two new
tiers, `'dapps'` / `'manifests'` bare labels are sufficient since no existing test asserts on
their message content yet (new tests can pin whatever exact wording lands).
**Warning signs:** `make test` fails specifically on the 3 pre-existing ROB-05 tests, not the
new ones — a strong signal the shared message template silently changed wording under an
existing test's feet.

### Pitfall 2: Conflating "wrong shape" with "valid but empty" via `.length`-based branching

**What goes wrong:** If the refactored `loadManifests()` checks `coerced?.length` (or
`coerced.length` after defaulting `null` to `[]`) to decide tier fallthrough, a malformed
`dapps: "abc"` (coerces to `null` → treated as length 0) becomes indistinguishable from a
genuinely empty `dapps: []` — both silently fall through to try `manifests`/`registryUrl` next,
even though `dx:error` already fired for the malformed case. The developer's `dapps` config is
effectively discarded and swapped for a different manifest source with no indication *why*.
**Why it happens:** `null` and `[]` are both falsy-ish under a `.length` check (`null?.length` is
`undefined`, falsy; `[].length` is `0`, falsy) — easy to collapse them into one branch by
accident.
**How to avoid:** Branch explicitly on `coerced === null` (return `[]` immediately, no
fallthrough) before ever consulting `.length` for the fallthrough decision.
**Warning signs:** A new test asserting "`dapps: 'bad-shape'` emits exactly one `dx:error` and
`shell.getManifests()` is empty" passes, but a follow-up assertion checking `window.fetch` (the
registry probe) was *not* called would fail — revealing the silent tier-swap.

### Pitfall 3: Homogenizing the `dapps` vs `manifests` tier fallthrough rule

**What goes wrong:** `dapps` tier falls through to the next tier on a genuinely empty array
(`dapps: []`); inline `manifests` tier does **not** fall through on a genuinely empty array
(`manifests: []` stops there, treated as "zero dapps, deliberately"). This asymmetry is real,
existing, shipped behavior (see `if (dappEntries?.length)` vs `if (inlineManifests)` in the
current source). A refactor that makes both tiers use the *same* fallthrough predicate (e.g. both
using `.length`, or both using truthiness) silently changes one tier's behavior for a
100%-valid, already-shipped config shape.
**Why it happens:** The two conditions look almost the same at a glance
(`dappEntries?.length` vs `if (inlineManifests)`) but are not equivalent for the `[]` case —
easy to "simplify" them to match during a DRY-driven refactor without noticing the semantic
difference.
**How to avoid:** After introducing `coerceManifestArray()`, keep each tier's *own* existing
post-coercion fallthrough predicate unchanged: `dapps` still checks the coerced array's
`.length` truthy to decide whether to *use* it vs. fall through; inline `manifests` still treats
any valid array (including `[]`) as "stop here, return it." Only the *shape* check
(`Array.isArray`) is new and shared — the *emptiness* semantics per tier are not.
**Warning signs:** A regression test asserting `manifests: []` does not trigger a `fetch()` call
to `registryUrl` (add this if it doesn't already exist — it currently isn't explicitly tested,
which is itself a coverage gap worth closing in this phase) starts failing, or starts passing
`fetch` calls it previously didn't make.

### Pitfall 4: Double-emitting for the same malformed config

**What goes wrong:** If `coerceManifestArray()` emits `dx:error` on wrong shape, and the caller
*also* independently emits a similar error for the same value (e.g. leftover defensive code, or
a `catch` block wrapping the coercion call), a single malformed config produces two `dx:error`
events instead of one, breaking tests written to assert exactly one error and confusing
consumers who count/log `dx:error` events.
**Why it happens:** Natural when refactoring incrementally — old inline checks aren't fully
removed once the shared helper is introduced.
**How to avoid:** `coerceManifestArray()` is the single emission point for "wrong top-level
shape" across all three tiers. Remove the old inline `Array.isArray(parsed)` check block from
the registry tier entirely once it's routed through the helper — do not leave both.
**Warning signs:** A new test asserting error *count* (`errors.filter(e => ...).length === 1`)
rather than just existence would catch this; the existing ROB-05 tests only assert `.some(...)`
existence, so this pitfall could slip through without an explicit count assertion.

### Pitfall 5: Guard runs after the value is already consumed

**What goes wrong:** Placing the `Array.isArray` check *after* `dappEntries.map(...)` has
already been called (e.g., inside a `try/catch` around the whole tier instead of before it)
still throws, just gets caught later — potentially swallowing the *original* TypeError with a
less useful message, or catching an unrelated error from inside `loadDappManifest` under the
same catch block.
**Why it happens:** Wrapping the entire tier in `try/catch` looks like it "handles" the crash,
but it's a coarser net than a precise upfront shape check and can mask unrelated failures inside
`loadDappManifest()` (network errors, JSON parse errors — which already have their own specific
`dx:error` handling and must not be re-caught/re-wrapped here).
**How to avoid:** `coerceManifestArray()` must run and return before any `.map()`/iteration
touches the raw value — it is a precondition check, not a wrapped side effect.

## Code Examples

### loadManifests() — recommended restructure (illustrative, exact wording per Pitfall 1)

```typescript
// Source: derived from src/shell.ts:249-307 (current implementation, read directly from repo)
async function loadManifests(): Promise<DappManifest[]> {
  if (dappEntries !== undefined) {
    const coerced = coerceManifestArray<DappEntry>(dappEntries, 'dapps');
    if (coerced === null) return []; // wrong shape — fail closed, do not try manifests/registry
    if (coerced.length) {
      const results = await Promise.all(coerced.map(loadDappManifest));
      return results.filter((m): m is DappManifest => m !== null);
    }
    // dapps: [] (valid, genuinely empty) — existing behavior: fall through to next tier
  }

  if (inlineManifests !== undefined) {
    const coerced = coerceManifestArray<DappManifest>(inlineManifests, 'manifests');
    if (coerced === null) return []; // wrong shape — fail closed, do not try registry
    return coerced; // manifests: [] (valid, even empty) stops here — existing behavior preserved
  }

  try {
    const res = await fetch(registryUrl);
    if (!res.ok) {
      /* ...unchanged D-15 non-OK handling... */
      return [];
    }
    const parsed = await res.json();
    // ROB-05's existing inline Array.isArray(parsed) block is replaced by this call —
    // tierLabel must reproduce the exact existing message text (Pitfall 1).
    const coerced = coerceManifestArray<DappManifest>(parsed, `Failed to load registry from ${registryUrl}`);
    if (coerced === null) return [];
    return coerced;
  } catch (err) {
    /* ...unchanged D-15 catch handling... */
  }

  return [];
}
```

Note: `dappEntries !== undefined` / `inlineManifests !== undefined` replace the current
`dappEntries?.length` / `if (inlineManifests)` presence checks *only* for deciding "was this
tier configured at all" — the emptiness/fallthrough semantics after coercion are preserved
exactly as annotated above (Pitfall 3).

## State of the Art

Not applicable — this is not a fast-moving external ecosystem question. The relevant "state of
the art" is entirely internal precedent: ROB-05 (Phase 9) already established the pattern
(`Array.isArray` guard → `dx:error` with source `shell:manifest` → fail-closed to `[]`) this
phase extends to two more call sites. No external tooling changed since Phase 9 landed
(2026-07-18) that would affect this.

## Runtime State Inventory

This phase is a refactor of `loadManifests()`'s internal control flow, not a rename/rebrand/
identifier migration — but per the trigger condition ("any phase involving... refactor"), each
category is checked explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `coerceManifestArray`/`loadManifests` touch no database, localStorage, or persisted collection. `enabledState`/settings-plugin persistence (keyed by manifest `id`) is untouched — manifest `id` values themselves are not renamed by this phase. | None |
| Live service config | None — no external service (n8n, Datadog, etc.) references `loadManifests` or `coerceManifestArray` by name. | None |
| OS-registered state | None — no task scheduler, pm2, launchd/systemd registration references these function names. | None |
| Secrets/env vars | None — no env var or secret key is named after `loadManifests`/`dapps`/`manifests`/`registryUrl` internals. | None |
| Build artifacts | None — no compiled artifact, egg-info, or package name embeds these internal function names; `dist/` output is regenerated from source on every build regardless. | None |

**Nothing found in any category** — verified by reading `src/shell.ts` in full and confirming
`loadManifests`/`normalizeAndValidateManifests` are called only from within the same file
(`init()`), with no cross-file or cross-package references (`grep -rn "loadManifests" src/
plugins/` returns only the definition and its one call site).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Malformed (present-but-wrong-shape) `dapps`/`manifests` config should fail closed (emit + return `[]`, no fallthrough to the next tier) rather than silently trying the next configured tier | Architecture Patterns / Pitfall 2 | If the project maintainer actually wants fallthrough-on-malformed (treating a bad `dapps` config the same as an absent one), the recommended `T[] \| null` sentinel design still supports that by changing one branch — but the *default* recommendation here (fail closed) is a design judgment, not something pinned by existing precedent (ROB-05's registry tier is the *last* tier, so it never had to answer "should a malformed non-terminal tier fall through?"). Flag for discuss-phase/plan-check confirmation. |
| A2 | Register a new requirement ID (e.g. `ROB-06`) in `REQUIREMENTS.md`, traced to Phase 10, rather than silently extending `ROB-05`'s existing (already-`[x]`-checked) requirement | Summary / Open Questions | If tracked under the closed `ROB-05` instead, `REQUIREMENTS.md`'s traceability table would show a requirement satisfied by two phases (9 and 10), which breaks the "Mapped to phases: 1:1" invariant the milestone audit's 3-source cross-reference relies on (`v1.1-MILESTONE-AUDIT.md`'s Requirements Coverage table). A fresh ID keeps that invariant intact for the next milestone audit. |
| A3 | `manifests: []` not triggering a `registryUrl` fetch is current, load-bearing, tested-by-inference (not explicitly asserted) behavior worth preserving and pinning with an explicit new test in this phase | Common Pitfalls (Pitfall 3) | If wrong, an explicit test asserting "no fetch call when `manifests: []`" would be added defending behavior nobody actually depends on — low cost either way, but worth the planner confirming intent rather than research asserting it as settled product behavior. |

## Open Questions

1. **Should a malformed `dapps` config fall through to try `manifests`/`registryUrl`, or fail
   closed?**
   - What we know: ROB-05's registry-tier precedent fails closed (`return []`), but it's the
     terminal tier with nothing to fall through *to* — that precedent doesn't disambiguate the
     non-terminal-tier case.
   - What's unclear: Whether "fail closed, don't guess which config source was intended" or
     "best-effort fall through to the next configured source" is the more helpful behavior for a
     developer who fat-fingered their `dapps` config.
   - Recommendation: Fail closed (matches "never silent" — falling through would silently swap
     config sources, which is arguably *more* surprising than an empty manifest list with a
     loud `dx:error`). Confirm during plan-check/discuss-phase before locking in — this is
     Assumption A1.

2. **Should this phase register `ROB-06` in `REQUIREMENTS.md`, or a `CR-01` ID matching the
   audit's own label?**
   - What we know: The project's existing naming convention uses feature-prefixed IDs
     (`ROB-05`, `TOOL-01`, `FCT-01`) tied to the *milestone's* requirement categories, not the
     audit's internal tech-debt numbering (`CR-01` there is itself a recycled label — a
     different `CR-01` already exists in the v1.0/Phase-6 decision log, "Node engines bump...
     closing CR-01" — reusing `CR-01` as a v1.1 requirement ID would collide with that unrelated
     prior usage).
   - What's unclear: Whether the milestone considers this new work still "v1.1" scope (the
     milestone's own audit already passed/closed) or effectively a new mini-milestone/patch.
   - Recommendation: Register `ROB-06` under the existing "Robustness" category in
     `REQUIREMENTS.md`'s v1 Requirements section, phrased analogously to `ROB-05`:
     *"`loadManifests()`'s `dapps` and inline `manifests` tiers validate array shape via a
     shared `coerceManifestArray()` helper; a wrong-shape value emits `dx:error` (source
     `shell:manifest`) instead of throwing before `window.__DXKIT__` is exposed."* Add a
     Traceability row (`ROB-06 | Phase 10 | Complete` once done). This is Assumption A2.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependency beyond the toolchain
already verified and pinned by Phases 6–9 (Node ≥22.12, pnpm, vitest 4.1.10, happy-dom,
Biome — all already installed and in use by the existing test suite this phase extends).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (`vitest.config.ts`, `environment: 'happy-dom'`) |
| Config file | `/Users/derks/Development/Denizen/dxkit/vitest.config.ts` |
| Quick run command | `npx vitest run tests/shell.test.ts` |
| Full suite command | `make test` (lint → typecheck → `npx vitest run`) |

### Phase Requirements → Test Map

No formally registered requirement ID exists yet (see Open Question 2 / Assumption A2) — this
table anticipates the recommended `ROB-06` ID so the planner can wire it directly.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROB-06 | `dapps: <non-array>` (truthy-length, no `.map` — e.g. a string) emits `dx:error` (source `shell:manifest`), `init()` resolves without throwing, `getManifests()` is empty | unit | `npx vitest run tests/shell.test.ts -t "dapps"` | ✅ existing file, add case |
| ROB-06 | `dapps: <non-array>` (falsy `.length` — e.g. a plain object) also emits `dx:error` rather than silently falling through to `manifests`/registry | unit | `npx vitest run tests/shell.test.ts -t "dapps"` | ✅ existing file, add case |
| ROB-06 | `manifests: <non-array>` (non-iterable, e.g. a plain object) emits `dx:error`, `init()` resolves without throwing | unit | `npx vitest run tests/shell.test.ts -t "manifests"` | ✅ existing file, add case |
| ROB-06 | `manifests: <non-array>` (iterable-but-wrong-shape, e.g. a string) emits exactly one `dx:error` for the shape, not N per-character validation errors | unit | `npx vitest run tests/shell.test.ts -t "manifests"` | ✅ existing file, add case |
| ROB-06 | `window.__DXKIT__` is still defined after `init()` for every wrong-shape case above (pre-exposure ordering) | unit | `npx vitest run tests/shell.test.ts -t "still exposes"` | ✅ existing file, add case (mirrors ROB-05's line-532 test) |
| ROB-06 | Valid `dapps`/`manifests` arrays (including `[]`) flow through unchanged — no new `dx:error`, no behavior change | unit (regression) | `npx vitest run tests/shell.test.ts` | ✅ already covered by existing happy-path tests (lines 275, 305, and the many `manifests: [...]` cases) — re-run as regression gate, no new file needed |
| ROB-06 (Pitfall 3 coverage) | `manifests: []` does not trigger a `fetch()` call to `registryUrl` | unit (new coverage gap) | `npx vitest run tests/shell.test.ts -t "manifests"` | ❌ Wave 0 gap — not explicitly asserted today |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/shell.test.ts`
- **Per wave merge:** `make test`
- **Phase gate:** `make test` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New test cases in `tests/shell.test.ts` for `dapps: <non-array>` (both the throw-today and
      silent-fallthrough-today failure modes) — file exists, needs new `it(...)` blocks near the
      existing ROB-05 block (lines 481–579).
- [ ] New test cases for `manifests: <non-array>` (both the throw-today and
      iterates-as-string-today failure modes) — same file, same location.
- [ ] New test asserting `manifests: []` does not call `fetch()` (closes the Pitfall 3 coverage
      gap — this test doesn't exist today even for the *current*, pre-fix behavior).
- [ ] No new fixtures/mocks needed — `testLoaders`, `onDxError()`, and the `window.fetch` mock
      pattern already used throughout the file (e.g. lines 394–405) cover every new case.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not touched by this phase |
| V3 Session Management | No | Not touched by this phase |
| V4 Access Control | No | Not touched by this phase |
| V5 Input Validation | Yes | Native `Array.isArray()` type-shape check on developer-supplied config (`dapps`, `manifests`) and on fetched JSON (`registryUrl` response) before any iteration/property access — exactly the ASVS V5 concern (validate structure of untrusted/external input before use). No schema library needed; this is a single structural invariant, not field-level content validation (which `isValidManifest()` already owns downstream, untouched) |
| V6 Cryptography | No | Not touched by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Untrusted/malformed JSON response (`registryUrl` fetch) or malformed static-HTML `<script>`-inlined config (`dapps`/`manifests`) causing a client-side uncaught exception that prevents `window.__DXKIT__` from ever being exposed | Denial of Service (client-side availability) | `coerceManifestArray()`'s fail-closed-and-visible pattern: never trust the shape of an external/developer-supplied value before iterating it; always emit an observable error and continue with a safe empty default rather than throwing. This is the same mitigation ROB-05 already applied to the `registryUrl` tier — this phase is a direct extension, not a new mitigation pattern |

This is a low-severity, availability-only concern for a headless, DOM-free client framework — no
data exfiltration, auth bypass, or injection vector is introduced or closed by this phase. It is
included per `security_enforcement: true` / ASVS level 1 in `.planning/config.json`, not because
a high-severity issue exists.

## Sources

### Primary (HIGH confidence — direct codebase read, this session)
- `/Users/derks/Development/Denizen/dxkit/src/shell.ts` (lines 1–572, full file) — exact current
  `loadManifests()` implementation, ROB-05's existing registry-tier guard, `init()` ordering
  relative to `window.__DXKIT__` exposure, `normalizeAndValidateManifests()`'s untouched scope
- `/Users/derks/Development/Denizen/dxkit/tests/shell.test.ts` (lines 1–60, 380–579) — existing
  ROB-05 regression test structure, `onDxError()` helper, `testLoaders` fixture pattern
- `/Users/derks/Development/Denizen/dxkit/src/types/shell.ts` — `ShellConfig`/`DappEntry`/`Shell`
  interface shapes (`dapps?: DappEntry[]`, `manifests?: DappManifest[]`)
- `/Users/derks/Development/Denizen/dxkit/src/types/manifest.ts` — `DappManifest` shape
- `/Users/derks/Development/Denizen/dxkit/docs/events-reference.md` (lines 181–187) — existing
  `shell:manifest` error catalog rows, confirming the message-format precedent and that this
  phase will need a new catalog row (owned by `/gsd-docs-update`, not this phase's plan directly,
  but noted so the planner doesn't overlook the doc-gate dependency)
- `/Users/derks/Development/Denizen/dxkit/.planning/v1.1-MILESTONE-AUDIT.md` — authoritative
  CR-01 scope statement (Tech Debt item #1)
- `/Users/derks/Development/Denizen/dxkit/.planning/STATE.md` — Phase 09-04 ROB-05 decision log
  (D-10/P2 ungating decision, single-choke-point decision for
  `normalizeAndValidateManifests()`)
- `/Users/derks/Development/Denizen/dxkit/.planning/REQUIREMENTS.md` — existing requirement ID
  scheme and traceability table
- `/Users/derks/Development/Denizen/dxkit/package.json`, `/Users/derks/Development/Denizen/dxkit/vitest.config.ts`,
  `/Users/derks/Development/Denizen/dxkit/Makefile` — test commands and framework version

### Secondary (MEDIUM confidence)
None used — no web/external documentation lookup was needed for this phase; the entire problem
space is internal to this repository.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external stack involved, confirmed zero-new-dependency scope by reading `CLAUDE.md`/`.claude/CLAUDE.md` constraints and the existing `package.json`
- Architecture: HIGH — exact current code paths read directly from `src/shell.ts`; recommended restructure is a direct, minimal extension of the already-shipped ROB-05 pattern
- Pitfalls: HIGH — the tier-asymmetry (Pitfall 3) and null-vs-empty-array (Pitfall 2) pitfalls were derived by tracing the exact current conditionals (`dappEntries?.length` vs `if (inlineManifests)`), not inferred generically

**Research date:** 2026-07-19
**Valid until:** No expiry driver — this is internal-codebase research tied to the current state
of `src/shell.ts`; valid until that file changes again (e.g. if a future phase further refactors
`loadManifests()` before Phase 10 executes, this research should be re-verified against the
diff).

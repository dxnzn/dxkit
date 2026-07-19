---
phase: 10-close-gap-cr-01-guard-dapps-inline-manifests-tiers
reviewed: 2026-07-19T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/shell.ts
  - tests/shell.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the Phase 10 diff extending ROB-05's registry-only array-shape guard to the `dapps` and
inline `manifests` tiers via the new closure-local `coerceManifestArray<T>()` helper, plus the
restructured three-tier `loadManifests()` and the six new ROB-06 regression tests.

I traced every documented invariant by hand against the actual diff (`git diff
cb09506f09c91a73b859b80f98f95eb7e62802fd^..HEAD -- src/shell.ts tests/shell.test.ts`):

- **Tier-asymmetric fallthrough** — correctly implemented. `dapps: []` (real, empty array) falls
  through past the `if (coerced.length)` check to the next tier; `manifests: []` returns
  immediately without probing `registryUrl`. Confirmed correct by manual trace of both branches.
- **Fail-closed via `coerced === null`** — correctly implemented in all three tiers; none of the
  three call sites branch on `.length` to detect a shape failure.
- **Single `dx:error` emission point** — confirmed. `coerceManifestArray()` is the only place that
  emits the "wrong top-level shape" error, called exactly once per `loadManifests()` invocation
  (each tier returns before falling into another tier's coercion call). The string-`manifests`
  regression test (`ROB-06: manifests as an iterable-but-wrong-shape value (string)...`) confirms
  exactly one `shell:manifest` error, not one per character.
- **Precondition, not try/catch** — confirmed. The guard runs as an explicit shape check before any
  `.map()`/iteration touches the value; it is not wrapping a try/catch around an iteration failure.
- **`normalizeAndValidateManifests()` untouched** — confirmed by diff; zero lines changed in that
  function.
- **Zero new runtime deps, closure-local helper** — confirmed. `coerceManifestArray` is a plain
  function declaration inside `createShell()`'s closure, referencing `events` from the enclosing
  scope; no new imports or dependencies were added.

The implementation itself is correct on the invariants that matter most. The two findings below are
both **test-coverage / message-quality gaps**, not functional regressions — nothing here changes my
overall assessment that the core fix is sound, but both are real defects worth fixing before this
ships.

## Warnings

### WR-01: `dapps: []` fallthrough — the phase's own locked must-have — has zero regression-test coverage

**File:** `tests/shell.test.ts` (whole file — no matching test exists)
**Issue:** The plan's `must_haves.truths` (`.planning/phases/10-.../10-01-PLAN.md`) explicitly locks:
`"dapps: [] (valid, empty) still falls through to the next configured tier (existing behavior
preserved)."` This is also the exact tier-asymmetric behavior called out as highest-value to verify
in this review. I confirmed by manual trace that `src/shell.ts`'s `loadManifests()` does implement
this correctly (`if (coerced.length)` gates the fetch-and-return; an empty coerced array falls
through the `if` block to the `inlineManifests`/`registryUrl` tiers below). However, no test in
`tests/shell.test.ts` exercises `dapps: []` at all — `grep -n "dapps: \[\]"` returns nothing. The
phase's own summary (`10-01-SUMMARY.md`) claims coverage of "all 7 ROB-06 behaviors" but only lists
6 new tests (D1–D6), and D6 only covers the `manifests: []` no-fetch case, not the `dapps: []`
fallthrough case. The symmetric counterpart (`ROB-06: manifests: [] ... stops at that tier`, line
648) exists; there is no `ROB-06: dapps: [] ... falls through` counterpart.

This means the single most subtle, easy-to-accidentally-invert behavior in this diff — the tier
asymmetry itself — currently ships with no regression test protecting it. A future refactor that
"fixes" the perceived asymmetry (e.g. someone unifies both tiers to stop on `[]`, or flips the
`.length` check) would pass the entire existing suite and silently break dapp-entry configs that
rely on falling through to inline manifests or the registry when `dapps` resolves to an empty list.

**Fix:** Add a test mirroring the existing `manifests: []` one, asserting the opposite outcome:

```ts
it('ROB-06: dapps: [] (valid, empty) falls through to the next configured tier', async () => {
  const manifest: DappManifest = {
    id: 'fallback',
    name: 'Fallback',
    version: '0.0.1',
    route: '/fallback',
    entry: 'data:text/javascript,',
    nav: { label: 'Fallback' },
  };

  shell = createShell({ ...testLoaders, dapps: [], manifests: [manifest] });
  await shell.init();

  expect(shell.getManifests()).toHaveLength(1);
  expect(shell.getManifests()[0].id).toBe('fallback');
});
```

(A second variant asserting `dapps: []` falls all the way through to a registry `fetch()` call when
`manifests` is also absent would close the gap completely.)

### WR-02: Registry-tier error message is grammatically broken due to `tierLabel` parameter reuse

**File:** `src/shell.ts:307` (call site), `src/shell.ts:197-207` (`coerceManifestArray` template)
**Issue:** `coerceManifestArray`'s message template is `` `Invalid ${tierLabel} config — expected an
array, got ${...}` ``, designed for a short noun-phrase label (`'dapps'`, `'manifests'`). The
registry call site instead passes a full sentence as `tierLabel`:

```ts
const coerced = coerceManifestArray<DappManifest>(parsed, `Failed to load registry from ${registryUrl}`);
```

Composed, this produces:

> `Invalid Failed to load registry from /custom-registry.json config — expected an array, got object`

This is not valid English and reads as a rendering bug to anyone consuming the `dx:error` message
(console, logging pipeline, error-tracking UI). It passes tests only because the assertions use
`.includes(...)` substring matching on the URL, not the full message — the commit's own author
acknowledged the tradeoff in `10-01-SUMMARY.md` ("at the cost of a slightly awkward combined
message") but the result is worse than "slightly awkward": it's incoherent, and it also silently
drops the previous message's more specific wording (`"expected a JSON array of manifests"` →
generic `"expected an array"`), losing information for anyone debugging a misconfigured registry
endpoint. This directly cuts against the project's stated core value that "failures are visible" —
visible-but-garbled undermines that goal.

**Fix:** Give `coerceManifestArray` two parameters instead of overloading one — a short tier label
for the generic phrasing, and let the registry call site build its own full message using the same
underlying detail, e.g.:

```ts
function coerceManifestArray<T>(value: unknown, tierLabel: string): T[] | null {
  if (Array.isArray(value)) return value;
  events.emit('dx:error', {
    source: 'shell:manifest',
    error: new Error(
      `Invalid ${tierLabel} — expected an array, got ${value === null ? 'null' : typeof value}`,
    ),
  });
  return null;
}

// registry tier:
const coerced = coerceManifestArray<DappManifest>(
  parsed,
  `registry response from ${registryUrl} (expected a JSON array of manifests)`,
);
```
which renders as `Invalid registry response from /custom-registry.json (expected a JSON array of
manifests) — expected an array, got object` — still not perfect, but grammatically sound. Simplest
fix: drop the leading `"Invalid "` /`"config"` wrapper entirely from the template and have each call
site supply its own complete sentence, since the registry tier already needs one.

## Info

### IN-01: `coerceManifestArray` name implies a transformation it doesn't perform

**File:** `src/shell.ts:197`
**Issue:** The function neither coerces nor transforms its input — it validates the top-level shape
and returns the value unchanged (or `null`). "Coerce" typically implies type conversion (e.g.
`String(x)`, `Number(x)`), which could mislead a future reader into expecting normalization/parsing
behavior that isn't there (contrast with `normalizeRoute`, which genuinely transforms its input).
**Fix:** Consider a name like `validateManifestArrayShape` or `assertManifestArrayShape` to match
its actual behavior (shape-check + fail-closed, no transformation). Non-blocking — the existing
JSDoc-style comment above the function adequately documents the real behavior for anyone who reads
it, this is purely a naming-clarity nit.

---

_Reviewed: 2026-07-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

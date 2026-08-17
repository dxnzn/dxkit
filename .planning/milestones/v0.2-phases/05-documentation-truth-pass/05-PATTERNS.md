# Phase 5: Documentation — Truth Pass - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 5 (3 code files modified, 2 test files modified) + 1 new doc file
**Analogs found:** 5 / 5 (all analogs are internal — same-file sibling patterns; this phase adds no new architectural surface)

This phase is 95% prose editing (14 docs + README, no analog needed — see CONTEXT.md D-14 for
voice exemplar). Pattern mapping below covers only the code/test surface: the three folded fixes
(D-15, D-16, D-17) and their regression tests, plus the one new doc file's structural analog.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/shell.ts` (D-15: `loadManifests()` registry catch, `:237-244`) | service (internal fn) | request-response (fetch + error surfacing) | `src/shell.ts` `loadDappManifest()` (`:184-224`, same file) | exact — same function family, same error-emit convention |
| `src/shell.ts` (D-16: `disableDapp()`, `:129-146`) | service (internal fn) | event-driven (state mutation → router side-effect) | `src/shell.ts` `rebuildRouter()` (`:97-117`, same file) | exact — the navigate-to-`/` branch being mirrored |
| `src/lifecycle.ts` (D-17: `mount()` bare `isStale()` gates, `:352`, `:372`, `:396`, `:415`) | service (internal fn) | event-driven (generation-guarded async state machine) | `src/lifecycle.ts` `mount()`'s own catch blocks (`:341-349`, `:362-371`, `:383-395`, `:404-414`, same file) | exact — same function, the catch-block clearing pattern is the template for the bare-gate fix |
| `tests/shell.test.ts` (D-15/D-16 regression tests + D-17 listener-cleanup nit) | test | request-response / event-driven | `tests/shell.test.ts` existing WR-01 tests (`:310-372`) and `dx:ready`/`dx:plugin:registered` cleanup tests (`:41-69`) | exact — same file, established idioms |
| `tests/router.test.ts` (D-17 rename nit, `:163-172`) | test | transform | `tests/router.test.ts` sibling test (`:153-160`) | exact — same file, adjacent test |
| `docs/security.md` (new) | doc | n/a | `README.md` doc-table row structure + existing doc voice (no code analog) | n/a — structural/voice analog only |

## Pattern Assignments

### `src/shell.ts` — D-15 registry.json failure emit (`loadManifests()`, `:237-244`)

**Analog:** `loadDappManifest()`, same file, `:184-224` — the established two-message `dx:error`
split for manifest-tier failures (non-OK vs throw/parse).

**Current code to replace** (`:237-244`):
```typescript
try {
  const res = await fetch(registryUrl);
  if (res.ok) {
    return await res.json();
  }
} catch {
  // No registry.json — that's fine
}

return [];
```

**Non-OK pattern to mirror** (`:187-196`):
```typescript
if (!res.ok) {
  const statusInfo = typeof res.status === 'number' ? ` (status ${res.status})` : '';
  events.emit('dx:error', {
    source: 'shell:manifest',
    error: new Error(`Failed to fetch manifest from ${entry.manifest}${statusInfo} — non-OK response`),
  });
  return null;
}
```

**Throw/parse-failure pattern to mirror** (`:211-223`):
```typescript
} catch (err) {
  events.emit('dx:error', {
    source: 'shell:manifest',
    error: new Error(
      `Failed to load manifest from ${entry.manifest} — request failed or response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    ),
  });
  return null;
}
```

**Required addition — presence-of-`registryUrl` check.** The destructure at `:35` already applies
a default, erasing whether the caller passed it. Mirror the existing `Object.hasOwn` presence
pattern used for the D-05 flat-loader guard (`:20-23`):
```typescript
const flatLoaderKeys = ['scriptLoader', 'styleLoader', 'templateLoader'] as const;
const presentFlatKeys = flatLoaderKeys.filter((key) => Object.hasOwn(config, key));
```
Apply the same `Object.hasOwn(config, 'registryUrl')` check (captured before/independent of the
`registryUrl = '/registry.json'` destructure default) to gate the new emit — emit only when true.

**Wiring:** RESEARCH.md's Open Question #1 recommends mirroring `loadDappManifest()`'s two-message
split (status-info message for non-OK, unified network/parse message for the catch) — this is
Claude's Discretion per CONTEXT.md.

---

### `src/shell.ts` — D-16 disable-mid-flight navigates to `/` (`disableDapp()`, `:129-146`)

**Analog:** `rebuildRouter()`, same file, `:97-117` — the existing navigate-to-`/` branch for the
committed-mount disable path.

**Template branch to mirror** (`:109-116`):
```typescript
// If the current dapp was disabled, unmount and return to root
if (currentDapp) {
  const stillEnabled = getEnabledManifests().some((m) => m.id === currentDapp);
  if (!stillEnabled) {
    lifecycle.unmount();
    router.navigate('/');
  }
}
```

**Current `disableDapp()`** (`:129-146`) calls `lifecycle.invalidatePendingMount(id)` (`:139`),
conditionally `releasePendingMount()` (`:142`), then `rebuildRouter()` (`:143`) — but
`rebuildRouter()`'s branch gates on `lifecycle.getCurrentDapp()` being non-null, which is `null`
for an in-flight (not-yet-committed) mount, so no navigate happens in that case today.

**Fix shape (per RESEARCH.md Folded-Fix Landing Sites → D-16):** add a second condition in
`disableDapp()` (or a parameter threaded into `rebuildRouter()`) that detects "the
currently-resolved route belongs to the disabled dapp AND nothing was committed" and navigates to
`/` in that case too. Use the same `resolve(router.getCurrentPath())` check `init()` already uses
(`:359`, read separately if needed) rather than adding new router API — this keeps the fix
consistent with the codebase's existing pattern of checking route ownership via `router.resolve()`
rather than a new lookup method.

**Test analog:** mirror the slow-loader / in-flight-mount stress pattern in `tests/stress.test.ts`
(same technique used for other in-flight-mount assertions) combined with the existing committed-
mount disable test in `tests/shell.test.ts` for the assertion shape (`expect(...).toBe('/')` on
final location).

---

### `src/lifecycle.ts` — D-17 inFlightMountId hygiene (`mount()`, bare gates at `:352`, `:372`, `:396`, `:415`)

**Analog:** the four catch blocks in the same function, same file — `:341-349` (template catch),
`:362-371` (sanitize catch), `:383-395` (dependency catch), `:404-414` (entry catch) — all clear
`inFlightMountId = null` inside `if (!isStale())`.

**Catch-block pattern to mirror** (representative excerpt, `:404-414`-ish shape — verify exact
lines at implementation time since file has moved since todo filing):
```typescript
if (!isStale()) {
  events.emit('dx:error', { source: `lifecycle:${manifest.id}`, error: ... });
  inFlightMountId = null;
}
```

**Bare gates that currently do NOT clear** (need the ownership-aware fix):
```typescript
if (isStale()) return false;
```
appears standalone at `:352`, `:372`, `:396`, `:415` with no `inFlightMountId` handling.

**Required fix — track a generation alongside `inFlightMountId`**, mirroring the existing
`pendingMountToken`/`pendingMountId` call-scoped-ownership pattern already used in `src/shell.ts`
(`:58-61`, `:139-142`):
```typescript
// src/shell.ts — the ownership-token pattern to mirror inside lifecycle.ts's own generation var
let pendingMountId: string | null = null;
let pendingMountToken = 0;
// ... later, only clear if this call still owns the slot:
if (pendingMountId === id) releasePendingMount();
```
Apply the equivalent to `inFlightMountId`: capture the generation that set it, and only null it
out on a bare-gate return if the returning call's `generation` still matches what's stored
alongside `inFlightMountId` (not just `mountGeneration`, which changes on every new call).

**Test analog:** `invalidateAnyPendingMount()` (`:454-469`) and its existing comment "No-op when
nothing is in flight" (`:465`) — the new unit test should assert `inFlightMountId` reflects only
the current (non-superseded) call's state after two overlapping `mount()` calls where the first is
invalidated via a bare-gate path (not a catch path).

---

### `tests/shell.test.ts` — D-15/D-16 regression tests + D-17 listener-cleanup nit

**Analog for D-15 tests:** existing WR-01 tests, `:310-372` — three tests (non-OK, throw, parse-
failure), each following this shape:
```typescript
it('...', async () => {
  const errors: { source: string; error: Error }[] = [];
  window.addEventListener('dx:error', ((e: CustomEvent) => {
    errors.push(e.detail);
  }) as EventListener);

  const originalFetch = window.fetch;
  window.fetch = vi.fn(async () => (/* fixture response */)) as any;

  shell = createShell({ ...testLoaders, /* config under test */ });
  await shell.init();

  expect(/* assertion */);
  expect(errors.some((e) => e.source === 'shell:manifest')).toBe(true);

  window.fetch = originalFetch;
});
```
Extend this pattern for: explicit `registryUrl` + non-OK / throw / parse-failure (3 tests, each
asserting `errors.some(e => e.source === 'shell:manifest')` is true), plus one test with default
`registryUrl` (omitted) asserting **no** `dx:error` fires and `getManifests()` returns `[]`.

**Analog for D-16 test:** combine the WR-01 fetch-mocking shape above with `tests/stress.test.ts`'s
slow-loader technique (grep that file for the delayed-promise pattern used for in-flight-mount
races) to hold a mount in flight, call `disableDapp()` mid-flight, then assert
`window.location.pathname` (or router's current path) is `/`.

**Analog for D-17 listener-cleanup nit:** the cleaned-up pattern at `:41-69` (`dx:ready`,
`dx:plugin:registered` tests) —
```typescript
window.addEventListener('dx:ready', handler);
await shell.init();
window.removeEventListener('dx:ready', handler);
```
Apply matching `window.removeEventListener('dx:error', handler)` calls to every uncleaned site
(`:119-121`, `:312-314`, `:333-335`, `:353-355`, `:390-392`, `:405-407`, `:573-575`, and others —
grep `addEventListener('dx:error'` in this file for the full list) — or factor a shared
`beforeEach`/`afterEach` helper if the count makes inline cleanup unwieldy.

---

### `tests/router.test.ts` — D-17 confusing manifest-ids nit (`:163-172`)

**Analog:** the adjacent, correctly-named sibling test at `:153-160` (uses `id: 'first'`,
`id: 'second'` in intuitive array order).

**Current (confusing) code** (`:163-172`):
```typescript
it('resolve() still returns the first-registered manifest when input order is reversed', () => {
  const router = createRouter({
    manifests: [manifest({ id: 'second', route: '/dup' }), manifest({ id: 'first', route: '/dup' })],
  });
  expect(router.resolve('/dup')?.id).toBe('second');
});
```
The assertion is correct (first-array-position wins) but naming the first-position manifest
`'second'` reads like a contradiction. Fix: rename to order-neutral ids (e.g. `'alpha'`/`'beta'`)
or add a one-line clarifying comment above the assertion — do not change the test's logic/assertion.

---

### `docs/security.md` (new file) — structural/voice analog

**No code analog** — this is net-new content (D-08). Pattern to follow:

**README doc-table row structure** (`README.md`, the `### Framework` table under `## Documentation`):
```markdown
| DOCUMENT | DESCRIPTION |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Framework overview, core concepts, lifecycle, config, full sample project |
```
Add a `docs/security.md` row in this same table (per D-08, "gets a row in the README doc table"),
one-line description in the same terse register as the existing rows (no "comprehensive guide to"
throat-clearing — see D-13 slop bar).

**Voice exemplar (D-14):** README's terse "DNZN //" register — short declarative sentences, no
"simply/just/powerful," no benefits-selling. Existing docs to sample the register from directly:
`docs/getting-started.md`'s opening section and `docs/configuration.md`'s existing DOMPurify
snippet (`:68-75`, already correct per RESEARCH.md) for how a concrete code example is framed with
minimal surrounding prose.

**Content source (not a code pattern, but the input material):** `.planning/codebase/CONCERNS.md`
sections "No Content Security Policy Guidance," "XSS Risk in Template Injection," "Settings
Storage Lacks Encryption," "IIFE Builds Attach to Global Namespace," "Window Event Listeners Not
Cleaned Up on Shell Reuse," "Known Limitations" — per D-11's inventory list.

**CSP/DOMPurify code example patterns** — RESEARCH.md already contains both consumption-mode
snippets verified against source (ESM matches `docs/configuration.md:68-75`; IIFE is net-new but
follows the same `.sanitize(html)` call shape) — reuse those two snippets verbatim as the anchor
examples, then add the CSP header/meta-tag policy blocks per D-09 (with the Pitfall-4 meta-tag
directive-support caveat: `frame-ancestors`/`report-uri`/`sandbox` are NOT meta-safe).

## Shared Patterns

### `dx:error` emit shape (applies to D-15's new emit site)
**Source:** `src/shell.ts` — every existing `events.emit('dx:error', ...)` call site (11 in this
file alone; see RESEARCH.md's Event Catalog table for the full 22-row cross-codebase catalog).
**Apply to:** the new D-15 registry-failure emit.
```typescript
events.emit('dx:error', {
  source: 'shell:manifest',
  error: new Error('<descriptive message with context>' /* , { cause: err } when wrapping a caught error */),
});
```
Convention: always a genuine `Error` instance; non-Error throws get wrapped
(`new Error(String(err))`); sites that catch an original error thread it via `{ cause: err }`.

### Call-scoped ownership tokens (applies to D-16 and D-17)
**Source:** `src/shell.ts:58-61` (`pendingMountId` / `pendingMountToken`) and `:139-142`
(`if (pendingMountId === id) releasePendingMount()`).
**Apply to:** D-17's `inFlightMountId` generation-tracking fix in `src/lifecycle.ts` — same
"only the owning call may clear the shared slot" invariant, just enforced with a paired
id/generation instead of an incrementing token.

### Test fetch-mocking idiom (applies to D-15 regression tests)
**Source:** `tests/shell.test.ts:316-319` (save `window.fetch`, replace with `vi.fn`, restore in
a `finally`-equivalent trailing line before the test ends).
**Apply to:** all six new D-15 tests (3 explicit-registryUrl failure modes + 3 default-silent
variants can share fixtures with the existing WR-01 tests' response-mocking style).

## No Analog Found

None — every code/test file in this phase's surface has a same-file or same-repo sibling analog.
`docs/security.md` has no *code* analog by design (it is net-new prose content); its structural
analog (README table row) and voice analog (existing docs) are documented above in lieu of a
missing-analog entry.

## Metadata

**Analog search scope:** `src/shell.ts`, `src/lifecycle.ts`, `tests/shell.test.ts`,
`tests/router.test.ts`, `tests/stress.test.ts` (referenced for slow-loader pattern), `README.md`
(doc-table structure), `docs/configuration.md` (DOMPurify snippet reuse).
**Files scanned:** 7 (5 read directly this session, 2 referenced from RESEARCH.md's prior grep/read work)
**Pattern extraction date:** 2026-07-14

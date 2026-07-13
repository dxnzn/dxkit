# Phase 4: Testing — Stress, Edge-Case & Regression Coverage - Research

**Researched:** 2026-07-13
**Domain:** Concurrency/race-condition correctness (vanilla async TS), manifest/route validation policy, vitest fake-timer + deferred-promise test technique
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**TEST-01 — Race invariants (and the fix they require)**
- **D-01 (last navigation wins):** Under concurrent mounts, the final DOM and `lifecycle.getCurrentDapp()` MUST match the most recent navigation. Stale in-flight mounts must not complete — they must not inject DOM, set `currentDappId`, or emit `dx:mount`. Current code fails this (whichever mount finishes last wins); the fix lands in this phase. Fix shape (e.g. a mount-generation/epoch token checked before injection) is Claude's discretion.
- **D-02 (strict event alternation):** Tests assert the full observable stream: every `dx:mount` is followed by that dapp's `dx:unmount` before any other `dx:mount` fires. Superseded in-flight mounts emit neither event.
- **D-03 (race scenario matrix):** Beyond rapid A→B→A, the stress suite covers all four additional interleavings:
  1. `disableDapp()` while that dapp's mount is in flight (router rebuild + unmount racing the pending mount).
  2. A load timeout (Phase 2's 30s guard) firing after the user already navigated away — the abort must not clear the *new* dapp's DOM or emit misattributed `dx:error`.
  3. Sub-path navigation into dapp A while A's initial mount is still loading (`dx:route:subpath` vs `pendingMountId` interaction).
  4. `shell.init()`'s initial-route mount racing an immediate first navigation.

**Bug-fix policy**
- **D-04 (race fix in-phase):** The known mount race is fixed in this phase, together with the stress tests that prove it. No known-failing (`test.fails`) assertions land.
- **D-05 (correctness bugs fix in-phase):** Any further race/correctness/lost-event bug the new tests surface is fixed in-phase with its test. Only out-of-scope findings (feature requests, design questions) are filed as todos. The suite ships green.

**TEST-02 — Manifest validation policy**
- **D-06 (route normalization + reject unfixable):** Manifest routes get the same normalization rules as `normalizePath` (`src/router.ts:27-39`: ensure leading slash, strip trailing slash) applied at router construction, so `"blog"` → `"/blog"` just works instead of being a silently-dead route. Empty/garbage routes that normalization can't fix are rejected with `dx:error`. This is a behavior change justified by the milestone's no-silent-failures charter.
- **D-07 (validate all three tiers):** `isValidManifest` currently guards only the dapp-entries tier — inline manifests and `registry.json` results flow through unvalidated. All three tiers now validate; invalid manifests are discarded with the same `shell:manifest` `dx:error`.
- **D-08 (duplicate routes — first wins + dx:error):** Two manifests with the same exact route keep deterministic first-registered-wins resolution, but the shell emits `dx:error` naming the conflicting ids so the collision is visible. Tests assert both the winner and the emit. Overlapping-prefix multi-match (`/tools` vs `/tools/sender`) stays longest-route-wins and gets asserted as-is.
- **D-09 (deepMerge — assert documented semantics):** Override-merge tests lock the documented `deepMerge` contract: nested objects merge recursively, arrays in overrides replace wholesale, `null`/`undefined` values are skipped, `__proto__`/`constructor`/`prototype` keys are ignored (pollution guard).

**TEST-03 — Settings-cleanup regression depth**
- **D-10 (full-shell integration):** The regression drives the real path — `createShell` → mount dapp → register settings handlers via the actual plugin → `disableDapp()` → assert handlers neither fire nor leak — through the real `dx:dapp:disabled` wiring, not a mocked context.

**Suite organization & technique**
- **D-11 (dedicated stress file):** Concurrency/race scenarios live in a new dedicated test file (e.g. `tests/stress.test.ts`); manifest edge cases extend `tests/shell.test.ts` / `tests/router.test.ts` where those behaviors already live.
- **D-12 (deferred promises + targeted fake timers):** Slow loaders are simulated with manually-resolved deferred-promise loader fixtures for exact interleaving control (resolve B before A on demand). `vi.useFakeTimers` is used only where the timeout clock matters. No real-delay (`setTimeout(5ms)`) timing-dependent tests.

### Claude's Discretion
- The race-fix mechanism (mount-generation token vs abort-signal plumbing vs queue) — so long as D-01/D-02 invariants hold and the change stays within the zero-runtime-deps / no-bundler constraints.
- Where route normalization/rejection executes (router construction vs manifest load) and the exact `dx:error` source strings for new emits — follow the established colon-hierarchical taxonomy (`shell:manifest`, `shell:route`, etc.).
- Exact stress-file name and internal describe-block structure, consistent with existing suite conventions.
- WR-01 error-source/message wording, mirroring the existing validation-failure emit at `src/shell.ts:177-185`.
- Whether behavior-change commits (route normalization, tier validation, duplicate emit) warrant `BREAKING CHANGE:` footers — judge each against the milestone rule (justified + migration notes); the race fix is a straight bug fix.

### Deferred Ideas (OUT OF SCOPE)
- Docs for the new/changed behavior (route normalization rules, duplicate-route emit, manifest-tier validation, race semantics) — Phase 5 (DOC-01) verifies docs against final 0.2.0 code; migration notes still ship with any breaking commits in this phase.
- Coverage thresholds/reporters in vitest config — out of scope for this phase (no requirement backs it).
- Wildcard/regex/`:param` routes — out of milestone (ROUTE-01, v2); route-format policy here deliberately avoids constraining that future design.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Stress tests cover concurrent navigation and mount races (rapid A→B→A with slow loaders) without double-mount or lost-unmount | See "Architecture Patterns" (mount-generation guard) and "Code Examples" for the fix shape + deferred-promise interleaving-control technique; "Common Pitfalls" for race-test flakiness traps |
| TEST-02 | Manifest-validation edge cases are tested (invalid route formats, deep-merge overrides, multi-match routes) | See "Manifest & Route Validation Design" for normalization/reject-unfixable policy, tier-parity fix site, and duplicate-route detection design |
| TEST-03 | Tests verify settings-handler cleanup on `disableDapp()` (handlers do not fire after disable) | See "TEST-03 Integration Design" — real `createShell` + real settings plugin wiring, contrasted with Phase 2's already-existing mocked-context unit tests |

WR-01 (folded todo, not a numbered requirement but in scope per CONTEXT.md) is covered under "Manifest & Route Validation Design → WR-01".
</phase_requirements>

## Summary

This phase is almost entirely internal: no new runtime dependencies, no new public API surface beyond bug fixes to existing internal control flow. The domain is (1) a genuine, already-diagnosed concurrency bug in `mountDapp()`/`lifecycle.mount()` where the *last-finishing* async mount wins instead of the *last-navigated-to* one, (2) manifest/route validation gaps where two of the three manifest-loading tiers bypass `isValidManifest` and route strings are matched verbatim with no normalization, and (3) a settings-cleanup regression test that needs to exercise the real `createShell → disableDapp() → dx:dapp:disabled` wiring instead of the mocked-context path Phase 2 already tests.

The codebase already has the raw materials for all three: `shell.ts`'s `pendingMountId` is a same-dapp dedupe guard that the race fix generalizes into a cross-dapp "mount generation" guard; `router.ts`'s `normalizePath()` already implements the exact normalization rules D-06 wants applied to manifest routes; and `tests/shell.test.ts` already has a `mount de-duplication (double-mount regression)` describe block with a `deferredEntryLoader` fixture that is the direct ancestor of the D-12 deferred-promise pattern this phase formalizes into a dedicated `tests/stress.test.ts`.

**Primary recommendation:** Fix the mount race with a monotonic generation counter owned by `lifecycle.ts` (mirroring the existing `pendingMountId` idea, generalized to cross-dapp supersession), checked immediately before every DOM-mutating or state-committing step inside `mount()` (template injection, `currentDappId` assignment, `dx:mount`/`dx:dapp:mounted` emission). Expose a `lifecycle` invalidation hook so `shell.disableDapp()` can supersede an in-flight mount that isn't yet reflected in `getCurrentDapp()` (D-03 scenario 1) — this is the one race sub-case a pure "bump-on-new-mount-call" counter does not cover on its own. Build the stress suite entirely on deferred promises + `vi.useFakeTimers()` (no real-time waits), one dedicated `tests/stress.test.ts` file per D-11.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mount-race correctness (generation guard) | Lifecycle Manager (`src/lifecycle.ts`) | Shell (`src/shell.ts`) | Lifecycle owns `currentDappId`, container mutation, and event emission — the actual commit points that must be generation-gated. Shell owns *when a new mount attempt is authorized* (navigation, disable) and must be able to invalidate a lifecycle-owned in-flight mount it didn't itself start via a fresh `mount()` call (the disable-mid-flight case). |
| Manifest tier validation (`isValidManifest`) | Shell (`src/shell.ts`) | — | All three manifest-loading tiers (`loadDappManifest`, inline `manifests`, `registry.json`) are shell-owned; validation must happen at a single choke point shell controls after `loadManifests()` resolves, regardless of tier. |
| Route normalization + reject-unfixable | Router (`src/router.ts`) construction, invoked from Shell | Shell (`src/shell.ts`) | `normalizePath()` already lives in `router.ts` and is the exact algorithm D-06 wants reused. Router has no `EventBus` dependency today (pure function module) — either thread normalization results back to shell for the reject/`dx:error` path, or accept a light coupling. See "Open Questions" for the concrete recommendation. |
| Duplicate-route detection + `dx:error` | Shell (`src/shell.ts`) | — | Duplicate detection needs the full manifest list before `createRouter()` is called (router only knows "longest-prefix wins", not "which two IDs collided") — shell is the only tier with both the raw manifest list and the event bus. |
| Settings-handler cleanup regression (TEST-03) | Plugin (`plugins/settings/src/index.ts`) | Shell (`src/shell.ts`) | Plugin owns `cleanup()` and the `dx:dapp:disabled` subscription (already shipped, Phase 2/ROB-04); shell owns the trigger (`disableDapp()` → `dx:dapp:disabled` emit) the integration test must drive end-to-end instead of mocking. |
| Stress/deferred-promise test fixtures | Test suite (`tests/stress.test.ts`) | — | New dedicated file per D-11; no production code owns test fixtures. |

## Project Constraints (from CLAUDE.md)

- **Zero runtime deps** — the race fix, validation changes, and all new tests must not introduce any `dependencies` entry; `vitest`/`happy-dom` are already `devDependencies` and sufficient for everything this phase needs (deferred promises, fake timers — both built into vitest, no new package required).
- **TS 5.8.3, strict mode, ES2022** — any new internal types (e.g. a `mountGeneration` counter, an invalidation callback) must be fully typed, no `any` beyond the existing narrow `as any` duck-typing spots already in the codebase.
- **Named exports only, factory-closure pattern** — any new lifecycle-manager internals stay inside the `createLifecycleManager()` closure; no classes, no new module-level singletons (module-level singletons are reserved for the documented loader-cache exception at `src/lifecycle.ts:15-77`... actually those are function-scoped `loaded` Sets inside each loader factory, not module-level — a new `mountGeneration` variable must likewise live inside `createLifecycleManager()`'s closure, not at module scope, or multiple shells in the same process would corrupt each other's generation count).
- **Breaking changes allowed but must be justified + carry `BREAKING CHANGE:` footer + migration notes** — per CONTEXT.md discretion, route normalization / tier validation / duplicate-route emit are behavior changes; judge each individually. The race fix itself is a straight bug fix (no footer needed) since it makes existing intended-but-broken behavior actually work, not a signature/contract change.
- **Comment the "why", one-line preferred, no `@param` JSDoc on internal functions, no section-header comments** — matches the existing style already visible throughout `lifecycle.ts` (e.g. the `withTimeout`/`withSanitizeTimeout` doc comments explaining *why* the clear-on-settle discipline exists, not what the code does line-by-line).
- **`test:` conventional-commit type** for test-only commits; phases mixing fixes + tests use `fix:`/`feat:`/`test:` scoped per the dominant change in that commit, per repo convention observed in prior phase decisions (e.g. `[Phase 03-03]` decisions in STATE.md separate the breaking-change commit from the pure test-migration commit).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.9 (pinned `^4.1.9`, verified installed) | Test runner, fake timers, mocking | Already the project's only test runner; `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync()` are already in active use in `tests/lifecycle.test.ts` for the Phase 2 timeout suite — this phase's D-12 fake-timer scenarios (timeout racing navigation) follow that exact established pattern. |
| happy-dom | 20.10.6 (verified installed) | DOM environment for `document`, `window.history`, `CustomEvent` dispatch | Already the project's only DOM shim; no change needed. |

### Supporting
None. This phase adds zero new dependencies — deferred promises and fake timers are vitest/language built-ins already used elsewhere in the suite.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual deferred-promise fixtures | `AbortController`-based cancellable loaders | Rejected: D-07 (Phase 2) already established that custom loaders are opaque/non-cancellable and only get a `Promise.race` hang guard — full cancellation plumbing through every loader signature would be a larger, unrequested API change. Deferred promises give equivalent interleaving control for tests without touching the loader contract. |
| `vi.useFakeTimers()` globally for the whole stress file | Real `setTimeout` delays | Rejected explicitly by D-12 — real-delay tests are flaky/slow; fake timers are already the established pattern for anything timeout-related in `tests/lifecycle.test.ts`. |
| A dedicated npm race-condition-testing helper (e.g. `p-defer`) | Hand-rolled deferred-promise factory (3 lines) | Rejected: `p-defer` is trivial to reimplement and would be the *only* runtime/dev dependency added for a ~3-line utility — violates the zero-dep posture for no real benefit. `Promise.withResolvers()` (ES2024, not yet guaranteed on the project's ES2022 target) is an alternative but not verified available in the pinned TS/Node target — hand-rolled `new Promise((res) => { resolve = res })` is safest. |

**Installation:** None required — no new packages.

**Version verification:** `vitest/4.1.9 linux-arm64 node-v22.22.1` confirmed installed and running in this repo `[VERIFIED: npm view / local install]`. `happy-dom ^20.10.6` and `vitest ^4.1.9` confirmed in `package.json` devDependencies `[VERIFIED: package.json]`.

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** All work is internal code (bug fixes to `src/shell.ts` / `src/lifecycle.ts` / `src/router.ts` / `src/utils.ts`) and new test files built entirely on already-installed `vitest`/`happy-dom`. No `package-legitimacy check` run was needed; nothing to audit.

## Architecture Patterns

### The Race, Precisely

```
mountDapp('A')                          mountDapp('B')                          mountDapp('A') [2nd nav back]
     |                                        |                                        |
pendingMountId='A'                            |                                        |
     |                                        |                                        |
lifecycle.mount(A) starts                     |                                        |
  currentDappId=null -> no unmount            |                                        |
  ...awaits loadScript(A.entry)... (slow)     |                                        |
     |                               pendingMountId='B' (A's finally hasn't run yet)   |
     |                               lifecycle.mount(B) starts                         |
     |                                 currentDappId=null -> no unmount (A never set it)|
     |                                 ...loadScript(B.entry) resolves fast...          |
     |                                 currentDappId='B'; emit dx:mount B               |
     |                               pendingMountId=null (B's finally)                  |
     |                                        |                              pendingMountId='A' (2nd call, allowed —
     |                                        |                               pendingMountId was cleared by B)
     |                                        |                              lifecycle.mount(A) [2nd] starts
     |                                        |                                currentDappId='B' -> unmount() emits dx:unmount B
     |                                        |                                ...loadScript(A.entry) resolves fast...
     |                                        |                                currentDappId='A'; emit dx:mount A [premature/duplicate]
  ...original A entry load finally resolves...                                        |
  currentDappId='A' (already 'A' from 2nd call — but this is a SEPARATE completed mount)
  emit dx:mount A  <-- SECOND dx:mount for 'A' with no intervening dx:unmount: D-02 VIOLATION
```

Root cause, precisely: `lifecycle.mount()` unmounts the *previous committed* dapp at the top (`src/lifecycle.ts:274-276`) but only commits (`currentDappId = manifest.id`, `src/lifecycle.ts:364`) after every async step resolves — and nothing tracks "is this particular `mount()` invocation still the one the shell currently wants." `shell.ts`'s `pendingMountId` (`src/shell.ts:56-58, 299`) only dedupes a second call for the *same* dapp id while one is in flight; it does nothing once the target id changes, so two or more `lifecycle.mount()` calls for *different* dapps (or the same dapp on a second navigation) can be in flight simultaneously, and whichever's chain of awaits resolves last controls both the DOM and `currentDappId`, irrespective of navigation order.

### Recommended Fix Shape: Generation Guard

A monotonically incrementing counter, private to `createLifecycleManager()`'s closure, captured per `mount()` call and rechecked at every commit point:

```typescript
// Source: pattern generalized from the existing pendingMountId same-dapp dedupe at src/shell.ts:56-58
let mountGeneration = 0;

async function mount(manifest: DappManifest, container: HTMLElement, path?: string): Promise<void> {
  const generation = ++mountGeneration;
  const isStale = () => generation !== mountGeneration;

  if (currentDappId) unmount(); // safe: currentDappId is only ever set by a mount that reached
                                 // the bottom of this function without going stale — see below

  // ...plugin-requirement check (no isStale check needed — nothing committed yet)...

  // styles: non-blocking, no isStale check needed — failure/success here never mutates
  // container or currentDappId

  if (manifest.template) {
    let html: string;
    try {
      html = await loadTemplate(manifest.template);
    } catch (err) {
      if (!isStale()) events.emit('dx:error', { source: `lifecycle:${manifest.id}:template`, error: /* ... */ });
      return; // a stale mount's own failure is not worth reporting — the newer mount owns the container now
    }
    if (isStale()) return; // <-- re-check immediately before the DOM write

    // sanitize + container.innerHTML = ... (same isStale() re-check after the sanitize await)
  }

  // dependencies loop: isStale() check after each awaited loadScript()

  try {
    await loadScript(manifest.entry);
  } catch (err) {
    if (!isStale()) { events.emit('dx:error', /* ... */); container.innerHTML = ''; }
    return;
  }
  if (isStale()) return; // <-- final gate before commit

  currentDappId = manifest.id;
  events.emit('dx:mount', { id: manifest.id, container, path: path ?? manifest.route });
  events.emit('dx:dapp:mounted', { id: manifest.id });
}
```

**Why this satisfies D-01/D-02:** A stale mount never writes to `container`, never sets `currentDappId`, and never emits `dx:mount`/`dx:dapp:mounted` — so it also never becomes something a later `unmount()` needs to pair a `dx:unmount` against. The "unmount current at top" logic stays correct because `currentDappId` is *only* ever set by the single mount call that was still current at its very last check — by construction there can be at most one such call per generation value.

**The one gap a pure generation-bump-on-new-`mount()`-call scheme does not close (D-03 scenario 1):** `disableDapp()` doesn't call `lifecycle.mount()` — it calls `rebuildRouter()`, which only acts on `lifecycle.getCurrentDapp()`, and that's `null` for a dapp that's still mid-flight (hasn't committed yet). So disabling a dapp while its mount is in flight does not bump `mountGeneration` and does not stop the in-flight mount from eventually committing — a disabled dapp could still emit `dx:mount` and render. **Recommendation:** add an explicit invalidation entry point to `LifecycleManager` (e.g. `invalidatePendingMount(id: string)` or a broader `invalidate()`), called from `shell.disableDapp()`/`rebuildRouter()` whenever the dapp being disabled is not-yet-current but may be in flight. This keeps `mountGeneration` fully owned by `lifecycle.ts` (single source of truth for staleness) while giving `shell.ts` a hook for the one trigger it knows about that lifecycle can't see on its own (a route/enablement decision made without calling `mount()` again).

**Alternative shapes considered (all rejected in favor of the above, documented for the planner's discretion call):**
- *AbortController threaded through the whole mount chain* — more "correct" in the DOM sense but requires changing `ScriptLoader`/`StyleLoader`/`TemplateLoader`/`TemplateSanitizer` signatures (all currently `(arg) => Promise<T>`, no signal parameter) — out of proportion to the bug, and Phase 2 (D-07) already accepted that custom loaders can't be truly cancelled, only guarded.
- *A single shared promise queue that serializes all mounts* — would fix the race but changes navigation latency semantics (B would wait for A's slow load to finish before starting) — contradicts "last navigation wins" (the point is B/A-again should *not* wait on a superseded in-flight load).

### Manifest & Route Validation Design (TEST-02)

**D-06 route normalization:** `normalizePath()` (`src/router.ts:27-39`) already implements: strip `basePath` prefix, ensure leading slash, strip trailing slash except root. Manifest `route` fields need the leading-slash/trailing-slash subset of this (not the `basePath`-stripping part — manifest routes are declared without a `basePath` prefix). Two implementation shapes, both consistent with the Architectural Responsibility Map above:

1. **Router-owned:** `createRouter()` normalizes each incoming `manifest.route` before the length-sort (`src/router.ts:24`), and *returns* which manifests were rejected (unfixable) so the caller (shell) can emit `dx:error`. Requires widening `Router`'s construction contract (e.g. `createRouter()` throws/returns diagnostics instead of being a pure "give it a list, get a router" factory) — a bigger shape change to a currently-clean, event-bus-free module.
2. **Shell-owned:** shell normalizes+validates the manifest list (reusing an exported-from-router or duplicated-and-tested normalization helper) in a new post-`loadManifests()` step, before ever calling `createRouter()`. Router stays a pure function of an already-valid manifest list; shell keeps sole ownership of all `dx:error` emission for manifest/route problems (consistent with `isValidManifest`, WR-01, and D-08 already living in shell.ts).

**Recommendation: shape 2 (shell-owned).** It keeps `router.ts` free of the `EventBus` dependency it doesn't have today, and puts route validation in the same choke point as tier validation (D-07) and duplicate detection (D-08) — one `normalizeAndValidateManifests(manifests): DappManifest[]` step, called once from `init()` right after `loadManifests()` resolves, before `initEnabledState()`/`createRouter()`. This also means validation runs exactly once per shell lifetime (not on every `rebuildRouter()` call from `enableDapp`/`disableDapp`), which is correct — enable/disable does not change the manifest list, only which subset is active.

**What counts as "unfixable"?** `isValidManifest` already guarantees `route` is `typeof string` before this step runs. The normalization algorithm (`ensure leading slash` + `strip trailing slash`) is total for any non-empty string — the only genuinely unfixable case is an **empty string** (`""`), which the existing `normalizePath` algorithm would silently coerce to `"/"` (root) — two manifests with `route: ""` would silently both resolve to `/` without D-06's explicit reject path. **Recommendation:** treat `route.trim() === ''` (empty or whitespace-only) as the reject condition; anything else normalizes successfully. This is a `[ASSUMED]` policy call — see Assumptions Log — the exact boundary (e.g. should `"   "` reject, should routes containing only slashes like `"//"` reject) is a discretion call for the plan/implementation, not something research can verify from existing code, since no such policy currently exists.

**D-07 tier parity:** `isValidManifest()` (`src/shell.ts:161-170`) is currently called only inside `loadDappManifest()` (dapp-entries tier, `src/shell.ts:177`). Fix: call `isValidManifest()` (or the new `normalizeAndValidateManifests` wrapper) uniformly over the *result* of `loadManifests()` regardless of which of the three tiers produced it — i.e. filter+validate happens once in `init()` after `manifests = await loadManifests();` (`src/shell.ts:228`), not per-tier inside `loadManifests()`. This is the simplest single-choke-point fix and naturally satisfies both D-06 and D-07 in one pass.

**D-08 duplicate-route detection:** After normalization/validation, iterate the manifest list once; a `Map<route, id>` first-seen-wins tracker; on a second manifest with an already-seen exact `route` string, emit `dx:error` (source TBD — see Open Questions) naming both conflicting ids, but keep the manifest in the list (first-registered-wins is a router-resolution-time behavior via the *existing* longest-prefix-then-verbatim-match algorithm — the duplicate manifest itself is not discarded, only shadowed at resolution time by insertion order, since `sorted` in `router.ts:24` uses `Array.prototype.sort()`, which is stable in all ES2019+ engines including the project's ES2022 target, so equal-length routes preserve relative input order = first-registered-wins is already guaranteed by JS's stable sort `[VERIFIED: ECMA-262 Array.prototype.sort stability, guaranteed since ES2019]`). This means D-08's "first wins" behavior requires **no router.ts change at all** — it already works today by construction; the phase's job is purely to *detect and surface* the collision via `dx:error`, and to write the regression test proving both the winner and the emit.

**WR-01 (folded):** `loadDappManifest`'s `catch { return null; }` (`src/shell.ts:190-192`) swallows fetch-network-failure, non-2xx (already partially handled at `:175` via early `return null` on `!res.ok` — that branch is *also* currently silent and arguably in-scope for the same fix), and `res.json()` parse failures uniformly. Recommendation: emit `dx:error` with `source: 'shell:manifest'` (mirroring the existing validation-failure emit at `:177-185` per the CONTEXT.md discretion note) from both the `!res.ok` early-return and the `catch` block, with a message distinguishing "fetch failed" vs "invalid JSON" (the `catch` block currently catches both network errors *and* `res.json()` parse errors indiscriminately — the message should include the caught error's detail via `cause` or interpolation, following the existing `{ cause: err }` convention seen in `plugins/settings/src/index.ts:60-64,83-87`).

### System Interaction Diagram — Mount Race Fix Boundary

```
 Browser navigation / shell.navigate()
            |
            v
      router.resolve() ---------------------------> DappManifest | null
            |
            v
   shell.handleRouteChange(manifest)
            |
            v
   shell.mountDapp(manifest)  <-- same-dapp pendingMountId dedupe (existing, unchanged)
            |
            v
   lifecycle.mount(manifest, container, path)  <-- NEW: generation guard owns staleness
     |         |            |              |
     v         v            v              v
  [styles   [template    [dependencies  [entry script]
  non-      fetch +      sequential      |
  blocking] sanitize +   loadScript]     v
     |      isStale()        |      isStale() gate
     |      gate before      |         before commit
     |      container        |              |
     |      write            |              v
     +---------+--------------+---> currentDappId = id
                                    events.emit('dx:mount')
                                    events.emit('dx:dapp:mounted')

  shell.disableDapp(id)  ------------> lifecycle.invalidatePendingMount(id)  [NEW hook,
            |                          needed because disableDapp doesn't call mount()
            v                          again and can't otherwise supersede an in-flight
   rebuildRouter()                     mount for a dapp not yet reflected in getCurrentDapp()]
            |
            v
   if (currentDapp && !stillEnabled) unmount() + navigate('/')
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cancellable/interleavable async control flow for tests | A custom "test scheduler" or manual `setTimeout` chains | `vitest`'s built-in `vi.useFakeTimers()` + hand-rolled deferred promises (`new Promise((res) => { resolve = res })`) | Already the established, working pattern in `tests/lifecycle.test.ts` (timeout suite) and `tests/shell.test.ts` (`deferredEntryLoader`) — zero new tooling needed, and it composes cleanly with async/await test bodies. |
| Race-condition-safe async sequencing in production code | A generic pub/sub "cancel token" library, a promise queue library, or bespoke `AbortController` plumbing through every loader signature | A closure-scoped monotonic generation counter (3-5 lines) | The existing codebase already solved an isomorphic, smaller version of this problem with `pendingMountId` (`src/shell.ts:56-58`) — generalizing that idiom is strictly less code and less API-surface risk than adopting a dependency or redesigning the loader contract, and stays inside the zero-runtime-deps constraint. |
| Deep-object-merge semantics | A generic `deepmerge`/`lodash.merge` package | The project's own `deepMerge()` (`src/utils.ts`) — already implemented, already has a prototype-pollution guard, already has 15 passing unit tests | This phase only needs to *test* documented semantics (D-09), not implement or replace deepMerge. `tests/utils.test.ts` already covers flat merge, nested merge, array-replace, null/undefined-skip, and all three pollution-guard keys — D-09 is largely **already satisfied** by existing tests; verify gaps rather than duplicate coverage (see Open Questions). |

**Key insight:** Every "don't hand-roll" temptation in this phase points back to code the project already has (`pendingMountId`, `normalizePath`, `deepMerge`) — the work is generalizing/extending/testing existing internal primitives, not reaching for external libraries. This is consistent with the zero-runtime-deps constraint and the project's established closure-factory architecture.

## Common Pitfalls

### Pitfall 1: Checking staleness only at the very end of `mount()`
**What goes wrong:** If `isStale()` is only checked once, right before `currentDappId = manifest.id`, a stale mount can still have already mutated `container.innerHTML` during its template-injection step (which happens *before* the entry-script await) — so the "final" DOM content is a race between whichever mount's template write happened last, even though `currentDappId`/`dx:mount` correctly reflect the winner. This produces a **container/state mismatch bug that's worse than the original** (events say dapp A mounted, but the visible DOM briefly/permanently shows dapp B's template).
**Why it happens:** `container.innerHTML = html` is a side effect with no natural "undo," and it happens at a different point in the async chain than the `currentDappId` commit.
**How to avoid:** Re-check `isStale()` immediately before *every* `container` mutation, not just before the final `currentDappId` assignment — see the annotated code example above (checks after `loadTemplate()`, after `sanitizeTemplate()`, and again before the final commit).
**Warning signs:** A stress test that asserts `dx:mount`/`dx:dapp:mounted`/`currentDappId` correctness but doesn't separately assert `container.innerHTML` content would miss this class of bug entirely — the test suite must assert DOM content, not just events, for at least the template-injection race scenarios.

### Pitfall 2: `vi.advanceTimersByTimeAsync` vs. real microtask flushing when mixing deferred promises and fake timers
**What goes wrong:** D-12's timeout-racing-navigation scenario needs *both* a manually-controlled deferred promise (to hold a mount open) *and* `vi.useFakeTimers()` (to fire the 30s timeout deterministically). If the deferred promise's `resolve()` is called but the test doesn't also flush microtasks/pending timers correctly afterward, assertions can run before the promise's `.then()` chain (which itself schedules further work, e.g. `clearTimeout` inside `withTimeout`'s resolve branch) has settled — leading to flaky "sometimes passes" tests.
**Why it happens:** Fake timers control `setTimeout`/`clearTimeout` scheduling but do not, by themselves, control native Promise microtask ordering — `vi.advanceTimersByTimeAsync()` is `async` specifically because it awaits microtask flushes as it advances, but a manually-resolved deferred promise resolved *outside* of `vi.advanceTimersByTimeAsync()`'s own advancement needs its own `await Promise.resolve()` (or the existing project convention `await tick()` = `await new Promise((r) => setTimeout(r, 0))`) to let its continuations run — and `tick()`'s `setTimeout` itself needs fake-timer advancement if fake timers are active, creating a subtle ordering dependency.
**How to avoid:** Follow the exact pattern already established in `tests/lifecycle.test.ts`'s `load timeout` describe block: `const mountPromise = lm.mount(...); await vi.advanceTimersByTimeAsync(30); await mountPromise;` — always resolve/reject the deferred fixture *before* calling `vi.advanceTimersByTimeAsync()`, then await the production promise directly (not a bare `tick()`) so the test waits on the actual completion signal rather than a fixed number of ticks.
**Warning signs:** Tests that pass in isolation (`vitest run tests/stress.test.ts`) but flake under `vitest run` (full suite) or under `--repeat`/CI reruns — a strong signal of microtask/timer ordering fragility.

### Pitfall 3: `hashchange`/`popstate` are real browser events, not mockable via fake timers
**What goes wrong:** In `mode: 'hash'`, `router.navigate()` assigning a *different* hash relies on the real, async `hashchange` event (`src/router.ts:74-77`) to eventually call `notifyListeners()` — this is native happy-dom event dispatch, not a `setTimeout`-based mechanism, so `vi.useFakeTimers()` does **not** control when it fires. Combining hash-mode navigation races with fake timers in the same test can produce nondeterministic ordering between the (real, async, uncontrollable) `hashchange` dispatch and the (fake, controllable) timeout firing.
**Why it happens:** happy-dom dispatches DOM events through its own internal event loop, independent of the timer-mocking Vitest performs via `@sinonjs/fake-timers`.
**How to avoid:** Prefer `mode: 'history'` for the stress-file's race scenarios — `history` mode's `navigate()` calls `notifyListeners()` **synchronously** (`src/router.ts:81-82`, comment: "pushState does NOT fire 'popstate' — the explicit notify is the only notification"), which makes interleaving fully deterministic and controllable purely via deferred-promise resolution order, with no dependency on real event-loop timing at all. Existing hash-mode double-mount coverage (`tests/shell.test.ts` mount de-duplication block) already exists separately and doesn't need duplicating for every new race scenario — reserve hash-mode tests for hash-specific behavior, not the general race matrix.
**Warning signs:** A hash-mode stress test that needs an extra `await tick()` beyond what history-mode-equivalent tests need is a sign the test is fighting real event dispatch timing rather than controlling it.

### Pitfall 4: Forgetting that `pendingMountId` dedupe happens in `shell.ts`, not `lifecycle.ts`
**What goes wrong:** A test that calls `lifecycle.mount()` directly (bypassing `shell.mountDapp()`) to simulate "two concurrent mounts for the same dapp" will not exercise the same-dapp dedupe at all (that logic lives entirely in `shell.ts:299`, `lifecycle.mount()` has no concept of "a mount for this id is already pending" — it always unconditionally proceeds). Tests aimed at TEST-01's stress scenarios (which are about *shell-level* navigation races) must drive them through `createShell()` + `shell.navigate()`, not through `createLifecycleManager()` directly, or the test won't reflect real user-facing behavior.
**Why it happens:** The dedupe/generation-guard responsibility is split across two modules (per the Architectural Responsibility Map above) — it's easy to write a "lifecycle-level" unit test that looks like it's testing the race but is actually testing a different, narrower surface.
**How to avoid:** Put the D-03 four-scenario race matrix in the new `tests/stress.test.ts` driven through `createShell()` (matching the existing `mount de-duplication` block's approach in `tests/shell.test.ts`, which this phase's dedicated file supersedes/extends for the fuller matrix). Reserve direct `createLifecycleManager()` tests (already in `tests/lifecycle.test.ts`) for lifecycle-only concerns (the generation-guard mechanism itself, in isolation, if the plan wants an additional lower-level unit test of `isStale()`/`invalidatePendingMount()` behavior).
**Warning signs:** A "race" test that never calls `shell.navigate()` twice, or that constructs `lifecycle` in isolation for a scenario whose bug report (CONTEXT.md) explicitly cites `shell.ts` line numbers.

### Pitfall 5: Stale-path capture in the sub-path-during-pending-mount branch (D-03 scenario 3)
**What goes wrong:** `mountDapp()` captures `const path = router.getCurrentPath()` (`src/shell.ts:284`) once, at the top of each call. If a second navigation to a sub-path of the same (still-loading) dapp is dropped by the `pendingMountId === manifest.id` dedupe (`src/shell.ts:299`) before it can update anything, the *original* call's captured `path` is what eventually gets used for `currentPath = path` and the `dx:mount` `path` field when the pending mount finally commits — silently stale, not matching the browser's actual current URL at commit time.
**Why it happens:** The dedupe branch is a bare `return` with no side effect at all — it doesn't communicate "the target path changed" back to the in-flight call.
**How to avoid:** This is a genuine open design question, not a known-good fix to copy — see "Open Questions." At minimum, the stress test for scenario 3 should assert what `shell.getCurrentRoute()` / the `dx:mount` event's `path` field actually is after the pending mount resolves, so the plan can decide (and lock via test) whether "use the freshest resolved path at commit time" or "the first-requested path, plus a synthetic `dx:route:subpath` catch-up event after commit" is correct.
**Warning signs:** A test that asserts only `lifecycle.getCurrentDapp()` for scenario 3 without also asserting the committed path/`dx:route:subpath` behavior would pass while this gap remains unfixed.

## Code Examples

### Deferred-promise fixture (D-12), generalized beyond the existing single-purpose `deferredEntryLoader`

```typescript
// Source: generalized from tests/shell.test.ts's existing deferredEntryLoader (lines ~556-572)
function deferred<T = void>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Usage: a scriptLoader that resolves only when the test explicitly releases it,
// keyed by src so different dapps can be released independently and in any order —
// this is what D-12's "resolve B before A on demand" requires.
function controllableScriptLoader(): { loader: ScriptLoader; release: (src: string) => void } {
  const pending = new Map<string, ReturnType<typeof deferred>>();
  const loader: ScriptLoader = (src: string) => {
    const d = deferred<void>();
    pending.set(src, d);
    return d.promise;
  };
  return {
    loader,
    release: (src: string) => pending.get(src)?.resolve(),
  };
}
```

### Stress scenario skeleton — rapid A→B→A, last-navigation-wins (TEST-01 primary scenario)

```typescript
// Source: pattern combining tests/shell.test.ts conventions (testLoaders, tick, countMounts)
// with the controllableScriptLoader above.
it('rapid A -> B -> A: final DOM and getCurrentDapp() match the LAST navigation, not the last finisher', async () => {
  const { loader, release } = controllableScriptLoader();
  shell = createShell({
    lifecycle: { scriptLoader: loader, styleLoader: async () => {} },
    mode: 'history', // deterministic synchronous notifyListeners — see Pitfall 3
    manifests: [dappA, dappB],
  });
  await shell.init();

  const mountEvents: string[] = [];
  const unmountEvents: string[] = [];
  window.addEventListener('dx:mount', ((e: CustomEvent) => mountEvents.push(e.detail.id)) as EventListener);
  window.addEventListener('dx:unmount', ((e: CustomEvent) => unmountEvents.push(e.detail.id)) as EventListener);

  shell.navigate('/a'); // A's entry script load is now pending (held by controllableScriptLoader)
  shell.navigate('/b'); // B's entry script load is now ALSO pending
  shell.navigate('/a'); // back to A — a THIRD mount attempt, before either A or B has resolved

  // Resolve out of navigation order: B first, then the ORIGINAL A call, then the second A call.
  // Only the second A call (the current/latest generation) should ever commit.
  release('/dapps/b/app.js');
  release('/dapps/a/app.js'); // resolves BOTH pending A calls (loader is keyed by src, not call)
  await tick();

  expect(shell.getCurrentRoute()).toBe('/a');
  expect(mountEvents.filter((id) => id === 'a')).toHaveLength(1); // not 2 — the stale first A call never committed
  expect(mountEvents).not.toContain('b'); // B was superseded before it could commit
  // Strict alternation (D-02): every mount is followed by its own unmount before the next mount.
  // With last-navigation-wins, no mount ever actually completed except the final 'a' — so
  // unmountEvents should be empty here (nothing had committed yet to need unmounting).
  expect(unmountEvents).toEqual([]);
});
```

### D-08 duplicate-route regression skeleton

```typescript
it('emits dx:error naming both ids when two manifests declare the same exact route, first still wins', async () => {
  const errors: { source: string; error: Error }[] = [];
  window.addEventListener('dx:error', ((e: CustomEvent) => errors.push(e.detail)) as EventListener);

  shell = createShell({
    ...testLoaders,
    manifests: [
      { id: 'first', name: 'First', version: '0.0.1', route: '/dup', entry: 'data:text/javascript,', nav: { label: 'First' } },
      { id: 'second', name: 'Second', version: '0.0.1', route: '/dup', entry: 'data:text/javascript,', nav: { label: 'Second' } },
    ],
  });
  await shell.init();

  shell.navigate('/dup');
  await new Promise((r) => setTimeout(r, 0));

  expect(shell.getCurrentRoute()).toBe('/dup');
  // Router resolution picks 'first' (stable sort preserves insertion order for equal-length routes).
  const mountedIds: string[] = [];
  // ...assert lifecycle mounted 'first', not 'second', via dx:dapp:mounted listener registered pre-navigate...

  expect(errors.some((e) => e.error.message.includes('first') && e.error.message.includes('second'))).toBe(true);
});
```

### TEST-03 integration skeleton — real shell, real settings plugin, real disableDapp()

```typescript
// Source: contrasts with plugins/settings/tests/settings.test.ts's mockContext-based unit tests
// (lines ~530-639) — this drives the identical assertion through createShell() instead.
it('settings handlers registered by a dapp stop firing after that dapp is disabled via shell.disableDapp()', async () => {
  const optionalDapp: DappManifest = {
    id: 'hello', name: 'Hello', version: '0.0.1', route: '/hello',
    entry: 'data:text/javascript,', nav: { label: 'Hello' }, optional: true,
  };
  const settingsPlugin = createSettings();

  shell = createShell({
    ...testLoaders,
    plugins: { settings: settingsPlugin },
    manifests: [optionalDapp],
  });
  await shell.init();

  const api = settingsPlugin.getSettingsAPI();
  const handler = vi.fn();
  api.onChange('hello', 'someKey', handler);

  shell.disableDapp('hello'); // drives the REAL dx:dapp:disabled emit through shell's real path

  api.set('hello', 'someKey', 'newValue'); // internal store write still succeeds — cleanup only prunes handlers
  expect(handler).not.toHaveBeenCalled(); // the handler must not fire post-disable
});
```

## State of the Art

Not applicable in the usual "library X deprecated in favor of Y" sense — this is entirely internal code with no external ecosystem to track. The one relevant internal precedent: Phase 2 (ROB-01) already established the project's idiom for "guard an in-flight async operation against staleness" via `withTimeout`'s `Promise.race`-based hang guard and the clear-on-settle timer discipline (`src/lifecycle.ts:37-64`) — the mount-generation guard this phase adds is architecturally the same *class* of fix (staleness detection at commit points) applied to a different failure mode (superseded navigation vs. hung load), which is why it fits naturally into `lifecycle.ts` rather than requiring a new module.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Unfixable" route = empty/whitespace-only string after `.trim()`; all other non-empty strings are normalizable via the existing leading-slash/trailing-slash rules | Manifest & Route Validation Design (D-06) | If the plan/implementation picks a different boundary (e.g. also rejecting routes with embedded whitespace, double slashes, or non-ASCII), the reject-vs-normalize test matrix built on this assumption would need rework. Low risk — no existing code or CONTEXT.md text contradicts this reading, but it is a genuinely new policy with no prior art in this codebase to verify against. |
| A2 | `dx:error` source for duplicate-route detection is a new string (not yet decided) — this research did not receive a mandate on the exact string and treats `shell:manifest` or `shell:route` as equally plausible, leaning toward `shell:manifest` since it's a manifest-content conflict rather than a path-parsing issue | Manifest & Route Validation Design (D-08); Open Questions | Cosmetic risk only — wrong source string doesn't break functionality, just requires a one-line test/impl update if the plan picks differently. CONTEXT.md explicitly delegates this to Claude's discretion, so this is not a gap, just documented for traceability. |
| A3 | Route normalization + validation should run once in `init()` after `loadManifests()` resolves (not per-tier inside `loadManifests()`, not inside `createRouter()`) | Manifest & Route Validation Design | If the plan instead pushes normalization into `router.ts` (shape 1 discussed above), `router.ts` would need an `EventBus` dependency it doesn't have today — a larger, more invasive change than shape 2. This is presented as a recommendation with reasoning, not a verified-only-one-way-works fact. |
| A4 | The `invalidatePendingMount()`-style hook is the right shape to close the disable-mid-flight gap (D-03 scenario 1), rather than, e.g., having `disableDapp()` poll/wait or having `mountDapp()` re-check enablement at commit time itself | Architecture Patterns (Recommended Fix Shape) | If the plan finds a simpler shape (e.g. `lifecycle.mount()` accepting an `isEnabled: (id) => boolean` predicate checked at the final gate, avoiding a new imperative invalidation call entirely), that would also satisfy D-01/D-02/D-03-1 and might be simpler. This is Claude's discretion per CONTEXT.md — flagged so the planner treats it as one option, not the only option. |

**If this table is empty:** N/A — see entries above. All four assumptions are design *recommendations* under an explicit CONTEXT.md discretion grant, not verified facts presented as settled; the planner should treat them as a starting point, not a locked decision.

## Open Questions

1. **Exact `dx:error` source strings for the three new emit sites (WR-01 fetch/parse failure, route-reject-unfixable, duplicate-route)**
   - What we know: CONTEXT.md explicitly delegates this to discretion, "follow the established colon-hierarchical taxonomy (`shell:manifest`, `shell:route`, etc.)"; existing precedent is `shell:manifest` (validation failure) and `shell:mount` (container missing).
   - What's unclear: Whether route-reject and duplicate-route should share `shell:manifest` (both are "manifest content problems") or split into a new `shell:route` (route-specific). WR-01 almost certainly reuses `shell:manifest` per the discretion note's explicit "mirroring" instruction.
   - Recommendation: `shell:manifest` for WR-01 (mirrors existing validation emit exactly, per CONTEXT.md's own wording); `shell:route` for reject-unfixable (a routing-table construction problem, distinct enough from "manifest is missing a field" to warrant its own source); `shell:manifest` for duplicate-route (it's fundamentally two manifests conflicting, not a single route string being malformed). Final call belongs to the plan.

2. **Sub-path-during-pending-mount exact contract (D-03 scenario 3)**
   - What we know: The dedupe branch (`src/shell.ts:299`) currently drops the second call silently with no side effect, so the eventually-committed mount uses a stale captured `path`.
   - What's unclear: Whether the correct fix is "update the in-flight call's target path so it commits with the freshest path" (requires making `path` mutable/re-readable inside the async call, not a captured `const`) vs. "commit with the original path, then synthesize a catch-up `dx:route:subpath` event afterward if the resolved path changed" vs. "no special handling needed, this is an acceptable edge case, just document + test the current (stale-path) behavior explicitly as intended-if-surprising."
   - Recommendation: Given D-05's "fix correctness bugs in-phase" policy and the "no silent failures" charter, treat the stale-path outcome as a bug to fix (first option: make the target path re-readable at commit time, e.g. read `router.getCurrentPath()` fresh at the final commit point instead of relying solely on the value captured when the (possibly-dropped) call started) — but this is a plan-level design decision, not something research can resolve unilaterally since it touches the same commit-point code the generation-guard fix is already restructuring.

3. **Should the `!res.ok` early-return in `loadDappManifest` (`src/shell.ts:175`, distinct from the `catch` block) also get a WR-01 `dx:error` emit, or only the `catch` block?**
   - What we know: The folded todo's problem statement says "fetch/HTTP/JSON-parse failures" (plural, covering all three failure modes) — HTTP failure (`!res.ok`) is textually in scope per the todo title even though it's a separate code branch from the `catch`.
   - What's unclear: Whether CONTEXT.md's "fold TEST-02 exercises exactly this path" framing means *only* the parse-failure path that TEST-02's manifest tests would naturally hit, or the full three-mode surface described in the todo.
   - Recommendation: Cover all three (`!res.ok`, network-throw, JSON-parse-throw) — cheap to do once the emit call is written, matches the todo's literal scope, and avoids leaving a known-adjacent silent-failure gap the "no silent failures" charter would flag again later.

## Environment Availability

Not applicable — this phase has no external service/tool dependencies beyond what's already installed and verified (`vitest`, `happy-dom`, both confirmed present and running in this repo). No network calls, no new CLIs, no database/service processes required.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (`environment: 'happy-dom'`, per `vitest.config.ts`) |
| Config file | `vitest.config.ts` (path aliases already map `@dnzn/dxkit` → `src/index.ts`, `@dnzn/dxkit-settings` → `plugins/settings/src/index.ts`, etc. — no config change needed) |
| Quick run command | `pnpm vitest run tests/stress.test.ts` (or `npx vitest run tests/shell.test.ts tests/router.test.ts` for TEST-02 additions) |
| Full suite command | `make test` (lint + `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | Rapid A→B→A with slow loaders: last-navigation-wins, no double-mount, no lost-unmount | integration (full `createShell`) | `npx vitest run tests/stress.test.ts` | ❌ new file (D-11) |
| TEST-01 | disableDapp() racing an in-flight mount | integration | `npx vitest run tests/stress.test.ts` | ❌ new file |
| TEST-01 | Load timeout firing after navigate-away | integration, fake timers | `npx vitest run tests/stress.test.ts` | ❌ new file |
| TEST-01 | Sub-path nav during pending initial mount | integration | `npx vitest run tests/stress.test.ts` | ❌ new file |
| TEST-01 | `shell.init()` initial mount racing immediate first navigation | integration | `npx vitest run tests/stress.test.ts` | ❌ new file |
| TEST-02 | Invalid/malformed route formats (empty, unnormalized) | unit (`router.test.ts`) + integration (`shell.test.ts` for reject+`dx:error`) | `npx vitest run tests/router.test.ts tests/shell.test.ts` | ✅ files exist, add cases |
| TEST-02 | Route normalization (`"blog"` → `"/blog"`) | unit | `npx vitest run tests/router.test.ts` | ✅ file exists, add cases |
| TEST-02 | deepMerge override semantics | unit | `npx vitest run tests/utils.test.ts` | ✅ already largely covered — verify gaps only |
| TEST-02 | Multi-match/duplicate routes (both prefix-overlap and exact-duplicate) | unit + integration | `npx vitest run tests/router.test.ts tests/shell.test.ts` | ✅ files exist (prefix-overlap already covered — `uses longest prefix match`), add exact-duplicate case |
| TEST-02 | All three manifest tiers validated (D-07) | integration (`shell.test.ts`) | `npx vitest run tests/shell.test.ts` | ✅ file exists (dapp-entries tier already covered), add inline + registry.json invalid-manifest cases |
| TEST-02 | WR-01 fetch/HTTP/parse failure emits `dx:error` | integration (`shell.test.ts`) | `npx vitest run tests/shell.test.ts` | ✅ file exists, add case (currently `skips dapps with failed manifest fetch` asserts silent skip — that test's *assertion* will need updating alongside the fix, not just a new test added) |
| TEST-03 | Settings handlers do not fire after `disableDapp()`, real shell wiring | integration (`shell.test.ts` or a new `plugins/settings/tests/integration.test.ts`) | `npx vitest run tests/shell.test.ts` or `npx vitest run plugins/settings/tests/` | ❌ new test case; existing `plugins/settings/tests/settings.test.ts` covers the mocked-context version only |

### Sampling Rate
- **Per task commit:** targeted file run (e.g. `npx vitest run tests/stress.test.ts`)
- **Per wave merge:** `make test` (lint + full `vitest run`)
- **Phase gate:** Full suite green before `/gsd-verify-work` — per D-04/D-05, no `test.fails`/known-failing assertions may land; the suite must be fully green at phase completion, not partially red with todos.

### Wave 0 Gaps
- [ ] `tests/stress.test.ts` — new dedicated file for the D-03 race matrix (D-11)
- [ ] `controllableScriptLoader`/`deferred()` fixture helpers (either inline in `tests/stress.test.ts` per the "fixtures inline, not shared files" convention, or promoted if reused across `tests/shell.test.ts`'s existing `deferredEntryLoader` — recommend generalizing in place rather than creating a shared fixtures file, consistent with existing convention)
- [ ] No framework/config changes needed — `vitest.config.ts` already covers `tests/**/*.test.ts` glob, a new `stress.test.ts` file is picked up automatically.
- [ ] Existing test `skips dapps with failed manifest fetch` (`tests/shell.test.ts:310-321`) currently asserts *silent* skip (`shell.getManifests()` has length 0, no error assertion) — this assertion will need to be extended (not just supplemented) once WR-01 lands, since the behavior it's pinning changes from "silent" to "silent-list-but-loud-`dx:error`".

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | Indirectly | The mount-generation guard is itself an architectural control preventing a TOCTOU (time-of-check-to-time-of-use) class bug — see Threat Patterns below. |
| V4 Access Control | Yes | `disableDapp()` is the project's dapp-isolation/access boundary (an end-user or admin decision that a given dapp should stop receiving events/mounting). The mount race currently allows this boundary to be silently violated (a disabled dapp's in-flight mount can still commit and mount) — D-03 scenario 1 is a security-adjacent correctness bug, not just a UX bug. |
| V5 Input Validation | Yes | Manifest/route validation (D-06/D-07/D-08) is direct input validation of developer-supplied (or, in a `dapps` entries + remote-`manifest.json` fetch scenario, potentially attacker-influenced-if-the-manifest-host-is-compromised) structured data before it drives routing and script-injection decisions. |
| V6 Cryptography | No | Not touched by this phase. |
| V7 Error Handling & Logging | Yes | This entire phase is, in large part, about closing silent-failure gaps (WR-01) — directly ASVS V7's "failures are logged/surfaced, not silently swallowed" concern, already the project's stated core value. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| TOCTOU race allowing a disabled dapp to still mount and receive `dx:mount` (container reference + entry-script execution) after its access was revoked | Elevation of Privilege / Tampering | The `invalidatePendingMount()`-style hook (or equivalent) closing D-03 scenario 1 — must be locked by a regression test asserting a disabled dapp's in-flight mount is fully abandoned (no `dx:mount`, no `dx:dapp:mounted`, no `currentDappId` set to the disabled id), not merely "eventually corrected." |
| Manifest route/field spoofing via a compromised or misconfigured `dapps[].manifest` remote fetch endpoint | Spoofing / Tampering | Existing `isValidManifest()` field-presence check (unchanged scope, now applied uniformly across all three tiers per D-07) + the prototype-pollution guard already in `deepMerge()` (`__proto__`/`constructor`/`prototype` key rejection, already tested) — this phase extends validation coverage, it does not need to add new sanitization primitives. |
| Route-collision-driven dapp confusion (two manifests silently resolving to the same path, one shadowing the other with no operator visibility) | Spoofing (wrong dapp silently serves a route the operator believed belonged to another) | D-08's `dx:error` emit on duplicate detection — turns a silent trust-boundary ambiguity into an observable, alertable event, consistent with the project's "no silent failures" charter. |
| Stale/superseded async mount injecting content into a container the current dapp believes it exclusively owns | Tampering (DOM-level, not a classic web-security boundary since DxKit has no origin isolation between dapps by design, but still a correctness/trust concern within the single-dapp-active invariant documented in `.claude/CLAUDE.md`'s Architectural Constraints) | The generation-guard's pre-mutation `isStale()` checks (Pitfall 1) — the primary reason this phase treats "check staleness right before every DOM write," not just before the final event emission, as a hard requirement rather than a nice-to-have. |

No new cryptography, authentication, or session-management surface is touched by this phase — the security-relevant work is entirely about closing a race-condition-shaped access-control gap and completing input-validation coverage that was already partially implemented.

## Sources

### Primary (HIGH confidence)
- `src/shell.ts`, `src/lifecycle.ts`, `src/router.ts`, `src/utils.ts`, `src/types/events.ts`, `src/types/manifest.ts` — read in full this session, current on-disk state including all Phase 1-3 changes `[VERIFIED: local file read]`
- `plugins/settings/src/index.ts` — read in full, current cleanup/disable wiring `[VERIFIED: local file read]`
- `tests/shell.test.ts`, `tests/router.test.ts`, `tests/utils.test.ts`, `tests/lifecycle.test.ts` (fake-timer sections) — read in full/relevant sections, establishing existing test conventions `[VERIFIED: local file read]`
- `.planning/codebase/TESTING.md` — project's own testing-pattern documentation `[VERIFIED: local file read]`
- `package.json`, `vitest.config.ts` — dependency/version/config ground truth `[VERIFIED: local file read]`
- `vitest --version` output (`vitest/4.1.9 linux-arm64 node-v22.22.1`) — confirmed installed and runnable `[VERIFIED: local command execution]`
- ECMA-262 `Array.prototype.sort` stability guarantee (stable since ES2019, applies to the project's ES2022 target) — used to confirm D-08's "first wins" needs no `router.ts` algorithm change `[VERIFIED: ECMA-262 specification, well-established language guarantee, no external lookup needed]`

### Secondary (MEDIUM confidence)
None used — this phase required no external documentation lookups; all research grounded directly in the project's own source and prior-phase decision history (`.planning/STATE.md`, `.planning/phases/01-*/`, `.planning/phases/02-*/`, `.planning/phases/03-*/` context files).

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, existing installed versions verified directly.
- Architecture (race fix shape): HIGH on root-cause diagnosis (directly traced through the actual source), MEDIUM on the exact recommended fix shape (a sound, idiomatically-consistent recommendation, but explicitly a discretion call per CONTEXT.md, not a single verified-correct answer — flagged as such throughout).
- Manifest/route validation design: HIGH on what's broken and why (verified against source), MEDIUM on the precise "unfixable" boundary and exact `dx:error` source strings (both explicitly delegated to discretion in CONTEXT.md, treated here as assumptions/recommendations, not facts).
- Pitfalls: HIGH — all five are derived directly from tracing actual code paths and existing test-suite conventions, not speculative.

**Research date:** 2026-07-13
**Valid until:** No expiry driver — this is internal-code research with no external dependency drift risk; valid until the underlying `src/` files change (i.e., effectively until this phase itself is implemented).

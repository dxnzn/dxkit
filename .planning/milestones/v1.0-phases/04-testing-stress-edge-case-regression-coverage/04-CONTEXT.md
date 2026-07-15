# Phase 4: Testing — Stress, Edge-Case & Regression Coverage - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

The test suite gains dedicated coverage for the three scenarios the concerns audit flagged as missing, plus the correctness fixes those tests demand:

- **TEST-01** — A stress suite drives rapid A→B→A navigation with slow loaders and asserts no double-mount / no lost-unmount. The owner chose a **last-navigation-wins** invariant, which current code does not satisfy (`src/shell.ts:283-317` + `src/lifecycle.ts:272-364` let the last-*finishing* mount win the DOM) — so **this phase fixes the mount race in-phase**, alongside the tests that prove it.
- **TEST-02** — Manifest-validation edge cases: invalid route formats, deep-merge override behavior, multi-match/duplicate routes. The owner locked *policy* changes here too: route normalization + reject-unfixable, validation across all three manifest tiers, and duplicate-route visibility (see decisions).
- **TEST-03** — A full-shell integration regression proving settings handlers registered by a dapp do not fire after `disableDapp()` (Phase 2 shipped plugin-level tests; this drives the real `createShell` → `dx:dapp:disabled` wiring).
- **WR-01 (folded)** — `loadDappManifest` fetch/HTTP/JSON-parse failures emit `dx:error` (source per the D-02 taxonomy, e.g. `shell:manifest`) instead of silently returning null, plus a regression test.

**Standing policy for this phase:** correctness bugs surfaced by the new tests are fixed in-phase with their tests — the suite lands green. Only genuinely out-of-scope findings (new features, design questions) become todos.

**Not in scope:** new routing features (wildcard/`:param` — out of milestone), docs updates for the fixed/changed behavior (Phase 5 verifies docs against final 0.2.0 code), coverage thresholds/tooling changes, E2E/browser testing (suite stays vitest + happy-dom).
</domain>

<decisions>
## Implementation Decisions

### TEST-01 — Race invariants (and the fix they require)
- **D-01 (last navigation wins):** Under concurrent mounts, the final DOM and `lifecycle.getCurrentDapp()` MUST match the most recent navigation. Stale in-flight mounts must not complete — they must not inject DOM, set `currentDappId`, or emit `dx:mount`. Current code fails this (whichever mount finishes last wins); the fix lands in this phase. Fix shape (e.g. a mount-generation/epoch token checked before injection) is Claude's discretion.
- **D-02 (strict event alternation):** Tests assert the full observable stream: every `dx:mount` is followed by that dapp's `dx:unmount` before any other `dx:mount` fires. Superseded in-flight mounts emit neither event. Rationale: dapps rely on mount/unmount pairing for teardown; this is the strongest regression guard.
- **D-03 (race scenario matrix):** Beyond rapid A→B→A, the stress suite covers all four additional interleavings:
  1. `disableDapp()` while that dapp's mount is in flight (router rebuild + unmount racing the pending mount).
  2. A load timeout (Phase 2's 30s guard) firing after the user already navigated away — the abort must not clear the *new* dapp's DOM or emit misattributed `dx:error`.
  3. Sub-path navigation into dapp A while A's initial mount is still loading (`dx:route:subpath` vs `pendingMountId` interaction).
  4. `shell.init()`'s initial-route mount racing an immediate first navigation.

### Bug-fix policy
- **D-04 (race fix in-phase):** The known mount race is fixed in this phase, together with the stress tests that prove it. No known-failing (`test.fails`) assertions land.
- **D-05 (correctness bugs fix in-phase):** Any further race/correctness/lost-event bug the new tests surface is fixed in-phase with its test. Only out-of-scope findings (feature requests, design questions) are filed as todos. The suite ships green.

### TEST-02 — Manifest validation policy
- **D-06 (route normalization + reject unfixable):** Manifest routes get the same normalization rules as `normalizePath` (`src/router.ts:27-39`: ensure leading slash, strip trailing slash) applied at router construction, so `"blog"` → `"/blog"` just works instead of being a silently-dead route. Empty/garbage routes that normalization can't fix are rejected with `dx:error`. This is a behavior change justified by the milestone's no-silent-failures charter.
- **D-07 (validate all three tiers):** `isValidManifest` currently guards only the dapp-entries tier — inline manifests and `registry.json` results flow through unvalidated (`src/shell.ts:196-214`). All three tiers now validate; invalid manifests are discarded with the same `shell:manifest` `dx:error`.
- **D-08 (duplicate routes — first wins + dx:error):** Two manifests with the same exact route keep deterministic first-registered-wins resolution, but the shell emits `dx:error` naming the conflicting ids so the collision is visible. Tests assert both the winner and the emit. Overlapping-prefix multi-match (`/tools` vs `/tools/sender`) stays longest-route-wins and gets asserted as-is.
- **D-09 (deepMerge — assert documented semantics):** Override-merge tests lock the documented `deepMerge` contract (`src/utils.ts:1-22`): nested objects merge recursively, arrays in overrides replace wholesale, `null`/`undefined` values are skipped, `__proto__`/`constructor`/`prototype` keys are ignored (pollution guard).

### TEST-03 — Settings-cleanup regression depth
- **D-10 (full-shell integration):** The regression drives the real path — `createShell` → mount dapp → register settings handlers via the actual plugin → `disableDapp()` → assert handlers neither fire nor leak — through the real `dx:dapp:disabled` wiring, not a mocked context. Phase 2's plugin-level tests remain; this adds the integration layer TEST-03's criterion describes.

### Suite organization & technique
- **D-11 (dedicated stress file):** Concurrency/race scenarios live in a new dedicated test file (e.g. `tests/stress.test.ts`); manifest edge cases extend `tests/shell.test.ts` / `tests/router.test.ts` where those behaviors already live.
- **D-12 (deferred promises + targeted fake timers):** Slow loaders are simulated with manually-resolved deferred-promise loader fixtures for exact interleaving control (resolve B before A on demand). `vi.useFakeTimers` is used only where the timeout clock matters (the timeout-racing-navigation scenario). No real-delay (`setTimeout(5ms)`) timing-dependent tests.

### Claude's Discretion
- The race-fix mechanism (mount-generation token vs abort-signal plumbing vs queue) — so long as D-01/D-02 invariants hold and the change stays within the zero-runtime-deps / no-bundler constraints.
- Where route normalization/rejection executes (router construction vs manifest load) and the exact `dx:error` source strings for new emits — follow the established colon-hierarchical taxonomy (`shell:manifest`, `shell:route`, etc.).
- Exact stress-file name and internal describe-block structure, consistent with existing suite conventions.
- WR-01 error-source/message wording, mirroring the existing validation-failure emit at `src/shell.ts:177-185`.
- Whether behavior-change commits (route normalization, tier validation, duplicate emit) warrant `BREAKING CHANGE:` footers — judge each against the milestone rule (justified + migration notes); the race fix is a straight bug fix.

### Folded Todos
- **WR-01 — Surface loadDappManifest fetch and parse failures** (`.planning/todos/pending/2026-07-11-surface-loaddappmanifest-fetch-and-parse-failures.md`, from `01-REVIEW.md`): the `try/catch → return null` at `src/shell.ts:172-193` silently swallows manifest 404s and corrupt JSON while sibling validation failures emit `dx:error`. Fix: emit on fetch/HTTP/parse failure + regression test. Folded because TEST-02 exercises exactly this path — single-touch economics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 4: Testing — Stress, Edge-Case & Regression Coverage" — goal + three success criteria.
- `.planning/REQUIREMENTS.md` — TEST-01, TEST-02, TEST-03 definitions.
- `.planning/PROJECT.md` §Constraints — zero-runtime-deps, IIFE/IPFS-first, breaking-changes-must-be-justified posture governing the fixes this phase makes.

### Folded todo
- `.planning/todos/pending/2026-07-11-surface-loaddappmanifest-fetch-and-parse-failures.md` — WR-01 problem statement + solution sketch.
- `.planning/phases/01-diagnostics-surface-silent-failures/01-REVIEW.md` — original WR-01 finding.

### Code truth (the sites this phase tests and fixes)
- `src/shell.ts:283-317` — `mountDapp()`: same-dapp `pendingMountId` dedupe (`:299`), sub-path short-circuit (`:287-294`), the cross-dapp race window D-01 fixes.
- `src/lifecycle.ts:272-364` — `mount()` unmounts previous at start (`:274-275`) but sets `currentDappId` only at the end (`:364`) — the root of last-finisher-wins; `:371-377` — `unmount()` event emission (D-02's pairing source).
- `src/shell.ts:160-193` — `isValidManifest()` + `loadDappManifest()` (WR-01 silent catch at `:190-192`, validation emit template at `:177-185`).
- `src/shell.ts:196-214` — `loadManifests()` three-tier fallback; inline/registry tiers bypass validation (D-07 fix site).
- `src/router.ts:22-50` — construction-time length-sort (`:24`), `normalizePath()` (`:27-39`, the rules D-06 reuses for routes), verbatim route matching in `resolve()` (`:44-46`).
- `src/utils.ts:1-22` — `deepMerge` documented semantics D-09 locks.
- `src/shell.ts:104-120` — `disableDapp()` → router rebuild + `dx:dapp:disabled` emit (D-03 scenario 1 + D-10 trigger).
- `plugins/settings/src/index.ts` — `cleanup(dappId)` wiring from Phase 2 (ROB-04) that D-10's integration regression drives end-to-end.
- `src/types/events.ts` — `dx:error` payload `{ source, error }` (unchanged; new sources follow the existing taxonomy).

### Testing conventions
- `.planning/codebase/TESTING.md` — suite structure, `tick()` async helper, manifest factory, loader stubs, mock-context pattern, destroy/cleanup conventions all new tests must follow.
- `vitest.config.ts` — happy-dom environment + path aliases.

### Prior phase context (locked behavior the tests assert against)
- `.planning/phases/02-robustness-load-guards-caching-handler-cleanup/02-CONTEXT.md` — timeout semantics (per-fetch, 30s default, style non-blocking vs abort-and-clear), template cache, ROB-04 cleanup decisions (D-13/D-14/D-15 there) that TEST-03 and the timeout-race scenario exercise.
- `.planning/phases/01-diagnostics-surface-silent-failures/01-CONTEXT.md` — `dx:error` source/message convention (colon taxonomy, wrapped Error with `cause`) every new emit follows; container-clear guarantee the race fix must preserve.
- `.planning/phases/03-security-sanitization-storage-isolation/03-CONTEXT.md` — nested `ShellConfig.lifecycle` config shape and sanitizer-in-mount-flow step that stress fixtures must construct shells with.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`tick()` helper + manifest factory + loader stubs** (see `.planning/codebase/TESTING.md`) — established fixtures the stress suite extends; the deferred-promise loader (D-12) is a natural evolution of the existing `noopLoader`/`failLoader` stubs.
- **`pendingMountId` guard** (`src/shell.ts:56-58`, `:299`) — existing same-dapp dedupe with an explanatory comment; the D-01 fix generalizes this idea (a generation/epoch check) to cross-dapp supersession.
- **`dx:error` emit sites** (`src/shell.ts:177-185`, `:303-307`) — the exact template for WR-01, duplicate-route, and route-rejection emits.
- **Existing shell integration tests** (`tests/shell.test.ts`, 97 tests) — shell-construction fixtures and `window.__DXKIT__` cleanup patterns the new integration regression reuses.

### Established Patterns
- Failures are contained: emit + graceful return, never throw out of shell/lifecycle flow — race-fix abandonment paths and new validation rejections must obey this.
- One test file per source module; fixtures inline, not shared files (D-11's dedicated stress file is a deliberate, scoped exception for cross-module race scenarios).
- Destroy-pattern cleanup called inside tests (not `afterEach`) to verify teardown; `afterEach` deletes `window.__DXKIT__` in shell tests.
- Phase 1's D-04/D-09 "emit every time, no dedupe state" convention applies to the new duplicate-route and WR-01 emits.

### Integration Points
- Race fix: `src/shell.ts` `mountDapp`/`handleRouteChange` + `src/lifecycle.ts` `mount()` (where stale mounts must abandon before injection).
- Manifest policy: `isValidManifest`/`loadDappManifest`/`loadManifests` in `src/shell.ts`; route normalization at `createRouter` construction or manifest-load time (discretion).
- TEST-03 regression: `createShell` + real settings plugin + `disableDapp()` — no mocked context.

</code_context>

<specifics>
## Specific Ideas

- **The load-bearing discovery this discussion produced:** `lifecycle.mount()` unmounts the previous dapp at the start but claims `currentDappId` only after all async loading, while the shell's `pendingMountId` only dedupes same-dapp mounts — so A→B→A with slow loaders races three mounts into one container and the last *finisher* wins. The owner explicitly chose to define correctness as last-*navigation*-wins and fix it now rather than characterize the bug.
- **"No silent failures" is still the charter:** every manifest-policy decision (D-06/D-07/D-08, WR-01) resolved toward visibility — normalize what's fixable, emit `dx:error` for everything else, never silently drop or dead-route a dapp.
- **Tests are specifications here, not characterization:** where current behavior and correct behavior diverge, the tests assert correct behavior and the phase changes the code to match.

</specifics>

<deferred>
## Deferred Ideas

- **Docs for the new/changed behavior** (route normalization rules, duplicate-route emit, manifest-tier validation, race semantics) — Phase 5 (DOC-01) verifies docs against final 0.2.0 code; migration notes still ship with any breaking commits in this phase.
- **Coverage thresholds/reporters in vitest config** — noted during scouting that coverage is not configured; out of scope for this phase (no requirement backs it).
- **Wildcard/regex/`:param` routes** — out of milestone (ROUTE-01, v2); route-format policy here deliberately avoids constraining that future design.

</deferred>

---

*Phase: 4-testing-stress-edge-case-regression-coverage*
*Context gathered: 2026-07-13*

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 05
current_phase_name: documentation-truth-pass
status: executing
stopped_at: Completed 05-07-PLAN.md
last_updated: "2026-07-14T16:24:08.289Z"
last_activity: 2026-07-14
last_activity_desc: Phase 05 execution started
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 23
  completed_plans: 22
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-11)

**Core value:** DxKit stays trustworthy for real use — failures are visible (never silent), documented behavior matches actual behavior, and the alpha is stable enough to build on with confidence.
**Current focus:** Phase 05 — documentation-truth-pass

## Current Position

Phase: 05 (documentation-truth-pass) — EXECUTING
Plan: 8 of 8
Status: Ready to execute
Last activity: 2026-07-14 — Phase 05 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 15
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | - | - |
| 02 | 4 | - | - |
| 03 | 3 | - | - |
| 04 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 4min | 2 tasks | 4 files |
| Phase 01 P02 | 15min | 3 tasks | 6 files |
| Phase 02 P01 | 3min | 2 tasks | 2 files |
| Phase 02 P02 | 4min | 2 tasks | 2 files |
| Phase 02 P03 | 5min | 2 tasks | 2 files |
| Phase 02 P04 | 4min | 2 tasks | 2 files |
| Phase 03 P01 | 8min | 2 tasks | 3 files |
| Phase 03 P02 | 10 min | 3 tasks | 2 files |
| Phase 03 P03 | 10min | 2 tasks | 3 files |
| Phase 04 P01 | 27min | 2 tasks | 4 files |
| Phase 04 P03 | 12min | 2 tasks | 3 files |
| Phase 04 P02 | 15min | 3 tasks | 3 files |
| Phase 04 P04 | 10min | 2 tasks | 2 files |
| Phase 04 P05 | 12min | 2 tasks | 3 files |
| Phase 04 P06 | 8min | 2 tasks | 2 files |
| Phase 05 P01 | 25min | 3 tasks | 5 files |
| Phase 05 P02 | 35min | 2 tasks | 3 files |
| Phase 05 P03 | 15min | 2 tasks | 3 files |
| Phase 05 P04 | 25min | 2 tasks | 3 files |
| Phase 05 P05 | 30min | 2 tasks | 6 files |
| Phase 05 P06 | 35min | 2 tasks | 4 files |
| Phase 05 P07 | 20min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Milestone-wide: Scope as "harden toward beta", ship as 0.2.0 — alpha is field-stable, this is robustness/trust work, not a feature push.
- Milestone-wide: Target all four hardening tracks (diagnostics/silent failures, robustness, security, tests) — a partial pass leaves obvious gaps per the concerns audit.
- Milestone-wide: Docs pass (Phase 5) = verify-against-code + slop cleanup + gap-fill; sequenced last so it reflects final 0.2.0 behavior.
- Milestone-wide: Breaking changes allowed but must be justified and carry `BREAKING CHANGE:` footers + migration notes.
- Milestone-wide: TS6 migration, new routing features, storage encryption, and cross-dapp state sharing are explicitly out of scope for this milestone.
- [Phase 01-01]: shell:mount emit follows the existing shell:manifest wrapped-message convention — Consistency with in-file dx:error emit sites (D-02/D-03)
- [Phase 01-01]: Container clear applied only to the two post-injection catches (dependency-loop, entry-script) — Template-catch returns before/at injection so no stale DOM exists there (D-12 scope boundary)
- [Phase 01]: Wallet canUseStorage() guard copied verbatim from settings/theme to preserve D-07 silent-on-unavailable behavior
- [Phase 01]: New storage-failure dx:error sites use fresh Error with cause: err, distinct from existing shell/lifecycle convention of re-deriving/passing the caught error
- [Phase 02-01]: timeout is per-fetch (D-01), 30000ms default ships enabled as a breaking change (D-02), timeout: 0/Infinity opt-out restores hang-forever (D-03), built-in loaders true-abort via node removal / AbortController (D-06), custom loaders get a Promise.race hang guard with unchanged type signatures (D-07) — Matches ROB-01 plan decisions in 02-CONTEXT.md; un-hangable mounts by default is the point of ROB-01
- [Phase 02-02]: Router sort snapshot uses array spread (not a live reference to config.manifests) so post-construction mutation of the caller's array cannot affect resolution (D-08), locked in by a dedicated regression test
- [Phase 02-03]: cleanup(dappId) matches keyHandlers entries by ${dappId}: prefix, which naturally excludes _shell:* bridge handlers without a special-case check (D-14)
- [Phase 02-03]: dx:dapp:disabled subscription stored as a Listener from context.events.on() (not a bare unsubscribe fn) and torn down via .off() in destroy(), mirroring the auth plugin's subscribe/unsubscribe lifecycle
- [Phase 02-03]: No subscription to dx:unmount — cleanup fires only on dx:dapp:disabled so handlers survive normal navigation-away (D-15)
- [Phase 02-04]: cacheTemplates defaults to true (D-09), cache wraps outermost above the timeout-wrapped loadTemplate loader so a cache hit skips the fetch and its timeout entirely (D-11/D-12), clearTemplateCache()/invalidateTemplate(url) give full-reset and single-URL invalidation (D-10) — closure-held Map<url, html>, no module-level singleton
- [Phase 03-01]: TemplateSanitizer captured once at construction, undefined means pass-through unchanged (no bundled sanitizer) — Preserves zero-runtime-deps posture and 0.1.5 byte-for-byte default behavior per D-01/D-02
- [Phase 03-01]: Sanitize step lives in its own try/catch nested after the fetch try/catch resolves, with distinct lifecycle:<id>:sanitize error source — Keeps fetch failures and sanitizer failures distinguishable per D-08, avoids RESEARCH Pitfall 1
- [Phase 03-02]: storageKey used verbatim, no auto-derived prefixing (D-09) — Consumer owns the full literal key; keeps behavior predictable
- [Phase 03-02]: No migration from legacy 'dxkit:wallet' key when a custom storageKey is set (D-10) — Avoids one app's persisted selection clobbering another's on a shared origin
- [Phase 03-02]: Reconnect-failure dx:error emits before persistProvider(null) clears the key (D-12) — Preserves existing clear-on-failure behavior while adding required visibility
- [Phase 03-02]: address! assertions replaced with truthy guards, not just removed (D-11) — connect() now guarantees non-empty address before updateState is called with connected:true; guard encodes that invariant in the type system
- [Phase 03-03]: Fixed the plan's stated LifecycleManagerOptions import path (./lifecycle.js -> ../lifecycle.js) — src/lifecycle.ts lives one directory above src/types/; the literal path in the plan would not have resolved
- [Phase 03-03]: BREAKING CHANGE footer placed on the Task 1 commit, not Task 2 — Task 1 lands the actual type removal + runtime throw; Task 2 is pure test migration onto the already-breaking shape
- [Phase 04-01]: Mount-generation guard (mountGeneration counter + isStale() gating) fixes last-navigation-wins; closure-scoped, never module-level — Multiple shells in one process must not share a counter; generalizes the existing pendingMountId same-dapp dedupe idiom to cross-dapp supersession
- [Phase 04-01]: invalidatePendingMount(id) added to LifecycleManager, wired from shell.disableDapp(), to close the disable-mid-flight race gap — rebuildRouter() only acts on lifecycle.getCurrentDapp(), which is null for a not-yet-committed mount
- [Phase 04-01]: Sub-path stale-path bug fixed by re-reading router.getCurrentPath() after lifecycle.mount() resolves, emitting a dx:route:subpath catch-up if it moved — pendingMountId dedupe silently dropped sub-path navigations during a pending mount with no side effect, leaving the committed path stale
- [Phase 04-03]: TEST-03 regression lives in new plugins/settings/tests/integration.test.ts, not appended to shell.test.ts — Keeps the real-wiring vs mocked-context contrast explicit and co-located with the plugin it drives
- [Phase 04-03]: deepMerge JSDoc reconciled to code truth (null replaces, undefined skips) rather than changing runtime null-handling — Manifest overrides in src/shell.ts depend on null-replaces; an existing test already pins that behavior
- [Phase 04-02]: normalizeAndValidateManifests() runs once in init() after loadManifests(), before initEnabledState()/createRouter() — Single choke point for route normalization (D-06), tier-uniform validation (D-07), and duplicate-route detection (D-08); enable/disable never changes the manifest list so re-running per rebuildRouter() would be wasted work
- [Phase 04-02]: shell:route is a new dx:error source for reject-unfixable routes; WR-01 and duplicate-route emits reuse shell:manifest — Follows the colon-hierarchical taxonomy per RESEARCH.md Open Question 1 — route-reject is a distinct routing-table construction problem, while WR-01/duplicate-route are manifest-content conflicts
- [Phase 04-02]: Duplicate-route manifests are kept in the list, not discarded — First-registered-wins resolution is already guaranteed by router.ts's stable construction-time sort (ES2019+ Array.prototype.sort stability) — the fix only needed to surface the collision via dx:error naming both ids
- [Phase 04]: [Phase 04-04]: Reused lifecycle.invalidatePendingMount(id) guarded on truthy pendingMountId at handleRouteChange's null-manifest branch, matching disableDapp's existing wiring, to close CR-01 (D-01 dapp->unmatched-route hole)
- [Phase 04-05]: invalidateAnyPendingMount() bumps mountGeneration only when inFlightMountId !== null, decoupling unmatched-route invalidation from the corruptible shell-level pendingMountId slot
- [Phase 04-05]: mountDapp finally guarded (pendingMountId === manifest.id) so a stale settling call cannot clobber a newer mount's in-flight marker
- [Phase 04-06]: pendingMountToken makes the shell mount dedupe slot call-scoped; releasePendingMount() frees it at both invalidation sites (handleRouteChange null branch, disableDapp) so re-navigation to an invalidated dapp mounts fresh instead of being dropped (CR-01, third D-01 instance)
- [Phase 05-01]: D-15 message shape mirrors loadDappManifest()'s two-message split (status-info for non-OK, unified network/parse message with cause for the throw/parse catch) — Claude's Discretion per RESEARCH Open Question 1
- [Phase 05-01]: D-16 keeps committed-mount and in-flight-mount disable paths as two distinct branches, only the navigate-to-/ outcome converges — Per Pitfall 3 in RESEARCH/PATTERNS — collapsing the branches risked duplicating unmount() calls
- [Phase 05-01]: D-17's ownership-guarded clear applied at every mount() exit path with the leak shape (missing-plugin return, all 4 catch blocks, all 4 bare isStale gates, final commit), not just the 4 literally-named bare gates — The catch blocks' own stale branches had the identical unaddressed leak gap
- [Phase 05-02]: dx:error catalog presented as 23 distinct source+trigger rows (not collapsed by literal source string) — every distinct trigger is independently actionable for a dx:error handler, and DOC-01 required every source string including D-15's registry emit
- [Phase 05-02]: createEthereumWallet()'s deprecated status was checked but produced no api-reference.md edit — that doc's Factory Functions section only covers core factories, plugin factories belong to docs/plugins/wallet.md (a later sweep plan's scope)
- [Phase 05-03]: Config defaults and nested lifecycle shape in configuration.md/getting-started.md were already accurate against source; drift was narrower than expected (D-07 timeless-present violations + missing custom-loader timeout caveat), not wholesale default corrections
- [Phase 05-03]: Migration section titled 'Migrating to 0.2.0' placed as its own section in getting-started.md per D-05 Claude's-discretion placement; configuration.md's breaking-change note links out to it instead of duplicating history
- [Phase 05-04]: dapp-development.md and system-internals.md now state the single post-D-16 disable-while-active outcome rule (return to /) per Pitfall 3, without naming a single implementation function
- [Phase 05-05]: Corrected duck-typing attribution bug and false 'settings should be registered last' claim (duplicated in plugin-development.md and settings.md) by tracing src/shell.ts's register-all-then-init-all loop structure — settings-array discovery is order-independent, but settings must be registered before theme (which writes to dx.settings during its own init())
- [Phase 05-05]: Added storageKey to wallet.md's WalletOptions table — it was entirely absent despite being the Phase 3 SEC-02 hardening; also added Error Handling subsections (dx:error catalogs) to wallet/theme/settings docs and settings.md's previously-undocumented ROB-04 handler-cleanup-on-disable behavior
- [Phase 05]: Cookbook Custom Events recipe had the same 'declare module dxkit' bug already fixed elsewhere in Plan 05-02 — fixed to '@dnzn/dxkit'
- [Phase 05]: Verified development.md's plugin-bundling claim against compiled dist/index.global.js rather than tsup.config.ts intent alone — no plugin config bundles a sibling plugin package, and the noExternal @dnzn/dxkit entry bundles nothing since plugins only type-import from core; rewrote to state the real reason standalone script tags work
- [Phase 05-07]: Documented that <script> tags parsed via innerHTML never execute, then reasoned why CSP script-src still matters against unsanitized template HTML (inline event-handler attributes / javascript: URLs are blocked without unsafe-inline) — ties CSP guidance directly to src/lifecycle.ts's innerHTML injection point, framing CSP and the sanitizer as complementary layers, not redundant ones
- [Phase 05-07]: IPFS gateway CSP guidance distinguishes path-style gateways (shared origin, weak self isolation) from subdomain-style gateways (per-CID origin) rather than one blanket caveat — directional per RESEARCH Assumption A2, not a normative claim

### Pending Todos

3 open (from Phase 1 code review, `01-REVIEW.md`):

- WR-01 — surface `loadDappManifest` fetch/parse failures (`src/shell.ts`)
- WR-02 — wallet connect empty-accounts yields `undefined` address (`plugins/wallet`)
- WR-03 — surface wallet auto-reconnect failure on init (`plugins/wallet`) → tagged `resolves_phase: 3` (bundle with SEC-02)

### Blockers/Concerns

- Phase 3 (Security) touches `innerHTML` template injection and wallet storage — `security_enforcement` is enabled in config (ASVS level 1, block on high), so expect extra scrutiny/review on this phase's plan and verification.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260712-wcu | Implement PR #3 self-review findings: hasPlugin guard, sanitizer timeout, wallet contract-violation error, cause preservation, hasOwn guard | 2026-07-13 | d349ca9 | [260712-wcu-implement-pr3-self-review-findings-haspl](./quick/260712-wcu-implement-pr3-self-review-findings-haspl/) |
| 260714-1lz | Fix stale mountDapp epilogue (subpath swallow/duplicate) and normalizeRoute trim from PR #4 review | 2026-07-14 | 17e863d | [260714-1lz-fix-stale-mountdapp-epilogue-subpath-swa](./quick/260714-1lz-fix-stale-mountdapp-epilogue-subpath-swa/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-14T16:24:08.277Z
Stopped at: Completed 05-07-PLAN.md
Resume file: 
None

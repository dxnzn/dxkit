# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.2.0](https://github.com/dxnzn/dxkit/compare/v0.1.5...v0.2.0) (2026-07-15)


### ⚠ BREAKING CHANGES

* footer.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

* test(stress): dedicated concurrency stress suite for the D-03 race matrix

Adds tests/stress.test.ts (D-11) — a dedicated suite driving every scenario
through createShell() + shell.navigate() (not createLifecycleManager()
directly, per Pitfall 4) in history mode (deterministic synchronous
notifyListeners, per Pitfall 3), proving the generation-guard fix from the
prior commit against the full D-03 matrix:

1. Rapid A->B->A with slow loaders — last-navigation-wins, no double-mount,
   strict dx:mount/dx:unmount alternation, and container DOM content matches
   the winning navigation (not just the event stream — Pitfall 1).
2. disableDapp() racing an in-flight mount — the disabled dapp is fully
   abandoned via invalidatePendingMount(), no dx:mount/dx:dapp:mounted.
3. A load timeout firing after navigate-away — the abort doesn't clear the
   new dapp's DOM or misattribute dx:error to the superseded mount (uses
   vi.useFakeTimers(), resolving deferred fixtures before advancing per
   Pitfall 2).
4. Sub-path navigation into a still-mounting dapp — the committed path and
   dx:route:subpath catch-up reflect the freshest resolved path, not the
   stale path captured when the pending mount started.
5. shell.init()'s initial-route mount racing an immediate first navigation —
   last-navigation-wins holds at boot too.

Fixtures use a keyed-gate helper (deferred promises collected per src/url,
release() resolves every concurrent waiter for that key) for exact,
timing-independent interleaving control — no real-delay waits anywhere
(D-12). Suite ships green: `make test` passes, no test.fails/.skip.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

* docs(04-01): complete mount-race fix and stress suite plan

* test(04-03): full-shell settings-cleanup regression (TEST-03/D-10)

Phase 2 (ROB-04) shipped settings handler cleanup with plugin-level tests
against a mocked context. This adds the integration layer TEST-03 requires:
drive the real createShell -> mount config -> register settings handlers
via the actual plugin -> shell.disableDapp() -> assert the disabled dapp's
handler stops firing while an unrelated dapp's handler is untouched (no
over-cleanup), all through the real dx:dapp:disabled wiring
(plugins/settings/src/index.ts:242), not a mocked emit.

See: .planning/phases/04-testing-stress-edge-case-regression-coverage/04-03-PLAN.md (Task 1)

* test(04-03): lock deepMerge nested-array/pollution semantics, reconcile JSDoc (D-09)

Existing tests/utils.test.ts already covered flat/nested merge, top-level
array replace, undefined-skip, null-replace, and single-level
__proto__/constructor/prototype rejection. Fills the two genuine D-09 gaps:
arrays replace wholesale even when nested one level deep (not just
top-level), and constructor/prototype pollution keys are rejected at that
same nested depth (previously only __proto__ had a nested case).

Also corrects the deepMerge JSDoc toward code truth: line 17
(`else if (val !== undefined)`) only skips undefined — null replaces, as
the pre-existing "replaces with null" test already locks. The JSDoc
wrongly claimed both were skipped. Comment-only fix; no runtime/control-flow
change (git diff src/utils.ts touches only the doc comment). Manifest
overrides (src/shell.ts:187-194 loadDappManifest -> deepMerge) keep their
current null-replaces behavior unchanged.

See: .planning/phases/04-testing-stress-edge-case-regression-coverage/04-03-PLAN.md (Task 2)

* docs(04-03): complete settings-cleanup integration + deepMerge semantics plan

* docs(04): revert premature TEST-02 completion marking

* feat(04-02): shell-owned manifest normalize/validate/dedupe + WR-01 emits

Closes the manifest-validation gaps the concerns audit flagged (D-06/D-07/
D-08) plus the WR-01 silent-swallow in loadDappManifest: previously only
the dapp-entries tier ran isValidManifest, routes were matched verbatim
(so "blog" silently dead-routed), duplicate routes silently shadowed, and
loadDappManifest's catch/!res.ok branches returned null with no dx:error.

normalizeAndValidateManifests() is a new single choke point invoked once
in init() right after loadManifests() resolves (not per rebuildRouter() —
enable/disable doesn't change the manifest list). It normalizes routes
(leading-slash/trailing-slash subset of router.ts's normalizePath, no
basePath stripping since manifest routes don't carry one), rejects
empty/whitespace-only routes as unfixable (new shell:route source), runs
isValidManifest uniformly across all three tiers, and detects duplicate
exact routes — keeping the first-registered manifest (already guaranteed
by router.ts's stable sort) but emitting dx:error naming both ids.

loadDappManifest's !res.ok branch and catch block now emit dx:error
(source shell:manifest) instead of silently returning null; the catch
wraps the caught error with `cause`, covering both network-throw and
res.json() parse-failure indiscriminately since that's genuinely what it
catches.
* inline manifests and registry.json manifests missing
required fields (id, route, entry, nav.label) are now discarded with a
dx:error instead of being silently accepted unvalidated. Previously only
the dapp-entries tier enforced this. Consumers with malformed inline or
registry.json manifests will see those entries dropped from
getManifests()/getEnabledManifests() and a dx:error emitted (source
shell:manifest) — fix the manifest to restore it.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

* test(04-02): router-level exact-duplicate first-wins resolution (D-08)

Locks the resolution half of D-08: two manifests declaring an identical
exact route resolve to the first-registered one, verified in both
insertion orders — this is a direct consequence of Array.prototype.sort's
ES2019+ stability guarantee (router.ts's construction-time length-sort),
not new router logic. The dx:error visibility half of D-08 is shell-owned
and covered in tests/shell.test.ts.

Longest-prefix multi-match precedence (/tools/sender over /tools) was
already covered by the existing "uses longest prefix match" test — no
duplicate case added per the plan's discretion.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

* test(04-02): shell-level manifest validation/normalization/dedupe/WR-01 coverage

Extends tests/shell.test.ts with the integration-level TEST-02 cases that
need the shell's dx:error (so they live here, not in router.test.ts):

- Route normalization (D-06): an inline manifest with route: 'blog' (no
  leading slash) mounts at /blog — the previously-dead route now works.
- Reject-unfixable (D-06): an empty/whitespace-only route is discarded
  with a shell:route dx:error.
- Tier parity (D-07): both the inline and registry.json tiers now discard
  invalid manifests with a shell:manifest dx:error — proving the
  previously-unvalidated tiers validate identically to dapp-entries.
- Duplicate-route (D-08): two manifests sharing an exact route emit a
  shell:manifest dx:error naming both ids; the first-registered manifest
  is the one that actually mounts.
- WR-01: the existing "skips dapps with failed manifest fetch" test now
  also asserts a dx:error was emitted (assertion changed, not merely
  supplemented, since the underlying behavior changed from silent to
  silent-list-but-loud-dx:error); added sibling cases for the JSON-parse-
  failure and network-throw failure modes.

Full suite green: make test passes (308 tests, 12 files).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

* docs(04-02): complete manifest and route validation hardening plan

* docs(04): add code review report

* docs(04): record verification gaps; keep phase 4 open pending gap closure

* docs(04): add gap-closure plan 04-04 for CR-01 (D-01 unmatched-route hole)

* docs(04): create gap-closure plan for CR-01

* fix(04-04): supersede in-flight mount on unmatched-route navigation

handleRouteChange's null-manifest branch only called lifecycle.unmount()
and never bumped the mount-generation guard, so a dapp mount already in
flight when the user navigated to a route no manifest matches could still
commit: dx:mount/dx:dapp:mounted fired, the stale template landed in
#dx-mount, and a misattributed dx:route:subpath named the abandoned dapp
under the new (unmatched) path. This closes the one-line hole Plan 01's
mount-generation guard left in the dapp->unmatched-route transition,
reusing the same lifecycle.invalidatePendingMount() wiring disableDapp()
already uses for the dapp->disabled transition.
* **shell:** ShellConfig.scriptLoader/styleLoader/templateLoader are
removed. Move them under a nested lifecycle group:
  createShell({ scriptLoader, styleLoader, templateLoader })
  -> createShell({ lifecycle: { scriptLoader, styleLoader, templateLoader } })
createShell() throws at construction time if any of the old flat keys is
present, for consumers who bypass TypeScript (IIFE/<script> usage).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
* **lifecycle:** dapp asset loads now time out after 30s by default instead of
hanging indefinitely. Consumers that rely on unbounded loads (e.g. slow IPFS
gateways) must opt out explicitly with `timeout: 0` or `timeout: Infinity`.

See: .planning/phases/02-robustness-load-guards-caching-handler-cleanup/02-01-SUMMARY.md
See: .planning/phases/02-robustness-load-guards-caching-handler-cleanup/02-04-SUMMARY.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

* Phase 4: Testing — Stress, Edge-Case & Regression Coverage (#4) ([ea11d98](https://github.com/dxnzn/dxkit/commit/ea11d98f1f7258a4d2bcd1df8d7f32af74ce686e)), closes [#4](https://github.com/dxnzn/dxkit/issues/4) [#4](https://github.com/dxnzn/dxkit/issues/4) [#4](https://github.com/dxnzn/dxkit/issues/4) [#4](https://github.com/dxnzn/dxkit/issues/4) [#4](https://github.com/dxnzn/dxkit/issues/4) [#4](https://github.com/dxnzn/dxkit/issues/4) [#4](https://github.com/dxnzn/dxkit/issues/4) [#4](https://github.com/dxnzn/dxkit/issues/4)


### Features

* **01-01:** clear mount container on post-injection load failure ([a567a7c](https://github.com/dxnzn/dxkit/commit/a567a7c6d0236c157991aea9833f340c33db4d03))
* **01-01:** emit dx:error when #dx-mount cannot be resolved ([488f04f](https://github.com/dxnzn/dxkit/commit/488f04f74b5e6007d4648ddf0910945601dba12c))
* **01-02:** add storage guard and emit dx:error on wallet storage failure ([ba49fd5](https://github.com/dxnzn/dxkit/commit/ba49fd57a4e4b25aa8db0bb041f8d0459e93d5c4))
* **01-02:** emit dx:error on settings storage read/write failure ([5caec8c](https://github.com/dxnzn/dxkit/commit/5caec8c558f99a4901cacb5791804ca144f25d95))
* **01-02:** emit dx:error on theme storage read/write failure ([3755d86](https://github.com/dxnzn/dxkit/commit/3755d8693baf4082f3ba9570d319e91847a55133))
* **lifecycle:** add sanitizeTemplate hook to the mount flow ([f278606](https://github.com/dxnzn/dxkit/commit/f278606560b211cd0883ae03fc0c62f91cbd002d))
* **lifecycle:** load timeout + URL template cache (ROB-01, ROB-03) ([4867866](https://github.com/dxnzn/dxkit/commit/4867866deeddb34bfa09b8271932be86ddd701cc))
* **settings:** prune dapp handlers on dapp disable (ROB-04) ([65252db](https://github.com/dxnzn/dxkit/commit/65252db94c09df16b12cd57f3c67410dd6b6c3ba))
* **shell:** nest ShellConfig lifecycle loaders, throw on flat shape ([a441497](https://github.com/dxnzn/dxkit/commit/a441497ffe53f6d23e1b55d6cd7344ef34b001a6))
* **wallet:** configurable storageKey, reconnect visibility, empty-accounts guard ([901dc4f](https://github.com/dxnzn/dxkit/commit/901dc4f923882969b2f7d9ccbb990e48d78e9d5f))


### Bug Fixes

* **lifecycle:** bound sanitizer hang guard, preserve thrown cause ([ffd99af](https://github.com/dxnzn/dxkit/commit/ffd99afd5e783e815c5aad253380bc14047ff81e))
* **shell:** un-bypassable required-plugin enforcement, own-key guard ([e51d927](https://github.com/dxnzn/dxkit/commit/e51d9272d987e9672c1f76af759d22605cd9ff88))
* **wallet:** surface connected-without-address as dx:error ([d349ca9](https://github.com/dxnzn/dxkit/commit/d349ca99bdeeb1a10c2bdcefeb0f83dc7764302d))

## [0.1.5](https://github.com/dxnzn/dxkit/compare/v0.1.4...v0.1.5) (2026-06-29)


### Bug Fixes

* **router:** mount target dapp once per hash-mode navigation ([419a0c7](https://github.com/dxnzn/dxkit/commit/419a0c7eac1d443317ecd920757c6cf11ec72a0d))

## [0.1.4](https://github.com/dxnzn/dxkit/compare/v0.1.3...v0.1.4) (2026-04-01)

## [0.1.3](https://github.com/dxnzn/dxkit/compare/v0.1.2...v0.1.3) (2026-04-01)


### Bug Fixes

* **release:** bump all plugin versions in lockstep with core ([e95a789](https://github.com/dxnzn/dxkit/commit/e95a789d52d3adceb6bfa9b15096394f9b7d2a5f))

## 0.1.2 (2026-04-01)


### Features

* add dx:route:subpath event for sub-path navigation ([6ecf4ad](https://github.com/dxnzn/dxkit/commit/6ecf4adcf91e0aa839d4a45b1764909518dfb2ce))
* add make release target with commit-and-tag-version ([0b2652c](https://github.com/dxnzn/dxkit/commit/0b2652c6f769dc35f0f4bac88500dd8da2bbb3e5))
* add onApply hook to theme plugin for DOM side-effects ([d000cc8](https://github.com/dxnzn/dxkit/commit/d000cc81423e19e3b4c0c04b800186f89de9a9bc))
* add template and dependencies manifest fields ([54b2cba](https://github.com/dxnzn/dxkit/commit/54b2cbafe83b7a41be031c7ee850417a06d00399))
* **audit:** perform self review and security audit ([abbc0fe](https://github.com/dxnzn/dxkit/commit/abbc0fec791da696c1342d91d4ff0f5c8d9fa949))
* initial commit ([fa2bb9d](https://github.com/dxnzn/dxkit/commit/fa2bb9d633d08401632598e5a0424b41ffbc7b18))
* update package json info ([ded44e2](https://github.com/dxnzn/dxkit/commit/ded44e2020139094a4791664c8586c3ef805c9d7))


### Bug Fixes

* adjust for lowercase git repo ([82e6ca5](https://github.com/dxnzn/dxkit/commit/82e6ca5e5502b908c9c213dff540766fb1fa4a08))
* **ci:** add packageManager field for pnpm/action-setup@v4 ([9dbf9ca](https://github.com/dxnzn/dxkit/commit/9dbf9ca2045a5c86f2dfab296da6a712ce752767))
* fix typo and add make publish ([6c88a19](https://github.com/dxnzn/dxkit/commit/6c88a195ccee834590dfa0af87d92cd310939f57))
* rename packages ([25686b3](https://github.com/dxnzn/dxkit/commit/25686b3d6d258318be149a917ddcf54ad48a86ae))

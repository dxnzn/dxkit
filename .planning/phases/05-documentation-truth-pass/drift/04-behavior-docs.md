# Drift Log — Plan 05-04 (Behavior Docs)

Per-doc record of what was wrong and what changed, verified against post-D-16 source read this
plan (`src/shell.ts`, `src/lifecycle.ts`, `src/router.ts`, `src/events.ts`, `src/registry.ts`,
`plugins/settings/src/index.ts`, `src/types/manifest.ts`).

## docs/dapp-development.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | No description of what happens when an optional dapp is disabled while its route is active — the doc only listed `dx.disableDapp(id)` as an API call with no behavior | Added a "Disabling the Active Dapp" section stating the single post-D-16 outcome rule: disabling the dapp whose route is currently active — mounted or still loading — returns the browser to `/`, stated without naming a single implementation function (the outcome spans `rebuildRouter()` and `disableDapp()`'s own branch) | `src/shell.ts:134-168` (`disableDapp()`, post-D-16); RESEARCH.md Pitfall 3 |
| 2 | TOC linked `[Permission Gating](#permission-gating)` but the actual heading is `## Requirement Gating` (anchor `#requirement-gating`) — broken internal link | Corrected the TOC entry to `[Requirement Gating](#requirement-gating)`, added the new `[Disabling the Active Dapp](#disabling-the-active-dapp)` entry | In-file heading vs. TOC mismatch (pre-existing bug, Rule 1) |

**Everything else checked and found already correct:** settings handler cleanup is disable-only
(doc makes no cleanup-lifecycle claim in this file — accurate by omission, the claim lives in
`docs/plugins/settings.md`, out of this plan's scope); sub-path no-remount + `dx:route:subpath`
description (`src/shell.ts:442-450`); `standalone` described as a dapp-author convention signalled
via `window.__DXKIT__` presence, not shell-enforced (matches `src/types/manifest.ts:57-58` —
`standalone` isn't read anywhere in `src/`); `dx:mount`/`dx:unmount` contract; manifest field
table (all fields/defaults match `src/types/manifest.ts`); requirement-gating `dx:error` source
string (`lifecycle:<id>`) and message shape; template/dependency blocking-load descriptions; no
D-13 booster/hedge words present.

## docs/system-internals.md

| # | Was | Now | Source |
|---|-----|-----|--------|
| 1 | "Router Internals → Path Normalization" described only `router.ts`'s per-navigation `normalizePath()` (basePath strip, leading/trailing slash) — no mention that manifest routes go through a *second*, different normalizer once at load time | Added a "Manifest Route Normalization" subsection describing shell-level `normalizeRoute()` (trims whitespace, leading/trailing-slash normalization, rejects empty/whitespace-only routes with a `shell:route` `dx:error`) as a distinct, once-at-load-time function — explicitly stated as not the same function as the router's per-navigation normalizer | `src/shell.ts:292-306` (`normalizeRoute()`) vs. `src/router.ts:27-39` (`normalizePath()`); RESEARCH §Code Truth: Behavior — "these two normalizers are not the same function" |
| 2 | No mention of duplicate-route handling anywhere in the doc | Added a "Duplicate Routes" subsection: duplicate exact routes are kept in the manifest list (not discarded), the router's stable construction-time sort guarantees first-registered-wins regardless of array order, and `normalizeAndValidateManifests()` emits one `shell:manifest` `dx:error` naming both colliding ids | `src/shell.ts:337-352` (duplicate-route emit); `src/router.ts:24` (stable sort, hoisted per ROB-02) |
| 3 | "Mount de-duplication" paragraph (under Navigation Sequence) described only the same-dapp in-flight dedupe (`pendingMountId`) — no mention of the cross-dapp last-navigation-wins generation guard that supersedes an in-flight mount for a *different* dapp | Split into two paragraphs: the lifecycle-level `mountGeneration`/`isStale()` guard (only the most-recently-started `mount()` call can ever reach `dx:mount`, re-checked at every commit gate) as the general last-navigation-wins mechanism, and the shell-level same-dapp dedupe as a narrower, additional guard on top | `src/lifecycle.ts:298-304` (`generation`/`isStale()`); `src/shell.ts:455` (`pendingMountId` same-dapp dedupe) |
| 4 | Navigation Sequence diagram showed `Shell->>LC: unmount()` as a call the shell makes *before* calling `LC: mount(...)` | Corrected the diagram: `unmount()` of the previous dapp happens *inside* `mount()`, at its very start (`LC->>LC: unmount()`), not as a separate shell-initiated step before the mount call | `src/lifecycle.ts:319-321` (`if (currentDappId) unmount();` is the first statement inside `mount()`) |
| 5 | No mention of the post-injection container-clear guarantee anywhere in "Lifecycle Manager Internals" | Added a "Template Loading & Container Clearing" subsection: template fetch/sanitize failures are pre-injection (return before any `innerHTML` write, nothing to clear); dependency-load and entry-load failures are post-injection and both explicitly clear the container (`container.innerHTML = ''`) before returning, so no stale dapp DOM survives a post-injection failure | `src/lifecycle.ts:352-401` (template/sanitize, pre-injection returns), `:404-441` (dependency/entry, post-injection clear) |
| 6 | No mention of the template cache anywhere in the doc | Added a "Template Caching" subsection: cache wraps outermost above the timeout-wrapped fetch (a cache hit skips fetch and its timeout entirely), only successful fetches are cached, cached HTML is raw (the sanitizer hook still runs on every mount including cache hits), `clearTemplateCache()`/`invalidateTemplate(url)` API | `src/lifecycle.ts:281-296` (cache wrapping + only-successful-fetches-cached), `:378` (sanitize runs after `loadTemplate()` every time) |
| 7 | Init Sequence diagram jumped from `loadManifests()` straight to the plugin-init loop — omitted the validation/normalization pass that runs between them | Added a `Shell->>Shell: normalizeAndValidateManifests()` step with a note (tier-uniform validation, route normalization + reject-unfixable, duplicate-route detection) between `loadManifests()` and the plugin-init loop | `src/shell.ts:367` (`manifests = normalizeAndValidateManifests(await loadManifests())`, runs before plugin `init()`) |
| 8 | "Optional Dapp State Machine → On state change" step 3 said "If the currently mounted dapp was disabled → unmount + navigate to `/`" — described only the committed-mount case, which is exactly the pre-D-16 divergence (the in-flight case previously had no navigate) | Rewrote to the single post-D-16 outcome rule: "If the dapp whose route is currently active — mounted or still loading — was disabled, the mount is abandoned (or unmounted, if already committed) and the browser navigates to `/`" | `src/shell.ts:134-168` (`disableDapp()`, post-D-16 two-branch fix); RESEARCH.md Pitfall 3 |

**Everything else checked and found already correct:** Architecture Overview diagram; Longest
Prefix Match description (matches `src/router.ts:44-48`); History vs Hash Mode table and the
hash-mode identical-hash `notifyListeners()` quirk (already accurately described); Script/Style
Loading sections (load-once caching, non-blocking CSS); Requirement Checking section; Event Bus
Internals (CustomEvent wrapping, Listener pause/resume/off, handler-tracking `Map`) — verified
against `src/events.ts`; Event Registry Internals (namespace validation rules, conflict
resolution) — verified against `src/events.ts:93-132`; Plugin Registry Internals (`Map` +
defensive-copy `getAll()`) — verified against `src/registry.ts`; Manifest Loading Pipeline
three-tier fallback + deep-merge rules table; Context Bridge shape (matches the `context` object
built in `src/shell.ts:178-192`); no D-13 booster/hedge words present.

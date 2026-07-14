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

---
phase: 04
status: current
verified_against: 511b417a18a831b492146400bfc5d4c97cc94560
updated: 2026-07-14
---

# Phase 04 — Documentation Ship Gate Marker

Scoped pre-ship docs pass for Phase 4 (testing — stress, edge-case & regression coverage), per the Documentation Ship Gate in `.claude/CLAUDE.md`. Scope: docs whose claims phase 4's changes (mount-race fixes, manifest validation, settings cleanup, new test suites) could have drifted, plus confirmed carryovers from the interrupted 2026-07-12 docs run.

## Verified (194 claims checked, 9 docs)

| Doc | Claims | Result |
|-----|--------|--------|
| docs/system-internals.md | 38/38 | ✓ current (mount-dedupe prose matches post-phase-4 behavior) |
| docs/dapp-development.md | 26/26 | ✓ current |
| docs/events-reference.md | 20/20 | ✓ current |
| docs/api-reference.md | 15/15 | ✓ current |
| docs/getting-started.md | 15/15 | ✓ current (prior flat-loader failure no longer present) |
| docs/plugins/settings.md | 14/14 | ✓ current |
| README.md | 35/35 | ✓ fixed — version cell 0.1.0→0.1.5, `noExternal: ['@dnzn/dxkit']` (commit 511b417) |
| docs/testing.md | 16/16 | ✓ fixed — Test Locations table now includes stress.test.ts + settings integration.test.ts (commit 511b417) |
| docs/plugins/auth.md | 15/15 | ✓ fixed — H1 package name @dxkit/auth → @dnzn/dxkit-auth (commit 511b417) |

## Deferred to Phase 5 (docs truth pass)

- Full sweep of docs/cookbook.md, docs/plugin-development.md, docs/plugins/{theme,wallet}.md, docs/{development,configuration}.md, CONTRIBUTING.md cross-links, plugins/*/README.md
- Noted omissions (accurate-but-incomplete, not failures): docs/plugins/settings.md doesn't mention handler pruning on `disableDapp()`; docs/api-reference.md LifecycleManager block omits `clearTemplateCache()`, `invalidateTemplate()`, `invalidatePendingMount()`, `invalidateAnyPendingMount()`
- CSP/security documentation gaps (planned Phase 5 scope)

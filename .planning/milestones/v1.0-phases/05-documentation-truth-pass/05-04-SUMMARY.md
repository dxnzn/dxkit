---
phase: 05-documentation-truth-pass
plan: 04
subsystem: docs
tags: [markdown, routing, lifecycle, mount-semantics, sequence-diagrams]

requires:
  - phase: 05-documentation-truth-pass
    provides: "Plan 01's D-16 disable-mid-flight fix (post-fix src/shell.ts is the verification target for both docs)"
provides:
  - "docs/dapp-development.md verified against post-D-16 source — single disable-while-active outcome rule stated"
  - "docs/system-internals.md verified against post-D-16 source — two-tier normalization, duplicate routes, container-clear, template cache, corrected sequence diagrams"
  - "drift/04-behavior-docs.md — before/after record for both docs"
affects: [05-08]

tech-stack:
  added: []
  patterns:
    - "State disable-while-active as a single outcome rule (Pitfall 3), never naming one implementation function since it spans two code paths"

key-files:
  created:
    - .planning/phases/05-documentation-truth-pass/drift/04-behavior-docs.md
  modified:
    - docs/dapp-development.md
    - docs/system-internals.md

key-decisions:
  - "Disable-while-active behavior added as a new 'Disabling the Active Dapp' section in dapp-development.md, placed immediately after 'Accessing the Context' where enableDapp/disableDapp are first introduced — Claude's discretion per plan scope, kept content-only (no restructuring)"
  - "Fixed a pre-existing broken TOC anchor in dapp-development.md (linked 'Permission Gating' for a heading actually titled 'Requirement Gating') under Rule 1 — discovered while reading the file's full TOC for the required edit"
  - "system-internals.md's last-navigation-wins guard split into two paragraphs (lifecycle-level generation guard vs shell-level same-dapp dedupe) rather than merging them, since RESEARCH is explicit that the generation guard is the general cross-dapp mechanism and the shell dedupe is a narrower same-dapp layer on top"
  - "Navigation Sequence diagram's unmount() call moved from a separate pre-mount Shell->>LC step to inside the 'Has current dapp' alt block as LC->>LC, matching that unmount() is the first statement inside lifecycle.mount(), not a shell-orchestrated pre-step"

requirements-completed: [DOC-01, DOC-02]

coverage:
  - id: D1
    description: "docs/dapp-development.md verified against post-D-16 src/shell.ts; single disable-while-active outcome rule added; broken TOC anchor fixed; sub-path/standalone/requirement-gating claims confirmed accurate"
    requirement: "DOC-01"
    verification:
      - kind: other
        ref: "bash -c \"grep -q 'disable' docs/dapp-development.md && ! grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' docs/dapp-development.md\""
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/system-internals.md verified against post-D-16 source; two-tier normalization, duplicate-route handling, container-clear guarantee, template cache, and both sequence diagrams corrected"
    requirement: "DOC-01"
    verification:
      - kind: other
        ref: "bash -c \"grep -qi 'longest' docs/system-internals.md && grep -qi 'normal' docs/system-internals.md && ! grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' docs/system-internals.md\""
        status: pass
    human_judgment: false
  - id: D3
    description: "drift/04-behavior-docs.md records both docs' before/after changes with source citations"
    verification:
      - kind: other
        ref: "test -f .planning/phases/05-documentation-truth-pass/drift/04-behavior-docs.md"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-14
status: complete
---

# Phase 05 Plan 04: Behavior Docs (dapp-development.md, system-internals.md) Truth Pass Summary

**Verified dapp-development.md and system-internals.md against post-D-16 source (src/shell.ts, src/lifecycle.ts, src/router.ts, src/events.ts, src/registry.ts) — both docs now state the single converged disable-while-active outcome rule and fill six previously-undocumented internal-behavior gaps in system-internals.md.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-14T15:47:17Z
- **Tasks:** 2
- **Files modified:** 3 (2 docs + 1 new drift log)

## Accomplishments

- Confirmed `docs/dapp-development.md` never described what happens when an optional dapp is disabled while its route is active — added a "Disabling the Active Dapp" section stating the post-D-16 outcome rule (return to `/`, whether the mount had committed or was still loading) per RESEARCH Pitfall 3, without naming a single implementation function.
- Fixed a pre-existing broken TOC anchor in `dapp-development.md` (`Permission Gating` link pointed at a heading actually titled `Requirement Gating`).
- Confirmed sub-path no-remount, standalone-as-convention (not shell-enforced), requirement-gating `dx:error` shape, and the full manifest field table in `dapp-development.md` were already accurate against source — no changes needed there.
- Added six previously-missing internal-behavior sections/corrections to `docs/system-internals.md`: a "Manifest Route Normalization" subsection distinguishing the shell's once-at-load `normalizeRoute()` from the router's per-navigation `normalizePath()`; a "Duplicate Routes" subsection (first-registered-wins + `shell:manifest` emit); a "Template Loading & Container Clearing" subsection (pre-injection vs post-injection failure handling, container-clear guarantee); a "Template Caching" subsection (outermost cache wrap, raw-HTML storage, cache-hit skips fetch+timeout); an `normalizeAndValidateManifests()` step added to the Init Sequence diagram; and the Navigation Sequence diagram's `unmount()` call corrected to run inside `mount()` rather than as a separate shell-orchestrated pre-step.
- Rewrote the "Mount de-duplication" paragraph into two: the lifecycle-level generation guard (the actual cross-dapp last-navigation-wins mechanism) and the shell-level same-dapp dedupe as a narrower additional layer — the doc previously described only the latter.
- Corrected the Optional Dapp State Machine's disable-outcome bullet, which described only the committed-mount case (exactly the pre-D-16 divergence) — restated as the single post-D-16 outcome rule.

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify docs/dapp-development.md against source** - `1fb1485` (docs)
2. **Task 2: Verify docs/system-internals.md against source** - `0a0fa1e` (docs)

_Note: the drift log file `drift/04-behavior-docs.md` was created with Task 1 (dapp-development.md section) and appended with Task 2 (system-internals.md section), each committed alongside its respective doc._

## Files Created/Modified

- `docs/dapp-development.md` - Added "Disabling the Active Dapp" section; fixed broken TOC anchor (Permission Gating → Requirement Gating).
- `docs/system-internals.md` - Added "Manifest Route Normalization", "Duplicate Routes", "Template Loading & Container Clearing", "Template Caching" subsections; corrected Init Sequence and Navigation Sequence diagrams; rewrote "Mount de-duplication" paragraph; corrected Optional Dapp State Machine's disable-outcome bullet.
- `.planning/phases/05-documentation-truth-pass/drift/04-behavior-docs.md` - Before/after record for both docs, citing source line numbers.

## Decisions Made

- Placed the new disable-while-active section in `dapp-development.md` immediately after "Accessing the Context" (where `enableDapp`/`disableDapp` are first introduced) rather than elsewhere — closest logical proximity to the API surface it describes.
- Split the last-navigation-wins explanation in `system-internals.md` into two distinct paragraphs (lifecycle-level generation guard vs. shell-level same-dapp dedupe) instead of merging them into one, matching RESEARCH's explicit distinction between the general cross-dapp mechanism and the narrower same-dapp layer.
- Moved the Navigation Sequence diagram's `unmount()` call inside the "Has current dapp" alt block as an `LC->>LC` self-call, reflecting that `unmount()` runs as the first statement inside `lifecycle.mount()` rather than being orchestrated as a separate shell-level step before `mount()` is called.
- Fixed the `dapp-development.md` TOC anchor mismatch as an in-scope Rule 1 bug fix (broken internal link discovered while editing the same TOC line for the plan's required addition), rather than filing a separate todo for a one-line fix already in hand.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken TOC anchor in docs/dapp-development.md**
- **Found during:** Task 1
- **Issue:** The table-of-contents linked `[Permission Gating](#permission-gating)`, but the actual section heading is `## Requirement Gating` (anchor `#requirement-gating`) — the link never resolved to the intended section.
- **Fix:** Updated the TOC entry to `[Requirement Gating](#requirement-gating)`.
- **Files modified:** `docs/dapp-development.md`
- **Commit:** `1fb1485`

No other deviations — both tasks otherwise executed exactly as planned.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `docs/dapp-development.md` and `docs/system-internals.md` are source-accurate against post-D-16 code and slop-clean; both automated verify greps pass.
- Both docs now state the disable-while-active outcome identically ("returns you to `/`") — cross-doc consistency for this specific claim is already aligned, though the plan's final cross-doc consistency sweep (Plan 08) still needs to check the rest of the doc set.
- `docs/plugins/settings.md` still owns the settings-handler-cleanup-on-disable claim in full detail (out of this plan's file scope) — a later wave should confirm it doesn't contradict the outcome rule now stated in these two docs.

---
*Phase: 05-documentation-truth-pass*
*Completed: 2026-07-14*

## Self-Check: PASSED

- FOUND: docs/dapp-development.md
- FOUND: docs/system-internals.md
- FOUND: .planning/phases/05-documentation-truth-pass/drift/04-behavior-docs.md
- FOUND: 1fb1485 (docs(dapp-development) commit)
- FOUND: 0a0fa1e (docs(system-internals) commit)

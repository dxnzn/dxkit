---
phase: 05-documentation-truth-pass
plan: 07
subsystem: docs
tags: [markdown, security, csp, dompurify, xss]

requires:
  - phase: 05-documentation-truth-pass
    provides: "05-RESEARCH.md's CSP/DOMPurify Code Examples, Common Pitfalls (Pitfall 4 meta-tag directive support), Assumptions Log (A1/A2/A3), and Config Defaults table (theme/settings storageKey NOT given SEC-02 treatment); .planning/codebase/CONCERNS.md's security/limitations sections; docs/configuration.md's existing ESM DOMPurify snippet (kept consistent)"
provides:
  - "docs/security.md — new file: CSP guidance for three deployment shapes, both DOMPurify sanitizer recipes (ESM + IIFE), and a seven-item honest limitations inventory"
  - "drift/07-security.md — net-new-doc content + source-basis record"
affects: [05-08]

tech-stack:
  added: []
  patterns:
    - "CSP directive reasoning tied to actual loader behavior: script-src/style-src/connect-src explained against src/lifecycle.ts's default loaders and fetch call sites, not generic CSP boilerplate"
    - "innerHTML-injected <script> tags never execute (DOM spec) — CSP script-src (no unsafe-inline) blocks the remaining inline-event-handler/javascript: vectors, making CSP and the sanitizer complementary layers rather than redundant ones"

key-files:
  created:
    - docs/security.md
    - .planning/phases/05-documentation-truth-pass/drift/07-security.md
  modified: []

key-decisions:
  - "Documented the DOM-spec fact that <script> tags parsed via innerHTML never execute, then explained why CSP's script-src still matters against unsanitized template HTML (inline event-handler attributes and javascript: URLs execute and are blocked by script-src without unsafe-inline) — ties the CSP section directly to src/lifecycle.ts's actual innerHTML injection point rather than presenting CSP and the sanitizer as interchangeable mitigations"
  - "IPFS gateway CSP guidance distinguishes path-style gateways (shared origin, weak 'self' isolation) from subdomain-style gateways (per-CID origin) rather than presenting one blanket caveat — directional guidance per RESEARCH Assumption A2, not a normative claim"
  - "README doc-table row for security.md deliberately not added in this plan — plan frontmatter and 05-RESEARCH.md's sweep order both assign that to Plan 08"

requirements-completed: [DOC-03, DOC-02]

coverage:
  - id: D1
    description: "docs/security.md CSP section: copy-paste policies for same-origin static host, IPFS gateway, and cross-origin-asset deployment shapes, each directive reasoned against src/lifecycle.ts's script/style/template loaders; header-vs-meta distinction with explicit meta-safe directive list (frame-ancestors/report-uri/sandbox flagged as header-only)"
    requirement: "DOC-03"
    verification:
      - kind: other
        ref: "bash -c \"test -f docs/security.md && grep -qi 'content-security-policy\\|CSP' docs/security.md && grep -q 'script-src' docs/security.md && grep -q 'connect-src' docs/security.md && grep -qi 'frame-ancestors' docs/security.md && grep -qi 'dompurify' docs/security.md && grep -qi 'sanitizeTemplate' docs/security.md\""
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/security.md Sanitizing Templates section: both DOMPurify consumption-mode recipes (ESM/bundler + IIFE/static global) with identical .sanitize(html) call shape, explicit scope-limit statement (template HTML only, entry scripts trusted and unsanitized), no homegrown sanitizer suggested"
    requirement: "DOC-03"
    verification:
      - kind: other
        ref: "bash -c \"grep -qi 'dompurify' docs/security.md && grep -qi 'sanitizeTemplate' docs/security.md\""
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/security.md Limitations section: all seven D-11 items (template/entry-script trust, sanitizer scope, localStorage plaintext, theme/settings storageKey collision, IIFE global collision, shell.destroy() reuse requirement, single-dapp-at-a-time) stated factually and traced to CONCERNS.md/RESEARCH.md; drift/07-security.md records the net-new doc and its source basis"
    requirement: "DOC-03"
    verification:
      - kind: other
        ref: "bash -c \"grep -qi 'limitation' docs/security.md && grep -qi 'localstorage\\|plaintext\\|secret' docs/security.md && grep -qi 'destroy' docs/security.md && grep -qi 'trusted' docs/security.md && test -f .planning/phases/05-documentation-truth-pass/drift/07-security.md\""
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/security.md reads in the README voice, no D-13 booster/hedge words (simply/just/powerful/seamless/robust/leverage)"
    requirement: "DOC-02"
    verification:
      - kind: other
        ref: "bash -c \"! grep -Eiqw 'simply|just|powerful|seamless|robust|leverage' docs/security.md\""
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-14
status: complete
---

# Phase 05 Plan 07: docs/security.md — CSP, Sanitizer Recipes, Limitations Summary

**Authored the phase's one net-new doc: CSP policies for three deployment shapes reasoned against `src/lifecycle.ts`'s actual loaders, both DOMPurify consumption-mode sanitizer recipes with an explicit scope limit, and a seven-item honest limitations inventory traced to `CONCERNS.md`.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-14T18:10:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 new doc + 1 new drift log)

## Accomplishments

- Wrote `docs/security.md`'s Content Security Policy section: mapped `script-src` to `manifest.entry`/`manifest.dependencies` (`defaultScriptLoader`'s real `<script type="module">` injection), `style-src` to `manifest.styles` (`defaultStyleLoader`'s `<link>` injection), and `connect-src` to every `fetch()` call site (`loadTemplate`, `registryUrl`, `dapps[].manifest`). Added the DOM-spec fact that `innerHTML`-injected `<script>` tags never execute, then explained why `script-src` still matters against unsanitized template HTML (inline event-handler attributes and `javascript:` URLs are blocked by `script-src` without `unsafe-inline`) — makes CSP and the sanitizer complementary, not redundant, and ties the section to the actual `container.innerHTML = ...` line in `src/lifecycle.ts`.
- Covered all three required deployment shapes with copy-paste policies: same-origin static host (HTTP header preferred, `<meta>` fallback), IPFS gateway (`<meta>`-only, with a path-style-vs-subdomain-gateway origin-isolation caveat per RESEARCH Assumption A2), and cross-origin-asset dapps (per-origin allowlisting on `script-src`/`style-src`/`connect-src`). Verified none of the three example policies would block DxKit's own dynamic injection.
- Stated the header-vs-`<meta>` distinction explicitly with a meta-safe directive list (`default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `font-src`, `object-src`, `base-uri`, `form-action`) and the header-only list (`frame-ancestors`, `report-uri`/`report-to`, `sandbox`) per RESEARCH's Pitfall 4.
- Wrote both DOMPurify sanitizer recipes verbatim from RESEARCH's verified Code Examples — ESM/bundler via `config.lifecycle.sanitizeTemplate` (already consistent with `docs/configuration.md:68-75`) and IIFE/static via the `window.DOMPurify` global — with an explicit scope-limit statement: `sanitizeTemplate` runs on `manifest.template` HTML only, `manifest.entry`/`manifest.dependencies` are trusted code and never passed through it. No homegrown regex/strip-tags sanitizer suggested, per Phase 3's prior rejection of built-in sanitizing as false security.
- Wrote the seven-item Limitations section, each traced to a specific `CONCERNS.md` section or `RESEARCH.md` table row: template/entry-script trust (no URL allowlisting), sanitizer scope, `localStorage` plaintext persistence (don't persist secrets), theme/settings `storageKey` collision (wallet's is configurable per Phase 3 SEC-02, theme's/settings' are not — a fact RESEARCH's Config Defaults table specifically flagged as accurate-but-undocumented), IIFE global collision risk, `shell.destroy()` required before creating another shell (unremoved `popstate`/`hashchange` listeners), and single-dapp-at-a-time.
- Logged `docs/security.md` as a net-new file to `drift/07-security.md`, recording each section's content and source basis (since there is no prior version to diff against) rather than a before/after table.

## Task Commits

1. **Task 1: Write the CSP guidance + DOMPurify sanitizer recipes**
   - `c5717a5` — docs(security): add CSP guidance + DOMPurify sanitizer recipes
2. **Task 2: Write the honest limitations inventory**
   - `a4f8e15` — docs(security): add honest limitations inventory + drift log

## Deviations from Plan

None — plan executed exactly as written. `docs/security.md` was authored as a single Write covering the full file (CSP + sanitizer + limitations content together), then committed in two steps matching the plan's two-task split: Task 1's commit covers the CSP/sanitizer portion, Task 2's commit covers the limitations portion plus the drift log. Both tasks' automated verify greps pass against the final file state.

## Self-Check: PASSED

- FOUND: docs/security.md
- FOUND: .planning/phases/05-documentation-truth-pass/drift/07-security.md
- FOUND: c5717a5 (git log)
- FOUND: a4f8e15 (git log)

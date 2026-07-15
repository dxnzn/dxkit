# Phase 5: Documentation — Truth Pass - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Every framework and plugin doc plus the README is verified against final 0.2.0 code (code is truth, drift corrected — DOC-01), AI slop is removed under a ruthless bar (DOC-02), and the concerns-audit gaps are filled with a new `docs/security.md` covering CSP guidance and a security/limitations note (DOC-03). Three small code todos are folded in (see Folded Todos) — including one open design decision the owner resolved during discussion (disable-mid-flight now navigates to `/`).

**The verification surface:** all 14 files in `docs/` (including the three not indexed by the README table), `README.md`, and `examples/getting-started` (executable documentation — it must construct a 0.2.0 shell). **Not in the surface:** public-API JSDoc in `src/`, `CLAUDE.md`/agent docs — drift spotted there incidentally becomes todos, not in-phase edits.

**Not in scope:** doc restructuring (no merges/splits/deletes of existing files — content edits only, plus the one new `security.md`), fixing code bugs discovered during verification (beyond the three folded todos), version-cell bump in the README status table (release tooling owns that), TS6/routing/encryption items (out of milestone).
</domain>

<decisions>
## Implementation Decisions

### Verification method & evidence (DOC-01)
- **D-01 (drift log artifact):** Verification is a claim-by-claim pass producing a drift log in the phase directory recording, per doc, what was wrong and what changed. Corrected docs + an auditable record — the "verified" claim is itself verifiable. Format/filename is Claude's discretion.
- **D-02 (doc-by-doc sweep):** The unit of work is the doc file: read it, verify every claim against source, correct, log. Completion criterion = all 14 docs + README + example checked off. A final cross-doc consistency sweep catches contradictions between docs.
- **D-03 (document actual, file todo):** When verification finds the code is wrong (doc describes better behavior than code has), docs describe 0.2.0 as it actually ships — warts included — and the bug becomes a pending todo. The docs phase does not reopen shipped code. The only code changes in this phase are the three explicitly folded todos.
- **D-04 (compile-checked examples):** TypeScript snippets in docs are extracted (or mirrored) into a throwaway scratch harness and type-checked against the real 0.2.0 types — this instantly catches stale config shapes like the removed flat loaders. HTML/IIFE snippets get eyeball verification. The harness is not committed as CI.

### Migration & versioning (feeds DOC-01)
- **D-05 (migration section in docs):** A concise 0.1.5 → 0.2.0 migration section ships in the docs (placement — own page vs section of getting-started — is Claude's discretion): the three breaking changes (30s default load timeout, nested `ShellConfig.lifecycle` + flat-loader runtime throw, route normalization/rejection), before/after config snippets, and the `timeout: 0`/`Infinity` escape hatch. The generated changelog remains the release record; this is the human-readable path.
- **D-06 (README status table — verify, don't bump):** Fix table drift (audit link, doc index) but leave the version cell at its current value — commit-and-tag-version updates it when 0.2.0 is cut. Status stays alpha.
- **D-07 (timeless present):** Doc bodies describe current behavior only — no "as of 0.2.0" / "previously…" annotations. History lives in the changelog and the migration section.

### CSP & security docs (DOC-03)
- **D-08 (dedicated `docs/security.md`):** One new doc holds the CSP guidance, sanitizer/DOMPurify consumer guidance (deferred here from Phase 3 D-02/D-13/D-14), and the limitations note. It gets a row in the README doc table.
- **D-09 (copy-paste CSP policies + why):** Concrete CSP header/meta-tag examples for the main deployment shapes (same-origin static host, IPFS gateway, dapps loading cross-origin assets), with each directive explained against what DxKit actually does (dynamically injected `<script>`/`<link>`, `fetch` for templates/registry, `innerHTML` injection). Policies are verified by reasoning against the loaders in `src/lifecycle.ts` — no browser-enforced test harness required.
- **D-10 (sanitizer recipe — both consumption modes):** Working DOMPurify examples for bundler/ESM (`config.lifecycle.sanitizeTemplate`) AND IIFE/static (script-tag DOMPurify global — the first-class no-bundler target). Includes the Phase 3 D-14 scope warning verbatim in spirit: the sanitizer covers template HTML only; dapp entry scripts are trusted code.
- **D-11 (full honest limitations inventory):** The limitations note covers everything a consumer should know before trusting DxKit, not just the DOC-03 minimum: template trust requirement, sanitizer scope, localStorage is plaintext (don't persist secrets), IIFE globals can collide/be overwritten, `shell.destroy()` required before creating another shell, single-dapp-at-a-time. Source list: `.planning/codebase/CONCERNS.md`.

### Slop bar & inventory (DOC-02)
- **D-12 (content edits + fix the index):** Keep the current file set (plus new `security.md`). Fix text in place. Reconcile the README doc table to reality — `docs/configuration.md`, `docs/development.md`, `docs/testing.md` get indexed. No merges or deletions.
- **D-13 (ruthless bar — earn every sentence):** Delete anything that doesn't inform: throat-clearing intros, "simply/just/powerful", paragraphs restating the adjacent code sample, benefits-selling. Net doc length is expected to shrink. A claim that can't be traced to source is deleted, not softened.
- **D-14 (voice — match the README):** The current README's terse, stylized "DNZN //" voice is the exemplar for every doc. Not genre-relaxed: tutorials get the same voice, structured for stepwise reading but written in the same register.

### Folded code fixes
- **D-15 (registry.json failures — remaining WR-01 tier):** `loadManifests`' registry fallback (`src/shell.ts:237-244`) emits `dx:error` (source `shell:manifest`) on fetch throw / non-OK / JSON-parse failure **when `registryUrl` was explicitly configured**; the default `/registry.json` probe stays silent (absence is expected). Regression tests cover both cases (explicit → emits; default → silent).
- **D-16 (disable-mid-flight navigates to `/`):** Owner's decision: mirror the committed-mount path. After `disableDapp()` invalidates an in-flight mount whose route matches the current URL, the shell navigates to `/` — both disable paths end in the same user-visible state. Code change in `src/shell.ts` + a test asserting it. Docs then document one rule, no divergence.
- **D-17 (inFlightMountId hygiene + test nits):** Clear `inFlightMountId` only when the returning call is the one that set it (track generation alongside id), with a small unit test locking the tightened invariant; fix the `dx:error` listener-accumulation nit in `tests/shell.test.ts` and the confusing manifest ids in the router duplicate-route test.

### Claude's Discretion
- Drift log format, filename, and granularity (per-doc sections vs one table).
- Migration section placement (dedicated page vs section) and exact wording.
- `security.md` internal structure and README-table row description.
- Scratch-harness mechanics for compile-checking snippets (extraction script vs hand-mirrored file).
- Sequencing of folded code fixes vs docs work within the phase (fixes-first is the natural order so docs describe post-fix behavior — D-16 changes documented routing behavior).
- Exact `dx:error` message wording for D-15/D-16 following the established colon-taxonomy conventions.

### Folded Todos
- **Surface registry.json fetch/parse failures (remaining WR-01 tier)** (`.planning/todos/pending/2026-07-11-surface-loaddappmanifest-fetch-and-parse-failures.md`): the registry fallback still swallows failures via the `// No registry.json — that's fine` catch; defensible for the default probe, invisible misconfiguration when `registryUrl` is explicit. Folded so docs can describe "all manifest tiers surface failures" per D-15.
- **Decide disable-mid-flight URL behavior** (`.planning/todos/pending/2026-07-14-disable-mid-flight-leaves-url-on-dead-route.md`): the two "disable while its route is active" paths end in different user-visible states. Resolved as D-16 (navigate to `/`).
- **inFlightMountId hygiene + test nits** (`.planning/todos/pending/2026-07-14-inflightmountid-hygiene-and-test-nits.md`): three benign-today hygiene items from the PR #4 external review. Folded per its own suggestion ("fold into a phase-5+ hygiene pass") as D-17.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 5: Documentation — Truth Pass" — goal + three success criteria.
- `.planning/REQUIREMENTS.md` — DOC-01, DOC-02, DOC-03 definitions.
- `.planning/PROJECT.md` §Constraints — zero-runtime-deps, IIFE/IPFS-first posture the security/CSP guidance must respect.

### Folded todos (problem statements + solution sketches)
- `.planning/todos/pending/2026-07-11-surface-loaddappmanifest-fetch-and-parse-failures.md` — D-15 spec (explicit-vs-default emit split, test matrix).
- `.planning/todos/pending/2026-07-14-disable-mid-flight-leaves-url-on-dead-route.md` — D-16 problem statement (option (a) chosen).
- `.planning/todos/pending/2026-07-14-inflightmountid-hygiene-and-test-nits.md` — D-17 item list (`src/lifecycle.ts:348`, `:392`, test files).

### The docs under verification (the work surface)
- `README.md` — status table, doc index (3 unindexed docs), installation/build claims.
- `docs/getting-started.md`, `docs/dapp-development.md`, `docs/plugin-development.md`, `docs/system-internals.md`, `docs/events-reference.md`, `docs/api-reference.md`, `docs/cookbook.md`, `docs/configuration.md`, `docs/development.md`, `docs/testing.md` — framework docs (last three currently unindexed in README).
- `docs/plugins/wallet.md`, `docs/plugins/auth.md`, `docs/plugins/theme.md`, `docs/plugins/settings.md` — plugin docs.
- `examples/getting-started/` — executable documentation; must construct a valid 0.2.0 shell.

### Known drift sources — what Phases 1–4 changed (deferred doc items)
- `.planning/phases/01-diagnostics-surface-silent-failures/01-CONTEXT.md` — new `dx:error` sources + wrapped-Error-with-`cause` convention; container-clear guarantee.
- `.planning/phases/02-robustness-load-guards-caching-handler-cleanup/02-CONTEXT.md` — 30s default timeout (breaking) + `timeout: 0`/`Infinity` escape hatch, custom loaders NOT truly cancelled (documented limitation), template cache + `clearTemplateCache()`/`invalidateTemplate(url)`, settings handler cleanup on disable.
- `.planning/phases/03-security-sanitization-storage-isolation/03-CONTEXT.md` — sanitizer hook contract (D-01/D-02 there), nested `ShellConfig.lifecycle` breaking change + flat-loader throw, wallet `storageKey`, WR-02/WR-03 wallet fixes; explicitly deferred DOMPurify/CSP/limitations guidance to this phase (D-13/D-14 there).
- `.planning/phases/04-testing-stress-edge-case-regression-coverage/04-CONTEXT.md` — last-navigation-wins mount semantics, route normalization + reject-unfixable, three-tier manifest validation, duplicate-route first-wins + `dx:error`, dapp-entry WR-01 emits.
- `.planning/STATE.md` §Accumulated Context / Quick Tasks — post-Phase-4 fixes (mountDapp epilogue, normalizeRoute trim, PR #3 self-review findings) that also changed behavior docs may describe.

### Gap list (source of DOC-03 content)
- `.planning/codebase/CONCERNS.md` — §"No Content Security Policy Guidance", §"XSS Risk in Template Injection", §"Settings Storage Lacks Encryption", §"IIFE Builds Attach to Global Namespace", §"Window Event Listeners Not Cleaned Up on Shell Reuse", §"Known Limitations" — the inventory D-11 documents.

### Code truth (verification targets + folded-fix sites)
- `src/shell.ts` — shell config/init/manifest loading (D-15 site at `:237-244`), `disableDapp()` (D-16 site at `:110-146`), routing behavior docs must match.
- `src/lifecycle.ts` — loaders, timeout, cache, sanitizer step, mount/unmount semantics (D-17 items at `:348`, `:392`); the mechanics CSP guidance reasons against.
- `src/router.ts` — normalization rules, longest-prefix matching, hash/history modes.
- `src/events.ts` + `src/types/events.ts` — event catalog truth for `docs/events-reference.md`.
- `src/types/` — public type surface truth for `docs/api-reference.md` and snippet compile-checks.
- `plugins/*/src/index.ts` — plugin option/state/event truth for `docs/plugins/*.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **README doc table + voice** — the structural and stylistic exemplar (D-14); the truth pass extends it (security.md row, 3 missing rows) rather than redesigning it.
- **`audit/self/dxkit-0.1.0.md`** — precedent for audit-style evidence artifacts; the drift log (D-01) follows that culture but lives in the phase dir, not `audit/`.
- **Existing `dx:error` emit sites** (`src/shell.ts` manifest validation emits) — the template for the D-15 registry emit; `rebuildRouter()`'s navigate-to-`/` path is the template for D-16.
- **Phase 4's stress/regression suites** (`tests/stress.test.ts`, `tests/shell.test.ts`) — the fixtures and patterns the D-15/D-16/D-17 tests extend.

### Established Patterns
- `dx:error` colon-taxonomy sources (`shell:manifest`, `shell:route`, `lifecycle:<id>:<stage>`, `plugin:wallet:*`) — D-15's emit and any doc describing events must use the real strings.
- "Emit every time, no dedupe state" (Phase 1 D-04/D-09) applies to the D-15 registry emit.
- Options-with-defaults resolved at construction (`timeout ?? 30000`, `cacheTemplates ?? true`, `storageKey ?? 'dxkit:wallet'`) — the config docs must state these actual defaults.
- Conventional commits with `docs:` type; per-doc commits fit the doc-by-doc sweep (D-02).

### Integration Points
- README doc table ↔ `docs/` directory (index reconciliation, D-12).
- `docs/security.md` ← `.planning/codebase/CONCERNS.md` (content source) + `src/lifecycle.ts` (CSP reasoning target).
- Folded fixes: `src/shell.ts` (D-15, D-16), `src/lifecycle.ts` (D-17), `tests/shell.test.ts` + `tests/router.test.ts` (D-17 nits).
- `examples/getting-started/` ↔ 0.2.0 `ShellConfig` shape (flat loaders now throw — the example is the most likely place drift breaks something executable).

</code_context>

<specifics>
## Specific Ideas

- **"Code is truth — unless it's broken, then file a todo":** the owner drew a hard line keeping this phase from reopening shipped code. Docs describe actual 0.2.0 behavior even when a wart is found; the wart becomes a todo. Only the three folded todos are code work.
- **The README is the voice exemplar for everything:** not genre-appropriate softening — every doc gets the README's terse, stylized DNZN// register. Combined with the ruthless slop bar (D-13), net doc shrinkage is an expected and acceptable outcome.
- **Fixes-first sequencing matters:** D-16 changes user-visible routing behavior that `dapp-development.md`/`system-internals.md` will describe — the folded code fixes should land before the docs that describe those paths are verified.
- **The drift log is the phase's proof:** DOC-01's "verified" claim must itself be checkable — the phase-dir artifact records what was checked and what moved.

</specifics>

<deferred>
## Deferred Ideas

- **Public-API JSDoc truth pass** (`src/` exported factories/types) — considered for the surface, excluded; incidental drift found there becomes todos.
- **CLAUDE.md / `.claude/` agent-doc verification** (line-number refs, architecture claims) — same treatment: out of surface, todo on incidental discovery.
- **Doc consolidation** (e.g. `development.md`/`testing.md` overlap with README) — restructuring was explicitly kept out of the truth pass; revisit after the pass establishes what each doc actually says.
- **Tested/browser-enforced CSP reference policy** against the example project — D-09 chose reasoned policies over a browser harness; upgrade candidate for a later milestone.
- **New 0.2.0 self-audit** (`audit/self/dxkit-0.2.0.md`) — the README audit link is verified this phase, but a fresh self-review is its own effort.

### Reviewed Todos (not folded)
- **Wallet connect empty accounts yields undefined address** (`.planning/todos/pending/2026-07-11-wallet-connect-empty-accounts-yields-undefined-address.md`) — appears stale: Phase 3 D-11 shipped this fix (connect() throws on empty accounts). Close it out rather than folding.

</deferred>

---

*Phase: 5-documentation-truth-pass*
*Context gathered: 2026-07-14*

# Phase 5: Documentation — Truth Pass - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 5-documentation-truth-pass
**Areas discussed:** Todo folding, Verification method & evidence, Migration & versioning story, CSP & security doc shape, Slop bar & doc inventory

---

## Todo Folding (pre-discussion)

| Option | Description | Selected |
|--------|-------------|----------|
| registry.json failures (WR-01 tier) | Small emit-on-failure fix in src/shell.ts so docs can describe "all manifest tiers surface failures" | ✓ |
| Disable-mid-flight URL behavior | Design decision: park on dead route vs navigate('/') | ✓ |
| inFlightMountId hygiene + test nits | Internal hygiene with near-zero doc impact | ✓ |
| None — docs-only phase | Keep Phase 5 pure documentation | |

**User's choice:** Fold all three code todos into Phase 5.
**Notes:** The stale WR-02 wallet todo (fixed in Phase 3 D-11) was flagged for closure, not folded.

---

## Verification Method & Evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Drift log artifact | Claim-by-claim pass per doc; findings in a phase-dir drift log | ✓ |
| Commits as evidence | Fix in place; commit bodies as the record | |
| Updated audit/self report | Roll findings into audit/self/dxkit-0.2.0.md | |

**User's choice:** Drift log artifact.

| Option | Description | Selected |
|--------|-------------|----------|
| Document actual, file todo | Docs describe 0.2.0 as-shipped; discovered bugs become todos | ✓ |
| Fix trivial, todo the rest | One-liners in-phase, structural as todos | |
| Fix in-phase like Phase 4 | Same standing policy as the test phase | |

**User's choice:** Document actual, file todo.

| Option | Description | Selected |
|--------|-------------|----------|
| Doc-by-doc | Each doc file is a unit; final cross-doc consistency sweep | ✓ |
| Subsystem-by-subsystem | Verify by topic across all docs at once | |
| Change-driven first, then sweep | Known Phase 1–4 drift first, lighter full pass after | |

**User's choice:** Doc-by-doc.

| Option | Description | Selected |
|--------|-------------|----------|
| Compile-check them | TS snippets type-checked in a throwaway harness; HTML/IIFE eyeballed | ✓ |
| Eyeball against types | Read snippets next to type definitions | |
| Runnable examples verified | examples/ actually run against a local 0.2.0 build | |

**User's choice:** Compile-check them.

---

## Migration & Versioning Story

| Option | Description | Selected |
|--------|-------------|----------|
| Changelog only | Generated changelog is the migration record | |
| Migration section in docs | Concise 0.1.5 → 0.2.0 section with before/after snippets | ✓ |
| Both, cross-linked | Migration doc plus enriched changelog entries | |

**User's choice:** Migration section in docs.

| Option | Description | Selected |
|--------|-------------|----------|
| Verify, leave version to release | Fix table drift; version cell updates at release | ✓ |
| Update to 0.2.0 now | Write 0.2.0 into the table this phase | |
| Restructure the table | Rethink what the status table communicates | |

**User's choice:** Verify, leave version to release.

| Option | Description | Selected |
|--------|-------------|----------|
| Timeless present | Current behavior only; history in changelog/migration | ✓ |
| Annotate changes | "Changed in 0.2.0" markers where behavior moved | |

**User's choice:** Timeless present.

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to '/' | Mirror the committed path after invalidating an in-flight mount | ✓ |
| Keep parked, document it | No code change; document the divergence | |

**User's choice:** Navigate to '/' (resolves the folded disable-mid-flight todo).

---

## CSP & Security Doc Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated docs/security.md | One new doc: CSP, sanitizer guidance, limitations; README table row | ✓ |
| Sections in existing docs | Scattered across cookbook/getting-started/plugin docs | |
| security.md + inline pointers | Dedicated doc plus one-line pointers from other docs | |

**User's choice:** Dedicated docs/security.md.

| Option | Description | Selected |
|--------|-------------|----------|
| Copy-paste policies + why | Concrete CSP examples per deployment shape, directives explained | ✓ |
| Conceptual guidance only | Explain mechanism↔directive interactions only | |
| Tested reference policy | Policy exercised against the example project in a browser | |

**User's choice:** Copy-paste policies + why.

| Option | Description | Selected |
|--------|-------------|----------|
| Both consumption modes | DOMPurify examples for ESM and IIFE/static + D-14 scope warning | ✓ |
| Bundler example only | ESM example + scope warning | |
| Pointer only | Name DOMPurify, show signature, link out | |

**User's choice:** Both consumption modes.

| Option | Description | Selected |
|--------|-------------|----------|
| Full honest inventory | Template trust, sanitizer scope, plaintext storage, IIFE globals, destroy(), single-dapp | ✓ |
| DOC-03 minimum | Template trust + CSP + sanitizer scope only | |
| Inventory + threat framing | Organized as a threat model | |

**User's choice:** Full honest inventory.

---

## Slop Bar & Doc Inventory

| Option | Description | Selected |
|--------|-------------|----------|
| Content edits + fix the index | Keep file set (+security.md); index the 3 orphaned docs | ✓ |
| Merge/delete where warranted | Consolidation in scope | |
| Index-only decision later | Fix table now, todo for consolidation | |

**User's choice:** Content edits + fix the index.

| Option | Description | Selected |
|--------|-------------|----------|
| Ruthless: earn every sentence | Delete anything that doesn't inform; net shrink expected | ✓ |
| Surgical: cut only clear tells | Preserve explanatory redundancy | |
| Rewrite-grade | Wholesale rewrites for voice consistency | |

**User's choice:** Ruthless.

| Option | Description | Selected |
|--------|-------------|----------|
| examples/getting-started | Executable documentation; verify + fix on 0.2.0 | ✓ |
| Public API JSDoc in src/ | Editor-visible docs under the same bar | |
| CLAUDE.md / .claude project docs | Agent-facing docs verification | |
| docs/ + README only | Literal DOC-01 surface | |

**User's choice:** examples/getting-started only (multi-select; JSDoc and CLAUDE.md excluded).

| Option | Description | Selected |
|--------|-------------|----------|
| Genre-appropriate | Tutorials welcoming, references terse, same slop bar | |
| Uniform terse | One dense reference-grade voice everywhere | |
| Match the README | README's terse, stylized DNZN// voice as the exemplar for every doc | ✓ |

**User's choice:** Match the README.

---

## Claude's Discretion

- Drift log format, filename, and granularity.
- Migration section placement (dedicated page vs section of an existing doc) and wording.
- security.md internal structure and README-table row description.
- Scratch-harness mechanics for snippet compile-checks.
- Sequencing of folded code fixes vs docs work (fixes-first suggested).
- dx:error message wording for the folded fixes, per the colon-taxonomy conventions.

## Deferred Ideas

- Public-API JSDoc truth pass (excluded from surface; incidental drift → todos).
- CLAUDE.md / .claude agent-doc verification (same treatment).
- Doc consolidation (development.md/testing.md overlap) — after the truth pass.
- Browser-tested CSP reference policy — later milestone.
- Fresh 0.2.0 self-audit (audit/self/dxkit-0.2.0.md).
- Close stale WR-02 wallet todo (fixed in Phase 3).

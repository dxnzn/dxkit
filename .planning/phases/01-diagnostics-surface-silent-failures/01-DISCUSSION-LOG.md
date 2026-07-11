# Phase 1: Diagnostics — Surface Silent Failures - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 1-diagnostics-surface-silent-failures
**Areas discussed:** localStorage error policy, Container recovery contract, dx:error source taxonomy, Mount-fail timing, Storage-write noise, Error detail fidelity

---

## localStorage error policy (DIAG-02)

### Storage entirely unavailable (`canUseStorage()` false)

| Option | Description | Selected |
|--------|-------------|----------|
| Stay silent | Unavailability is an expected environment condition (SSR / private mode); plugins already degrade to in-memory. Emitting would flood dx:error and train devs to ignore it. | ✓ |
| Emit once per plugin | One dx:error the first time storage is found unavailable, then suppress. | |
| Emit every time | Emit on every persist/restore attempt when unavailable. | |

### Corrupted JSON on restore (`JSON.parse` throws)

| Option | Description | Selected |
|--------|-------------|----------|
| Emit dx:error | Corrupted persisted state is a real, diagnosable problem; emit then still fall back to defaults so behavior is unchanged. | ✓ |
| Stay silent | Treat corruption as benign, use defaults quietly (current behavior). | |

**User's choice:** Stay silent on unavailability; emit on corrupted JSON.
**Notes:** Genuine operation failures (quota/SecurityError while storage IS available) emit — that's the core DIAG-02 requirement, not in question.

---

## Container recovery contract (DIAG-03)

### Recovery method

| Option | Description | Selected |
|--------|-------------|----------|
| Clear to empty | `container.innerHTML = ''` on failure. Single-dapp + prior unmount means "empty" is the correct restored state. No snapshotting. | ✓ |
| Snapshot & restore | Capture innerHTML before injection, restore on failure. Machinery for a case the mount contract doesn't support. | |

### Scope of clear-on-failure

| Option | Description | Selected |
|--------|-------------|----------|
| All post-injection paths | Clear on entry AND dependency failures — one "failed mount leaves no visible DOM" guarantee. Broader than literal wording, same intent. | ✓ |
| Entry-script only (literal) | Clear only on entry failure, exactly per DIAG-03. Dependency failure would still leave stale DOM. | |

**User's choice:** Clear to empty, all post-injection paths.
**Notes:** —

---

## dx:error source taxonomy

### Plugin storage failure format

| Option | Description | Selected |
|--------|-------------|----------|
| `plugin:<name>:storage:<op>` | Mirrors the plugin-event namespace (dx:plugin:<name>:<action>); consumers can distinguish plugin errors from shell/lifecycle. Op suffix satisfies DIAG-02. | ✓ |
| `<name>:storage:<op>` | Matches the bare-component style (lifecycle:*, shell:*) more literally; shorter but ambiguous vs a core component of the same name. | |

### Missing-container source

| Option | Description | Selected |
|--------|-------------|----------|
| `shell:mount` | Fits the existing shell:manifest sibling; two-segment convention. | ✓ |
| `shell:mount:container` | More specific but deeper than existing convention. | |

**User's choice:** `plugin:<name>:storage:<op>`; `shell:mount`.
**Notes:** Existing lifecycle:* / shell:manifest sources unchanged.

---

## Mount-fail timing (DIAG-01)

### When to emit

| Option | Description | Selected |
|--------|-------------|----------|
| Every failed mount attempt | Error tied to the actual failed navigation; repeats only if dev keeps navigating with no container. | ✓ |
| Once + validate at init() | Also check #dx-mount at init. Risks false positives — container is documented as lazily resolved. | |
| Once total (dedupe) | Emit first failure only; adds state, can hide ongoing failures. | |

### Control flow

| Option | Description | Selected |
|--------|-------------|----------|
| Emit then return | Keep `if(!container) return;` control flow, add emit before it. Fully backward-compatible. | ✓ |
| Emit then throw | Throw after emitting; breaks silent-continue contract, could crash route handlers. | |

**User's choice:** Every failed attempt; emit then return.
**Notes:** No init-time check (lazy-resolution false-positive risk).

---

## Storage-write noise (DIAG-02, follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Emit every time | Consistent with mount decision; no dedupe state; a flood is itself a signal. | ✓ |
| Throttle repeats per plugin | Emit first failure, suppress identical repeats until a write succeeds; adds last-error state, can hide ongoing failures. | |

**User's choice:** Emit every time.
**Notes:** settings.persist() writes the whole blob on every setValue, so a full quota would emit per write — accepted for consistency and simplicity.

---

## Error detail fidelity (DIAG-02, follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap with descriptive message | e.g. `new Error(\`Settings persist failed: ...\`)`, original as cause. Matches existing lifecycle convention; greppable. | ✓ |
| Pass raw caught error | Forward original DOMException unchanged; preserves type/stack but terse and inconsistent. | |

**User's choice:** Wrap with descriptive message (preserve original as `cause`).
**Notes:** `source` names plugin+op; message adds the human-readable "what".

---

## Claude's Discretion

- Exact wording of the wrapped error messages (must name the operation, read consistently with lifecycle:* messages).
- How the wallet plugin's storage closures reach `dx?.events` (already close over `dx`).
- Test approach for the new emit paths — researcher/planner decides.

## Deferred Ideas

- Configurable wallet storage key — Phase 3 / SEC-02.
- Template sanitizer hook — Phase 3 / SEC-01.
- Throttle/dedupe of repeated dx:error — considered, rejected this phase.
- Init-time #dx-mount validation — considered, rejected (lazy-resolution false positives).
- Storage encryption — out of scope (v2).

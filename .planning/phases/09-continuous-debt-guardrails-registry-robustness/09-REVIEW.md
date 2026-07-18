---
phase: 09-continuous-debt-guardrails-registry-robustness
reviewed: 2026-07-18T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - .github/workflows/ci.yml
  - scripts/check-no-runtime-deps.cjs
  - src/shell.ts
  - tests/check-no-runtime-deps.test.ts
  - tests/node-builtins.d.ts
  - tests/renovate-config.test.ts
  - tests/shell.test.ts
  - tests/typecheck-config.test.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-07-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Diffed against `0978215` to isolate the actual phase changes: two new named CI steps (GATE-01
typecheck, GATE-02 zero-runtime-dep), the new `scripts/check-no-runtime-deps.cjs` gate script and
its test, an ambient `node:module` declaration addition, the new `tests/renovate-config.test.ts`
(GATE-03), a non-array-body guard added to `src/shell.ts`'s `loadManifests()` registry-fetch tier
(ROB-05), and the corresponding new tests plus a GATE-01 CI-wiring test block.

The core finding is that the ROB-05 fix is incomplete: `loadManifests()` has three input tiers
(`dapps` entries, inline `manifests`, and the `registryUrl` fetch), all three are equally
externally-supplied and equally untyped-consumer-reachable (the IIFE/no-bundler deployment target
is explicitly first-class per this project's README), but the new non-array guard was applied to
only one of the three. The other two retain the exact uncaught-crash failure mode this phase set
out to eliminate, which contradicts the project's own "failures are visible, never silent" charter.
A secondary finding is a vacuous assertion introduced in the new GATE-01 CI-wiring test that
provides no actual protection against the regression it claims to guard. The rest of the new code
(the dep-check script, its tests, the renovate test, and the CI wiring itself) is sound.

## Critical Issues

### CR-01: ROB-05 non-array guard only covers one of `loadManifests()`'s three input tiers — the other two still crash `shell.init()` silently

**File:** `src/shell.ts:250-257` (uncovered tiers), contrast with the fixed tier at `src/shell.ts:274-289`
**Issue:** The phase added a guard so a wrong-shape `registryUrl` fetch body (e.g. `{ not: 'an array' }`) is caught and turned into a `dx:error` emit instead of crashing:

```ts
const parsed = await res.json();
if (!Array.isArray(parsed)) {
  events.emit('dx:error', { source: 'shell:manifest', error: new Error(/* ... */) });
  return [];
}
return parsed;
```

The comment justifying this (lines 276-280) is explicit about *why*: an unguarded non-array value
reaches `normalizeAndValidateManifests()`'s `for (const m of list)` and throws an uncaught
`TypeError` **before `window.__DXKIT__` is exposed**, and that must never happen silently.

That exact reasoning applies identically to the other two tiers of the same function, neither of
which received the guard:

```ts
// line 250-253 — dapps entries tier
if (dappEntries?.length) {
  const results = await Promise.all(dappEntries.map(loadDappManifest));   // .map() throws if
  return results.filter((m): m is DappManifest => m !== null);            // dappEntries is a
}                                                                          // non-array object

// line 255-257 — inline manifests tier
if (inlineManifests) {
  return inlineManifests;   // returned unchecked — a non-array `manifests` config value
}                            // flows straight into the same for...of crash
```

`config.manifests` is typed `manifests?: DappManifest[]` (`src/types/shell.ts:21`), so a
TypeScript consumer is protected at compile time — but IIFE/static-HTML consumers (this project's
documented primary deployment target for IPFS/`file:///`, per README's Build System table) pass
this config as untyped JS and get no such protection. A plausible authoring mistake — e.g. passing
an object keyed by id instead of an array, or a `dapps` value that isn't an array but happens to
carry a `.length` — reaches the same `for...of`/`.map()` TypeError, which surfaces only as an
unhandled promise rejection from `shell.init()`. `window.__DXKIT__` is never assigned (that
happens later in `init()`), and no `dx:error` is emitted — precisely the silent-crash failure mode
this phase's own design rationale says must be eliminated.

**Fix:** Extract the array-shape check into a shared helper and apply it to all three
`loadManifests()` tiers, not just the registry-fetch one:

```ts
function coerceManifestArray(value: unknown, sourceLabel: string): DappManifest[] {
  if (!Array.isArray(value)) {
    events.emit('dx:error', {
      source: 'shell:manifest',
      error: new Error(
        `${sourceLabel} — expected an array of manifests, got ${value === null ? 'null' : typeof value}`,
      ),
    });
    return [];
  }
  return value;
}

// dapps tier
if (dappEntries !== undefined) {
  const entries = coerceManifestArray(dappEntries, 'config.dapps');
  if (entries.length === 0) return [];
  const results = await Promise.all(entries.map(loadDappManifest));
  return results.filter((m): m is DappManifest => m !== null);
}

// inline manifests tier
if (inlineManifests !== undefined) {
  return coerceManifestArray(inlineManifests, 'config.manifests');
}
```

(Reuse the same helper for the `registryUrl` branch to remove the duplicated inline check.)

## Warnings

### WR-01: Vacuous OR-condition makes the new GATE-01 "named step" assertion always pass regardless of naming

**File:** `tests/typecheck-config.test.ts:313-317`
**Issue:**

```ts
const namedTypecheckStep =
  /name:.*(GATE-01|deprecation).*\n\s*run:\s*make typecheck/i.test(ciWorkflowContent) ||
  /run:\s*make typecheck/.test(ciWorkflowContent);
expect(namedTypecheckStep, 'ci.yml should contain a run: make typecheck line').toBe(true);
```

The second disjunct — a bare substring test for `run: make typecheck` anywhere in the file — is
true whenever the first (meaningful, "named + references GATE-01") disjunct would also be true, and
is *also* true in every case where the step is unnamed or doesn't reference GATE-01. The `||` makes
the first disjunct's result irrelevant to the assertion outcome: this `expect` will pass as long as
any `run: make typecheck` line exists at all, so it provides zero regression protection for the
"named step referencing GATE-01" invariant its own docstring claims to guard (the actual naming
requirement is only enforced by the *following* `stepBlockMatch` assertions, three lines down).
This is dead/misleading test logic — it reads as a meaningful check but isn't one.

**Fix:** Drop the vacuous OR entirely; the `stepBlockMatch` assertions that follow already assert
the real invariant:

```ts
const stepBlockMatch = ciWorkflowContent.match(/-\s*name:\s*(.+)\n\s*run:\s*make typecheck/);
expect(stepBlockMatch, 'ci.yml should have a named step directly running `make typecheck`').toBeTruthy();
expect(stepBlockMatch![1], 'the named typecheck step should reference GATE-01 or deprecation').toMatch(
  /GATE-01|deprecation/i,
);
```

### WR-02: `scripts/check-no-runtime-deps.cjs` CLI entrypoint has no error handling for missing/unreadable/malformed `package.json`

**File:** `scripts/check-no-runtime-deps.cjs:32`
**Issue:**

```js
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
```

If `pkgPath` doesn't exist, isn't readable, or contains invalid JSON, this throws an uncaught
exception — Node prints a raw stack trace instead of the script's own `FAIL:`-prefixed,
actionable error style used everywhere else in the file (including the adjacent "missing argument"
branch, which *does* handle its error case cleanly). The process still exits non-zero (Node's
default for an uncaught exception), so the CI gate itself doesn't silently pass, but the failure
mode is inconsistent and confusing compared to the rest of the script.

**Fix:**

```js
let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
} catch (err) {
  console.error(`FAIL: could not read/parse ${pkgPath} — ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
```

## Info

### IN-01: `typeof parsed` misreports `null` as `"object"` in the ROB-05 error message

**File:** `src/shell.ts:283`
**Issue:** `typeof null === 'object'` in JavaScript, so a registry body that parses to JSON `null`
produces `"expected a JSON array of manifests, got object"`, which is misleading — there's no
object at all, just `null`.
**Fix:** `` `got ${parsed === null ? 'null' : typeof parsed}` ``.

### IN-02: `checkNoRuntimeDeps()` mis-flags array-shaped dependency fields with meaningless index names

**File:** `scripts/check-no-runtime-deps.cjs:14`
**Issue:** `typeof value === 'object'` is also true for arrays. A malformed `package.json` with
e.g. `"dependencies": ["lodash"]` would pass the `value && typeof value === 'object'` guard and
then `Object.keys(value)` returns `['0']`, producing a violation string `dependencies.0` instead of
naming the actual package. Low-impact (real `package.json` dependency fields are always objects,
and `dependencies` is validated elsewhere in the npm toolchain), but worth an explicit
`Array.isArray(value)` exclusion for a script whose entire job is precise reporting.
**Fix:** `if (value && typeof value === 'object' && !Array.isArray(value)) { ... }`

### IN-03: `renovate-config.test.ts`'s "toolchain group completeness" check identifies the target rule by a fragile length heuristic

**File:** `tests/renovate-config.test.ts:95-98`
**Issue:**

```ts
const toolchainRule = rules.find((rule) => {
  const names = rule.matchPackageNames as string[] | undefined;
  return Array.isArray(names) && names.length >= TOOLCHAIN_PACKAGES.length;
});
```

This identifies "the toolchain rule" purely by `matchPackageNames.length >= 6`, not by checking
that the names actually overlap with `TOOLCHAIN_PACKAGES` (unlike the sibling test two blocks
above, which correctly uses `.every(pkg => names.includes(pkg))`). A future, unrelated
`packageRules` entry that happens to list 6+ arbitrary package names would silently become "the
toolchain rule" for this assertion, masking an actual regression where the real toolchain group
loses a package (since the `for` loop below checks membership against whatever rule this `find`
happened to select, not the config's actual toolchain rule).
**Fix:** Reuse the same overlap-based selection as the first sub-test:
`rules.find((rule) => Array.isArray(rule.matchPackageNames) && TOOLCHAIN_PACKAGES.every((pkg) => (rule.matchPackageNames as string[]).includes(pkg)))`.

---

_Reviewed: 2026-07-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

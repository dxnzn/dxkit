# Phase 8: Forward-Compat Typing - Research

**Researched:** 2026-07-17
**Domain:** TypeScript strict forward-compat compiler flags (`verbatimModuleSyntax`, `isolatedDeclarations`, `erasableSyntaxOnly`) + build-artifact (dist/) smoke testing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (flag config placement):** All three flags go in the **root base `tsconfig.json`** — the
  single source of truth inherited by (a) the `tsc --emitDeclarationOnly -p tsconfig.json`
  declaration-emit pass, (b) the five `tsconfig.typecheck.json` configs, and (c) all four plugins via
  `extends: "../../tsconfig.json"`. Rationale: `isolatedDeclarations` only guards `.d.ts` emit, so it
  MUST live in the config the emit pass reads (not typecheck-only); putting all three in base keeps
  emit and typecheck enforced in lockstep and gives plugins the flags for free. Rejected:
  typecheck-only placement and split-by-where-each-bites.
- **D-02 (isolatedDeclarations annotation policy):** Minimal at-source annotations — add explicit
  return-type/type annotations **only where `isolatedDeclarations` demands them**. No broader
  public-API audit, no manufactured churn.
- **D-03 (breaking-change note):** Write the `BREAKING CHANGE:` footer + migration note **only if
  the adoption actually alters consumer-visible type behavior**; if nothing public shifts, no note
  is manufactured (degenerate-but-valid: non-breaking additive config change).
- **D-04 (FCT-04 smoke test placement & runner):** A dedicated `make` target (e.g. `make smoke`)
  runs `make build` and then a **vitest** pass against the **real built `dist/`** artifacts: CJS via
  `require('.../dist/index.cjs')`, IIFE loaded into **happy-dom** to assert global-attach. **NOT
  folded into `make test`** — `make test` never builds. Wire the smoke target into the
  **build/release/CI** flow.
- **D-05 (FCT-04 assertion depth):** Exhaustive expected-key assertions — each IIFE global (`DxKit`,
  `DxWallet`, `DxAuth`, `DxTheme`, `DxSettings`) must attach with its full expected set of top-level
  export keys, and CJS `require()` must return that same expected export set. The expected-key list
  is a deliberate maintained fixture.
- **D-06 (rollout & commit order):** One bisectable commit per flag, no-ops first,
  `isolatedDeclarations` last. Sequence: (1) `verbatimModuleSyntax` + `erasableSyntaxOnly` first
  (may be one or two commits); (2) `isolatedDeclarations` core-before-plugins, per-package; (3) the
  FCT-04 smoke test last.

### Claude's Discretion

- Exact `make` target name for the smoke test (`smoke` vs `smoke-test` vs folding under an existing
  verify step's naming), and the precise CI/`release`/`publish` wiring point — mirror how
  `verify-outputs` is wired (D-04 intent, not exact string). **This research recommends inserting
  immediately after `verify-outputs`** in both CI and the Makefile prerequisite chains — see Open
  Question 2.
- Whether `verbatimModuleSyntax` and `erasableSyntaxOnly` land as one combined "no-op flags" commit
  or two separate commits.
- The exact happy-dom vs node mechanism for loading the IIFE global — implementation detail, as long
  as global-attach is genuinely asserted. **This research verified `vm.runInContext(code, window)` is
  the only mechanism that actually works** for this codebase's bundle shape — see Common Pitfalls #1.
- The degenerate case where `isolatedDeclarations` surfaces **zero** required annotations — verified
  this session to be the actual outcome; FCT-02's "fixes" are empty (flag-on commit only).
- Whether the expected-export-key fixtures are inlined per-package or centralized in the smoke spec.

### Deferred Ideas (OUT OF SCOPE)

- **CI deprecation gate** scoped to `src/`+`plugins/*/src/` (GATE-01), **zero-runtime-dep assertion**
  (GATE-02), **Renovate** automation (GATE-03), **WR-01 registry array-shape fix** (ROB-05) — all
  **Phase 9**. This phase does not add `node_modules/` deprecation-noise scoping or dependency
  automation.
- **TS7 migration** and **tsup→tsdown swap** — deferred to v2 (milestone out-of-scope).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FCT-01 | `verbatimModuleSyntax` enabled across all packages; build and tests stay green | Verified this session: zero errors with the flag enabled across core + all 4 plugins + tests. See Summary, Standard Stack, State of the Art row 1. Recommend a `tsconfig.json` flag-presence guard test (Validation Architecture Wave 0 gap) as a durable regression check, not just a one-time green build. |
| FCT-02 | `isolatedDeclarations` enabled across all packages; `.d.ts` emit succeeds for every package | Verified this session: zero errors with the flag enabled, including real `tsc --emitDeclarationOnly` emission for core + all 4 plugins. Verified the `onSuccess` build-failure path is loud, not silent (Common Pitfalls #4). See Architecture Patterns diagram, Common Pitfalls #4, Open Question 1. |
| FCT-03 | `erasableSyntaxOnly` enabled across all packages (no non-erasable TS syntax remains) | Verified this session: zero classes/enums/namespaces/parameter-properties exist in `src/` or `plugins/*/src/` (grep-confirmed); flag compiles clean. True no-op, confirmed not hypothetical. |
| FCT-04 | IIFE global-attach and CJS `require()` interop verified intact on the built `dist/` artifacts after the flags land (smoke test) | The core research deliverable of this phase. Verified working pattern (`vm.runInContext` + `createRequire`) and verified-broken naive pattern (`<script>`-element injection) — see Pattern 1/2, Common Pitfalls #1–#3, Code Examples (full fixture + ambient decls), Validation Architecture. |
</phase_requirements>

## Summary

This research is unusually conclusive because the three compiler flags were **empirically tested
against the real codebase during this research session** — not inferred from documentation. A
scratch tsconfig (never committed, deleted before this document was written) added all three flags
simultaneously to core + all four plugins, including declaration emit (`tsc --emitDeclarationOnly`)
and the full `tsconfig.typecheck.json` shape (src + tests, 5-key path aliases). **Zero errors
surfaced anywhere** — core, all four plugins, both `src/` and `tests/`, both `noEmit` typecheck and
real `.d.ts` emission. This confirms the CONTEXT.md scout findings exactly: FCT-01/02/03 is a true
three-line flag-flip in the root `tsconfig.json`, with no at-source annotation work required
anywhere (D-02's "degenerate-but-valid zero annotations" case is the actual outcome, not a
hypothetical).

The real work — and the real research payoff — is **FCT-04**. The naive approach ("inject the IIFE
into a happy-dom `<script>` element") **does not work** for this codebase's build output and was
proven to silently fail during this session: happy-dom v20.10.6 wraps classic `<script>` evaluation
in an internal `(function anonymous($happy_dom) { ... })` closure before executing it, so the
bundle's top-level `var DxKit = ...` becomes function-scoped and never reaches `window.DxKit` —
`window.DxKit` stays `undefined` with no thrown error, i.e. **the failure mode is silent**, which is
exactly the class of bug this project's Core Value exists to prevent. The verified fix is to bypass
happy-dom's `<script>`-element machinery entirely and use Node's native `vm.runInContext(code,
window)` directly against the happy-dom `Window` instance (which is already a `vm.Context` on
construction) — this correctly attaches all five IIFE globals (`DxKit`, `DxWallet`, `DxAuth`,
`DxTheme`, `DxSettings`) with their full expected key sets, including when all five are loaded
sequentially into one shared window (the real multi-`<script>`-tag deployment shape). CJS
`require()` interop was verified via `createRequire(import.meta.url)` (vitest test files are ESM;
bare `require` is not ambiently available) and returns the exact same export sets. No new
dependency is needed for any of this — `happy-dom`, `node:vm`, `node:module`, `node:fs` are already
available (happy-dom is an existing devDependency; the rest are Node builtins, matching the
project's zero-new-devDependency / no-`@types/node` posture established in Phase 7).

**Primary recommendation:** Add all three flags to root `tsconfig.json` in one (or two) bisectable
no-op commits per D-06, then land the FCT-04 smoke test as its own top-level test target (not under
`tests/`, not part of `make test`) using `vm.runInContext` against fresh `happy-dom` `Window`
instances — never happy-dom's `<script>`-element path, which silently fails on this bundle shape.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Compiler strictness (3 flags) | Build/Compile-time (tsconfig) | — | Pure `tsc` diagnostic surface; zero runtime effect, verified via empirical compile (no codegen change from esbuild's perspective) |
| `.d.ts` declaration emit | Build/Compile-time (`tsc --emitDeclarationOnly` in tsup `onSuccess`) | — | Already decoupled from tsup's bundler dts (Phase 7); `isolatedDeclarations` attaches to this exact pass |
| CJS `require()` interop | Node/CJS consumer boundary | Build (`tsup` CJS output) | Verified via `createRequire()` against `dist/index.cjs` — a Node-side concern, not browser |
| IIFE global-attach | Browser/Client (`<script>` deployment) | Build (`tsup` IIFE output) | The runtime contract for the "no bundler" / IPFS-static deployment target; smoke test simulates this tier directly via `vm.runInContext` |
| Smoke test harness | Build/CI (new `make smoke` target) | — | Sits alongside `verify-outputs`/`typecheck` as a build-adjacent gate, not application code |

## Standard Stack

### Core (no new dependencies)

| Tool | Version (installed) | Purpose | Why Standard |
|------|---------|---------|--------------|
| `typescript` | 6.0.3 `[VERIFIED: local install, npx tsc --version]` | Compiler; hosts all 3 flags | Already the project's pinned compiler (Phase 7); `verbatimModuleSyntax` (TS5.0+), `isolatedDeclarations` (TS5.5+), `erasableSyntaxOnly` (TS5.8+) are all well inside 6.0.3's supported set `[CITED: typescriptlang.org/tsconfig/isolatedDeclarations.html, typescriptlang.org/tsconfig/verbatimModuleSyntax.html, typescriptlang.org/tsconfig/erasableSyntaxOnly.html]` |
| `happy-dom` | 20.10.6 `[VERIFIED: local install]` | DOM env for the smoke test's IIFE global-attach assertion | Already the project's vitest DOM implementation; `Window` class exports a real `vm.Context`-backed global object usable directly with `node:vm` |
| `vitest` | 4.1.10 `[VERIFIED: local install]` | Smoke test runner | Already the project's test runner; a second, separate vitest config (not folded into the default one) is the natural fit per D-04 |
| `node:vm` (builtin) | Node ^22.12.0 \|\| >=24.0.0 | Executes the raw IIFE source directly against a happy-dom `Window` context, bypassing happy-dom's `<script>`-element wrapper | **The only mechanism that correctly reproduces top-level `var` → `window.<Global>` attachment** for this bundle shape — verified empirically this session (see Common Pitfalls) |
| `node:module` (`createRequire`) (builtin) | — | Genuine `require()` semantics against `dist/index.cjs` from an ESM test file | vitest test files execute as ESM; bare `require` is not ambiently available, so `createRequire(import.meta.url)` is the standard, explicit substitute |
| `node:fs` / `node:path` (builtin) | — | Read built `dist/*.global.js` / `dist/*.cjs` file contents/paths | Already used in `tests/typecheck-config.test.ts` via the project's own ambient ban on `@types/node` |

**No new packages are introduced by this phase.** Every tool above is either already an installed
devDependency or a Node.js builtin. **Package Legitimacy Audit is not applicable** — see that
section below for the explicit "no-op" record.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vm.runInContext(code, window)` | `document.createElement('script'); script.textContent = code; body.appendChild(script)` | **Verified broken for this bundle** — happy-dom wraps classic scripts in an anonymous function closure, so top-level `var` never reaches `window`. Silent failure (no thrown error), not just an ergonomics tradeoff. See Common Pitfalls #1. |
| `vm.runInContext` | Playwright/Puppeteer real-browser smoke test | A genuine browser would work (no wrapper-closure problem), but adds a heavyweight, non-zero-dep, non-CI-trivial dependency for a check `vm.runInContext` + happy-dom already satisfies with zero new deps. Rejected as over-engineering for this phase's scope. |
| `createRequire(import.meta.url)` | Rename smoke test files to `.cjs` and use native `require` | Works, but forces a second module-format convention (`.cjs` test files) into a codebase that is otherwise 100% ESM/`type: module`; `createRequire` keeps one file extension convention throughout. |

**Installation:** None required — all tools are already present.

**Version verification:** All versions above were confirmed against the locally installed
`node_modules/` (not the npm registry, since nothing new is installed) via `npx tsc --version`,
`cat node_modules/happy-dom/package.json`, and the root/plugin `package.json` `devDependencies`
blocks, all matching Phase 6/7's already-verified pins exactly. No drift detected.

## Package Legitimacy Audit

**Not applicable — this phase installs zero new packages.** All tooling (`happy-dom`, `vitest`,
`typescript`, `node:vm`, `node:module`, `node:fs`, `node:path`) is either an existing devDependency
already vetted in Phase 6, or a Node.js builtin. No `package-legitimacy check` run was needed; there
is nothing to verify against a registry.

**Packages removed due to [SLOP] verdict:** none (n/a — no packages evaluated)
**Packages flagged as suspicious [SUS]:** none (n/a — no packages evaluated)

## Architecture Patterns

### System Architecture Diagram

```text
                         ┌─────────────────────────────────────────┐
                         │  root tsconfig.json (D-01 single source) │
                         │  + verbatimModuleSyntax                  │
                         │  + isolatedDeclarations                  │
                         │  + erasableSyntaxOnly                    │
                         └───────────────┬───────────────────────────┘
                                         │ extends (plugins) / includes (typecheck)
                ┌────────────────────────┼─────────────────────────────┐
                │                        │                              │
                ▼                        ▼                              ▼
   plugins/*/tsconfig.json   tsconfig.typecheck.json ×5      tsup onSuccess hook
   (extends ../../tsconfig)  (make typecheck gate)            tsc --emitDeclarationOnly
                │                        │                              │
                ▼                        ▼                              ▼
        tsc --noEmit (5×)      tsc --noEmit -p *.typecheck.json   dist/*.d.ts (5×)
        [VERIFIED clean]        [VERIFIED clean, src+tests]        [VERIFIED clean emit]


                    ── FCT-04: the boundary nothing else exercises ──

  make build (tsup, per package)
        │
        ├── ESM  dist/index.js      (never asserted at runtime by any existing test)
        ├── CJS  dist/index.cjs     ──► createRequire(import.meta.url)(...)  ──► assert export-key set
        └── IIFE dist/index.global.js ──► vm.runInContext(code, happyDomWindow) ──► assert window.<Global> key set
                                          (NOT document.createElement('script') — verified broken)

  make smoke  (new target: build ⟶ vitest against real dist/, separate from make test)
```

### Recommended Project Structure

```
smoke/                          # NEW — top-level, NOT under tests/ (see Pitfall 2)
├── dist-exports.smoke.test.ts  # or split per-concern; single vitest config covers both CJS+IIFE
└── fixtures/
    └── expected-exports.ts     # maintained fixture — D-05's "deliberate maintenance point"
vitest.smoke.config.ts          # NEW — separate config, include: ['smoke/**/*.test.ts']
tsconfig.json                   # root — 3 new compilerOptions flags (D-01)
Makefile                        # NEW `smoke` target + .PHONY update, wired per D-04
```

### Pattern 1: Correct IIFE global-attach assertion (verified this session)

**What:** Execute the built IIFE file's raw source directly against a happy-dom `Window`'s VM
context using `node:vm`, bypassing happy-dom's own `<script>`-element evaluation path.

**When to use:** Any assertion that a `var <Global> = ...` top-level IIFE bundle attaches to a
DOM-like `window` object in a test environment.

**Example (verified working, exact keys returned this session):**
```typescript
// Source: verified empirically this research session against dist/index.global.js
import { Window } from 'happy-dom';
import vm from 'node:vm'; // ambient decl needed — see Code Examples
import { readFileSync } from 'node:fs';

const code = readFileSync('dist/index.global.js', 'utf-8');
const window = new Window(); // already vm.isContext(window) === true on construction
vm.runInContext(code, window, { filename: 'dist/index.global.js' });

// window.DxKit is now a real object: { createEventBus, createEventRegistry,
//   createLifecycleManager, createPluginRegistry, createRouter, createShell }
```

Loading all 5 packages' IIFE bundles into **one shared `Window`** (simulating multiple `<script>`
tags on one real HTML page — the actual deployment shape) was also verified this session: all five
globals (`DxKit`, `DxWallet`, `DxAuth`, `DxTheme`, `DxSettings`) coexist with no collisions when
executed sequentially in dependency order (core, then settings/wallet/auth/theme) via repeated
`vm.runInContext` calls against the same `window`.

### Pattern 2: CJS require() interop assertion

**What:** Use `createRequire(import.meta.url)` to get a genuine Node `require()` function inside an
ESM test file, then `require()` the built `dist/index.cjs`.

**Example (verified working):**
```typescript
// Source: verified empirically this research session against dist/index.cjs
import { createRequire } from 'node:module'; // ambient decl needed — see Code Examples
const require = createRequire(import.meta.url);
const mod = require('../dist/index.cjs'); // path relative to the smoke test file
// Object.keys(mod) === ['createEventBus','createEventRegistry','createLifecycleManager',
//   'createPluginRegistry','createRouter','createShell']
```

### Anti-Patterns to Avoid

- **`document.createElement('script'); el.textContent = code; document.body.appendChild(el)` in
  happy-dom, expecting `window.<Global>` to appear.** Verified broken this session (see Common
  Pitfalls #1) — the failure is *silent* (`window.DxKit` stays `undefined`, nothing throws), which
  is the worst possible failure mode for a gate whose entire purpose is catching a dropped export.
- **Nesting the smoke test under `tests/` or `plugins/*/tests/`.** `vitest.config.ts`'s existing
  `include: ['tests/**/*.test.ts', 'plugins/*/tests/**/*.test.ts']` glob is broad — any `*.test.ts`
  file anywhere under those trees gets swept into the default `vitest run` that `make test` invokes,
  which never builds (Phase 7 constraint). A smoke test placed there would either fail immediately
  in every `make test` run (no fresh `dist/`) or silently pass against a *stale* `dist/` left over
  from a previous `make build` — both violate D-04's explicit "not folded into `make test`" decision.
- **Manufacturing `isolatedDeclarations` annotations that aren't needed.** Verified this session:
  zero annotations are required anywhere in `src/` or `plugins/*/src/`. Per D-02/the CONTEXT.md
  "Claude's Discretion" note, if the flag surfaces nothing, land the flag-on commit and stop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading a UMD/IIFE bundle into a fake global scope for testing | A custom `Function(code)()` eval wrapper, or a hand-rolled `Object.assign(globalThis, ...)` shim | `vm.runInContext(code, window)` against a real `happy-dom` `Window` (already `vm.isContext`) | `new Function(code)()` has the *exact same* function-scoping problem as happy-dom's own `<script>` wrapper — top-level `var` never escapes a function body, in V8, regardless of strict mode. `vm.runInContext` executes directly in the target context's global scope, which is the only mechanism that reproduces real `<script>`-tag semantics for `var`-based UMD/IIFE output. |
| Verifying CJS/ESM interop | A custom dynamic-`import()`-then-inspect-`.default` shim | `createRequire(import.meta.url)` + real `require()` | `import()` of a `.cjs` file exercises Vite/Node's ESM-interop shimming layer, not Node's actual `require()` resolution/caching semantics — which is precisely the boundary FCT-04 exists to test. |

**Key insight:** Every "custom loader" shortcut for this problem re-introduces the same
function-scoping bug that broke happy-dom's own built-in `<script>` execution path. There is exactly
one correct mechanism (`vm.runInContext` against a real VM-context global object) — anything else
that wraps the source in an intermediate function silently reproduces the bug this phase exists to
catch.

## Common Pitfalls

### Pitfall 1: happy-dom's `<script>`-element execution silently drops top-level `var` globals

**What goes wrong:** Injecting the IIFE source via
`document.createElement('script'); script.textContent = code; document.body.appendChild(script)`
executes without throwing, but `window.DxKit` (and the other 4 plugin globals) remain `undefined`.
No error, no warning by default — a genuinely silent failure.

**Why it happens:** Verified by reading `HTMLScriptElement.js`'s `#evaluateScript` and
`JavaScriptCompiler.js`'s `compile()` (happy-dom 20.10.6): every classic `<script>` is compiled into
`(function anonymous($happy_dom) { try { <source> } catch (e) { ... } })` and then *called* (not
run at the VM context's top level). A `var` declared inside that generated function is
function-scoped per JS semantics — it can never become a property of `window`, no matter what
context the function itself was compiled against. This is unrelated to (and independent of) the
`enableJavaScriptEvaluation: false` default setting — even with JS evaluation explicitly enabled,
the wrapper still swallows `var`.

A second, compounding gotcha was found in the same investigation: because the wrapper text (`})`)
is appended to the source with **no newline separator**, a source file whose last line is a `//`
comment with no trailing newline (exactly what tsup emits: `...})();\n//# sourceMappingURL=...` with
no final `\n`) causes the appended `})` to be swallowed into the comment, throwing `SyntaxError:
Unexpected end of input` if `enableJavaScriptEvaluation` happens to be turned on. With it left at
its default `false`, no error surfaces at all — the append() call silently no-ops via the disabled
`disableEvaluation` branch, which is arguably worse (nothing crashes, nothing warns, the assertion
just measures `undefined` against `undefined` if written carelessly).

**How to avoid:** Do not use the `<script>`-element path at all. Use `vm.runInContext(code, window)`
directly (Pattern 1 above) — this bypasses happy-dom's wrapper entirely and executes the source at
the VM context's real top level, so `var DxKit = ...` correctly becomes `window.DxKit`. Verified
working for all 5 packages, individually and loaded together into one shared window.

**Warning signs:** A smoke test that "passes" by asserting `typeof window.DxKit === 'undefined'` as
the negative case never actually exercised a real scenario if the positive case was never separately
confirmed non-`undefined` first — always assert the *positive* shape (exact key set), never just
"did not throw."

### Pitfall 2: The smoke test's own file location can accidentally join `make test`

**What goes wrong:** `vitest.config.ts`'s `include` is `['tests/**/*.test.ts',
'plugins/*/tests/**/*.test.ts']` — a broad recursive glob. A smoke test file placed anywhere under
either tree (even a new `tests/smoke/` subdirectory) gets picked up by the *default* `vitest run`
that `make test` invokes, which per Phase 7's constraint **never builds**. Either the smoke test
fails on every `make test` run (no `dist/` present in a clean checkout) or passes against a stale
`dist/` from an earlier `make build`, silently defeating its own purpose.

**Why it happens:** Vite/vitest glob matching is directory-position-based, not config-file-based —
there's no automatic exclusion for "tests that need a build."

**How to avoid:** Give the smoke test its own top-level directory (e.g. `smoke/`) outside both
existing glob roots, and its own `vitest.smoke.config.ts` with a narrow `include`. Wire a new `make
smoke` target (`smoke: build` prerequisite, then `npx vitest run --config vitest.smoke.config.ts` or
equivalent) into CI/release/publish per D-04 — never into `make test`.

**Warning signs:** `make test` (which should never touch `dist/`) suddenly requires a prior `make
build` to pass, or CI's `make test` step starts failing intermittently depending on whether a build
happened to run first in the same job.

### Pitfall 3: `biome.json`'s explicit `files.includes` allowlist silently skips new directories

**What goes wrong:** `make lint` (`biome check .`) will not report any errors in a newly-created
`smoke/` directory — not because the code is clean, but because `biome.json`'s `files.includes` is
an **explicit allowlist**: `["src/**/*.ts", "tests/**/*.ts", "plugins/*/src/**/*.ts",
"plugins/*/tests/**/*.ts"]`. Anything outside those four globs is invisible to Biome, not merely
passing.

**Why it happens:** Biome (unlike ESLint's implicit "lint everything, `.eslintignore` excludes")
uses an inverse default — configured includes are the *only* thing scanned.

**How to avoid:** Add the new smoke directory (e.g. `"smoke/**/*.ts"`) to `biome.json`'s
`files.includes` alongside the new `Makefile`/CI wiring, so the smoke test's own code style is
actually enforced rather than silently exempted.

**Warning signs:** `make lint` reports 0 issues immediately after adding a large new test file with
obvious style violations — a green run that means "not checked," not "clean."

### Pitfall 4: `isolatedDeclarations` + tsup's `onSuccess` hook — verified to fail loudly, not silently

**What goes wrong (the thing to *not* worry about):** A plausible-sounding risk is that if
`isolatedDeclarations` ever *did* surface a real annotation-required error (e.g. from a future
change that isn't as cleanly typed as the current codebase), the `tsc --emitDeclarationOnly` call
inside tsup's `onSuccess` hook might fail silently, leaving a stale or partial `dist/*.d.ts` behind
while `make build` reports success.

**Verified this session:** it does not fail silently. A throwaway `tsup.config.ts` with
`onSuccess: 'exit 1'` was run against a scratch package (outside git, deleted after) using this
repo's actual installed `tsup@8.5.1` — the non-zero exit code from `onSuccess` **propagates as
`npx tsup`'s own exit code**. In the root `Makefile`, `@npx tsup` has no `-` prefix or explicit `||
exit 1` guard, but Make's default behavior is to abort the recipe on any non-zero command exit — so
a genuine `isolatedDeclarations` failure in the `onSuccess` pass would correctly fail `make build`
loudly, exactly matching this project's "failures are visible, never silent" Core Value. **No
Makefile change is required to make this failure mode visible — it already is.**

**Residual gap (worth flagging to the planner as discretionary):** `verify-outputs` currently checks
only `dist/index.js dist/index.cjs dist/index.global.js` per package — it does **not** check for
`dist/index.d.ts`. Since a build-time failure already aborts `make build` before `verify-outputs`
runs, this gap is not a correctness risk today, but adding a `dist/index.d.ts` existence check to
`verify-outputs` would be a natural, low-cost defense-in-depth extension of the exact same loop
pattern, and would make FCT-02's literal success criterion ("`.d.ts` emit succeeds for every
package") independently asserted rather than only implied by build exit code.

## Code Examples

Verified patterns from this session's live testing (not documentation-derived):

### Ambient Node builtin declarations needed (matches existing `tests/node-builtins.d.ts` convention)

```typescript
// Source: verified pattern, extends the existing tests/node-builtins.d.ts convention
// (no @types/node in this project — Phase 7 deliberately keeps it out)
declare module 'node:vm' {
  interface Context {}
  function runInContext(code: string, contextifiedObject: Context, options?: { filename?: string }): unknown;
  function isContext(object: unknown): boolean;
  const _default: { runInContext: typeof runInContext; isContext: typeof isContext };
  export default _default;
  export { runInContext, isContext };
}

declare module 'node:module' {
  function createRequire(path: string): (id: string) => any;
  export { createRequire };
}
```

Note: `happy-dom`'s `Window` class ships its own TypeScript types (`node_modules/happy-dom/lib/index.d.ts`)
— no ambient declaration is needed for `happy-dom` itself, only for the Node builtins it's paired with.

### Full expected-export fixtures (verified via actual `dist/` build this session)

```typescript
// Source: verified via `require()` (CJS) against a real `make build` output this session.
// This is the exact shape D-05's "maintained fixture" should assert.
export const EXPECTED_EXPORTS = {
  core: ['createEventBus', 'createEventRegistry', 'createLifecycleManager', 'createPluginRegistry', 'createRouter', 'createShell'],
  wallet: ['createEIP1193Provider', 'createEthereumWallet', 'createLocalWalletProvider', 'createWallet'],
  auth: ['createPassthroughAuth'],
  theme: ['createCSSTheme'],
  settings: ['createSettings'],
} as const;
```

Note `createEthereumWallet` is present and `@deprecated` (JSDoc-only, no runtime effect) — the
fixture intentionally includes it; dropping a deprecated export without a major/BREAKING CHANGE
bump is exactly the kind of drift D-05's exhaustive assertion exists to catch.

### Multi-global shared-window pattern (verified working)

```typescript
// Source: verified this session — all 5 IIFE globals coexist correctly in one shared window
// when loaded in dependency order (core before plugins), matching real multi-<script>-tag pages.
import { Window } from 'happy-dom';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const window = new Window();
const files: Array<[string, string]> = [
  ['DxKit', 'dist/index.global.js'],
  ['DxWallet', 'plugins/wallet/dist/index.global.js'],
  ['DxAuth', 'plugins/auth/dist/index.global.js'],
  ['DxTheme', 'plugins/theme/dist/index.global.js'],
  ['DxSettings', 'plugins/settings/dist/index.global.js'],
];
for (const [, file] of files) {
  vm.runInContext(readFileSync(file, 'utf-8'), window, { filename: file });
}
// window.DxKit, window.DxWallet, window.DxAuth, window.DxTheme, window.DxSettings all populated,
// no collisions, no re-declaration errors.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Loose `import`/`export type` elision (compiler infers what's type-only) | `verbatimModuleSyntax` — explicit `import type`/`export type` required, elision is literal | TS 5.0 `[CITED: typescriptlang.org/tsconfig/verbatimModuleSyntax.html]` | Already the codebase's de facto style (20 type-imports vs 5 value-imports observed); flag formalizes existing discipline, verified zero-diff |
| tsup's bundled `dts: true` (rollup-plugin-dts) for `.d.ts` emit | Direct `tsc --emitDeclarationOnly` pass, decoupled from tsup's bundler | Landed Phase 7 (07-04), TS6-02 fix for the `baseUrl` TS5101 deprecation | `isolatedDeclarations` attaches cleanly to a real `tsc` emit pass instead of a third-party dts bundler that doesn't understand the flag |
| No dedicated build-artifact test | FCT-04 smoke test (this phase) | This phase | First test that ever exercises `dist/index.cjs` / `dist/index.global.js` directly — closes the one gap `tsc --noEmit` and the default vitest suite structurally cannot reach (they only ever see `src/`) |

**Deprecated/outdated:**
- None — this phase adds strictness, it does not deprecate anything in this codebase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `isolatedDeclarations`'s general annotation rules (object-literal exemptions, `satisfies` handling, computed-property limitation) as summarized from the TS 5.5 release notes `[CITED: typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html]` | Common Pitfalls / background context | Low — this codebase was independently verified to compile with zero `isolatedDeclarations` errors under the *actual* installed TS 6.0.3, so the general rules are documented for context only and do not gate any real fix in this phase |
| A2 | happy-dom's `<script>`-wrapper behavior and the `vm.runInContext` fix are specific to `happy-dom@20.10.6`; a future happy-dom major could change this internal implementation | Common Pitfalls #1, Pattern 1 | Medium if happy-dom is bumped later without re-verifying — the `vm.runInContext` approach itself is a documented Node API (`[CITED: nodejs.org/api/vm.html]` general knowledge, stable API) and does not depend on happy-dom internals staying the same shape, so risk is limited to needing to re-verify (not re-architect) on a future happy-dom bump |

**All other claims in this research were independently verified this session** via direct `tsc`
compilation, `tsup` build execution, `node:vm`/`happy-dom` scripted tests, and `require()`/`Object.keys()`
inspection of the actual build output — not sourced from documentation or training knowledge.

## Open Questions

1. **Should `verify-outputs` gain a `dist/index.d.ts` existence check?**
   - What we know: verified this session that `verify-outputs` currently only checks the 3 JS
     formats, and that a genuine `isolatedDeclarations` failure in `onSuccess` already fails `make
     build` loudly (Pitfall 4) — so this is not a correctness gap, only a defense-in-depth /
     "make FCT-02's success criterion independently assertable" nicety.
   - What's unclear: whether the planner considers this in-scope for this phase (it's adjacent to,
     but not explicitly named by, D-04/D-05) or a Phase 9 guardrails concern.
   - Recommendation: low-cost enough (one more `test -f` line per package, mirroring the existing
     loop) to fold into this phase's work if the planner wants FCT-02 to have its own explicit gate;
     otherwise safe to leave out, since the loud build failure already covers it.

2. **Exact `make smoke` wiring point relative to `verify-outputs`/`test` in CI and `release`/`publish`.**
   - What we know: D-04 leaves the precise CI/release/publish wiring point as Claude's discretion,
     "mirror how verify-outputs is wired." Current CI order is `build → verify-outputs → test`;
     current `release`/`publish` Makefile targets both already chain `build verify-outputs test` as
     prerequisites.
   - What's unclear: whether `smoke` should be inserted between `verify-outputs` and `test`, or after
     `test`, in both CI and the Makefile prerequisite chains.
   - Recommendation: insert immediately after `verify-outputs` (both places) — it's a natural extension
     of "does the build output look right," logically prior to running the unit/integration suite, and
     keeps `test`'s existing "does not build" guarantee (Phase 7 constraint) undisturbed since `smoke`
     already self-builds via its own `build` prerequisite.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| TypeScript | FCT-01/02/03 flags | ✓ | 6.0.3 | — |
| tsup | FCT-04 build artifacts to smoke-test | ✓ | 8.5.1 | — |
| happy-dom | FCT-04 IIFE global-attach assertion | ✓ | 20.10.6 | — |
| vitest | FCT-04 smoke test runner | ✓ | 4.1.10 | — |
| `node:vm`, `node:module`, `node:fs`, `node:path` | FCT-04 smoke test implementation | ✓ (Node builtins) | Node ^22.12.0 \|\| >=24.0.0 (project floor) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — everything needed is already present.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (existing) + a second, separate vitest config for the smoke target |
| Config file | `vitest.config.ts` (existing, unmodified) + `vitest.smoke.config.ts` (new, D-04) |
| Quick run command | `npx vitest run --config vitest.smoke.config.ts` |
| Full suite command | `make smoke` (builds first per D-04, then runs the smoke config) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FCT-01 | `verbatimModuleSyntax` enabled, build+tests green | config-guard + existing suite | `make typecheck && make build && make test` | ❌ Wave 0 (recommend a `tsconfig.json` flag-presence guard test, mirroring `tests/typecheck-config.test.ts`'s TS6-02 pattern) |
| FCT-02 | `isolatedDeclarations` enabled, `.d.ts` emit succeeds per package | build-time gate (verified this session to fail loudly on error, Pitfall 4) | `make build` (each package's `onSuccess: tsc --emitDeclarationOnly`) | ✅ existing mechanism; ❌ optional `verify-outputs` extension (Open Question 1) |
| FCT-03 | `erasableSyntaxOnly` enabled, no non-erasable syntax | config-guard + existing suite | `make typecheck && make build` | ❌ Wave 0 (same guard test as FCT-01, one flag check) |
| FCT-04 | IIFE global-attach + CJS require() interop verified on real `dist/` | new smoke test | `make smoke` | ❌ Wave 0 — the entire deliverable of this phase |

### Sampling Rate

- **Per task commit:** `make typecheck` (flags 1–3 land here; fast, no build needed for 1&3, build
  needed only to observe FCT-02's onSuccess pass)
- **Per wave merge:** `make build && make smoke` (full artifact-level confirmation)
- **Phase gate:** `make smoke` green (FCT-04's explicit "required gate, not optional" per
  STATE.md Blockers/Concerns) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tsconfig.json` flag-presence guard test (new, mirrors `tests/typecheck-config.test.ts`'s
      TS6-02 pattern) — covers FCT-01/FCT-03 as a durable regression guard, not just a one-time
      build-green check
- [ ] `smoke/` directory + `vitest.smoke.config.ts` + the fixture file (`EXPECTED_EXPORTS` shape
      above) — covers FCT-04 entirely; this is the phase's core new test infrastructure
- [ ] `biome.json` `files.includes` extended to cover the new `smoke/` directory (Pitfall 3) — not a
      test file itself, but required for the new test files to actually be linted
- [ ] `Makefile` `smoke` target + `.PHONY` update + CI wiring (`.github/workflows/ci.yml`, after
      `verify-outputs` per Open Question 2)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase touches build tooling and compiler config only; no auth surface changes |
| V3 Session Management | No | Same — no session-related code touched |
| V4 Access Control | No | Same |
| V5 Input Validation | No (narrowly) | The smoke test reads only trusted, locally-built `dist/` files via `readFileSync`/`vm.runInContext` — not external/user input. No validation logic is being added. |
| V6 Cryptography | No | Not touched by this phase |

This phase is compiler-flag and build-artifact-testing work with no network-facing or user-input
surface. The one notable "trust boundary" consideration is intrinsic to the tool, not introduced by
this phase: **`vm.runInContext` executes arbitrary JavaScript in a shared V8 context** — this is
explicitly safe *here* because the executed code is always this repo's own freshly-built `dist/`
output (never third-party or user-supplied content), matching the same trust level as running the
project's own compiled code via any other test. happy-dom's own security notice for
`enableJavaScriptEvaluation` is not directly applicable to the `vm.runInContext` approach recommended
here (that setting only gates happy-dom's own `<script>`-element path, which this research
recommends bypassing entirely) — but the same underlying caution (never point this mechanism at
untrusted/external script content) applies equally to the recommended `vm.runInContext` path and
should be a one-line comment in the smoke test itself.

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Smoke test accidentally pointed at a stale or attacker-influenced `dist/` path | Tampering | Always resolve `dist/` paths relative to the test file / repo root (not an env var or CLI arg), and always run `make smoke`'s `build` prerequisite immediately before the vitest pass so the artifact under test is always freshly built, never stale |

## Sources

### Primary (HIGH confidence — verified this session)
- Local `tsc` compilation (TypeScript 6.0.3) against core + all 4 plugins + `tests/`, with all three
  flags simultaneously enabled, both `noEmit` typecheck and real `--emitDeclarationOnly` emission —
  zero errors in every configuration tested.
- Local `tsup@8.5.1` build (`make build`) producing real `dist/index.js` / `dist/index.cjs` /
  `dist/index.global.js` for all 5 packages, inspected via `node -e "require(...)"` and `tail`/`head`.
- Local `happy-dom@20.10.6` + `node:vm` scripted tests (this session) proving: (a) the
  `<script>`-element path silently fails to attach `var`-based globals, (b) `vm.runInContext`
  correctly attaches them, individually and in a shared multi-global window.
- Local `tsup@8.5.1` `onSuccess` exit-code-propagation test (scratch package, this session) — confirms
  build failures from the declaration-emit pass are not silent.
- Reading `node_modules/happy-dom/lib/nodes/html-script-element/HTMLScriptElement.js` and
  `node_modules/happy-dom/lib/javascript/JavaScriptCompiler.js` source directly to confirm the root
  cause of Pitfall 1 (not just its symptom).

### Secondary (MEDIUM confidence)
- [TypeScript: TSConfig Option: verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html) `[CITED]`
- [TypeScript: TSConfig Option: isolatedDeclarations](https://www.typescriptlang.org/tsconfig/isolatedDeclarations.html) `[CITED]`
- [TypeScript: TSConfig Option: erasableSyntaxOnly](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html) `[CITED]`
- [TypeScript 5.5 Release Notes — Isolated Declarations](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html#isolated-declarations) `[CITED]`

### Tertiary (LOW confidence)
- None used — every claim in this document is either independently verified this session or cited
  from official TypeScript documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all versions read directly from installed `node_modules`/`package.json`
- Architecture (FCT-01/02/03): HIGH — empirically verified zero-error compile against the real codebase with all three flags simultaneously enabled, across core + all 4 plugins + tests
- Architecture (FCT-04): HIGH — empirically verified working `vm.runInContext` pattern and empirically verified *broken* `<script>`-element pattern, against the real built `dist/` artifacts
- Pitfalls: HIGH — all 4 pitfalls were reproduced and root-caused via direct source inspection and scripted tests this session, not inferred

**Research date:** 2026-07-17
**Valid until:** 30 days (stable toolchain; re-verify if `typescript`, `tsup`, or `happy-dom` are bumped before this phase executes)

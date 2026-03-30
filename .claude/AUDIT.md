# AUDIT.md — DxKit Self-Review Audit Instructions

## Purpose

This document provides repeatable instructions for performing a software and security self-review of the DxKit codebase. The audit is performed by the project developers with assistance from an AI model. The output is an honest self-review — not a substitute for an independent third-party audit.

## Disclosure

Every audit produced under these instructions MUST include the following disclosure in the report header:

> **This is a self-review** performed by the project developers with assistance from `<model_name>` on `<date>`. It is not an independent third-party security audit. Findings reflect the best effort of the authors reviewing their own work. Users should evaluate the code independently before trusting it in production.

Replace `<model_name>` with the full model identifier (e.g., "Claude Opus 4.6 (1M context)") and `<date>` with the audit date in `YYYY.MM.DD` format.

## Scope

### In Scope

- All TypeScript source files: `src/**/*.ts`
- All plugin source files: `plugins/*/src/**/*.ts`
- All test files: `tests/**/*.test.ts`, `plugins/*/tests/**/*.test.ts`
- All type definitions: `src/types/**/*.ts`
- Build configuration: `tsup.config.ts`, `plugins/*/tsup.config.ts`
- Package manifests: `package.json`, `plugins/*/package.json`
- Project documentation: `docs/**/*.md`
- Project configuration: `tsconfig.json`, `biome.json`, `vitest.config.ts`, `Makefile`

### Out of Scope

- External package source code (node_modules)
- Development tooling internals (vitest, tsup, biome)
- CI/CD pipeline configuration (unless it affects build output)
- Example/demo code in `examples/` (unless it ships as part of the package)

### Dependency Audit

External dependencies are audited for **production installs only** (not devDependencies). Run:

```bash
pnpm audit --prod
```

If the project has zero production dependencies, note this explicitly as a positive finding.

## Methodology

### Phase 1: Discovery

1. **Enumerate source files.** Glob all files matching the in-scope patterns above. Record the file inventory in the appendix.
2. **Read all source files.** Every `.ts` file in `src/` and `plugins/*/src/` must be read in full. Do not skip files or skim.
3. **Read all test files.** Every `.test.ts` file must be read to assess coverage.
4. **Read all documentation.** Every `.md` file in `docs/` must be read to check for accuracy against the implementation.

### Phase 2: Automated Scans

Run the following and capture output for the appendix:

```bash
# Dependency vulnerability scan (production only)
pnpm audit --prod

# Linter status
npx biome check .

# Full test suite
npx vitest run
```

If `semgrep` and `gitleaks` are available (see Makefile `audit` target), also run:

```bash
# Static analysis (TypeScript rules)
semgrep --config p/typescript src/ plugins/

# Secret detection
gitleaks detect --source . --no-git
```

### Phase 3: Manual Review

Review each source file against the following checklists.

#### Security Review Checklist

For every source file, check for:

- [ ] **Injection vectors**: eval(), Function(), innerHTML, outerHTML, document.write(), insertAdjacentHTML()
- [ ] **Dynamic code execution**: new Function(), import() with user-controlled paths, script injection
- [ ] **Prototype pollution**: Object merging without `__proto__`/`constructor`/`prototype` key guards
- [ ] **XSS surface**: User-controlled values flowing into DOM attributes, event handlers, or script sources
- [ ] **Unsafe type assertions**: `as any` casts that bypass safety-critical type checks
- [ ] **Storage security**: Plaintext secrets in localStorage/sessionStorage, sensitive data persistence
- [ ] **Trust boundaries**: Where does the code trust external input (browser APIs, window globals, fetch responses, localStorage data)?
- [ ] **Error handling gaps**: Uncaught exceptions that could crash initialization or leave state inconsistent
- [ ] **Resource cleanup**: Event listeners, intervals, timeouts, and subscriptions properly cleaned up on destroy
- [ ] **Race conditions**: Async operations that could interleave unsafely (concurrent mounts, rapid navigations)

#### Code Quality Checklist

For every source file, check for:

- [ ] **Type safety**: Appropriate use of generics, avoidance of unnecessary `any` casts
- [ ] **State immutability**: Return values are copies, not mutable references to internal state
- [ ] **Memory management**: Handler sets, maps, and listeners cleaned up on destroy
- [ ] **Error messages**: Descriptive, actionable error messages for developer-facing errors
- [ ] **API consistency**: Factory functions follow consistent patterns across the codebase
- [ ] **Input validation**: Appropriate validation at trust boundaries (config, external data)

#### Test Coverage Checklist

For the test suite as a whole, assess:

- [ ] **Happy path coverage**: Are the primary use cases for each module tested?
- [ ] **Error path coverage**: Are failure modes tested (invalid input, missing dependencies, network errors)?
- [ ] **Edge cases**: Empty inputs, null/undefined, boundary values, rapid sequential operations
- [ ] **Security cases**: Prototype pollution attempts, namespace hijacking, malformed input
- [ ] **Integration coverage**: Do tests cover cross-module interactions (plugin + shell, settings + theme)?
- [ ] **Cleanup coverage**: Do tests verify that destroy() properly cleans up resources?

#### Documentation Review Checklist

For each documentation file, check:

- [ ] **Accuracy**: Does the documentation match the current implementation?
- [ ] **Completeness**: Are all public APIs documented?
- [ ] **Security guidance**: Are trust assumptions and security boundaries clearly communicated?
- [ ] **Examples**: Do code examples work with the current API?

### Phase 4: Architecture Review

Assess the overall system design:

- **Trust model**: Who is trusted? What are the boundaries? Is this documented?
- **Attack surface**: What is exposed to potentially untrusted code?
- **Defense in depth**: Are there multiple layers of protection, or single points of failure?
- **Failure modes**: What happens when each subsystem fails? Is the failure contained?

## Report Structure

The audit report MUST follow this structure. Every section is required.

### 1. Header

```markdown
# DxKit Security & Software Audit

| Field | Value |
|:---|:---|
| Project | DxKit |
| Version | <version from package.json or release tag> |
| Date | <YYYY.MM.DD> |
| Auditor | Self-review by project developers |
| AI Model | <full model identifier> |
| Scope | Core framework + all bundled plugins |
```

### 2. Disclosure

The full disclosure text from the Disclosure section above.

### 3. Executive Summary

2-4 paragraphs summarizing:
- What was reviewed
- Overall assessment (architecture quality, security posture, test coverage)
- Critical findings count by severity
- Key recommendations

### 4. Dependency Audit

- Output of `pnpm audit --prod`
- Count of production dependencies per package
- Assessment of supply chain risk

### 5. Static Analysis

- Linter results summary
- SAST results (if semgrep available)
- Secret scan results (if gitleaks available)

### 6. Architecture & Trust Model

- Description of the trust model
- Diagram of trust boundaries
- Assessment of the global context bridge
- Plugin isolation (or lack thereof)

### 7. Security Findings

Each finding uses this format:

```markdown
#### [ID] Finding Title

| Field | Value |
|:---|:---|
| Severity | CRITICAL / HIGH / MEDIUM / LOW / INFO |
| Category | <e.g., Input Validation, Trust Model, Data Storage> |
| Location | <file_path:line_number> |
| Status | Open / Accepted Risk / Mitigated |

**Description**: What the issue is.

**Impact**: What could go wrong.

**Recommendation**: How to fix or mitigate.
```

#### Severity Definitions

| Severity | Definition |
|:---|:---|
| CRITICAL | Exploitable vulnerability that could compromise user funds, credentials, or data with no user interaction beyond normal use |
| HIGH | Vulnerability that requires specific conditions but could lead to significant impact (data loss, unauthorized actions) |
| MEDIUM | Design weakness that increases risk or reduces defense-in-depth, but requires chaining with other issues to exploit |
| LOW | Minor issue that deviates from best practices but has limited practical impact |
| INFO | Observation, suggestion, or documentation gap with no direct security impact |

### 8. Code Quality Findings

Same format as security findings, but focused on correctness, maintainability, and robustness.

### 9. Test Coverage Assessment

- Total test count and pass rate
- Coverage by module (qualitative — which areas are well-tested vs. undertested)
- Identified coverage gaps
- Recommendations for additional tests

### 10. Documentation Review

- Accuracy assessment
- Completeness assessment
- Identified inconsistencies or gaps

### 11. Recommendations

Prioritized list of recommended actions, grouped by:
1. **Immediate** (should fix before production use)
2. **Short-term** (should fix in next release cycle)
3. **Long-term** (improve over time)

### 12. Appendix

- File inventory (all files reviewed)
- Tool output (pnpm audit, lint, test results)
- Test statistics

## Output Location

Save the completed audit report to:

```
audit/self/dxkit-<version>.md
```

Where `<version>` matches the version string used in the report header (e.g., `2026.03.29.000001`).

## Running an Audit

To perform an audit using these instructions:

1. Read this file (`.claude/AUDIT.md`) for methodology and structure
2. Read `README.md` for project context
3. **Review the most recent prior audit** in `audit/self/`. For every finding not marked as `Mitigated`, verify whether it has since been addressed in the current codebase. Carry forward any findings that remain open — do not lose track of unresolved issues between audits.
4. Glob and read all in-scope source files (`src/**/*.ts`, `plugins/*/src/**/*.ts`)
5. Glob and read all test files (`tests/**/*.test.ts`, `plugins/*/tests/**/*.test.ts`)
6. Glob and read all documentation (`docs/**/*.md`)
7. Run automated scans (Phase 2)
8. Perform manual review (Phase 3) against each checklist
9. Assess architecture (Phase 4)
10. Write the report following the Report Structure above — include carried-forward findings with their original IDs and updated status
11. Save to `audit/self/dxkit-<version>.md`

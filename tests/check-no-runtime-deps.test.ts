import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// scripts/check-no-runtime-deps.cjs is loaded via createRequire rather than a static `import` so
// tsc never needs to resolve/type a .cjs module (mirrors smoke/dist-exports.smoke.test.ts's CJS
// interop pattern) — keeps the zero-@types/node, zero-new-devDependency posture (P4).
const require = createRequire(import.meta.url);
const { checkNoRuntimeDeps } = require('../scripts/check-no-runtime-deps.cjs');

describe('checkNoRuntimeDeps (GATE-02 core-only dep-check)', () => {
  it('passes with no runtime-dep fields present', () => {
    expect(checkNoRuntimeDeps({})).toEqual({ ok: true, violations: [] });
  });

  it('passes with an empty dependencies field', () => {
    expect(checkNoRuntimeDeps({ dependencies: {} })).toEqual({ ok: true, violations: [] });
  });

  it('fails when dependencies declares an external package', () => {
    const result = checkNoRuntimeDeps({ dependencies: { lodash: '^4.17.0' } });
    expect(result.ok).toBe(false);
    expect(result.violations).toContain('dependencies.lodash');
  });

  it('fails when peerDependencies declares an external package', () => {
    const result = checkNoRuntimeDeps({ peerDependencies: { react: '^18.0.0' } });
    expect(result.ok).toBe(false);
    expect(result.violations).toContain('peerDependencies.react');
  });

  it('fails when optionalDependencies declares an external package', () => {
    const result = checkNoRuntimeDeps({ optionalDependencies: { chalk: '^5.0.0' } });
    expect(result.ok).toBe(false);
    expect(result.violations).toContain('optionalDependencies.chalk');
  });

  it('passes on the actual root package.json (zero declared deps today)', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
    expect(checkNoRuntimeDeps(pkg)).toEqual({ ok: true, violations: [] });
  });
});

describe('GATE-02 wiring', () => {
  // Wiring guard, mirroring tests/typecheck-config.test.ts's "GATE-01 CI deprecation gate wiring" /
  // "Makefile plugin configuration" blocks — locks the Makefile target and CI step so neither can
  // silently drift back to looping PLUGIN_BUILD_ORDER (revised D-08 / P1) or lose its named CI step.
  const makefilePath = resolve(process.cwd(), 'Makefile');
  const makefileContent = readFileSync(makefilePath, 'utf-8');
  const ciWorkflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
  const ciWorkflowContent = readFileSync(ciWorkflowPath, 'utf-8');

  it('should define a verify-no-runtime-deps target in the Makefile', () => {
    expect(makefileContent, 'Makefile should define verify-no-runtime-deps:').toMatch(/^verify-no-runtime-deps:\s*$/m);
  });

  it('should have verify-no-runtime-deps in .PHONY', () => {
    const phonyMatch = makefileContent.match(/^\.PHONY:\s*(.+)$/m);
    expect(phonyMatch, '.PHONY line should exist in Makefile').toBeTruthy();

    const phonyTargets = phonyMatch![1].split(/\s+/).filter((t: string) => t.length > 0);
    expect(phonyTargets, '.PHONY should include verify-no-runtime-deps').toContain('verify-no-runtime-deps');
  });

  it('should scope the target body to the root package.json only, never PLUGIN_BUILD_ORDER (revised D-08 / P1)', () => {
    const targetMatch = makefileContent.match(/^verify-no-runtime-deps:\s*$([\s\S]*?)^[a-z]/m);
    expect(targetMatch, 'verify-no-runtime-deps target should exist in Makefile').toBeTruthy();

    const targetBody = targetMatch![1];
    expect(targetBody, 'target body should reference package.json').toMatch(/package\.json/);
    expect(
      targetBody,
      'target body should NOT loop PLUGIN_BUILD_ORDER — core-only gate (revised D-08 / P1)',
    ).not.toMatch(/PLUGIN_BUILD_ORDER/);
  });

  it('should be a prerequisite of release and publish (mirrors verify-outputs)', () => {
    const releaseMatch = makefileContent.match(/^release:\s*(.+)$/m);
    const publishMatch = makefileContent.match(/^publish:\s*(.+)$/m);
    expect(releaseMatch, 'release target should be defined in Makefile').toBeTruthy();
    expect(publishMatch, 'publish target should be defined in Makefile').toBeTruthy();

    expect(releaseMatch![1].split(/\s+/), 'release prerequisites should include verify-no-runtime-deps').toContain(
      'verify-no-runtime-deps',
    );
    expect(publishMatch![1].split(/\s+/), 'publish prerequisites should include verify-no-runtime-deps').toContain(
      'verify-no-runtime-deps',
    );
  });

  it('should have a named CI step running `make verify-no-runtime-deps` that references GATE-02', () => {
    const stepBlockMatch = ciWorkflowContent.match(/-\s*name:\s*(.+)\n\s*run:\s*make verify-no-runtime-deps/);
    expect(
      stepBlockMatch,
      'ci.yml should have a named step directly running `make verify-no-runtime-deps`',
    ).toBeTruthy();
    expect(stepBlockMatch![1], 'the named step should reference GATE-02').toMatch(/GATE-02/i);
  });
});

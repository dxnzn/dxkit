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

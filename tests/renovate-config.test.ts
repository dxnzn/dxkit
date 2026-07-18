import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Node built-ins used here are typed by tests/node-builtins.d.ts (see tests/typecheck-config.test.ts
// for the same convention) — no @types/node devDependency needed (zero-runtime-deps posture, P4).

const TOOLCHAIN_PACKAGES = ['tsup', 'vite', 'vitest', 'happy-dom', '@biomejs/biome', 'typescript'] as const;

function readRenovateConfig(): Record<string, unknown> {
  const fullPath = resolve(process.cwd(), 'renovate.json');
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as Record<string, unknown>;
}

function readRenovateConfigRaw(): string {
  const fullPath = resolve(process.cwd(), 'renovate.json');
  return readFileSync(fullPath, 'utf-8');
}

describe('renovate.json invariants (GATE-03 guard)', () => {
  it('should exist and parse as valid JSON', () => {
    const config = readRenovateConfig();
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('extends should include config:recommended (D-01)', () => {
    const config = readRenovateConfig();
    expect(config.extends).toContain('config:recommended');
  });

  it('minimumReleaseAge should be exactly "3 days" (D-03)', () => {
    const config = readRenovateConfig();
    expect(config.minimumReleaseAge).toBe('3 days');
  });

  it('lockFileMaintenance should be an object (not boolean) with enabled: true (D-04)', () => {
    const config = readRenovateConfig();
    expect(typeof config.lockFileMaintenance).toBe('object');
    expect(config.lockFileMaintenance).not.toBeNull();
    const lfm = config.lockFileMaintenance as Record<string, unknown>;
    expect(lfm.enabled).toBe(true);
  });

  it('should not contain deprecated config:base or matchPackagePatterns tokens (P5)', () => {
    const raw = readRenovateConfigRaw();
    expect(raw).not.toMatch(/config:base/);
    expect(raw).not.toMatch(/matchPackagePatterns/);
  });

  it('should not encode lockFileMaintenance as a boolean literal (P5)', () => {
    const raw = readRenovateConfigRaw();
    expect(raw).not.toMatch(/"lockFileMaintenance"\s*:\s*(true|false)/);
  });

  describe('toolchain packageRules group (D-02: always-blocked majors)', () => {
    it('should have at least one packageRules entry naming all six toolchain packages with automerge: false', () => {
      const config = readRenovateConfig();
      const rules = config.packageRules as Array<Record<string, unknown>>;
      expect(Array.isArray(rules)).toBe(true);

      const toolchainRule = rules.find((rule) => {
        const names = rule.matchPackageNames as string[] | undefined;
        if (!Array.isArray(names)) return false;
        return TOOLCHAIN_PACKAGES.every((pkg) => names.includes(pkg));
      });

      expect(toolchainRule, 'a packageRules entry must list all six toolchain packages').toBeTruthy();
      expect(toolchainRule?.automerge).toBe(false);
    });

    it('should always block major toolchain bumps regardless of the general devDep major rule', () => {
      const config = readRenovateConfig();
      const rules = config.packageRules as Array<Record<string, unknown>>;

      // Every rule that matches any toolchain package name directly (not merely by devDep type)
      // must set automerge: false — this is the D-02 "always blocked" invariant.
      const toolchainNamedRules = rules.filter((rule) => {
        const names = rule.matchPackageNames as string[] | undefined;
        if (!Array.isArray(names)) return false;
        return names.some((name) => (TOOLCHAIN_PACKAGES as readonly string[]).includes(name));
      });

      expect(toolchainNamedRules.length).toBeGreaterThan(0);
      for (const rule of toolchainNamedRules) {
        expect(rule.automerge, `rule ${JSON.stringify(rule.matchPackageNames)} must set automerge: false`).toBe(false);
      }
    });

    it('should not drop any toolchain package from the always-blocked group', () => {
      const config = readRenovateConfig();
      const rules = config.packageRules as Array<Record<string, unknown>>;

      const toolchainRule = rules.find((rule) => {
        const names = rule.matchPackageNames as string[] | undefined;
        return Array.isArray(names) && names.length >= TOOLCHAIN_PACKAGES.length;
      });

      expect(toolchainRule).toBeTruthy();
      const names = toolchainRule?.matchPackageNames as string[];
      for (const pkg of TOOLCHAIN_PACKAGES) {
        expect(names, `toolchain group must include ${pkg}`).toContain(pkg);
      }
    });
  });

  it('non-major devDependency patch/minor bumps should automerge, excluding toolchain packages', () => {
    const config = readRenovateConfig();
    const rules = config.packageRules as Array<Record<string, unknown>>;

    const nonMajorRule = rules.find((rule) => {
      const updateTypes = rule.matchUpdateTypes as string[] | undefined;
      return (
        Array.isArray(updateTypes) &&
        updateTypes.includes('patch') &&
        updateTypes.includes('minor') &&
        rule.automerge === true
      );
    });

    expect(nonMajorRule, 'a packageRules entry must automerge non-major devDep bumps').toBeTruthy();
    const excluded = nonMajorRule?.excludePackageNames as string[] | undefined;
    expect(Array.isArray(excluded)).toBe(true);
    for (const pkg of TOOLCHAIN_PACKAGES) {
      expect(excluded, `non-major automerge rule must exclude toolchain package ${pkg}`).toContain(pkg);
    }
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Node built-ins used here are typed by tests/node-builtins.d.ts (a fresh ambient declaration),
// so this test needs no @types/node — a devDependency Phase 7 deliberately avoids (07-02 rewrote
// Buffer→TextEncoder for the same reason).

/**
 * Parse a JSON file, stripping JSONC comments (single-line and multi-line),
 * ensuring JSONC files with comments can be safely parsed. For plain JSON, this is a no-op.
 *
 * Limitation: the comment-stripping is naive regex, not a real JSONC tokenizer — a `//` or `/*`
 * sequence *inside a string value* (e.g. a URL) would be wrongly stripped. Safe for the tsconfig
 * files this guard reads today (none carry such values); revisit with a real JSONC parser if that
 * ever changes.
 */
function parseJsonWithComments(content: string): unknown {
  // Strip single-line comments
  let stripped = content.replace(/\/\/.*$/gm, '');
  // Strip multi-line comments
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(stripped);
}

/**
 * Read and parse a JSON/JSONC file from the repo root.
 */
function readConfigFile(relativePath: string): unknown {
  const fullPath = resolve(process.cwd(), relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return parseJsonWithComments(content);
}

describe('TypeScript 6 Config Invariants (TS6-02 Guard)', () => {
  const tsconfigFilePaths = [
    'tsconfig.json',
    'tsconfig.typecheck.json',
    'plugins/auth/tsconfig.json',
    'plugins/auth/tsconfig.typecheck.json',
    'plugins/wallet/tsconfig.json',
    'plugins/wallet/tsconfig.typecheck.json',
    'plugins/theme/tsconfig.json',
    'plugins/theme/tsconfig.typecheck.json',
    'plugins/settings/tsconfig.json',
    'plugins/settings/tsconfig.typecheck.json',
  ];

  it('should have no ignoreDeprecations in any tsconfig file (TS6-02)', () => {
    for (const filePath of tsconfigFilePaths) {
      const config = readConfigFile(filePath) as Record<string, unknown>;
      expect(config, `${filePath} should not contain ignoreDeprecations key (TS6-02 prohibition)`).not.toHaveProperty(
        'ignoreDeprecations',
      );

      if (config.compilerOptions && typeof config.compilerOptions === 'object') {
        const compilerOpts = config.compilerOptions as Record<string, unknown>;
        expect(
          compilerOpts,
          `${filePath} compilerOptions should not contain ignoreDeprecations (TS6-02)`,
        ).not.toHaveProperty('ignoreDeprecations');
      }
    }
  });

  describe('Root typecheck config (tsconfig.typecheck.json)', () => {
    it('should exist and be readable', () => {
      const config = readConfigFile('tsconfig.typecheck.json');
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should have noEmit: true', () => {
      const config = readConfigFile('tsconfig.typecheck.json') as Record<string, unknown>;
      const compilerOpts = config.compilerOptions as Record<string, unknown>;
      expect(compilerOpts.noEmit).toBe(true);
    });

    it('should NOT have baseUrl (prevents TS5101 deprecation under TS6)', () => {
      const config = readConfigFile('tsconfig.typecheck.json') as Record<string, unknown>;
      const compilerOpts = config.compilerOptions as Record<string, unknown>;
      expect(compilerOpts).not.toHaveProperty('baseUrl');
    });

    it('should include both src and tests', () => {
      const config = readConfigFile('tsconfig.typecheck.json') as Record<string, unknown>;
      expect(config.include).toEqual(['src', 'tests']);
    });

    it('should have 5-key paths block (core + 4 plugins)', () => {
      const config = readConfigFile('tsconfig.typecheck.json') as Record<string, unknown>;
      const compilerOpts = config.compilerOptions as Record<string, unknown>;
      const paths = compilerOpts.paths as Record<string, unknown[]>;
      const pathKeys = Object.keys(paths);
      expect(pathKeys).toHaveLength(5);
      expect(pathKeys).toContain('@dnzn/dxkit');
      expect(pathKeys).toContain('@dnzn/dxkit-wallet');
      expect(pathKeys).toContain('@dnzn/dxkit-auth');
      expect(pathKeys).toContain('@dnzn/dxkit-theme');
      expect(pathKeys).toContain('@dnzn/dxkit-settings');
    });
  });

  describe('Plugin typecheck configs', () => {
    const pluginNames = ['auth', 'wallet', 'theme', 'settings'];

    for (const pluginName of pluginNames) {
      describe(`plugins/${pluginName}/tsconfig.typecheck.json`, () => {
        const configPath = `plugins/${pluginName}/tsconfig.typecheck.json`;

        it('should exist and be readable', () => {
          const config = readConfigFile(configPath);
          expect(config).toBeDefined();
          expect(typeof config).toBe('object');
        });

        it('should have noEmit: true', () => {
          const config = readConfigFile(configPath) as Record<string, unknown>;
          const compilerOpts = config.compilerOptions as Record<string, unknown>;
          expect(compilerOpts.noEmit).toBe(true);
        });

        it('should have rootDir set to ../.. (monorepo root)', () => {
          const config = readConfigFile(configPath) as Record<string, unknown>;
          const compilerOpts = config.compilerOptions as Record<string, unknown>;
          expect(compilerOpts.rootDir).toBe('../..');
        });

        it('should NOT have baseUrl (prevents TS5101 deprecation under TS6)', () => {
          const config = readConfigFile(configPath) as Record<string, unknown>;
          const compilerOpts = config.compilerOptions as Record<string, unknown>;
          expect(compilerOpts).not.toHaveProperty('baseUrl');
        });

        it('should include both src and tests', () => {
          const config = readConfigFile(configPath) as Record<string, unknown>;
          expect(config.include).toEqual(['src', 'tests']);
        });

        it('should have 5-key paths block (core + 4 plugins)', () => {
          const config = readConfigFile(configPath) as Record<string, unknown>;
          const compilerOpts = config.compilerOptions as Record<string, unknown>;
          const paths = compilerOpts.paths as Record<string, unknown[]>;
          const pathKeys = Object.keys(paths);
          expect(pathKeys).toHaveLength(5);
          expect(pathKeys).toContain('@dnzn/dxkit');
          expect(pathKeys).toContain('@dnzn/dxkit-wallet');
          expect(pathKeys).toContain('@dnzn/dxkit-auth');
          expect(pathKeys).toContain('@dnzn/dxkit-theme');
          expect(pathKeys).toContain('@dnzn/dxkit-settings');
        });
      });
    }
  });

  describe('Makefile plugin configuration (TS6-01: plugin lockstep)', () => {
    it('should list all 4 plugins in PLUGIN_BUILD_ORDER', () => {
      const makefilePath = resolve(process.cwd(), 'Makefile');
      const makefileContent = readFileSync(makefilePath, 'utf-8');

      // Extract the PLUGIN_BUILD_ORDER line
      const match = makefileContent.match(/^PLUGIN_BUILD_ORDER\s*:=\s*(.+)$/m);
      expect(match, 'PLUGIN_BUILD_ORDER should be defined in Makefile').toBeTruthy();

      const orderLine = match![1];
      const pluginPaths = orderLine.split(/\s+/).filter((p: string) => p.length > 0);

      // Verify all 4 plugins are present
      expect(pluginPaths).toContain('plugins/settings/');
      expect(pluginPaths).toContain('plugins/wallet/');
      expect(pluginPaths).toContain('plugins/auth/');
      expect(pluginPaths).toContain('plugins/theme/');

      // Verify exactly 4 plugins (no extras)
      expect(pluginPaths).toHaveLength(4);
    });

    it('should reference PLUGIN_BUILD_ORDER in typecheck target', () => {
      const makefilePath = resolve(process.cwd(), 'Makefile');
      const makefileContent = readFileSync(makefilePath, 'utf-8');

      // Find the typecheck target block
      const typecheckMatch = makefileContent.match(/^typecheck:\s*$([\s\S]*?)^[a-z]/m);
      expect(typecheckMatch, 'typecheck target should exist in Makefile').toBeTruthy();

      const typecheckTarget = typecheckMatch![1];

      // Verify it uses PLUGIN_BUILD_ORDER (not a hardcoded second list)
      expect(typecheckTarget, 'typecheck target should reference $(PLUGIN_BUILD_ORDER)').toMatch(
        /\$\(PLUGIN_BUILD_ORDER\)/,
      );

      // Verify it runs tsc for root first
      expect(typecheckTarget, 'typecheck target should run tsc for root').toMatch(
        /tsc.*--noEmit.*-p\s+tsconfig\.typecheck\.json/,
      );
    });

    it('should have typecheck in .PHONY', () => {
      const makefilePath = resolve(process.cwd(), 'Makefile');
      const makefileContent = readFileSync(makefilePath, 'utf-8');

      // Find the .PHONY line
      const phonyMatch = makefileContent.match(/^\.PHONY:\s*(.+)$/m);
      expect(phonyMatch, '.PHONY line should exist in Makefile').toBeTruthy();

      const phonyTargets = phonyMatch![1].split(/\s+/).filter((t: string) => t.length > 0);

      // Verify typecheck is listed
      expect(phonyTargets, '.PHONY should include typecheck').toContain('typecheck');
    });

    it('should wire typecheck as prerequisite to test target', () => {
      const makefilePath = resolve(process.cwd(), 'Makefile');
      const makefileContent = readFileSync(makefilePath, 'utf-8');

      // Find the test target line
      const testMatch = makefileContent.match(/^test:\s*(.+)$/m);
      expect(testMatch, 'test target should be defined in Makefile').toBeTruthy();

      const testPrereqs = testMatch![1].split(/\s+/).filter((p: string) => p.length > 0);

      // Verify typecheck is a prerequisite
      expect(testPrereqs, 'test target should have typecheck as prerequisite').toContain('typecheck');
    });
  });

  describe('Forward-compat flag presence (FCT-01/FCT-02/FCT-03 guard)', () => {
    // Durable regression guard: a silent removal (or reversion to false) of any of the three
    // forward-compat flags in the root tsconfig.json must fail make test, not just a one-time
    // green build. Plugins inherit these via extends '../../tsconfig.json' (D-01 single source
    // of truth), so asserting on the root config alone is sufficient.
    it('should have verbatimModuleSyntax: true (FCT-01)', () => {
      const config = readConfigFile('tsconfig.json') as Record<string, unknown>;
      const compilerOpts = config.compilerOptions as Record<string, unknown>;
      expect(compilerOpts.verbatimModuleSyntax).toBe(true);
    });

    it('should have isolatedDeclarations: true (FCT-02)', () => {
      const config = readConfigFile('tsconfig.json') as Record<string, unknown>;
      const compilerOpts = config.compilerOptions as Record<string, unknown>;
      expect(compilerOpts.isolatedDeclarations).toBe(true);
    });

    it('should have erasableSyntaxOnly: true (FCT-03)', () => {
      const config = readConfigFile('tsconfig.json') as Record<string, unknown>;
      const compilerOpts = config.compilerOptions as Record<string, unknown>;
      expect(compilerOpts.erasableSyntaxOnly).toBe(true);
    });
  });

  describe('tsup declaration emit (TS6-02: no reintroduced baseUrl via tsup dts)', () => {
    // tsup 8.5's bundled `dts: true` injects a `baseUrl` that TS6 deprecates (TS5101). Declarations
    // are emitted by a direct `tsc --emitDeclarationOnly` pass in `onSuccess` instead. Re-enabling
    // tsup's dts would silently reintroduce the shim-forcing baseUrl without failing typecheck —
    // so guard the tsup side of TS6-02 here, not just the tsconfig side.
    const tsupConfigPaths = [
      'tsup.config.ts',
      'plugins/auth/tsup.config.ts',
      'plugins/wallet/tsup.config.ts',
      'plugins/theme/tsup.config.ts',
      'plugins/settings/tsup.config.ts',
    ];

    for (const configPath of tsupConfigPaths) {
      describe(configPath, () => {
        it('should emit declarations via a tsc --emitDeclarationOnly onSuccess pass', () => {
          const fullPath = resolve(process.cwd(), configPath);
          const content = readFileSync(fullPath, 'utf-8');
          expect(content, `${configPath} should run tsc --emitDeclarationOnly`).toMatch(/--emitDeclarationOnly/);
        });

        it('should NOT enable tsup dts bundling (would reinject a TS6-deprecated baseUrl)', () => {
          const fullPath = resolve(process.cwd(), configPath);
          const content = readFileSync(fullPath, 'utf-8');
          // Strip comments so the explanatory `dts:true` mention in the config header doesn't match.
          const code = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
          expect(code, `${configPath} should not set dts: true`).not.toMatch(/\bdts\s*:\s*true\b/);
        });
      });
    }
  });
});

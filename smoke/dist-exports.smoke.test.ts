import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { EXPECTED_EXPORTS } from './fixtures/expected-exports.js';

// Node built-ins used here are typed by smoke/node-builtins.d.ts (a fresh ambient declaration),
// so this test needs no @types/node — the same zero-@types/node posture tests/typecheck-config.test.ts
// established (07-02 rewrote Buffer→TextEncoder for the same reason).

// dist/ paths are always resolved relative to the repo root (process.cwd()), never from an env
// var or CLI argument (Tampering mitigation, T-08-02) — and `make smoke`'s `build` prerequisite
// guarantees the artifact under test is always freshly built, never stale.
const require = createRequire(import.meta.url);

interface PackageSpec {
  name: keyof typeof EXPECTED_EXPORTS;
  globalName: string;
  cjsPath: string;
  iifePath: string;
}

// Dependency order matters for the shared-window IIFE assertion below: core must attach before
// any plugin global is loaded, mirroring the real multi-<script>-tag deployment shape.
const PACKAGES: PackageSpec[] = [
  { name: 'core', globalName: 'DxKit', cjsPath: 'dist/index.cjs', iifePath: 'dist/index.global.js' },
  {
    name: 'settings',
    globalName: 'DxSettings',
    cjsPath: 'plugins/settings/dist/index.cjs',
    iifePath: 'plugins/settings/dist/index.global.js',
  },
  {
    name: 'wallet',
    globalName: 'DxWallet',
    cjsPath: 'plugins/wallet/dist/index.cjs',
    iifePath: 'plugins/wallet/dist/index.global.js',
  },
  {
    name: 'auth',
    globalName: 'DxAuth',
    cjsPath: 'plugins/auth/dist/index.cjs',
    iifePath: 'plugins/auth/dist/index.global.js',
  },
  {
    name: 'theme',
    globalName: 'DxTheme',
    cjsPath: 'plugins/theme/dist/index.cjs',
    iifePath: 'plugins/theme/dist/index.global.js',
  },
];

describe('Build-artifact smoke test (FCT-04)', () => {
  describe('CJS require() interop', () => {
    for (const pkg of PACKAGES) {
      it(`${pkg.name}: dist/index.cjs exports exactly the expected key set`, () => {
        const fullPath = resolve(process.cwd(), pkg.cjsPath);
        const mod = require(fullPath);
        const actualKeys = Object.keys(mod).sort();
        const expectedKeys = [...EXPECTED_EXPORTS[pkg.name]].sort();
        expect(actualKeys, `${pkg.cjsPath} export keys`).toEqual(expectedKeys);
      });
    }
  });

  describe("IIFE global-attach (vm.runInContext, never happy-dom's <script>-element path — Pitfall 1)", () => {
    for (const pkg of PACKAGES) {
      it(`${pkg.name}: dist/index.global.js attaches window.${pkg.globalName} with exactly the expected key set`, () => {
        const window = new Window();
        const fullPath = resolve(process.cwd(), pkg.iifePath);
        const code = readFileSync(fullPath, 'utf-8');
        // vm.runInContext executes this repo's own freshly-built dist/ output only — never point
        // this mechanism at external/untrusted script content (T-08-03 mitigation).
        vm.runInContext(code, window, { filename: pkg.iifePath });

        const global = (window as unknown as Record<string, unknown>)[pkg.globalName];
        expect(global, `window.${pkg.globalName} should be defined after loading ${pkg.iifePath}`).toBeDefined();

        const actualKeys = Object.keys(global as object).sort();
        const expectedKeys = [...EXPECTED_EXPORTS[pkg.name]].sort();
        expect(actualKeys, `window.${pkg.globalName} export keys`).toEqual(expectedKeys);
      });
    }

    it('all 5 IIFE globals coexist in one shared window with no collisions (real multi-<script>-tag shape)', () => {
      const window = new Window();

      for (const pkg of PACKAGES) {
        const fullPath = resolve(process.cwd(), pkg.iifePath);
        const code = readFileSync(fullPath, 'utf-8');
        vm.runInContext(code, window, { filename: pkg.iifePath });
      }

      for (const pkg of PACKAGES) {
        const global = (window as unknown as Record<string, unknown>)[pkg.globalName];
        expect(global, `window.${pkg.globalName} should be defined in the shared window`).toBeDefined();
        const actualKeys = Object.keys(global as object).sort();
        const expectedKeys = [...EXPECTED_EXPORTS[pkg.name]].sort();
        expect(actualKeys, `window.${pkg.globalName} export keys (shared window)`).toEqual(expectedKeys);
      }
    });
  });
});

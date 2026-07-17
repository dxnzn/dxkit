import { defineConfig } from 'tsup';

export default defineConfig([
  // Node / bundler builds (ESM + CJS)
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    // Declarations are emitted by a direct `tsc` pass (onSuccess), not tsup's `dts:true`.
    // tsup 8.5.1's dts bundler (rollup-plugin-dts) unconditionally injects a `baseUrl`
    // compiler option, which TS6 deprecates (TS5101) regardless of this repo's own
    // tsconfig (which never sets baseUrl) — see 07-04-SUMMARY.md for the full trace.
    clean: true,
    sourcemap: true,
    onSuccess: 'npx tsc -p tsconfig.json --emitDeclarationOnly',
  },
  // Browser build — single self-contained file
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'DxKit',
    outDir: 'dist',
    outExtension: () => ({ js: '.global.js' }),
    sourcemap: true,
    platform: 'browser',
  },
]);

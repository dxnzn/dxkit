import { defineConfig } from 'tsup';

export default defineConfig([
  // Node / bundler builds (ESM + CJS)
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
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

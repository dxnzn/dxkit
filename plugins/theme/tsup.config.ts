import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['@dnzn/dxkit'],
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'DxTheme',
    outDir: 'dist',
    outExtension: () => ({ js: '.global.js' }),
    sourcemap: true,
    noExternal: ['@dnzn/dxkit'],
    platform: 'browser',
  },
]);

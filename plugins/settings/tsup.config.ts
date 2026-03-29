import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['dxkit'],
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'DxSettings',
    outDir: 'dist',
    outExtension: () => ({ js: '.global.js' }),
    sourcemap: true,
    noExternal: ['dxkit'],
    platform: 'browser',
  },
]);

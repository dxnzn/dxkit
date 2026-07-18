import { defineConfig } from 'vitest/config';

// Separate from vitest.config.ts on purpose: smoke tests assert against the real built dist/
// artifacts (never src/ via aliases), and must never join `make test`'s "never builds" glob
// (Phase 7 constraint) — see smoke/dist-exports.smoke.test.ts and the `make smoke` Makefile target.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['smoke/**/*.smoke.test.ts'],
  },
});

// Minimal ambient declarations for the Node built-ins used by tests/typecheck-config.test.ts.
// This lets the standalone typecheck config (which includes tests/) resolve `node:fs`/`node:path`
// and `process` without pulling in @types/node — a devDependency Phase 7 deliberately keeps out of
// the project (07-02 rewrote Buffer→TextEncoder rather than add it). This file has no imports/exports
// so `declare module` creates fresh ambient modules rather than augmenting existing ones.

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf-8'): string;
}

declare module 'node:path' {
  export function resolve(...segments: string[]): string;
}

declare var process: { cwd(): string };

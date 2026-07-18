// Minimal ambient declarations for the Node built-ins used by smoke/dist-exports.smoke.test.ts.
// This lets the smoke test's separate vitest config resolve `node:vm`/`node:module`/`node:fs`/
// `node:path` without pulling in @types/node — a devDependency Phase 7 deliberately keeps out of
// the project. Co-located with the smoke test (mirrors tests/node-builtins.d.ts's co-location)
// so smoke/ stays a self-contained directory outside the tests/ tree.

declare module 'node:vm' {
  interface Context {}
  function runInContext(code: string, contextifiedObject: Context, options?: { filename?: string }): unknown;
  function isContext(object: unknown): boolean;
  const _default: { runInContext: typeof runInContext; isContext: typeof isContext };
  export default _default;
  export { isContext, runInContext };
}

declare module 'node:module' {
  function createRequire(path: string): (id: string) => any;

  export { createRequire };
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf-8'): string;
}

declare module 'node:path' {
  export function resolve(...segments: string[]): string;
}

declare var process: { cwd(): string };

'use strict';

const fs = require('node:fs');

const RUNTIME_DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

// Core-only (revised D-08): any entry in these three fields is a violation — no workspace-carveout
// logic, because the root package.json never declares workspace:* links (those live in the plugins,
// which this gate deliberately does not check — see 09-CONTEXT.md).
function checkNoRuntimeDeps(pkg) {
  const violations = [];
  for (const field of RUNTIME_DEP_FIELDS) {
    const value = pkg && pkg[field];
    if (value && typeof value === 'object') {
      for (const name of Object.keys(value)) {
        violations.push(`${field}.${name}`);
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

module.exports = { checkNoRuntimeDeps };

if (require.main === module) {
  const pkgPath = process.argv[2];
  if (!pkgPath) {
    console.error('Usage: node scripts/check-no-runtime-deps.cjs <path-to-package.json>');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const { ok, violations } = checkNoRuntimeDeps(pkg);

  if (ok) {
    console.log(`OK: ${pkgPath} declares no external runtime-visible dependency.`);
    process.exit(0);
  }

  for (const violation of violations) {
    console.error(`FAIL: ${pkgPath} declares ${violation} — core package must stay zero-runtime-dep (GATE-02).`);
  }
  process.exit(1);
}

# Technology Stack

**Analysis Date:** 2026-07-11

## Languages

**Primary:**
- TypeScript 5.8.3 - Core framework and all plugins

**Secondary:**
- JavaScript (generated) - Build outputs and tests

## Runtime

**Environment:**
- Node.js 18+ (ES2022 target)

**Package Manager:**
- pnpm 10.32.1
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- @dnzn/dxkit 0.1.5 - Headless microframework for composable dapps
  - Provides: routing, lifecycle management, event bus, plugin registry
  - Zero DOM ownership, framework-agnostic

**Plugins (bundled):**
- @dnzn/dxkit-wallet 0.1.5 - Wallet provider coordination and EIP-1193 support
- @dnzn/dxkit-auth 0.1.5 - Passthrough authentication (wallet-based)
- @dnzn/dxkit-theme 0.1.5 - CSS theme management with light/dark/system modes
- @dnzn/dxkit-settings 0.1.5 - Per-dapp configuration and settings persistence

**Testing:**
- vitest 4.1.9 - Unit and integration test runner
- happy-dom 20.10.6 - Lightweight DOM implementation for test environment

**Build/Dev:**
- tsup 8.4.0 - Bundler for ES2022 → ESM/CJS/IIFE outputs
- vite 7.3.6 - Development server and module resolution
- @biomejs/biome 2.5.1 - Linter and formatter (replaces ESLint/Prettier)
- TypeScript 5.8.3 - Language compiler
- commit-and-tag-version 12.7.3 - Automated versioning and changelog
- commitizen 4.3.2 - Conventional commit interface
- cz-conventional-changelog 3.3.0 - Commit message template

## Key Dependencies

**Zero Runtime Dependencies**
- Framework exports only type definitions and factory functions
- All plugins are zero-dependency (internal workspace packages only)
- No external npm packages required at runtime

**Dev-Only (Production-Safe):**
- All dependencies listed above are devDependencies
- Safe to remove for production builds

## Configuration

**Environment:**
- No .env configuration required
- Framework is configured programmatically via factory options

**Build:**
- `tsup.config.ts` - Main package + IIFE build for browser (3 outputs per package)
- Plugin-specific `tsup.config.ts` files in each `plugins/*/tsup.config.ts`
- `vitest.config.ts` - Test environment configuration with path aliases
- `tsconfig.json` - TypeScript compilation target ES2022, strict mode, DOM lib included
- `biome.json` - Linting and formatting rules (2-space indent, 120-char line width, single quotes)

## Output Formats

**ESM** - `dist/index.js`
- Modern import/export syntax
- For bundlers, Node.js ES modules, `<script type="module">`

**CJS** - `dist/index.cjs`
- CommonJS require() syntax
- For legacy Node.js tooling

**IIFE** - `dist/index.global.js`
- Self-contained browser bundle
- Attaches to global: `DxKit`, `DxWallet`, `DxAuth`, `DxTheme`, `DxSettings`
- Primary deployment target for IPFS/static hosting

**Type Definitions** - `dist/index.d.ts`
- Generated TypeScript type files with source maps

## Platform Requirements

**Development:**
- Node.js 18+ (ES2022 support)
- pnpm 10.32.1
- Linux/macOS/Windows with bash/make

**Production:**
- Browser with ES2022 support (via IIFE or bundler)
- Optional: localStorage for persistence (theme, settings, wallet state)
- Optional: window.ethereum (EIP-1193 injected provider for wallet plugin)

---

*Stack analysis: 2026-07-11*

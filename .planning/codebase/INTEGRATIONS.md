# External Integrations

**Analysis Date:** 2026-07-11

## APIs & External Services

**Ethereum / Web3:**
- EIP-1193 Standard - Browser-injected wallet provider protocol
  - SDK/Client: `window.ethereum` (injected by MetaMask, Brave Wallet, Coinbase Wallet, etc.)
  - Auth: No API keys — provider injects its own authentication
  - Implementation: `plugins/wallet/src/index.ts` - `createEIP1193Provider()`
  - Methods: `eth_requestAccounts`, `eth_chainId`, `personal_sign`, `accountsChanged` event, `chainChanged` event, `wallet_revokePermissions`

## Data Storage

**Databases:**
- None — framework is stateless

**File Storage:**
- None — framework does not manage files
- Dapps can load assets via `fetch()` (manifest URLs, registry URLs)

**Caching:**
- Browser localStorage only (optional)
  - Key prefix: `dxkit:` (configurable per plugin)
  - Plugins storing to localStorage:
    - Wallet: `dxkit:wallet` - Persists active provider ID
    - Theme: `dxkit:theme` - Persists selected theme and mode
    - Settings: `dxkit:settings` - Persists per-dapp configuration values
  - Storage location: `src/` modules call `localStorage.getItem()` / `localStorage.setItem()` with try-catch fallbacks
  - No persistence failures affect functionality (graceful degradation)

## Authentication & Identity

**Auth Provider:**
- Custom (wallet-based passthrough)
  - Implementation: `plugins/auth/src/index.ts` - `createPassthroughAuth()`
  - Approach: Delegates to wallet plugin; no tokens, sessions, or external auth service
  - Integration: Wallet connection state = authenticated state
  - Events: `dx:plugin:auth:authenticated`, `dx:plugin:auth:deauthenticated`

**Wallet Providers:**
- EIP-1193 (MetaMask, Brave, Coinbase, etc.) - See "Ethereum / Web3" section
- Local dev provider - `createLocalWalletProvider()` for testing (deterministic, no external deps)

## Monitoring & Observability

**Error Tracking:**
- None — framework provides no error tracking integration

**Logs:**
- Console only — consumers implement logging as needed
- Framework emits structured events via event bus

## CI/CD & Deployment

**Hosting:**
- No built-in hosting integration
- Dapps deployed to: IPFS, static file servers, CDNs, file:// URLs
- IIFE builds are self-contained and CDN-safe

**CI Pipeline:**
- None configured in codebase
- Makefile provides manual audit targets:
  - `make audit` - pnpm audit, semgrep SAST, gitleaks secret detection
  - `make test` - vitest + biome lint
  - `make build` - tsup for all packages
  - `make lint-fix` - biome auto-fix

## Environment Configuration

**Required env vars:**
- None — all configuration is programmatic via factory options

**Optional env vars:**
- `DEBUG` - Can be set by consumers for verbose logging (not used by framework itself)

**Secrets location:**
- No secrets stored in codebase
- Wallet provider credentials injected by browser (window.ethereum)
- If secrets needed: consumers responsible for env var management

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None — all communication is pull-based (fetch manifests, registry)

## Network Requests

**Manifest Loading:**
- Default template loader: `src/lifecycle.ts`
  - `fetch(src)` - Fetches HTML template for dapp
  - URL sourced from dapp manifest
  - Blocking — dapp expects populated container before mount

**Registry Loading:**
- Shell config: `src/shell.ts`
  - `fetch(registryUrl)` - Optional registry.json for dapp discovery
  - Default URL: `/registry.json` (relative to dapp root)
  - Non-blocking — used only for dapp enumeration

**Wallet RPC:**
- EIP-1193 provider: `plugins/wallet/src/index.ts`
  - `provider.request({ method, params })` - JSON-RPC calls to wallet
  - Supported methods: `eth_requestAccounts`, `eth_chainId`, `personal_sign`, `wallet_revokePermissions`
  - Transport: Injected provider (IPC/WebSocket managed by wallet extension)

---

*Integration audit: 2026-07-11*

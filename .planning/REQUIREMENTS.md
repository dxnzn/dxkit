# Requirements: DxKit — v1.2 On-Chain Deployment (ERC-8244)

**Defined:** 2026-08-16
**Core Value:** DxKit stays trustworthy for real use — failures are visible (never silent), documented behavior matches actual behavior, and the alpha is stable enough to build on with confidence.

> Milestone framing: on-chain (ERC-8244 `html()`) becomes the **third co-equal first-class deployment
> target** alongside bundler/webserver and IIFE/static/IPFS. Nothing here privileges one target or
> regresses another. "User" is the DxKit consumer/dapp author (and, for tooling, the maintainer).
> Everything is developed and verified on a local Foundry/Anvil loop first; Sepolia and Ethereum mainnet
> deploys are the milestone's final two phases. Zero runtime dependencies stay machine-enforced for core
> and extend to the new resolver package; Foundry and any render/verify helpers are dev-only.

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### Foundry / Anvil Dev Loop

- [ ] **DEV-01**: A Foundry workspace lives in-monorepo (`contracts/`) with `foundry.toml`, forge-std, solady, and pinned Solidity/Foundry versions; `forge build` and `forge test` run via `make` targets and are isolated from Biome/tsup/vitest (no lint/format/typecheck of `contracts/` by JS tooling)
- [ ] **DEV-02**: Developer can start a local Anvil node and publish DxKit + a dapp to it with a single `make` target (build → gzip → chunk → deploy → addresses recorded per chain in a committed JSON), repeatable from a clean checkout
- [ ] **DEV-03**: Developer can preview an on-chain dapp from Anvil in a normal browser via a dependency-free local gateway (`make preview` → `http://localhost:<port>/?contract=0x…&chain=31337` or `/0xADDR:31337/`) that `eth_call`s `html()` and serves the result — a stand-in for `web3://` — in a **loose** mode (page uses the wallet's provider pointed at Anvil)
- [ ] **DEV-04**: The local gateway also offers a **strict** mode that injects a read-only EIP-1193 shim forwarding `eth_call`/`eth_chainId` to Anvil and wraps the page in a sandboxed `srcdoc` iframe with a default-deny CSP, approximating the ERC-8244 sandbox for wallet-less runs and automated checks
- [ ] **DEV-05**: CI installs Foundry (foundry-toolchain), runs `forge test`, and runs Anvil-backed integration tests that exercise the publish pipeline + resolver + gateway end-to-end (not only mocked providers)
- [ ] **DEV-06**: Secrets hygiene: deploy scripts read keys/RPC URLs from env only; `.env*` ignored; gitleaks/`make audit` scope covers `contracts/`; no plaintext key can be committed by the documented flow

### On-Chain Publish Tooling & Contracts

- [ ] **PUB-01**: Built IIFE bundles (core + plugins) are gzipped with pinned parameters (mtime=0, fixed OS byte, fixed level) so output bytes and keccak are byte-identical across machines/CI runs; a CI check asserts reproducibility
- [ ] **PUB-02**: Payloads are split into ≤24,000-byte chunks and stored as SSTORE2-style data contracts (runtime-bytecode storage); chunk order/reassembly is unit-tested and forge-tested with a synthetic >24 KB payload
- [ ] **PUB-03**: Each published package/version has an immutable, versioned facade contract exposing ERC-8244 `html()` (selector `0x33c34ac3`, self-contained `<script>`-wrapped document form), a raw `source()` (gzipped bytes as string/bytes), `version()`, and `keccak()` — no proxy, no upgrade path; new version = new contract
- [ ] **PUB-04**: Facade contracts advertise ERC-4804/ERC-6860 `resolveMode()` (and satisfy ERC-5219 `request()` where required) so deployed contracts are viewable through existing third-party `web3://` gateways (e.g. w3link / web3url-gateway) without DxKit running a gateway
- [ ] **PUB-05**: Deploys use CREATE2 via the canonical deterministic deployer so a given DxKit version has the same address on every chain; the script checks the deployer exists on the target chain and fails loudly if not
- [ ] **PUB-06**: Deploy scripts are chain-agnostic (Anvil → Sepolia → mainnet by config), record addresses + keccak per chain in a committed JSON, and support Etherscan verification (`--verify`) for facade contracts on public networks
- [ ] **PUB-07**: The exact ERC-8244 draft text (PR + commit SHA) the contracts implement is pinned in-repo and re-checked at each phase boundary before immutable deploys, since ERC-8244 is still Draft

### `web3://` Resolver Package

- [ ] **RES-01**: A new zero-runtime-dependency package (`@dnzn/dxkit-web3`, built as ESM/CJS/IIFE like the others, IIFE global `DxWeb3`) parses ERC-6860-style `web3://<addr>[:chainId]/<method>[?returns=(string)]` URLs (also accepting a `web3://<addr>:<chainId>/` shorthand that implies `html()`)
- [ ] **RES-02**: The resolver fetches via `eth_call` through an injected EIP-1193 provider (`window.ethereum` or a caller-supplied provider), builds calldata from a hardcoded selector, and decodes the fixed-shape ABI `string`/`bytes` return without any ABI library
- [ ] **RES-03**: The resolver gunzips payloads via native `DecompressionStream('gzip')` with feature-detection and a `dx:error` (not a hang or silent empty) when unavailable
- [ ] **RES-04**: The resolver verifies a caller-supplied keccak-256 pin (hand-vendored keccak, no deps) **before** decompressing or handing bytes to any loader/executor — buffer → verify → gunzip → use; mismatch aborts the mount with `dx:error` naming the URL
- [ ] **RES-05**: The resolver refuses to call when the provider's `eth_chainId` differs from the URL's chainId, surfacing `dx:error` instead of calling the wrong chain
- [ ] **RES-06**: The resolver can be configured with a JSON-RPC URL fallback for non-ERC-8244 contexts (dev harness, CI, gateway previews); it is never the default on ERC-8244 pages and its use is visible in error sources
- [ ] **RES-07**: `createWeb3Loaders(options)` returns `templateLoader` / `scriptLoader` / `styleLoader` compatible with `ShellConfig.lifecycle`: scripts injected as text (`blob:` URL or `textContent`, never `<script src=http…>`), styles injected as `<style>` text, templates returned as HTML strings — non-`web3://` URLs pass through to the default loaders so mixed manifests work
- [ ] **RES-08**: The resolver's hand-rolled keccak and ABI decoder are cross-checked in tests against a reference implementation (test-only devDependency, never imported from `src/`) and covered by fixture + Anvil integration tests

### Core Sandbox Hardening (additive only)

- [ ] **CORE-01**: `DappManifest.entry` becomes optional; `isValidManifest()` fails closed requiring at least one of `entry` or `template`, and existing manifests/tests are unchanged (413-spec suite stays green with no spec modified)
- [ ] **CORE-02**: An opt-in `LifecycleManagerOptions.executeInlineScripts` (default `false`) re-executes `<script>` elements found in an injected template after `innerHTML` injection, so a full ERC-8244 `html()` document (or fragment) mounted into `#dx-mount` runs its inline scripts; off-by-default preserves 0.3.0 behavior byte-for-byte
- [ ] **CORE-03**: The template path can extract a usable fragment from a full HTML document (`<body>` + `<style>` + inline `<script>`) when the template is a complete `html()` page, without affecting fragment templates
- [ ] **CORE-04**: Wallet/theme/settings plugins tolerate opaque-origin sandboxes where `localStorage`/`sessionStorage` *property access itself throws* (not only `getItem`/`setItem`), degrading to in-memory state and surfacing `dx:error` per the v1.0 storage-error contract
- [ ] **CORE-05**: Documented guidance + a `dx:error` (or warning event) when history-mode routing is configured under a `srcdoc`/opaque-origin context where `pushState` is unusable; hash mode remains the recommended on-chain default
- [ ] **CORE-06**: Every core change is proven non-regressive for the other two targets: unchanged defaults, no new runtime dependency (GATE-02 still green), `make smoke` (IIFE/CJS artifacts) still green

### Bootstrap & Demo Dapp

- [ ] **DEMO-01**: A ~1 KB inline bootstrap snippet (dapp author pastes into their own `html()`) does: `eth_call` the DxKit facade → verify keccak → gunzip → inject → `DxKit.createShell({ mode: 'hash', manifests, lifecycle: DxWeb3.createWeb3Loaders(...) })`; provider-absent and pin-mismatch failures are visible on the page, never silent
- [ ] **DEMO-02**: A real multi-contract demo is deployed to Anvil: `DemoShell` (ERC-8244 entry serving `/` index + nav chrome with wallet-connect and theme-toggle, and `/about` from a second getter on the same contract), `DemoDocs` (separate contract serving `/docs`), both chain-loading DxKit from the separate `DxKit` facade — proving single-contract co-location and multi-contract composition in one deployment
- [ ] **DEMO-03**: The `/docs` route is a proper one-pager for developers — what the demo is, the contracts and their addresses per chain, how chain-loading works, how it's deployed — with diagrams rendered to inline SVG at build time (mermaid-cli as dev-only tooling; nothing runtime, nothing remote)
- [ ] **DEMO-04**: The demo works in loose mode (real wallet on Anvil), strict mode (gateway shim + sandbox), and via the CI integration test; the demo's manifests are the same schema used by web/IPFS dapps with only `web3://` strings differing

### Documentation

- [ ] **DOC-01**: Cookbook recipe "Deploying a DxKit dapp fully on-chain" (Anvil loop → publish → bootstrap → Sepolia/mainnet), plus a reference for `@dnzn/dxkit-web3` and the contract interfaces (`html()`, `source()`, `version()`, `keccak()`, `resolveMode()`), and a `docs/plugins/`-style page for the resolver package
- [ ] **DOC-02**: README/getting-started present the three deployment targets as co-equal (bundler/webserver, IIFE/static/IPFS, on-chain), and existing IIFE/IPFS + bundler docs are verified unaffected; security.md gains the on-chain trust model (pin-before-execute, RPC trust, sandbox/CSP)
- [ ] **DOC-03**: Docs are verified against final code and the ship-gate marker is written for every phase that changes `src/` or `plugins/*/src/`

### Network Deploys

- [ ] **NET-01**: DxKit 0.4.0 (facade + data contracts) and the demo (`DemoShell`, `DemoDocs`) are deployed to **Sepolia** with the chain-agnostic scripts, addresses + keccaks recorded, facades Etherscan-verified, and the demo loads end-to-end via the bootstrap in a real wallet browser and via a third-party `web3://` gateway
- [ ] **NET-02**: The same artifacts are deployed to **Ethereum mainnet** under a max-fee cap (~$1–2 budget at ~0.05 gwei; script aborts above the cap), addresses recorded, facades verified, demo confirmed loading; docs/README updated with mainnet addresses

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### On-Chain follow-ons

- **CHAIN-01**: L2 deploys (Base, etc.) using the same CREATE2 addresses
- **CHAIN-02**: ENS-name discovery for DxKit versions (`<version>.dxkit.eth` → address)
- **CHAIN-03**: On-chain manifests — shell reads its manifest list from a contract method (`manifests()`) instead of inline JSON in the bootstrap
- **CHAIN-04**: Freedom-browser-specific integration once its provider-injection story is public (spike question tracked in STATE.md)
- **CHAIN-05**: Multi-version registry contract for framework discovery (optional sugar; no precedent uses one)

### Modernization (carried)

- **TS7-01**: TypeScript 7.1 migration (paired with tsup → tsdown)
- **STOR-01**: Storage encryption for persisted settings/wallet state

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| A DxKit-hosted `web3://` gateway or custom on-chain browser | Infrastructure to operate/secure; Freedom, wallets, and EthStorage's gateway already own this. DxKit only ships the *local* dev gateway (DEV-03/04) and makes contracts gateway-compliant (PUB-04) |
| Storing large binary media (images/video/fonts) on-chain | Gas-prohibitive at EIP-170 chunk sizes; on-chain scope is code/HTML/CSS/text; heavy media stays IPFS/Arweave or small `data:` URIs |
| A `fetch()`/network escape hatch in the resolver for ERC-8244 pages | Violates ERC-8244 and the trust model; external data is a provider-mediated `eth_call`, never raw `fetch()` |
| Mandatory registry / ENS scheme to find DxKit versions | No precedent uses one; consumers pin verified addresses; deferred as optional sugar (CHAIN-02/05) |
| Streaming decompress-while-render | Defeats the keccak pin; resolver always buffers → verifies → decompresses |
| Runtime mermaid.js on the docs page | ~1 MB and CDN-loaded; diagrams are pre-rendered to inline SVG at build time |
| Changing default loaders or making core call `eth_call` | Would privilege on-chain over the other two targets; on-chain lives behind the existing loader seam via the separate resolver package |
| Two separate demo apps (single- vs multi-contract) | Routing/loading code path is identical — only the manifest string differs; one demo shows both patterns (DEMO-02) |
| Hardhat as the local chain | Foundry/Anvil is the L1-native toolchain (single binary, forge scripts/tests, matches zSwap precedent); no JS toolchain layer needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEV-01 | Phase 11 | Pending |
| DEV-02 | Phase 12 | Pending |
| DEV-03 | Phase 11 | Pending |
| DEV-04 | Phase 11 | Pending |
| DEV-05 | Phase 13 | Pending |
| DEV-06 | Phase 11 | Pending |
| PUB-01 | Phase 12 | Pending |
| PUB-02 | Phase 12 | Pending |
| PUB-03 | Phase 12 | Pending |
| PUB-04 | Phase 12 | Pending |
| PUB-05 | Phase 12 | Pending |
| PUB-06 | Phase 12 | Pending |
| PUB-07 | Phase 11 | Pending |
| RES-01 | Phase 13 | Pending |
| RES-02 | Phase 13 | Pending |
| RES-03 | Phase 13 | Pending |
| RES-04 | Phase 13 | Pending |
| RES-05 | Phase 13 | Pending |
| RES-06 | Phase 13 | Pending |
| RES-07 | Phase 13 | Pending |
| RES-08 | Phase 13 | Pending |
| CORE-01 | Phase 14 | Pending |
| CORE-02 | Phase 14 | Pending |
| CORE-03 | Phase 14 | Pending |
| CORE-04 | Phase 14 | Pending |
| CORE-05 | Phase 14 | Pending |
| CORE-06 | Phase 14 | Pending |
| DEMO-01 | Phase 15 | Pending |
| DEMO-02 | Phase 15 | Pending |
| DEMO-03 | Phase 15 | Pending |
| DEMO-04 | Phase 15 | Pending |
| DOC-01 | Phase 16 | Pending |
| DOC-02 | Phase 16 | Pending |
| DOC-03 | Phase 16 | Pending |
| NET-01 | Phase 17 | Pending |
| NET-02 | Phase 18 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36 ✓ (Phases 11–18)
- Unmapped: 0

---
*Requirements defined: 2026-08-16*
*Last updated: 2026-08-16 — traceability populated by roadmap (Phases 11–18)*

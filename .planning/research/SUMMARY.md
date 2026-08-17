# Research Summary: DxKit v0.4 On-Chain Deployment (ERC-8244)

**Project:** DxKit (headless dapp microframework)  
**Domain:** Ethereum L1 on-chain deployment + `web3://` asset resolution  
**Researched:** 2026-08-16  
**Confidence:** MEDIUM-HIGH (Stack HIGH, Features MEDIUM, Architecture MEDIUM-HIGH, Pitfalls MEDIUM)

---

## Executive Summary

DxKit v0.4 adds a third co-equal deployment target: fully on-chain dapps that chain-load a versioned DxKit framework contract and render via an ERC-8244 `html()` call. Unlike existing single-purpose on-chain dapps (zFi/zSwap), DxKit's architecture decouples the reusable framework from per-dapp contracts, reducing on-chain footprint and enabling true third-party dapp development on-chain.

The recommended approach mirrors real working precedent (zFi/zSwap via SSTORE2 data contracts): build locally with Foundry/Anvil, gzip and chunk the IIFE builds into ≤24,576-byte contracts via `SSTORE2.write()`, deploy a minimal versioned facade contract per DxKit release, and provide loaders that resolve `web3://` URLs via `eth_call` + native browser `DecompressionStream` gunzip. The bootstrap snippet (≈1 KB) hardcodes a keccak pin to verify chain-loaded code before execution — this is the single most critical security gate.

**Key risk:** ERC-8244 is confirmed REAL (verified in ethereum/ERCs PR #1712, updated 2026-08-03) but is DRAFT status and may change before Final. **Mitigation:** Pin the exact spec text + commit SHA before the first contract deploy; re-check at each phase boundary. A second structural risk is the core's sandbox hardening (inline script re-execution, optional `entry` field) — any change to lifecycle touches code paths IIFE/bundler dapps already rely on. **Mitigation:** Explicit regression test suite for the existing two targets; additive-only changes.

---

## Key Findings

### Recommended Stack

**Foundry v1.7.1** (stable, not nightly) + **Solidity ^0.8.30** (compiler pinned exact in `foundry.toml`) + **solady SSTORE2** (`Vectorized/solady` v0.1.26 tag) — the only production-validated pattern found for chunked on-chain data. Foundry is dev-only (not shipped); no runtime package dependencies added. **solady's `SSTORE2` specifically** (not `0xsequence/sstore2` nor hand-rolled CREATE tricks) because it's actively maintained and widely audited.

**Hand-written Keccak-256** (~120–180 lines, NIST FIPS 202 reference implementation) + **minimal calldata builder + ABI decoder** (~50 lines hardcoded selector + fixed-shape string decode) — both vendored as first-party TS source in the new `@dnzn/dxkit-web3` package. Do **not** add `ethers.js`/`viem` or `@noble/hashes` (violates zero-runtime-dep constraint; ethers/viem are 30–100+ KB and pull far more ABI surface than needed). Native `crypto.subtle` cannot provide Keccak (only SHA-1/256/384/512), so this is necessary, not optional.

**Native `DecompressionStream('gzip')`** — Baseline widely available (Chrome/Edge 80+, Firefox 113+, Safari 16.4+ as of May 2023). No polyfill needed for DxKit's stated deployment targets (ES2022 + EIP-1193 capable environments). Node's `zlib.gzipSync` with pinned parameters (mtime=0, explicit OS byte) for reproducible builds in the publish pipeline.

**Deployment context:** DxKit's current gzipped size (~15 KB core, ~7 KB total with plugins) fits one SSTORE2 data contract today; chunking path stays generic for future larger payloads.

### Expected Features

**Must Have (Table Stakes):**
- `web3://` URL resolution in loaders (`web3://addr:chainId/method`) via `eth_call` through `window.ethereum` (EIP-1193) or configured RPC — the primary access path for any on-chain-aware browser/gateway today
- `eth_call`-only fetching (no network `fetch()`, no `<script src>` to non-`data:`/`blob:` URLs); ERC-8244 forbids network fetches; requires opaque origin compliance
- Data-contract chunking for payloads over ~24 KB (EIP-170 hard limit), with SSTORE2 or equivalent `EXTCODECOPY`-based reassembly
- Gzip compression + `DecompressionStream` gunzip to fit larger dapps into one or two data contracts
- Versioned, immutable facade contracts (no proxy, no upgrade path) — new DxKit release = new contract address
- Keccak-pinned integrity verification before executing any chain-loaded code (subresource-integrity equivalent)
- Local Anvil dev loop with `make` targets and forge tests as the development substrate

**Should Have (Competitive Advantage):**
- Chain-loading a reusable, versioned DxKit framework from a separate contract (no existing precedent; zFi/zSwap bundle everything into one app)
- One manifest schema across all three deployment targets (bundler/IIFE/on-chain) — same `entry`/`template`/`styles`/`dependencies` fields, only URL scheme changes
- Sandbox hardening for multi-page, routable on-chain dapps (hash-mode routing under `srcdoc`, inline style/script re-execution, optional `entry`, graceful no-fetch/no-storage degradation)

**Defer to v2+ (Out of Scope):**
- Local preview/dev-server proxy for on-chain dapps in a normal browser
- ENS-name version discovery (optional sugar; no precedent uses it)
- Freedom browser integration (blocked on open question: does its read-only preview inject EIP-1193?)
- L2 deploys (Base, etc.) — sequencing candidate only after v0.4 lands

### Architecture Approach

DxKit's existing architecture (shell → router → lifecycle → plugins) is untouched on the logic level. The on-chain target is added *entirely via the existing loader seam*: `web3://` URIs are resolved outside core (in the new `@dnzn/dxkit-web3` package) and converted to `blob:` URLs before core ever sees them — core remains agnostic to the transport.

**Three additive core changes only (all optional, off-by-default):**
1. `DappManifest.entry` becomes optional when a dapp's template is self-contained on-chain
2. `LifecycleManagerOptions.executeInlineScripts` flag enables re-execution of `<script>` tags after `innerHTML` injection
3. `isValidManifest()` guard ensures at least one of `entry` or `template` is present (fail-closed)

**Major new components:**
- `contracts/` — Foundry workspace
- `@dnzn/dxkit-web3` — `web3://` resolver package
- Bootstrap snippet (~1 KB)
- Demo dapp contract

### Critical Pitfalls (Top 5)

1. **Pitfall 0: Unverified/inaccessible ERC-8244 spec text** — ERC-8244 is DRAFT (PR #1712) and may change. **Avoidance:** Pin the exact spec URL + commit SHA before first contract deploy; re-check at each phase boundary.

2. **Pitfall 1: EIP-170/EIP-3860 confusion** — Forgetting SSTORE2 prelude overhead when chunking. **Avoidance:** Budget ~24,000 bytes per chunk with explicit headroom; forge tests assert both caps.

3. **Pitfall 6: Executing code before keccak pin check** — If bootstrap decompresses and injects bytes *before* verifying hash, tampered RPC responses execute with full privileges. **Avoidance:** Always buffer-then-verify-then-decompress-then-render (never stream).

4. **Pitfall 3: Non-deterministic gzip → pin drift** — Different CI runners produce different gzipped bytes due to metadata. **Avoidance:** Pin exact gzip parameters (mtime=0, fixed OS byte); CI verifies reproducibility.

5. **Pitfall 12: Core changes regress IIFE/bundler targets** — Easy to implement optional `entry` in a way that silently breaks existing manifests. **Avoidance:** No existing vitest specs modified; full 400+ spec suite stays green.

---

## Implications for Roadmap

Research suggests 10 sequenced build-order phases, with core changes (highest risk) sequenced *after* resolver proves itself against real contracts.

### Suggested Phase Structure

**Phase 1: Foundry/Anvil Local Dev Loop Setup** → Foundry scaffold, solady SSTORE2, secrets hygiene

**Phase 2: On-Chain Publish Tooling** → gzip/chunking/deploy scripts, reproducible builds, Anvil validation

**Phase 3: `@dnzn/dxkit-web3` Resolver Package** → URL parser, `eth_call`, ABI decode, gunzip, keccak verify

**Phase 4: Web3 Loaders Integration** → `createWeb3Loaders()`, mount script-only demo against Anvil

**Phase 5: Core Sandbox Hardening** → `entry` optional, `executeInlineScripts` flag, regression tests

**Phase 6: Self-Contained Demo Dapp Contract** → Fragment-extraction + inline-script re-execution proof

**Phase 7: Full Demo Dapp + Bootstrap Snippet** → Wallet + theme on-chain, two-ring dev loop (local + fidelity)

**Phase 8: Docs Pass** → Cookbook recipe, resolver reference, contract reference

**Phase 9: Sepolia Testnet Deploy** → Real network validation

**Phase 10: Ethereum Mainnet Deploy** → Production release

### Phase Ordering Rationale

- **Foundry-first:** Necessary precondition; establishes substrate
- **Publish tooling before resolver:** Resolver tests against real contracts, not mocks
- **Resolver before core changes:** Isolates regression risk
- **Sandbox hardening after resolver:** Core changes required for full-document support, but system proven to work without them
- **Docs and deploys last:** Written against tested code

### Research Flags

**Phases needing deeper research:**
- **Phase 1:** Foundry submodule strategy doesn't conflict with pnpm or CI caching
- **Phase 5:** Storage-access error handling in every plugin (including storage-getter throws)
- **Phase 7:** CSP `blob:` URL scheme under ERC-8244 default-deny sandbox (manual test required)
- **Phases 3–4:** Freedom browser EIP-1193 injection (spike question)

**Phases with well-documented patterns (skip research):**
- **Phase 2:** EIP-170 / SSTORE2 chunking (multiple implementations to reference)
- **Phase 9–10:** Foundry deploy via `forge script --broadcast --verify` (standard workflow)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | **HIGH** | Versions verified (GitHub APIs). Keccak hand-write necessary (crypto.subtle lacks it). ABI decoder trivial. Zero runtime deps verified. |
| **Features** | **MEDIUM** | ERC-8244 REAL but DRAFT (may change). Table stakes align with zFi/zSwap precedent. Anti-features well-reasoned. |
| **Architecture** | **MEDIUM-HIGH** | DxKit code HIGH-confidence (file:line cited). Loader pattern proven. Sandbox hardening additive. `srcdoc`/routing novel (no precedent). |
| **Pitfalls** | **MEDIUM** | EVM/CSP/Foundry HIGH. ERC-8244 constraints MEDIUM (DRAFT). Regression patterns MEDIUM-HIGH. |

**Overall:** **MEDIUM-HIGH** — stack/tooling well-verified; architecture sound; main uncertainty is ERC-8244 DRAFT status and novel sandbox/routing patterns.

### Gaps to Address

1. **ERC-8244 DRAFT status** — Spec may change. *Mitigation:* Pin text + SHA; scheduled re-checks. Move forward; breaking changes unlikely.

2. **`srcdoc` / opaque-origin / hash routing** — No precedent for routable on-chain dapp in sandboxed iframe. *Mitigation:* Spike during Phase 7; verify hash-mode works with `data:` URLs.

3. **Freedom browser EIP-1193 injection** — Unconfirmed. *Mitigation:* Documented as spike; not a v0.4 blocker (RPC fallback exists).

4. **Etherscan data-contract verification** — Raw bytecode has no Solidity source. *Mitigation:* Verify facade only; likely acceptable.

5. **Per-chain CREATE2 deployer** — May not exist on all chains. *Mitigation:* Script checks presence; fails loudly if missing.

---

## Sources

### Primary (HIGH confidence)

- **STACK.md:** ERC-8244 PR #1712 (verified 2026-08-03, REAL DRAFT), Foundry v1.7.1, solady v0.1.26, caniuse DecompressionStream
- **FEATURES.md:** ERC-4804, ERC-6860, ERC-5219 (official), zFi/zSwap precedent, EIP-170
- **ARCHITECTURE.md:** DxKit source (file:line cited), existing loader seams, storage graceful degradation
- **PITFALLS.md:** EIP-170, EIP-3860, SSTORE2, Foundry, CSP, security mechanics

### Secondary (MEDIUM confidence)

- `PROJECT.md` (milestone constraints)
- Web synthesis on monorepo integration, gzip reproducibility, module resolution

**ERC-8244 Reconciliation:** Previous research flagged as "unverified"; STACK.md correction confirms it's REAL DRAFT in PR #1712 (updated 2026-08-03), interface `html() external view returns (string memory)` (selector `0x33c34ac3`), status DRAFT (may change), all references treat as confirmed DRAFT.

---

*Research completed: 2026-08-16*  
*Synthesized by: gsd-synthesizer*  
*Ready for roadmap: yes*

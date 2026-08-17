# Stack Research

**Domain:** On-chain (ERC-8244) deployment tooling for a zero-runtime-dep TypeScript microframework — Solidity contract toolchain + a browser-native `web3://` resolver package
**Researched:** 2026-08-16
**Confidence:** HIGH (Foundry versions and ERC texts verified directly against GitHub/eips.ethereum.org; MEDIUM on library size estimates and monorepo-layout conventions, which are synthesized rather than quoted)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Foundry (forge/cast/anvil) | `v1.7.1` stable channel (verified via `github.com/foundry-rs/foundry` tags API, 2026-08-16 — latest non-prerelease tag; `foundryup` also offers a rolling `nightly` channel, do not use for this milestone) | Solidity build/test/local-node/deploy toolchain | Rust binary, zero interaction with the pnpm/Node toolchain — installs to `~/.foundry`, never touches `node_modules`. `forge test` + `anvil` give the local L1 dev loop the milestone asks for; `forge script --broadcast --verify` covers Sepolia/mainnet from the same tool. Dev-only: nothing here ships in any npm package. |
| Solidity | `^0.8.30` pragma, pin exact compiler in `foundry.toml` (`solc = "0.8.36"` — latest stable per soliditylang.org blog, 2026-07-09; re-verify at implementation time since Solidity ships monthly-ish patch releases) | Contract language for data contracts + facade | Foundry's native compiler target; 0.8.30+ carries the current IR-pipeline storage-clearing fixes (0.8.34, Feb 2026) that matter for any contract using `immutable`/`SSTORE2`-style patterns. Pin an exact patch version (not a caret range) in `foundry.toml` — reproducible bytecode matters for a keccak-pinned facade. |
| solady `SSTORE2` (`Vectorized/solady`, `src/utils/SSTORE2.sol`) | pin to a tagged commit via `forge install Vectorized/solady@<tag>` (latest tag `v0.1.26`, 2025-08-25 per GitHub releases API — solady tags infrequently relative to `main`; re-check `main` HEAD at implementation time since many consumers pin a commit, not a tag) | Data-contract chunking (write bytes as bytecode via `CREATE`, read via `EXTCODECOPY`) | Purpose-built for exactly this pattern, MIT-licensed, widely used (higher scrutiny than a bespoke chunker), gas-optimized `read(pointer, start, end)` slicing lets the facade concatenate chunks cheaply. **Important distinction:** this is a Solidity import compiled *into* the deployed on-chain bytecode by `solc` — it is not an npm package and has no relationship to the TS zero-runtime-dep gate (`GATE-02`, `scripts/check-no-runtime-deps.cjs`), which only inspects `package.json` of the npm-published packages. "Dev-only" describes the *Foundry toolchain*; solady's code itself literally ships on-chain. |
| forge-std (`foundry-rs/forge-std`) | `^1.9.6`/`v1.10.0` (both current as of early 2026 per GitHub releases; re-verify exact latest tag — search results conflicted slightly on ordering, use `forge install foundry-rs/forge-std` which always grabs the newest tag) | `Test`, `Script`, `Vm` cheatcodes for `contracts/test/` and `contracts/script/` | Foundry's own standard library; required for `forge script` deploy scripts and `forge test`. Dev/test-only — never compiled into the deployed facade/data contracts (only the deploy script imports it, and scripts aren't part of deployed bytecode). |

### Supporting Libraries (new `@dnzn/dxkit-web3` package — runtime, zero npm deps)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none — hand-written)* Keccak-256 | vendor as first-party TS source, ~120–180 lines (Keccak-f[1600] permutation + `0x01` padding, per NIST FIPS 202 / the Keccak team's public-domain reference algorithm — do not npm-install `js-sha3`/`@noble/hashes`, see below) | Verify fetched chunk bytes against the facade's pinned `keccak256` hash before rendering | Every `web3://` fetch, before any bytes reach the DOM/`html()` sandbox — this is the integrity gate ERC-8244's Security Considerations section requires ("a client MUST NOT render the document with privileges greater than..."). `SubtleCrypto` (`crypto.subtle`) has **no Keccak** — only SHA-1/256/384/512 — so this cannot be satisfied by a browser built-in. |
| *(none — hand-written)* minimal calldata builder + return decoder | vendor as first-party TS source, ~30–50 lines total | Build the `eth_call` calldata for `html()`/`source()` and decode the `string` return | `html()`/`source()` per ERC-8244 take **zero arguments** — calldata is *just* the 4-byte selector (`0x33c34ac3` for `html()`, computed once and hardcoded; compute `source()`'s selector the same way at implementation time), no argument ABI-encoding needed at all. Decoding a single dynamic `string` return is fixed-shape: word 0 is always the offset `0x20`, word 1 is the byte length, remaining bytes (right-padded to a 32-byte boundary) are the UTF-8 payload. This is a fully general ABI encoder is overkill — do not add one. |
| `DecompressionStream` (native Web API, `new DecompressionStream('gzip')`) | Baseline since 2023 — Chrome/Edge 80+, Firefox 113+, **Safari 16.4+** (verified via caniuse.com `mdn-api_decompressionstream_decompressionstream_gzip`, 2026-08-16) | Gunzip fetched/decoded chunk bytes before verifying + rendering | Every `web3://` resolver fetch of a gzip-compressed chunk. No polyfill needed — DxKit's existing constraints already assume ES2022 + an EIP-1193-capable environment (a modern browser or wallet-embedded webview), and Safari 16.4 (March 2023) predates any realistic deployment window. |
| `fetch()` (native) | n/a | JSON-RPC transport to a configured RPC URL, as an alternative to `window.ethereum.request()` | Same pattern `defaultTemplateLoader` already uses in `src/lifecycle.ts` — no new HTTP client needed. `eth_call` over `fetch()` is one `POST` with a JSON body; see JSON-RPC shape below. |
| `window.ethereum.request()` (EIP-1193, injected) | n/a | Preferred `eth_call` path when a wallet provider is present | ERC-8244 itself assumes this path (`requires: 1193, 6963` in the ERC's own frontmatter) — prefer the injected provider over a configured RPC URL when both are available, since it's the provider the user's wallet already trusts. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `foundry-toolchain` GitHub Action (`foundry-rs/foundry-toolchain@v1`) | Installs Foundry in CI | Pin the *action* at `@v1` (major-version floating, standard practice per the action's own README) and pin the *Foundry version* it installs explicitly (e.g. `version: v1.7.1`) rather than `stable`, so CI doesn't silently pick up a new Foundry release mid-milestone. Caches `~/.foundry/cache` (RPC/Etherscan responses) by default. |
| `anvil` | Local Ethereum L1 node for the dev loop | Defaults: RPC at `http://127.0.0.1:8545`, chain ID `31337`, 10 pre-funded dev accounts at 10,000 ETH each, first account/key pair well-known (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` / `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`). These keys are public and safe only for local use — never fund them on a real network. |
| `forge script --broadcast --verify` | Sepolia/mainnet deploy + Etherscan verification in one command | Needs `--rpc-url $RPC_URL --etherscan-api-key $ETHERSCAN_API_KEY` (Etherscan v2 unified API key works across chains including Sepolia). For chains without native Foundry support, `--verifier-url` + the v2 `chainid` query param pattern applies — not needed here since both Sepolia and mainnet are natively supported. |
| Biome, tsup, vitest, pnpm (existing) | Unchanged | Foundry lives entirely outside this toolchain in `contracts/`; no `tsconfig`/`biome.json`/`tsup.config.ts` changes are needed to accommodate it — treat `contracts/` as a sibling Rust-toolchain project the way `plugins/*` are sibling TS packages. |

## Installation

```bash
# Foundry toolchain (once, machine-local — not a project dependency)
curl -L https://foundry.paradigm.xyz | bash
foundryup --install v1.7.1

# contracts/ workspace (inside the pnpm monorepo, NOT a pnpm workspace member)
mkdir -p contracts/src contracts/script contracts/test
cd contracts && forge init --no-commit --no-git .
forge install foundry-rs/forge-std --no-commit
forge install Vectorized/solady --no-commit

# New TS package (pnpm workspace member, zero runtime deps)
# packages/plugins/web3/package.json — devDependencies only:
#   typescript, tsup, vitest, happy-dom (all inherited from existing plugin pattern)
# No `pnpm add` of any runtime package — src/ imports nothing external.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| solady `SSTORE2` | `0xsequence/sstore2` | Sequence's version is fine and slightly simpler (plain `write`/`read` + a `Map` variant keyed by `bytes32` instead of returned address) but is less actively maintained than solady and has no companion off-chain JS deploy helper worth adopting (README confirms Solidity-only, no npm package) — no advantage over solady here. Use it only if a future need arises for `SSTORE2Map`'s deterministic-key lookup instead of solady's pointer-address model. |
| Foundry `forge script` (Solidity) for deploys | `0xsequence/sstore2`'s JS deploy tooling, or a hand-rolled `viem`/`ethers` deploy script | Not needed — `forge script` already handles chunking-and-deploying in the same language as the contracts, with `--broadcast`/`--verify` built in. Reach for a JS deploy script only if deploy logic needs to shell out to Node-side tooling (e.g. reading the built IIFE bundle from `dist/` via Node's `zlib.gzipSync`) — and even then, `forge script`'s `vm.readFile`/`vm.ffi` cheatcodes can often avoid it. |
| Hand-written Keccak-256 (vendored TS source) | `@noble/hashes/sha3.js` (`keccak_256`) | `@noble/hashes` is small, audited, and tree-shakeable (its `sha3` submodule alone is roughly 3–5 KB gzipped, well under the "all primitives" 14 KB figure) and would be the right call **if** the zero-runtime-dep constraint were scoped to core only. It is a legitimate fallback if the hand-written implementation proves too fragile to maintain, but it is an actual `package.json` `dependency` (violates the project's explicit "no ethers/viem at runtime" posture extended project-wide to the new package per `PROJECT.md`'s constraints) — do not add it without an explicit decision to relax the zero-dep rule for `dxkit-web3`. |
| Minimal hand-rolled `eth_call` selector/decoder | `viem`'s `encodeFunctionData`/`decodeAbiParameters`, or `ethers.js` `Interface` | `viem` (tree-shakeable, ~fine-grained imports) is the more "normal" choice for a general ABI surface, but `html()`/`source()` need *zero* general ABI capability — only a hardcoded 4-byte selector and one fixed-shape dynamic-string decode. Reach for `viem` only if the resolver package's scope grows to support arbitrary contract calls (e.g. a future ERC-5219 `request()` client with `KeyValue[]` params) — at that point the ABI surface is big enough that hand-rolling stops paying off. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `ethers.js` / `viem` / `web3.js` as a **runtime** dependency of `@dnzn/dxkit-web3` | Any of these is 30–100+ KB and pulls in far more ABI/RPC/wallet surface than `html()`/`source()` need — directly violates the milestone's explicit "no ethers/viem at runtime" instruction and the project's zero-runtime-dep posture (`PROJECT.md` Constraints: "Zero runtime deps: Hardening must not introduce runtime dependencies"). | The ~150-line hand-rolled Keccak-256 + ~50-line selector/decoder above. |
| `ethers.js` / `viem` as a **devDependency**, for contract deploy scripts | Foundry's own `forge script` (Solidity) already does chunking + deployment + verification in one tool with no Node-side script needed — adding a JS deploy path duplicates that for no benefit. | `forge script contracts/script/Deploy.s.sol --broadcast --verify`. |
| `ethers.js` / `viem` as a **devDependency**, for the resolver package's *tests* | **This one is a justified exception.** Using `viem` (or `ethers`) purely inside `plugins/web3/tests/` as a correctness oracle — asserting the hand-rolled decoder's output matches `viem.decodeAbiParameters(...)` for generated fixtures, or its keccak against `viem.keccak256(...)` — is the same posture the project already takes with `vitest`/`happy-dom`: a devDependency that never ships, used to *validate* the zero-dep runtime code rather than replace it. Scope it tightly (test files only, never imported from `src/`) and gate it the same way `verify-no-runtime-deps` already gates core. | If added, add it **only** as a devDependency, imported only under `plugins/web3/tests/`, and extend `scripts/check-no-runtime-deps.cjs`'s posture (or a package-scoped variant) to confirm it never leaks into `dist/`. |
| A generic/full ABI encoder library, even a small one (e.g. a hand-rolled "encode any Solidity type") | `html()`/`source()` are zero-argument view functions per the ERC-8244 spec's own interface (`function html() external view returns (string memory);`) — building general argument encoding is speculative scope for a capability the resolver doesn't need yet. | The selector-only calldata + fixed-shape dynamic-string decoder described above. If/when an ERC-5219 `request(string[], KeyValue[])` client is added (see Next Milestone Goals), scope ABI encoding to exactly that one signature rather than going general. |
| A gzip **polyfill** or Node's `zlib` bundled for the browser | `DecompressionStream('gzip')` has been Baseline-widely-available since March 2023 (Safari 16.4 was the last holdout) — bundling `pako` or similar for browsers already assumed to support ES2022 + EIP-1193 is dead weight. | Native `DecompressionStream`. (Node's `zlib.gzipSync` is fine and expected on the *write* side — inside Foundry-adjacent Node/CI scripts or a small `contracts/script/prepare-chunks.mjs` helper that gzips the built IIFE before chunking — that script is dev tooling, not the runtime resolver package, so it's unconstrained by the zero-dep rule.) |
| `0xsequence/sstore2`'s Solidity library over solady's, without a specific reason | Both work; solady is the more actively maintained, more widely audited choice for a contract that will hold real mainnet funds/gas spend by the end of this milestone. | solady `SSTORE2`, pinned to a specific commit/tag. |
| Foundry `nightly` channel for this milestone | Nightly is a rolling, unstable build stream intended for testing upcoming Foundry features, not for a milestone that ends in a real mainnet deploy. | Foundry `stable` channel, version-pinned (`v1.7.1` at time of writing — re-verify at implementation time via `foundryup --install stable` output or the GitHub tags API). |
| ENS resolution for the facade contract's discovery, in this milestone | Explicitly out of scope — `PROJECT.md` lists "ENS-name discovery for DxKit versions" as a *Next Milestone* candidate, not a v0.4 requirement. Adding it now expands the on-chain publish tooling's surface (ENS registry calls, `nsProviderSuffix` resolution per ERC-4804) beyond what's needed to ship. | Hardcode/pin the deployed contract address per version; defer ENS to a follow-on milestone. |

## Stack Patterns by Variant

**If a chunked document exceeds one SSTORE2 pointer's practical ceiling (~24,576 bytes minus overhead, per EIP-170):**
- Split across multiple data-contract pointers (`chunk1`, `chunk2`, ... — exactly the pattern in ERC-8244's own reference implementation) and `bytes.concat()` them in `html()`/`source()`.
- Because the framework's own gzipped size (~15 KB per `PROJECT.md`'s "Deployment reality check") comfortably fits *one* pointer today, but a demo dapp bundling DxKit + wallet + theme + its own entry script may not — plan the facade contract to accept an arbitrary-length array of pointers, not a hardcoded two.

**If the browser environment lacks an injected EIP-1193 provider (no `window.ethereum`) but a configured RPC URL is available:**
- Fall back to `fetch()`-based JSON-RPC `eth_call` against the configured URL.
- Because ERC-8244's Security Considerations flag that public RPC operators "SHOULD apply standard response-size limits" — the resolver should treat an RPC-URL fallback's `eth_call` response the same way it treats a wallet-provider response: gunzip, keccak-verify, and time out rather than block, matching the existing `withTimeout`/`isTimeoutActive` pattern already in `src/lifecycle.ts`.

**If a target contract predates ERC-8244 and cannot implement `html()` directly (already deployed, immutable):**
- ERC-8244 itself defines an optional `IContractHostedAppRegistry.html(address target)` fallback interface for exactly this case.
- Out of scope for v0.4 (DxKit deploys its own conforming contracts from scratch) — but worth flagging as a natural v0.5+ extension point for the resolver package if consumers ask to point DxKit at pre-existing on-chain apps.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| Foundry `v1.7.1` | Solidity `0.8.30`–`0.8.36` | Foundry's bundled `solc` selection (`svm`) downloads whatever version `foundry.toml`'s `solc =` pins; no coupling to the Foundry binary version itself beyond needing a Foundry recent enough to know about the pinned solc release (any `v1.x` from 2025 onward is fine). |
| solady `SSTORE2` | Solidity `^0.8.4`+ (per solady's own `pragma`) | No conflict with the `0.8.30`+ pin above. |
| `DecompressionStream` | Node.js ^22.12/24 (this project's engine floor) | `DecompressionStream` is a Web API, **not** available in Node by default the same way (Node has its own `zlib` module instead) — this matters only if `dxkit-web3`'s tests run under `happy-dom`/`vitest` in Node rather than a real browser. Verify `happy-dom` exposes `DecompressionStream`, or gate the gunzip step behind a small seam (mirroring `ScriptLoader`/`StyleLoader`) so tests can inject a Node-`zlib`-backed implementation the way `defaultTemplateLoader` is overridable today. |
| `@dnzn/dxkit-web3` loaders vs. `LifecycleManagerOptions.templateLoader`/`scriptLoader`/`styleLoader` | Existing `(src: string) => Promise<...>` signatures in `src/lifecycle.ts` (lines 29–31) | The resolver package must produce loaders matching these exact existing types — no new loader plumbing needed in core. A `web3://` URL is just another string a manifest's `template`/`entry`/`styles` field can hold; `createLifecycleManager()` doesn't need to know the URL is chain-backed. |

## Sources

- [ERC-8244 draft text](https://github.com/ethereum/ERCs/raw/fe9088c18350eef561ec182acfb35d15b42bddec/ERCS%2Ferc-8244.md) via [PR #1712 "Add ERC: Contract-Hosted Application HTML"](https://github.com/ethereum/ERCs/pull/1712) — HIGH confidence, fetched full text directly, status confirmed **Draft** (`s-draft` label, open PR, updated 2026-08-03). Confirms: single `html()` function, selector `0x33c34ac3`, `view`, `returns (string memory)`, no `source()` in the standard (DxKit's `source()` is a project-specific addition beyond the ERC), `requires: 1193, 6963`, optional `IContractHostedAppRegistry` fallback, coexists with ERC-5219, sandboxed-iframe rendering requirement, no compression/storage-layout mandate.
- [ERC-4804 "Web3 URL to EVM Call Message Translation"](https://eips.ethereum.org/EIPS/eip-4804) — HIGH confidence, official EIPs site, fetched directly. Grammar: `web3URL = web3Schema [userinfo "@"] contractName [":" chainid] path ["?" query]`; auto-mode calldata construction type-detection rules; manual mode calldata-passthrough.
- [ERC-5219 `IDecentralizedApp.sol`](https://eips.ethereum.org/assets/eip-5219/IDecentralizedApp.sol) — HIGH confidence, fetched the actual interface asset file. `request(string[] resource, KeyValue[] params) view returns (uint16 statusCode, string body, KeyValue[] headers)`.
- ERC-6860 "Web3 URL to EVM Call Message Translation" (superseding/parallel draft to ERC-4804) — MEDIUM confidence (via WebSearch synthesis, not a direct fetch); `resolveMode()` selector `0xDD473FAE`, returns `manual`/`auto`/`resourceRequest`.
- [foundry-rs/foundry GitHub tags API](https://api.github.com/repos/foundry-rs/foundry/tags) — HIGH confidence, queried directly 2026-08-16; latest non-RC stable tag `v1.7.1`, confirms `nightly-*` tags dominate recent releases (rolling channel).
- [foundry-rs/foundry-toolchain README](https://github.com/foundry-rs/foundry-toolchain) — HIGH confidence, fetched directly; example CI YAML, `@v1` action pin convention, `~/.foundry/cache` caching default.
- [Vectorized/solady `SSTORE2.sol`](https://github.com/Vectorized/solady/blob/main/src/utils/SSTORE2.sol) — HIGH confidence, fetched directly. `write`/`writeCounterfactual`/`writeDeterministic`, `read(pointer)`/`read(pointer,start)`/`read(pointer,start,end)`, `DeploymentFailed()` custom error, internal 65,534-byte length-prefix ceiling (practically bounded to 24,576 bytes by EIP-170 contract-size limits regardless).
- [Vectorized/solady GitHub releases API](https://api.github.com/repos/Vectorized/solady/releases) — HIGH confidence, latest tag `v0.1.26` (2025-08-25).
- [0xsequence/sstore2 README](https://github.com/0xsequence/sstore2/blob/master/README.md) — HIGH confidence, fetched directly. `write(bytes)`/`read(address)` and `SSTORE2Map` (`bytes32` key) variants; confirms 24,576-byte practical max and no companion off-chain JS deploy package.
- [caniuse: DecompressionStream + gzip](https://caniuse.com/mdn-api_decompressionstream_decompressionstream_gzip) — HIGH confidence, fetched directly 2026-08-16. Chrome/Edge 80+, Firefox 113+, Safari 16.4+.
- [Solidity blog — 0.8.34](https://www.soliditylang.org/blog/2026/02/18/solidity-0.8.34-release-announcement/), [0.8.35](https://www.soliditylang.org/blog/2026/04/29/solidity-0.8.35-release-announcement/), [0.8.36](https://www.soliditylang.org/blog/2026/07/09/solidity-0.8.36-release-announcement/) — MEDIUM confidence (WebSearch synthesis of blog titles/dates, not direct fetch of each post); latest stable as of research date is 0.8.36 (2026-07-09).
- `npmjs.com/package/js-sha3` registry metadata (via `registry.npmjs.org`) — HIGH confidence, queried directly; `v0.13.0`, zero dependencies, ~128 KB unpacked for the *full* SHA-3/Keccak/SHAKE/cSHAKE/KMAC family — cited only to establish that a Keccak-256-only extraction is a small fraction of that footprint, not as a package to install.
- `@noble/hashes` — MEDIUM confidence (WebSearch synthesis); cited in "Alternatives Considered" only, not recommended for adoption given the zero-runtime-dep constraint.
- Anvil defaults (chain ID 31337, port 8545, 10 funded dev accounts, well-known first key) — MEDIUM confidence (WebSearch synthesis across Foundry docs/community sources); these are long-stable, widely-documented Foundry defaults, low risk of drift.
- `PROJECT.md` (this repo, `.planning/PROJECT.md`) — the milestone's own constraints (zero-runtime-deps, three co-equal deployment targets, Foundry dev-only, ERC-8244 forbids network fetches) — read directly, HIGH confidence, primary source of truth for scope.
- `src/lifecycle.ts` (this repo) — existing `ScriptLoader`/`StyleLoader`/`TemplateLoader` seam signatures the new resolver package must match — read directly.

---
*Stack research for: On-chain (ERC-8244) deployment — v0.4 milestone*
*Researched: 2026-08-16*

# Roadmap: DxKit

## Milestones

- ✅ **v1.0 Beta Hardening** — Phases 1–5 (shipped 2026-07-15, released as 0.2.0)
- ✅ **v1.1 TypeScript 6 Migration & Toolchain Modernization** — Phases 6–10 (shipped 2026-08-16, released as 0.3.0)
- 🚧 **v1.2 On-Chain Deployment (ERC-8244)** — Phases 11–18 (active)

Detail archived in [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md) and
[`milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md).

## Overview (v1.2)

v1.2 makes on-chain a third co-equal deployment target. The entire milestone is developed and
proven on a local Foundry/Anvil loop; only the final two phases touch a public network, and both
are deploy-and-verify, not development.

Two hard constraints dictate the order. First, **contracts are immutable** — a mistake costs a new
address, not a patch — so the exact ERC-8244 draft text the facades implement (PR + commit SHA) is
pinned in the very first phase and re-checked at every phase boundary before anything immutable is
written. Second, **the resolver must prove itself against real deployed contracts, not mocks**,
which puts the publish pipeline (Phase 12) ahead of the `@dnzn/dxkit-web3` package (Phase 13).

Phases 11–13 add nothing to `src/`. The Foundry workspace, the publish pipeline, and the resolver
package are all new surface that reaches core only through the `ShellConfig.lifecycle` loader seam
v1.0 Phase 3 built for exactly this purpose. Phase 13 ends on the milestone's first real proof: a
script-only dapp mounting from Anvil through **unmodified** core.

Phase 14 is the milestone's highest-regression-risk phase and the **only** one that touches shared
lifecycle/manifest code (`src/types/manifest.ts`, `src/shell.ts`, `src/lifecycle.ts`). It is
deliberately sequenced after the resolver so any bundler/IIFE regression bisects to one phase.
Every change there is additive and off-by-default, and the existing 413-spec suite must stay green
with no existing spec modified.

Phase 15 puts the pasteable ~1 KB bootstrap and a real multi-contract demo (`DemoShell` +
`DemoDocs`) on Anvil. Phase 16 brings the docs back into truth and settles the ship-gate markers
for every phase that touched `src/` or `plugins/*/src/`. Phases 17–18 deploy DxKit 0.4.0 + the demo
to Sepolia and then Ethereum mainnet under a hard fee cap.

Out of scope this milestone (v2 candidates): a DxKit-operated `web3://` gateway, on-chain
manifests, ENS version discovery, and L2 deploys.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- Each milestone continues numbering from the previous one (v1.0 ended at Phase 5, v1.1 at Phase 10)

<details>
<summary>✅ v1.0 Beta Hardening (Phases 1–5) — SHIPPED 2026-07-15</summary>

Hardened DxKit 0.1.5 → 0.2.0 without expanding the feature surface: silent failures made
visible via `dx:error`, load/hang/leak guards, an optional template sanitizer + configurable
storage keys, a stress/edge-case/regression test suite, and a full documentation truth pass.

- [x] Phase 1: Diagnostics — Surface Silent Failures (2/2 plans) — completed 2026-07-11
- [x] Phase 2: Robustness — Load Guards, Caching & Handler Cleanup (4/4 plans) — completed 2026-07-12
- [x] Phase 3: Security — Sanitization & Storage Isolation (3/3 plans) — completed 2026-07-12
- [x] Phase 4: Testing — Stress, Edge-Case & Regression Coverage (6/6 plans) — completed 2026-07-14
- [x] Phase 5: Documentation — Truth Pass (8/8 plans) — completed 2026-07-14

</details>

<details>
<summary>✅ v1.1 TypeScript 6 Migration & Toolchain Modernization (Phases 6–10) — SHIPPED 2026-08-16</summary>

Modernized the dev toolchain 0.2.1 → 0.3.0 without touching the runtime surface: Node 22 LTS floor
(`^22.12.0 || >=24.0.0`, engine-strict, breaking), TypeScript 6 with a standalone per-package
`tsc --noEmit` gate and zero deprecation shims, TS7 forward-compat flags on, build-artifact smoke
test, machine-enforced zero-runtime-dep assertion, Renovate, and the ROB-05/06 manifest-shape guards.

- [x] Phase 6: Toolchain Audit & Modernization (6/6 plans) — completed 2026-07-17
- [x] Phase 7: TypeScript 6 Migration & Standalone Typecheck (4/4 plans) — completed 2026-07-17
- [x] Phase 8: Forward-Compat Typing (2/2 plans) — completed 2026-07-17
- [x] Phase 9: Continuous Debt Guardrails & Registry Robustness (4/4 plans) — completed 2026-07-18
- [x] Phase 10: Close gap: CR-01 — guard dapps/inline manifests tiers (1/1 plan) — completed 2026-07-19

</details>

**🚧 v1.2 On-Chain Deployment (ERC-8244) (Phases 11–18)**

- [ ] **Phase 11: Foundry/Anvil Dev Loop & Spec Pin** - Local chain, `contracts/` workspace, dual-mode preview gateway, secrets hygiene, and the pinned ERC-8244 draft text.
- [ ] **Phase 12: On-Chain Publish Tooling & Facade Contracts** - Reproducible gzip → chunked SSTORE2 data contracts → immutable versioned ERC-8244 facade, deployed by one chain-agnostic command.
- [ ] **Phase 13: `web3://` Resolver & Loader Integration** - New zero-dep `@dnzn/dxkit-web3` resolving `web3://` via `eth_call`, verify-before-execute, mounting a dapp from Anvil through unmodified core.
- [ ] **Phase 14: Core Sandbox Hardening (additive)** - Optional `entry`, inline-script re-execution, full-document templates, opaque-origin degradation — the only phase touching shared core code.
- [ ] **Phase 15: Bootstrap Snippet & On-Chain Demo Dapp** - The pasteable ~1 KB bootstrap plus a real multi-contract demo (`DemoShell` + `DemoDocs`) running fully on Anvil.
- [ ] **Phase 16: Documentation — On-Chain Target** - Cookbook recipe, resolver + contract references, three co-equal targets, on-chain trust model, ship-gate markers.
- [ ] **Phase 17: Sepolia Deploy** - DxKit 0.4.0 + demo on a real public testnet, Etherscan-verified, loading via the bootstrap and a third-party `web3://` gateway.
- [ ] **Phase 18: Ethereum Mainnet Deploy** - The same artifacts on Ethereum mainnet under a hard fee cap, addresses recorded and documented.

## Phase Details

### Phase 11: Foundry/Anvil Dev Loop & Spec Pin

**Goal**: A developer can start a local chain, deploy an ERC-8244 contract to it, and see that contract's `html()` render in an ordinary browser — with the exact spec text those contracts implement pinned in-repo before a single immutable byte is written.
**Depends on**: Nothing new (first phase of v1.2; v1.1 shipped as 0.3.0)
**Requirements**: DEV-01, DEV-03, DEV-04, DEV-06, PUB-07
**Success Criteria** (what must be TRUE):

  1. From a clean checkout, `make` targets bring up Anvil and run `forge build` + `forge test` green against an in-monorepo `contracts/` workspace (`foundry.toml`, forge-std, solady, pinned Solidity/Foundry versions) — and `make lint` / `make typecheck` / `make test` are provably unaffected by `contracts/` (no JS tooling lints, formats, or typechecks Solidity).
  2. `make preview` serves a trivial hello-world ERC-8244 facade deployed on Anvil at `http://localhost:<port>/?contract=0x…&chain=31337` (or `/0xADDR:31337/`) in **loose** mode, and its `html()` renders in a normal browser through the wallet's provider pointed at Anvil.
  3. The same dependency-free gateway offers a **strict** mode that renders the page with no wallet installed — a read-only EIP-1193 shim forwarding `eth_call`/`eth_chainId` to Anvil, inside a sandboxed `srcdoc` iframe under a default-deny CSP.
  4. The exact ERC-8244 draft text (PR + commit SHA) the contracts implement is pinned in-repo, and re-checking that pin is a documented, recorded precondition of every later on-chain phase.
  5. `make audit` / gitleaks scope reaches `contracts/`, `.env*` is git-ignored, and the documented deploy flow reads keys and RPC URLs from the environment only — the flow offers no path that commits a plaintext key.

**Plans**: TBD

**Note**: PUB-07 (the spec pin) lands here, at the start of contracts work, precisely because ERC-8244 is still Draft and every later phase writes immutable state. The dual-mode gateway (DEV-03/04) is dev-only tooling — DxKit ships no hosted `web3://` gateway.

### Phase 12: On-Chain Publish Tooling & Facade Contracts

**Goal**: Any built DxKit artifact can be published to any chain as immutable, byte-reproducible, keccak-pinned contracts with a single command — the substrate the resolver will be tested against.
**Depends on**: Phase 11 (Foundry workspace, forge test harness, and the pinned spec the facade interface is built to)
**Requirements**: DEV-02, PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06
**Success Criteria** (what must be TRUE):

  1. A single `make` target takes a clean checkout through build → gzip → chunk → deploy to a local Anvil node and records `{ chain, address, version, keccak }` per chain in a committed JSON; re-running it is repeatable.
  2. Gzipping the same bundle twice — on a different machine or CI runner — produces byte-identical output (mtime=0, fixed OS byte, fixed level), asserted by a CI reproducibility check, so the keccak pin cannot drift.
  3. A synthetic payload larger than 24 KB round-trips through chunking → SSTORE2 data contracts → on-chain reassembly with correct byte order, with forge tests asserting chunk + prelude bytes stay under the EIP-170/EIP-3860 caps with headroom.
  4. A deployed facade returns ERC-8244 `html()` (selector `0x33c34ac3`), a raw `source()`, `version()`, and `keccak()` for real DxKit bytes; it is immutable (no proxy, no upgrade path — new version = new contract) and advertises `resolveMode()` so third-party `web3://` gateways can render it with no DxKit-operated infrastructure.
  5. One chain-agnostic script deploys to Anvil, Sepolia, or mainnet by config, using CREATE2 through the canonical deterministic deployer (failing loudly when that deployer is absent on the target chain) and supporting Etherscan `--verify` for facades on public networks.

**Plans**: TBD

**Note**: No `src/` or `plugins/*/src/` changes in this phase — the pipeline consumes existing `dist/` artifacts.

### Phase 13: `web3://` Resolver & Loader Integration

**Goal**: A dapp mounts from chain through DxKit's existing loader seam with core completely unmodified, and no chain-loaded byte ever executes before its pin is verified.
**Depends on**: Phase 12 (the resolver is proven against real deployed facades and real DxKit bytes, not mocks)
**Requirements**: RES-01, RES-02, RES-03, RES-04, RES-05, RES-06, RES-07, RES-08, DEV-05
**Success Criteria** (what must be TRUE):

  1. A new zero-runtime-dependency package `@dnzn/dxkit-web3` builds to ESM/CJS/IIFE (global `DxWeb3`) and resolves ERC-6860-style `web3://<addr>[:chainId]/<method>[?returns=(string)]` URLs — plus the `web3://<addr>:<chainId>/` shorthand implying `html()` — via `eth_call` through an injected EIP-1193 provider, decoding the fixed-shape `string`/`bytes` return with no ABI library.
  2. Nothing executes before verification: the resolver buffers → verifies the caller-supplied keccak-256 pin → gunzips → hands off, and tampered bytes abort the mount with a `dx:error` naming the URL. A chainId mismatch, an absent provider, a revert, and a missing `DecompressionStream` each surface their own distinct `dx:error` instead of hanging, throwing uncaught, or returning silently empty.
  3. `createWeb3Loaders(options)` returns `templateLoader`/`scriptLoader`/`styleLoader` that plug into `ShellConfig.lifecycle` and mount a **script-only demo dapp from Anvil through unmodified core**: scripts injected as text (`blob:` or `textContent`, never `<script src=http…>`), styles as `<style>` text, templates as HTML strings, and non-`web3://` URLs passing through to the default loaders so mixed manifests work.
  4. The hand-vendored keccak and ABI decoder agree with a reference implementation across test vectors (test-only devDependency, never imported from `src/`), and `make verify-no-runtime-deps`-style zero-dep posture holds for the new package.
  5. CI installs Foundry, runs `forge test`, and runs Anvil-backed integration tests exercising publish pipeline → resolver → gateway end-to-end — not only mocked providers.

**Plans**: TBD

**Note**: An optional JSON-RPC-URL fallback exists for dev harnesses, CI, and gateway previews (RES-06), but it is never the default on ERC-8244 pages and its use is visible in `dx:error` sources. The provider path is the primary transport and must be exercised in every Anvil verification.

### Phase 14: Core Sandbox Hardening (additive)

**Goal**: Core can host a full ERC-8244 `html()` document under an opaque-origin sandbox — additively, off by default, with the bundler and IIFE/IPFS targets provably unchanged.
**Depends on**: Phase 13 (the resolver proves the whole path works against *unmodified* core first, so the one phase that edits shared code is isolated and bisectable)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06
**Success Criteria** (what must be TRUE):

  1. `DappManifest.entry` is optional and `isValidManifest()` fails closed requiring at least one of `entry` or `template`; the existing 413-spec suite stays green with **no existing spec modified** (only added).
  2. With opt-in `LifecycleManagerOptions.executeInlineScripts: true`, a full ERC-8244 `html()` document mounted into `#dx-mount` yields a usable fragment (`<body>` + `<style>` + inline `<script>`) and its inline scripts actually run; with the flag unset (default `false`), template injection is byte-for-byte 0.3.0 behavior and fragment templates are unaffected.
  3. Wallet, theme, and settings plugins still complete `init()` in an opaque-origin sandbox where `localStorage`/`sessionStorage` *property access itself* throws — degrading to in-memory state and surfacing `dx:error` per the v1.0 storage-error contract.
  4. Configuring history-mode routing under a `srcdoc`/opaque origin where `pushState` is unusable surfaces a `dx:error`/warning event instead of an uncaught `SecurityError`, with hash mode documented as the on-chain default.
  5. Non-regression for the other two targets is proven, not asserted: defaults unchanged, no new runtime dependency (GATE-02 green), and `make smoke` green against the real IIFE/CJS `dist/` artifacts.

**Plans**: TBD

**Risk**: This is the milestone's **highest-regression-risk phase and the only one that touches shared lifecycle/manifest code** (`src/types/manifest.ts`, `src/shell.ts`, `src/lifecycle.ts`). It is sequenced after the resolver specifically so that any regression in the bundler or IIFE/IPFS path bisects to a single phase. Never loosen an existing test to accommodate a new on-chain code path. Requires a `{phase}-DOCS.md` ship-gate marker (DOC-03).

### Phase 15: Bootstrap Snippet & On-Chain Demo Dapp

**Goal**: A real, multi-contract DxKit dapp runs entirely on-chain from a bootstrap a dapp author can paste — proving both single-contract co-location and multi-contract composition in one deployment.
**Depends on**: Phase 14 (full-document templates, inline-script re-execution, and optional `entry` are what a self-contained on-chain dapp needs)
**Requirements**: DEMO-01, DEMO-02, DEMO-03, DEMO-04
**Success Criteria** (what must be TRUE):

  1. A ~1 KB inline bootstrap snippet, pasted into a dapp author's own `html()`, chain-loads DxKit end-to-end (`eth_call` → verify keccak → gunzip → inject → `createShell({ mode: 'hash', manifests, lifecycle: DxWeb3.createWeb3Loaders(...) })`), and provider-absent or pin-mismatch failures are visible on the page — never silent.
  2. `DemoShell` (ERC-8244 entry serving the `/` index plus nav chrome with wallet-connect and theme-toggle, and `/about` from a second getter on the same contract) and `DemoDocs` (a separate contract serving `/docs`) are both deployed to Anvil and both chain-load DxKit from the separate DxKit facade.
  3. `/docs` is a genuine developer one-pager — what the demo is, its contracts and their per-chain addresses, how chain-loading works, how it is deployed — with diagrams rendered to inline SVG at build time (dev-only tooling; nothing runtime, nothing remote).
  4. The demo works in loose mode (real wallet on Anvil), in strict mode (gateway shim + sandbox), and via the CI integration test — using manifests in the same schema web/IPFS dapps use, with only the `web3://` strings differing.

**Plans**: TBD
**UI hint**: yes

### Phase 16: Documentation — On-Chain Target

**Goal**: The docs tell the truth about all three deployment targets, and the on-chain trust model is written down where a consumer will actually find it.
**Depends on**: Phase 15 (docs are written against final, demonstrated behavior — the project's "code is truth" convention)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):

  1. A cookbook recipe "Deploying a DxKit dapp fully on-chain" walks the whole path (Anvil loop → publish → bootstrap → Sepolia/mainnet), alongside a `docs/plugins/`-style reference for `@dnzn/dxkit-web3` and a contract-interface reference covering `html()`, `source()`, `version()`, `keccak()`, and `resolveMode()`.
  2. README and getting-started present bundler/webserver, IIFE/static/IPFS, and on-chain as three co-equal targets, and the existing IIFE/IPFS + bundler docs are verified unaffected in accuracy and stature.
  3. `docs/security.md` documents the on-chain trust model: pin-before-execute, what trusting an RPC/provider actually buys, and the sandbox/CSP posture an ERC-8244 page runs under.
  4. Every phase that changed `src/` or `plugins/*/src/` has its `{phase_dir}/{padded_phase}-DOCS.md` ship-gate marker written with `status: current` and a `verified_against` SHA that no later source commit invalidates.

**Plans**: TBD

**Note**: DOC-03 is owned here, but the project's docs ship gate is per-phase and blocking: any phase touching `src/` or `plugins/*/src/` (Phases 13, 14, and possibly 15) must run `/gsd-docs-update` and write its own marker before `/gsd-ship` will push. This phase is the milestone-wide truth pass, not a substitute for those markers.

### Phase 17: Sepolia Deploy

**Goal**: DxKit 0.4.0 and the demo behave on a real public testnet exactly as they do on instant Anvil blocks.
**Depends on**: Phase 16 (deploys are the last thing that happens, against documented, verified code)
**Requirements**: NET-01
**Success Criteria** (what must be TRUE):

  1. DxKit 0.4.0 (facade + data contracts), `DemoShell`, and `DemoDocs` are deployed to Sepolia by the same chain-agnostic scripts used on Anvil, with addresses and keccaks recorded in the committed per-chain JSON.
  2. The facade contracts are Etherscan-verified on Sepolia.
  3. The demo loads end-to-end via the bootstrap in a real wallet browser against Sepolia — real latency and finality, no assumptions baked in against instant blocks.
  4. The same deployed facade renders through a third-party `web3://` gateway, with no DxKit-operated infrastructure involved.
  5. The pinned ERC-8244 spec SHA is re-checked and the result recorded *before* anything immutable is broadcast.

**Plans**: TBD

### Phase 18: Ethereum Mainnet Deploy

**Goal**: The milestone lands in production — DxKit 0.4.0 and the demo live on Ethereum L1, at addresses the docs name.
**Depends on**: Phase 17 (mainnet only after the identical artifacts are proven on a public testnet)
**Requirements**: NET-02
**Success Criteria** (what must be TRUE):

  1. The same artifacts deploy to Ethereum mainnet under a max-fee cap (~$1–2 budget at ~0.05 gwei); the script aborts above the cap rather than overspending.
  2. Mainnet addresses and keccaks are recorded in the committed per-chain JSON, and the facade contracts are Etherscan-verified.
  3. The demo is confirmed loading from mainnet via the bootstrap in a real wallet browser.
  4. README and docs carry the mainnet addresses, so a reader can reach the live demo without asking.

**Plans**: TBD

## Progress

**Execution Order:**
v1.2 phases execute in numeric order: 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18.
Phases 1–10 (v1.0, v1.1) are complete — detail in `milestones/v1.0-ROADMAP.md` and `milestones/v1.1-ROADMAP.md`.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 11. Foundry/Anvil Dev Loop & Spec Pin | v1.2 | 0/TBD | Not started | - |
| 12. On-Chain Publish Tooling & Facade Contracts | v1.2 | 0/TBD | Not started | - |
| 13. `web3://` Resolver & Loader Integration | v1.2 | 0/TBD | Not started | - |
| 14. Core Sandbox Hardening (additive) | v1.2 | 0/TBD | Not started | - |
| 15. Bootstrap Snippet & On-Chain Demo Dapp | v1.2 | 0/TBD | Not started | - |
| 16. Documentation — On-Chain Target | v1.2 | 0/TBD | Not started | - |
| 17. Sepolia Deploy | v1.2 | 0/TBD | Not started | - |
| 18. Ethereum Mainnet Deploy | v1.2 | 0/TBD | Not started | - |

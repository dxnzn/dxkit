# Feature Research

**Domain:** On-chain (ERC-8244 `html()`) dapp deployment for a headless dapp microframework
**Researched:** 2026-08-16
**Confidence:** MEDIUM

**Upfront caveat (read before the rest of this file):** exhaustive search (`eips.ethereum.org/all`
listing up to EIP #8330, `github.com/ethereum/ERCs` raw file lookup, `ethereum-magicians.org`
"Web" category, GitHub PR/issue search) turned up **no publicly indexed EIP/ERC numbered 8244** at
research time. It does not appear at `eips.ethereum.org/EIPS/eip-8244`,
`github.com/ethereum/ERCs/blob/master/ERCS/erc-8244.md`, or in any forum thread search. This does
not mean the milestone's premise is wrong — EIP numbers are assigned to draft PRs before they're
merged/indexed, and PROJECT.md's specific claims (`html()` interface, `data:`/`blob:`-only fetch
restriction) are plausible and consistent with the *closest real precedent*, ERC-4804/ERC-6860/
ERC-5219 (all real, all cited below) plus the 2018 informal proposal in
[ethereum/EIPs#1198 "A standard contracts to have for Self Contained HTML"](https://github.com/ethereum/EIPs/issues/1198)
(closed/stale, never became a numbered ERC, but establishes the `html()`-function-on-a-contract
idea has been circulating for 8 years). **Treat every claim below sourced only from ERC-4804/6860/
5219 or from working precedent (zFi/zSwap) as the load-bearing research** — anything specific to
"ERC-8244" as such is unverified pending the milestone owner's own source for that number. Flagged
inline as **[UNVERIFIED-8244]** wherever the distinction matters.

## Feature Landscape

### Table Stakes (Users Expect These)

Features a fully on-chain deployment target must have to be usable at all — without these, "on-chain
deployment" isn't real, it's a demo.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `web3://` URL resolution in loaders (`web3://addr:chainId/...`) | This is *the* access path browsers/gateways/wallets use to reach on-chain content today — [ERC-4804](https://eips.ethereum.org/EIPS/eip-4804) is finalized and live, [ERC-6860](https://eips.ethereum.org/EIPS/eip-6860) supersedes it with corrections. Any on-chain-aware tool speaks this URL scheme. | MEDIUM | DxKit's existing loader interface — `(src: string) => Promise` for script/style/template — is the exact seam to plug this into. No shell/lifecycle change needed for the resolver itself, only a new loader implementation (matches the `@dnzn/dxkit-web3` package plan in PROJECT.md). |
| `eth_call`-only asset fetching (no `fetch()`, no `<script src>`) | ERC-8244's context in PROJECT.md states network URL fetches are forbidden (only `data:`/`blob:`) — [UNVERIFIED-8244], but this is *also* independently true of ERC-4804/6860: a `web3://` URL is defined as a translation into an EVM call message (`To` + `Calldata`), not an HTTP fetch. Either way, the on-chain loader must go through an injected EIP-1193 provider (`window.ethereum`) or configured RPC, never the network stack. | MEDIUM | Directly aligned with DxKit's existing wallet plugin (EIP-1193 provider coordination) — the on-chain loader can reuse that provider-discovery pattern rather than inventing a new one. |
| Gzip compression + `DecompressionStream` gunzip | DxKit's own IIFE builds (~7 KB core, ~15 KB with all 4 plugins gzipped) sit close to the [EIP-170](https://eips.ethereum.org/EIPS/eip-170) 24,576-byte-per-contract limit uncompressed; gzip is the difference between "fits in one data contract" and "needs chunking". [`DecompressionStream`](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream) is a native browser API (Baseline widely available), no runtime dependency needed. | LOW–MEDIUM | Zero-runtime-dep constraint is satisfiable — `DecompressionStream('gzip')` ships in every current browser engine. No polyfill required for supported targets. |
| Data-contract chunking for payloads over ~24 KB | EIP-170's 24,576-byte contract code size limit is a hard EVM constraint, not a convention. Any payload larger than that (a whole framework + plugins + demo dapp bundled together, uncompressed HTML+CSS+JS) must be split across multiple contracts and reassembled at read time. | MEDIUM–HIGH | zFi/zSwap's real-world precedent: 6 data contracts of ~21 KB each, reassembled in `html()` via `EXTCODECOPY` and ABI-encoded into one string response (see zFi section below). This is the concrete pattern to follow, not SSTORE2 alone (SSTORE2 is for arbitrary key-value; zFi's variant stores the payload itself as *runtime bytecode*, cheaper than `SSTORE` and cheaper to read via `EXTCODECOPY` than multiple `SLOAD`s). |
| Versioned, immutable facade contract per package version | Contracts are immutable; there is no "publish over" step like npm. Every DxKit release that goes on-chain needs its own contract address; consumers pin to a specific version by pinning to a specific address. | MEDIUM | Directly matches PROJECT.md's plan ("versioned, immutable facade contract per package/version"). No registry is *required* for this to work — the zFi precedent below uses raw contract addresses as the only "version pointer," no on-chain semver registry exists in practice yet. |
| `web3://` resolution-mode advertisement for gateway compatibility | For DxKit-hosted contracts to be reachable through third-party `web3://` gateways (not just DxKit's own resolver), the contract should implement (or advertise) [ERC-5219 "Contract Resource Requests"](https://eips.ethereum.org/EIPS/eip-5219) or ERC-4804's "manual" resolve mode, so gateways like EthStorage's [`web3url-gateway`](https://github.com/ethstorage/web3url-gateway) or `w3link` (`https://<address>.1.w3link.io/`) can serve it over plain HTTPS to a normal browser. | MEDIUM | This is the escape hatch for "preview an `html()` contract in a normal browser" — a real gateway already does this; DxKit doesn't need to build one (see Anti-Features). |
| Local Anvil dev loop (build → publish → load in browser) | Already scoped in PROJECT.md/REQUIREMENTS as the milestone's first phase — flagged here because every real precedent found (zFi, general SSTORE2 usage) assumes Foundry-style local iteration before any real deploy; there is no lighter-weight convention in the ecosystem. | MEDIUM | Standard Foundry/Anvil pattern — no exotic tooling found that beats it. |
| Bootstrap `html()` snippet that chain-loads the framework | This is the entire value proposition of DxKit as a *third* target rather than "yet another one-off on-chain dapp." Every real on-chain dapp found (zSwap) is a **monolithic single-contract app** — none of them chain-load a *separate, reusable, versioned UI framework* from a second contract. DxKit doing this is the differentiator (see below), but the bootstrap snippet itself — a minimal `html()` that does one `eth_call` to fetch DxKit's `source()`/`html()` and re-executes it — is table stakes for the pattern to work at all. | LOW (once the resolver exists) | ~1 KB target cited in PROJECT.md is realistic — it only needs to invoke the injected provider, decode, decompress, and `document.write`/inject. |

### Differentiators (Competitive Advantage)

Nothing in the researched ecosystem does these today — they are genuinely novel for DxKit, not
"catching up" to an existing convention.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Chain-loading a *separate, versioned, reusable* framework contract from a dapp's own `html()` | Every working "fully on-chain" precedent found — [zFi / zSwap ("the first onchain superdapp")](https://github.com/z-fi/zFi) — bundles its *entire* UI as one self-contained payload across its own 6 data contracts. None of them factor out a shared, independently-versioned framework that multiple dapp contracts `eth_call` into. DxKit doing this means N on-chain dapps don't each have to re-embed a copy of the routing/lifecycle/event-bus/plugin code — genuinely reduces the on-chain footprint per dapp and gives a real "install a dependency" story on-chain. | HIGH | No established convention to follow here — this is where DxKit is inventing the pattern, not adopting one. Budget real design/spike time; the "second `eth_call` hop, decode, decompress, re-execute" bootstrap has no precedent to copy from. |
| One manifest schema across all three deployment targets (bundler / IIFE-static / on-chain) | `DappManifest.entry`/`template`/`styles`/`dependencies` already accept plain string paths; extending those same fields to accept `web3://` URLs (vs. adding a separate `source: 'erc8244'` field or a parallel manifest shape) means a dapp author writes one manifest and it works everywhere. No other framework or on-chain-dapp project found treats "deployment target" as a resolvable URL scheme choice on an otherwise-unchanged manifest — they're single-target by construction (zSwap is *only* on-chain; a typical dapp is *only* bundler-built). | MEDIUM | Precedent for the *URL-scheme-as-loader-selector* pattern exists (`ipfs://`, `ar://`, and now `web3://`/`w3://` all being URL schemes that different loaders dispatch on) — that part isn't novel. What's novel is applying it inside a manifest whose other fields (route, nav, settings, requires) stay identical across targets. |
| Sandbox hardening for componentized/routable on-chain dapps (inline style/script re-execution, full-document `html()` → fragment injection, hash-mode routing under `srcdoc`/opaque origins) | Every real on-chain dapp found is a **single static page**, not a router with multiple mountable sub-apps. DxKit bringing its existing lifecycle (mount/unmount, sub-path routing, template injection) into an on-chain, sandboxed context is new ground — no on-chain dapp today has "pages" in the DxKit sense. | HIGH | This is squarely research/spike territory; `srcdoc`/sandboxed-iframe same-origin quirks (relative URLs resolve against the parent's base URL, not `about:srcdoc`) are a known browser-spec gotcha worth a dedicated spike, not just an implementation task. |
| Keccak-pinned version integrity for `eth_call`-sourced assets | IPFS gets integrity "for free" via content-addressing (the CID *is* the hash). Plain `eth_call` to a mutable-address-but-immutable-bytecode contract has no equivalent unless the *consumer* pins and verifies a hash. DxKit's resolver doing this pin-verification is closing a gap IPFS/bundler targets don't have. | MEDIUM | No competing tool found that does this for `web3://` loads — an opportunity, and also a real gap DxKit would otherwise silently have (a compromised/rugged RPC or malicious `eth_call` response is otherwise unguarded). |
| Local preview/dev-server proxy for viewing an `html()` contract in a normal, non-onchain-aware browser | Third-party `web3://` gateways (EthStorage's `web3url-gateway`, `w3link`) already solve this for *deployed* contracts, but there's no lightweight local-Anvil-to-normal-browser bridge found in the researched ecosystem — every reference either assumes a real chain deploy behind a public gateway, or a browser/wallet with native `web3://` support. A `make preview`-style local proxy that does the `eth_call` → decode → serve-over-HTTP loop against Anvil would be new. | MEDIUM | Flagged as a genuine gap in the ecosystem, not just an opportunity — no tool found fills this for local iteration. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Building a custom on-chain-aware browser or wallet integration | "Users need a way to actually view these dapps" | Duplicates work already underway — [Freedom Browser](https://github.com/solardev-xyz/freedom-browser) (Swarm/IPFS/ENS as first-class protocols) and other dapp browsers/wallet in-app browsers already own this problem; building a competing browser is a multi-year effort orthogonal to DxKit's job as a framework. **Note:** whether Freedom's read-only preview mode injects an EIP-1193 provider (needed for DxKit's `eth_call`-based chain-loading) is unconfirmed by this research — PROJECT.md already correctly scopes this as a spike question, not a blocker. | Target the injected-provider contract (any EIP-1193 wallet/browser) and the existing third-party `web3://` gateways for HTTP-style access; don't build browser infrastructure. |
| Building a custom `web3://` gateway server | "We need our own hosted way to preview/share on-chain dapps over HTTPS" | EthStorage already ships and maintains a reference implementation ([`ethstorage/web3url-gateway`](https://github.com/ethstorage/web3url-gateway)) and a hosted instance (`w3link`) that any ERC-4804/5219-compliant contract works with for free. Building a parallel gateway is infrastructure DxKit would then have to operate and secure. | Make DxKit-hosted contracts ERC-5219/4804-compliant (resolution-mode advertisement, table stakes above) so they "just work" on existing public gateways; own only the local-dev-loop preview tool (a differentiator, not a hosted service). |
| Storing large binary assets (images/video/fonts) fully on-chain | "If the framework is fully on-chain, why not the assets too?" | Gas-cost-prohibitive at scale — even at the ~$1 gas-cost figure PROJECT.md cites for the ~15 KB gzipped DxKit + demo, that math does not extend to megabyte-scale media; EIP-170's 24,576-byte-per-contract limit means large media needs dozens/hundreds of chunked contracts, each a separate deploy transaction. | Keep DxKit's on-chain story scoped to code/HTML/CSS/text (where it already fits in one or a handful of data contracts); point dapp authors at `data:` URIs for genuinely small inline assets and accept that heavy media stays off-chain (IPFS/Arweave) even for an "on-chain" dapp — this doesn't violate ERC-8244's `data:`/`blob:`-only constraint [UNVERIFIED-8244] since those are still same-document, not network fetches. |
| A required on-chain registry/discovery contract or mandatory ENS naming scheme for versions | "How will anyone find the right DxKit version to chain-load without a registry?" | No working precedent uses one — zFi/zSwap's *only* discovery mechanism is the raw contract address itself; no ENS records, no registry contract, no on-chain semver index. Building a mandatory registry is speculative infrastructure with no consumer demand signal from the one real analog project found. | Ship version-pinned, immutable facade contracts and let consumers hardcode the address they've verified (matches PROJECT.md's own "ENS names for discovery are optional sugar" framing) — a registry stays a genuinely optional add-on, not gating the milestone. |
| A generic `fetch()`/network escape hatch "for when `eth_call` isn't enough" | "Some assets are too big / some dapps need external APIs" | Directly violates the on-chain target's core trust property — everything the page renders should be derivable from chain state reachable via the injected provider. A network escape hatch reintroduces exactly the centralized-hosting dependency this whole target exists to remove, and (per PROJECT.md) may violate ERC-8244's forbidden-network-fetch rule outright [UNVERIFIED-8244]. | If a dapp genuinely needs external data, that's an application-level wallet/provider-mediated call (e.g., an oracle contract via `eth_call`) — not a raw `fetch()` bypassing the sandbox model. |

## Feature Dependencies

```
web3:// resolver loaders (script/style/template)
    └──requires──> existing pluggable loader interface (src: string) => Promise  [ALREADY SHIPPED]
    └──requires──> EIP-1193 provider discovery (window.ethereum / configured RPC)
                       └──enhances-from──> existing wallet plugin's provider-coordination pattern

Data-contract chunking + versioned facade (html()/source())
    └──requires──> Foundry/Anvil local dev loop (build → deploy → verify)
    └──enhances──> gzip compression (reduces chunk count, may collapse multi-contract → single-contract)

Chain-loading DxKit from a second contract (the framework-as-dependency pattern)
    └──requires──> web3:// resolver loaders
    └──requires──> versioned, immutable facade contract per package/version
    └──requires──> keccak pin verification (integrity, since eth_call has no CID-equivalent)

Bootstrap html() snippet (dapp author's own contract)
    └──requires──> chain-loading DxKit from a second contract
    └──requires──> core sandbox hardening (inline script/style re-execution under srcdoc/full-document html())

Core sandbox hardening (entry optional, full-document → fragment injection, hash-mode under srcdoc)
    └──enhances──> existing lifecycle manager (ordered asset loading, template sanitizer hook)
    └──conflicts-if-untested-with──> existing IIFE/static and bundler targets — PROJECT.md explicitly
        requires none of the three targets regress; sandbox changes must be additive-only

web3:// resolution-mode advertisement (ERC-5219/4804 compliance)
    └──enables──> third-party gateway preview (w3link, web3url-gateway) without DxKit building its own gateway

Local preview/dev-server proxy (differentiator)
    └──requires──> web3:// resolver loaders (reuses the same eth_call → decode → decompress pipeline, inverted)
    └──enhances──> Local Anvil dev loop (turns "load in a browser" from a manual step into a served preview)
```

### Dependency Notes

- **Chain-loading DxKit as a separate framework contract requires versioned, immutable facades AND
  keccak pinning together, not either alone:** immutability without pin verification means a dapp
  author's bootstrap snippet trusts whatever bytecode currently lives at a hardcoded address (fine,
  since contracts are immutable — but only if the *dapp author* verified the address once). Pin
  verification adds defense if the resolver itself is configured with an untrusted or attacker-
  supplied address at runtime (e.g., a manifest sourced from somewhere less trusted than the dapp's
  own hardcoded bootstrap).
- **Core sandbox hardening conflicts-if-untested-with the other two targets:** any change to the
  lifecycle manager's template/script injection path (needed for full-document `html()` → fragment
  extraction) touches the same code path bundler and IIFE/static dapps already rely on. This is
  exactly the kind of change PROJECT.md flags as needing "no other milestone may regress" — treat it
  as the highest-regression-risk item in the feature set and gate it behind the existing test suite
  (321+ specs) before adding on-chain-specific tests.
- **web3:// resolution-mode advertisement enhances (not requires) the local preview tool:** they
  solve the same "view this in a normal browser" problem via different means (a public gateway vs. a
  local proxy) and are complementary — ship the local proxy for dev-loop speed, ship ERC-5219/4804
  compliance for post-deploy shareability. Neither blocks the other.
- **Bootstrap snippet requires sandbox hardening, not just the resolver:** a naive bootstrap that
  fetches DxKit's `source()`/`html()` and `document.write()`s it into an `about:srcdoc` iframe will
  hit the exact browser quirk found in research — `srcdoc` documents resolve relative URLs against
  the *parent* page's base URL, not their own — which breaks hash-mode routing and relative asset
  paths unless the lifecycle/router code accounts for it. This is a concrete, citable browser-spec
  gotcha (see [whatwg/html#8105](https://github.com/whatwg/html/issues/8105) and
  [MDN: `HTMLIFrameElement.srcdoc`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/srcdoc)),
  not a hypothetical risk.

## MVP Definition

### Launch With (v1 — this milestone, v0.4)

Minimum viable product to prove "DxKit dapp lives entirely on Ethereum L1, chain-loading DxKit
from a separate contract" is real, not aspirational.

- [ ] `web3://` resolver loaders (script/style/template) via `eth_call` through an injected
  EIP-1193 provider — essential, nothing else in this feature set functions without it
- [ ] Local Anvil dev loop: build → gzip/chunk → deploy DxKit + a dapp → load in browser — essential
  as the fast-iteration substrate; every other on-chain feature is validated against it first
- [ ] Data-contract chunking + versioned, immutable facade `html()`/`source()` (SSTORE2-style /
  `EXTCODECOPY`-pattern per zFi precedent) — essential; without this, DxKit itself can't be
  published as the thing dapps chain-load
- [ ] Bootstrap `html()` snippet + one real demo dapp, chain-loading DxKit from a separate contract
  — essential as the proof of the core value prop (third co-equal target, not a stunt)
- [ ] Core sandbox hardening scoped to exactly what the bootstrap/demo needs (inline script/style
  re-execution, `entry` optional when template is on-chain) — essential but should be scoped
  narrowly to what the demo actually exercises, not built speculatively broad

### Add After Validation (v1.x — still this milestone's later phases, per PROJECT.md)

- [ ] Sepolia deploy of DxKit 0.4.0 + demo — trigger: local Anvil loop and demo are proven
- [ ] Ethereum mainnet deploy — trigger: Sepolia deploy validates gas/size assumptions hold on a
  real network
- [ ] Keccak pin verification in the resolver — trigger: the bootstrap/demo path works unverified
  first; add integrity-checking once the happy path is proven, per PROJECT.md's "additive, no
  regression" framing
- [ ] `web3://` resolution-mode advertisement (ERC-5219/4804 compliance) for third-party gateway
  compatibility — trigger: once contracts are deployed to a real network worth previewing via
  `w3link`/`web3url-gateway`

### Future Consideration (v2+ — explicitly out of this milestone's scope)

- [ ] Local preview/dev-server proxy tool — defer: real gap, genuinely useful, but not required to
  prove the core "chain-load a shared framework" value prop; PROJECT.md's own "Next Milestone
  Goals" doesn't list it, and it's additive DX tooling that doesn't block the mainnet deploy
- [ ] ENS-name discovery for DxKit versions — defer: PROJECT.md explicitly calls this "optional
  sugar," and no working precedent (zFi/zSwap) uses ENS-based discovery at all
- [ ] L2 deploys (Base, etc.) — defer: PROJECT.md lists this as a *next-milestone* candidate,
  contingent on v0.4 landing first
- [ ] Freedom-browser-specific integration — defer: blocked on an open question (does its preview
  mode inject an EIP-1193 provider?) that PROJECT.md correctly scopes as a spike, not a commitment

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| `web3://` resolver loaders | HIGH | MEDIUM | P1 |
| Local Anvil dev loop | HIGH | MEDIUM | P1 |
| Data-contract chunking + versioned facade | HIGH | HIGH | P1 |
| Bootstrap snippet + demo dapp chain-loading DxKit | HIGH | MEDIUM | P1 |
| Core sandbox hardening (scoped to demo needs) | HIGH | HIGH | P1 |
| Sepolia → mainnet deploy | HIGH | LOW (once above lands) | P1 |
| Keccak pin verification | MEDIUM | MEDIUM | P2 |
| ERC-5219/4804 gateway-compliance advertisement | MEDIUM | MEDIUM | P2 |
| Local preview/dev-server proxy | MEDIUM | MEDIUM | P3 |
| ENS-based version discovery | LOW | MEDIUM | P3 |
| L2 deploys | MEDIUM | LOW (reuses tooling) | P3 |

**Priority key:**
- P1: Must have for this milestone to be considered shipped
- P2: Should have, strengthens the milestone but doesn't block the mainnet-deploy goal
- P3: Nice to have, explicitly deferred by PROJECT.md itself

## Competitor / Precedent Feature Analysis

"Competitors" here means the small set of real, working "fully on-chain frontend" projects found —
there is no direct competitor to DxKit itself (a *reusable, chain-loadable, multi-target framework*),
only single-purpose monolithic on-chain apps.

| Feature | zFi / zSwap (z-fi) | Freedom Browser | DxKit's Planned Approach |
|---------|---------------------|------------------|---------------------------|
| Payload storage | 6 data contracts, ~21 KB each, stored as **runtime bytecode**, reassembled via `EXTCODECOPY` in `html()` | N/A (a browser/client, not a hosted dapp) | Same pattern (data-contract chunking), per PROJECT.md's "SSTORE2-style data contracts + versioned facade" — validated as the right precedent by this research |
| Shared/reusable framework across dapps | None — the entire UI (routing, orderbook logic, rendering) is bundled into one app's own contracts | N/A | **Differentiator** — DxKit is chain-loaded by the *dapp's* `html()` as a separate, versioned dependency; no precedent project does this |
| Discovery / versioning | Raw contract address only; no ENS, no registry, no semver | N/A | Matches — PROJECT.md scopes ENS as "optional sugar," consistent with the only working precedent found |
| Gateway/browser access path | ERC-5219 resource-serving + ERC-4804 `"5219"` resolve mode; served via `w3link` HTTP gateway or native `web3://`-aware wallets; also raw `cast call` | First-class `bzz:`/`ipfs:`/`ipns:` protocol handlers (per its README); ENS resolution; unconfirmed EIP-1193 injection for on-chain-`eth_call` content | DxKit's resolver targets the same `eth_call`-via-injected-provider path as the primary mechanism; gateway compliance (ERC-5219/4804 advertisement) planned as a P2 add-on for HTTP-gateway compatibility |
| Compression | Not confirmed by this research (zFi's README emphasizes the `EXTCODECOPY` cost story, not compression specifics) | N/A | Gzip + `DecompressionStream` — a reasonable inference given DxKit's own build sizes and EIP-170's byte limit, not directly copied from a precedent since none was found addressing compression explicitly |
| Routing / multi-page composition | None — zSwap is effectively a single-page app with internal view state, not a router with mountable sub-dapps | N/A | DxKit's existing router (hash/history, longest-prefix) extended for on-chain contexts — genuinely novel territory, no precedent to validate against |

## Sources

**Official / finalized standards (HIGH confidence):**
- [ERC-4804: Web3 URL to EVM Call Message Translation](https://eips.ethereum.org/EIPS/eip-4804) (finalized)
- [ERC-6860: Web3 URL to EVM Call Message Translation](https://eips.ethereum.org/EIPS/eip-6860) (supersedes/corrects ERC-4804)
- [ERC-5219: Contract Resource Requests](https://eips.ethereum.org/EIPS/eip-5219)
- [EIP-170: Contract code size limit](https://eips.ethereum.org/EIPS/eip-170)

**Working precedent repos (MEDIUM–HIGH confidence, primary source, unaudited claims taken from
project README/docs via fetch, not independently verified against deployed bytecode):**
- [z-fi/zFi — "the first onchain superdapp" (zSwap)](https://github.com/z-fi/zFi) — 6-chunk
  `EXTCODECOPY` data-contract pattern, ERC-5219/4804 compliance, `w3link` gateway access, no
  ENS/registry discovery
- [solardev-xyz/freedom-browser](https://github.com/solardev-xyz/freedom-browser) — decentralized-web
  browser with Swarm/IPFS/ENS as first-class protocols; EIP-1193 provider injection for on-chain
  `eth_call` content unconfirmed by this research
- [0xsequence/sstore2](https://github.com/0xsequence/sstore2) — the canonical SSTORE2 gas-optimization
  pattern (code-as-storage, `EXTCODECOPY` reads) that PROJECT.md references and zFi's variant builds on
- [ethstorage/web3url-gateway](https://github.com/ethstorage/web3url-gateway) — reference `web3://`
  HTTP gateway implementation (also referenced as `w3link`)

**Historical / informal precedent (LOW confidence — never became a numbered standard):**
- [ethereum/EIPs#1198 "A standard contracts to have for Self Contained HTML"](https://github.com/ethereum/EIPs/issues/1198)
  (2018, closed/stale) — earliest found articulation of an `html()`-function-on-a-contract convention;
  useful as historical context for how long this idea has circulated, not as a spec to implement against

**Platform/browser API references (HIGH confidence):**
- [MDN: `DecompressionStream`](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream)
- [MDN: `HTMLIFrameElement.srcdoc`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/srcdoc)
- [whatwg/html#8105 — sandboxed `srcdoc` inherits parent's base URL](https://github.com/whatwg/html/issues/8105)

**Explicitly could not verify (flagged, not cited as fact):**
- "ERC-8244" as a numbered, published standard — not found at `eips.ethereum.org`,
  `github.com/ethereum/ERCs`, or via forum/GitHub search at research time. All claims in
  PROJECT.md specific to ERC-8244 (the `data:`/`blob:`-only fetch restriction, the exact `html()`
  interface) should be treated as coming from the milestone owner's own source, not from research
  independently corroborating a public ERC-8244 spec text.

---
*Feature research for: On-chain (ERC-8244) deployment target for DxKit v0.4*
*Researched: 2026-08-16*

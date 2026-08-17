# Architecture Research: On-Chain Deployment (ERC-8244) Integration

**Domain:** Adding a third co-equal deployment target (fully on-chain, ERC-8244 `html()`) to an
existing zero-runtime-dep TypeScript microframework (DxKit) without regressing the other two
targets (bundler/webserver, IIFE/static/IPFS).
**Researched:** 2026-08-16
**Confidence:** MEDIUM-HIGH — every claim about DxKit's existing code is grounded in the actual
source (file:line cited throughout) and is HIGH confidence. Claims about the surrounding Web3
ecosystem (SSTORE2 via solady, `DecompressionStream` gzip support, EIP-170's 24,576-byte limit,
`srcdoc`/sandbox same-origin behavior) were independently web-verified and are HIGH confidence.
**One explicit gap:** the ERC-8244 spec text itself was not independently locatable via public
search at research time (it does not appear indexed on eips.ethereum.org or the ethereum/ERCs
GitHub repo as of 2026-08-16 — searches for "ERC-8244" returned only the unrelated ERC-8004
"Trustless Agents" standard). This document treats the milestone brief's own working definition
of ERC-8244 as authoritative (an `html()` view function returning a string; no `fetch()`/network
`<script src>`/`<link href>` to non-`data:`/`blob:` URLs permitted in the served page) and flags
every place that definition drives a design decision. **Recommend the first phase includes a
spike to pin down the actual ERC-8244 text** (or confirm it's a draft/unpublished number specific
to this project) before the contract interface is locked as "immutable."

---

## Standard Architecture

### System Overview — three co-equal deployment targets

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         DxKit Deployment Targets (co-equal, none privileged)   │
├─────────────────────────────┬─────────────────────────────┬───────────────────┤
│ 1. Bundler / webserver       │ 2. IIFE / static / IPFS      │ 3. On-chain        │
│    (existing)                │    (existing)                │    (NEW, v1.2)     │
│ ESM/CJS import into a         │ <script> tag, no bundler,    │ eth_call-driven    │
│ bundled app; fetch() for      │ fetch() for assets, served   │ bootstrap; NO      │
│ manifests/templates           │ from any static host/IPFS    │ fetch() permitted  │
└─────────────────────────────┴─────────────────────────────┴───────────────────┘
                                                                        │
                                                                        ▼ (zoom in)
┌────────────────────────────────────────────────────────────────────────────────┐
│                      On-Chain Deployment (Target 3) — Browser Side              │
│                                                                                  │
│  Browser tab — top-level document IS the chain-served page (opaque/data:/blob: │
│  origin; no fetch()/XHR to network URLs permitted)                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Demo Dapp Contract .html()  →  rendered directly as the page            │   │
│  │   <div id="dx-mount"></div>                                             │   │
│  │   <script> ~1KB inline bootstrap snippet </script>                      │   │
│  └───────────────────────────────┬────────────────────────────────────────┘   │
│                                   │ window.ethereum.request({method:'eth_call'})│
│                                   ▼                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │            @dnzn/dxkit-web3  (NEW package — createWeb3Loaders)          │   │
│  │  parse web3://<addr>[:chainId]/<method> → eth_call → ABI-decode string  │   │
│  │  → DecompressionStream('gzip') → keccak256 pin-verify → blob: URL       │   │
│  └───────────────────────────────┬────────────────────────────────────────┘   │
│                                   │ plugged in as ShellConfig.lifecycle        │
│                                   │ {scriptLoader, styleLoader, templateLoader}│
│                                   ▼ (existing seam, unmodified signatures)      │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │        @dnzn/dxkit core — createShell()/createLifecycleManager()        │   │
│  │        (two small additive changes — see Integration Points)           │   │
│  └───────────────────────────────┬────────────────────────────────────────┘   │
└──────────────────────────────────┼────────────────────────────────────────────┘
                                    │ eth_call (JSON-RPC via injected provider,
                                    │ NOT a network fetch — a JS API call)
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                    Ethereum L1 (or Anvil / Sepolia during dev)                  │
│                                                                                  │
│   DxKitFacade_v0.4.0                        DemoDappFacade                     │
│   .html() / .source() / .version() /        .html() / .source() / .keccak()    │
│   .keccak()  — immutable, one per version                                      │
│        │                                          │                            │
│        ▼                                          ▼                            │
│   SSTORE2 data contract(s)                   SSTORE2 data contract(s)          │
│   gzip chunk(s) ≤ 24,576 B (EIP-170)          gzip chunk(s) ≤ 24,576 B          │
└────────────────────────────────────────────────────────────────────────────────┘
```

Both other targets (1 and 2) are completely unaffected by this diagram — they never touch
`dxkit-web3`, `contracts/`, or `eth_call`. The only shared surface is DxKit core, and the changes
to core are two small, additive, off-by-default items (see below).

### Component Responsibilities

| Component | New/Modified | Responsibility | File(s) |
|-----------|--------------|-----------------|---------|
| `contracts/` (Foundry workspace) | **NEW** | SSTORE2 data contracts + versioned immutable facade contracts (DxKit + demo dapp), chain-parameterized deploy scripts, forge tests | `contracts/src/`, `contracts/script/`, `contracts/test/` |
| Publish pipeline | **NEW** | `make build` output → gzip → chunk (≤24,576 B) → `forge script` deploy → per-chain address JSON → `web3://` manifest emission | `scripts/publish-onchain.*`, new `Makefile` targets |
| `@dnzn/dxkit-web3` | **NEW package** | `web3://` URL parsing, `eth_call` transport (provider or rpcUrl), ABI decode, native gunzip, keccak pin verification, `createWeb3Loaders()` factory producing `{templateLoader, scriptLoader, styleLoader}` | `plugins/web3/src/index.ts` (new, follows the existing plugin-package layout) |
| Bootstrap `html()` snippet | **NEW (docs/example asset)** | ~1KB inline script embedded in every on-chain dapp's `html()`: `eth_call` the DxKit facade, verify, gunzip, inject, `createShell()` | `docs/cookbook.md` recipe + `examples/onchain-demo/` |
| Demo dapp contract + source | **NEW** | Real dapp (wallet + theme) proving the whole pipeline, deployed as its own contract(s) | `contracts/src/DemoDapp.sol`, `examples/onchain-demo/` |
| Dev gateway / harness page | **NEW** | Local preview of an on-chain dapp in a normal browser against Anvil, without needing a real `web3://`-aware browser | `contracts/dev/`, `Makefile` target |
| `src/types/manifest.ts` | **MODIFIED (additive)** | `entry` becomes optional | manifest.ts:17 |
| `src/shell.ts` | **MODIFIED (additive)** | `isValidManifest()` loosened to match; `entry`-load step guarded | shell.ts:211-221 |
| `src/lifecycle.ts` | **MODIFIED (additive)** | `mount()` skips the entry-load step when `manifest.entry` is absent; new opt-in `executeInlineScripts` hook re-executes `<script>` tags after template injection | lifecycle.ts:428-442, 397-401 |
| `src/router.ts`, `src/events.ts`, `src/registry.ts` | **UNCHANGED** | No on-chain-specific behavior needed — see Integration Points | — |
| `plugins/wallet`, `plugins/theme`, `plugins/settings` | **UNCHANGED** | Already storage-fail-soft (v1.0 Phase 3); wallet already reads the same `window.ethereum` global `dxkit-web3` uses | — |

---

## New vs. Modified Components (explicit)

**Entirely new, zero coupling to core internals beyond the public loader/manifest surface:**
- `contracts/` Foundry workspace (SSTORE2 data contracts + facade contracts + deploy scripts)
- Publish pipeline scripts + `Makefile` targets
- `@dnzn/dxkit-web3` package
- Bootstrap snippet, demo dapp contract + source, dev harness

**Modified in core (both additive, both off-by-default, both non-breaking):**
1. `DappManifest.entry: string` → `entry?: string` (`src/types/manifest.ts:17`), with the
   corresponding validation and mount-step changes in `src/shell.ts` and `src/lifecycle.ts`.
2. A new opt-in `LifecycleManagerOptions.executeInlineScripts` (or similarly named) flag in
   `src/lifecycle.ts`, defaulting to `false`/unset — restores today's `container.innerHTML = html`
   behavior exactly when unset.

**Provably unaffected — bundler/webserver and IIFE/static/IPFS targets:**
- `entry` optional is a *relaxation* of `isValidManifest()` (`src/shell.ts:212-221`): every
  manifest that validated before (all of which have `entry` set) still validates identically.
  No existing manifest becomes invalid; only a previously-rejected shape (no `entry`, but a
  self-contained `template`) now becomes accepted. This can only ever *add* manifests that pass,
  never remove ones that used to pass.
- `executeInlineScripts` is unset by default for every existing consumer — `container.innerHTML =
  html` (or the sanitized variant) is byte-for-byte the same code path as today
  (`src/lifecycle.ts:397,399`) when the flag is absent.
- `defaultScriptLoader`/`defaultStyleLoader`/`defaultTemplateLoader` (`src/lifecycle.ts:112-250`)
  are untouched — the on-chain path only ever *supplies a custom loader* through the existing
  `ShellConfig.lifecycle.{scriptLoader,styleLoader,templateLoader}` seam (`src/types/shell.ts:33`),
  which was built in v1.0 Phase 3 precisely to be pluggable.
- `dxkit-web3` is a standalone package with `@dnzn/dxkit` as an external peer/type-only import,
  identical in structure to `plugins/wallet` — it cannot regress core because it never edits
  core's source, only calls its public factory functions.

---

## Integration Points (grounded in source)

| Seam | Existing contract (file:line) | On-chain usage |
|------|-------------------------------|-----------------|
| `ScriptLoader` type | `src/lifecycle.ts:29` — `(src: string) => Promise<void>` | `dxkit-web3`'s script loader resolves a `web3://addr[:chainId]/source` URI via `eth_call`, gunzips, creates a `blob:` URL, and passes that blob URL as `src`. **Zero signature change** — the type already accepts any string. |
| `StyleLoader` type | `src/lifecycle.ts:30` | Same blob-URL-bridging pattern; `<link rel=stylesheet href="blob:...">` (`defaultStyleLoader`, `src/lifecycle.ts:152-190`) is unmodified and happily accepts a `blob:` href. |
| `TemplateLoader` type | `src/lifecycle.ts:31` — `(src: string) => Promise<string>` | `dxkit-web3`'s template loader resolves `web3://.../html`, and **returns a fragment string** (see the iframe-vs-fragment section below) that `mount()` still writes with `container.innerHTML = ...` (`src/lifecycle.ts:397,399`) exactly as it does today. |
| `ShellConfig.lifecycle` | `src/types/shell.ts:33`, wired at `src/shell.ts:49-54` | The bootstrap snippet's *only* shell-config touchpoint: `DxKit.createShell({ mode: 'hash', manifests: [...], lifecycle: DxWeb3.createWeb3Loaders({ provider: window.ethereum }) })`. No new `ShellConfig` fields required. |
| `DappManifest.entry`/`template`/`styles`/`dependencies` | `src/types/manifest.ts:17,19,21,23` — all plain `string`/`string[]` | Manifest authors put `web3://` URI strings directly in these existing fields. **Schema is unchanged** except `entry` becoming optional. |
| `DappManifest.entry` required → optional | `src/types/manifest.ts:17`; `src/shell.ts:212-221 isValidManifest()` | **Modified.** A self-contained `html()` dapp whose template already embeds its own `<script>` logic has no separate entry contract to point to. |
| `mount()` entry-load gate | `src/lifecycle.ts:428-442` — unconditional `await loadScript(manifest.entry)` | **Modified.** Must become `if (manifest.entry) { await loadScript(manifest.entry); ... }` — skipped entirely when absent. |
| Inline-`<script>` re-execution after template injection | `src/lifecycle.ts:397,399` — `container.innerHTML = ...` | **New additive hook.** Only `mount()` has a reference to `container` after injection — a `TemplateLoader` only returns a string (`src/lifecycle.ts:31`), so it structurally *cannot* re-execute scripts itself. This is why the fix must land in core, not in `dxkit-web3` alone. |
| Wallet provider access | `plugins/wallet/src/index.ts:23-25` — `getEthereumProvider() { return (window as any).ethereum; }` | **Unmodified, directly reused.** The bootstrap snippet talks to `window.ethereum` *before* any DxKit plugin exists (chicken-and-egg: DxKit itself is being loaded via `eth_call`), so `dxkit-web3` calls the same global directly. Once `createShell()` runs, an optional `wallet` plugin can be registered as usual and will resolve the identical global — no conflict, no bridging needed. |
| Storage graceful degradation | `plugins/wallet/src/index.ts` (`canUseStorage`), `plugins/theme/src/index.ts:60-91`, `plugins/settings/src/index.ts:41-81` | **Already covers this — zero new code.** All three storage-touching plugins already wrap every `localStorage` access in `canUseStorage()` + try/catch that emits `dx:error` on failure and continues in-memory. A sandboxed/opaque origin where `localStorage` throws a `SecurityError` is already handled by v1.0 Phase 3 hardening. |
| `dx:error` surfacing for custom-loader failures | `src/lifecycle.ts:336-350` (styles), `356-366` (template), `404-419` (dependency), `429-442` (entry) | **Already covers this.** Every loader call is already wrapped in try/catch that emits `dx:error` with source `lifecycle:<id>:<step>`. A `dxkit-web3` loader that throws `new Error('[web3:no-provider] window.ethereum not found', { cause: ... })` surfaces through the *existing* taxonomy for free. Recommend a documented message-prefix convention (`[web3:no-provider]`, `[web3:revert]`, `[web3:keccak-mismatch]`, `[web3:gunzip]`) rather than a new `dx:error` source field — keeps the change entirely inside `dxkit-web3`, not core. |
| Routing mode under opaque origin | `src/router.ts` (history vs hash), documented in `docs/system-internals.md:176-188` | **No core change required, but a real constraint.** `history.pushState()` throws under a `data:`/opaque-origin document; only `mode: 'hash'` works. This is a *configuration* requirement on the bootstrap snippet (`createShell({ mode: 'hash' })`), not a code change — document it prominently. (A defensive `try/catch` around `pushState` that turns a `SecurityError` into a `dx:error` instead of an uncaught exception is a **nice-to-have polish item**, not required for the MVP build order below.) |

---

## Data Flow: `make build` → contracts → browser

```
1. make build (UNCHANGED)
   dist/index.global.js (core IIFE, ~7.0 KB gzip)
   plugins/*/dist/index.global.js (wallet/theme/settings/auth IIFE, 1.1-2.6 KB gzip each)

2. make chain-publish CHAIN=anvil|sepolia|mainnet   (NEW)
   a. read each dist/index.global.js
   b. gzip (Node zlib, matches browser-native DecompressionStream('gzip') — Baseline
      widely available since May 2023)
   c. split into ≤24,576-byte chunks (EIP-170 contract-code limit) — a no-op single
      chunk for DxKit today (~7 KB), but the chunking loop stays generic for larger
      future payloads (e.g. a demo dapp bundling images)
   d. forge script deploy:
        - SSTORE2.write() (solady) per chunk → data contract address(es)
        - deploy an immutable per-version facade contract that:
            html()    → ERC-8244-shaped full document (bootstrap wrapper)
            source()  → concatenated raw bytes across chunk(s)
            version() → e.g. "0.4.0"
            keccak()  → keccak256 of the *uncompressed* source, pinned at deploy time
   e. record { chain, address, version, keccak } → contracts/deployments/<chain>.json
   f. emit a web3:// manifest fragment (dapp authors copy the address into their
      own manifest's web3:// URIs)

3. Browser loads the demo dapp's html() as the top-level document (or via a
   web3://-aware browser/extension resolving it directly)
   a. inline bootstrap snippet: window.ethereum.request({ method: 'eth_call',
      params: [{ to: DxKitFacadeAddr, data: <source()-selector> }] })
   b. ABI-decode the returned string, DecompressionStream('gzip') to inflate,
      keccak256 verify against the facade's keccak() (pinned, fetched once)
   c. create a blob: URL, inject <script type="module" src="blob:...">
      → this IS the DxKit core module, running exactly as the IIFE build does
   d. DxKit.createShell({ mode: 'hash', manifests: [...web3:// entries...],
      lifecycle: DxWeb3.createWeb3Loaders({ provider: window.ethereum }) })
   e. createShell()'s existing init() sequence runs completely unmodified
      (src/shell.ts:398-449) — plugin registration, loadManifests(), router
      construction, window.__DXKIT__ exposure, initial mount
```

Steps 1 and 3d-3e are identical to the existing bundler/IIFE flows — the *only* net-new runtime
work is steps 2 (build-time, off the browser's critical path entirely) and 3a-3c (a small,
isolated resolver that produces values indistinguishable, from core's point of view, from a
normal URL/blob string.

---

## Architectural Patterns

### Pattern 1: Loader-seam reuse via `blob:` URL bridging

**What:** Instead of teaching core to understand `web3://` URIs, `dxkit-web3` resolves them
*outside* core and hands back a `blob:` URL (or the ABI-decoded fragment string for templates) —
a value the existing `ScriptLoader`/`StyleLoader`/`TemplateLoader` types already accept.
**When to use:** Any time a new transport needs to plug into an existing "fetch this URL" seam
without widening its type signature.
**Trade-offs:** Requires the resolved content to fit in a `blob:`/string value (true here — DxKit
IIFE builds are tens of KB, not megabytes). Avoids any core type or call-signature change, at the
cost of `dxkit-web3` doing real work (ABI decode + decompress + verify) synchronously inside what
core treats as an opaque loader call.

```typescript
// plugins/web3/src/index.ts — sketch, not final
export function createWeb3Loaders(opts: Web3LoaderOptions): {
  scriptLoader: ScriptLoader; styleLoader: StyleLoader; templateLoader: TemplateLoader;
} {
  const resolve = async (uri: string): Promise<string> => {
    const { address, chainId, method } = parseWeb3Uri(uri);
    const raw = await ethCall(opts, address, chainId, method); // provider or rpcUrl
    const bytes = abiDecodeString(raw);
    const inflated = await gunzip(bytes); // DecompressionStream('gzip')
    verifyKeccak(inflated, opts.expectedKeccak); // throws '[web3:keccak-mismatch] ...'
    return inflated;
  };
  return {
    scriptLoader: async (src) => { /* blob: URL from resolve(src), inject <script src=blob> */ },
    styleLoader: async (href) => { /* same, <link href=blob> */ },
    templateLoader: (src) => resolve(src), // returns the fragment string directly
  };
}
```

### Pattern 2: SSTORE2 chunked data + versioned immutable facade

**What:** Raw gzipped bundle bytes live in one or more SSTORE2 data contracts (via solady's
`SSTORE2.sol` — a well-audited, widely used implementation; don't hand-roll the CREATE-prefix
trick). A separate, small facade contract per *version* exposes `html()`/`source()`/`version()`/
`keccak()` and reads through to the data contract(s). Contracts are immutable (no proxy, no
upgrade path) — a new DxKit release deploys a *new* facade address; nothing at an existing
address ever changes.
**When to use:** Any time you're publishing a versioned, content-addressed-in-spirit artifact to
L1 where gas cost dominates (`SSTORE2` writes cost ~200 gas/byte vs. ~625 gas/byte for raw
`SSTORE`, per independent verification).
**Trade-offs:** Immutability means bugs require a new version + new address, not a patch —
consistent with DxKit's existing "plugin lockstep versioning" convention (`.versionrc.json`).
Discovery of "the current address for version X" is out of scope for this milestone (ENS is
explicitly deferred to Next Milestone Goals) — dapp authors hardcode the facade address they
tested against, mirroring how an IIFE consumer today pins a specific `dist/index.global.js` URL.

### Pattern 3: Keccak-pinned integrity verification

**What:** The bootstrap snippet doesn't trust the RPC/provider response blindly — it verifies
`keccak256(inflated_bytes) === facade.keccak()` before executing anything. Because `keccak()` is
a *view* call on the same immutable contract (not a separate off-chain manifest), the trust
anchor is "the contract address I hardcoded," which is exactly the same trust model IIFE/IPFS
already has (you trust the CID/URL you hardcoded).
**When to use:** Always, for any code that will be `eval`'d/executed as a `<script>` — this is
the on-chain equivalent of subresource integrity (SRI) for `<script integrity="sha384-...">`.
**Trade-offs:** One extra `eth_call` per artifact (or batch it — `keccak()` and `source()` can be
combined into a single multicall-style view function to save a round trip; worth doing before
Sepolia to cut latency, not required for Anvil correctness proof).

---

## The iframe-vs-fragment decision

ERC-8244's `html()` is, per the milestone's working definition, a *full document* — meant to be
directly navigable as a browser's top-level page. DxKit's existing lifecycle model instead expects
a `template` to be an HTML **fragment** injected into `#dx-mount` via `container.innerHTML =`
(`src/lifecycle.ts:397,399`). These two shapes only actually collide when a *dapp contract's*
`html()` (not DxKit-core's own top-level bootstrap page) is reused as a DxKit `manifest.template` —
i.e., when a single on-chain contract is meant to serve *both* as a standalone `web3://`-navigable
page and as a mountable sub-dapp inside an already-running DxKit shell.

### Option A — Fragment extraction + inline `<script>` re-execution (recommended)

Take the full `html()` document text, extract the `<body>` content (or the whole document —
browsers parse `<style>`/`<div>` etc. leniently even outside a proper `<head>`/`<body>` context
when assigned via `innerHTML`) as the fragment, write it into `#dx-mount` exactly as today, then
walk the container for `<script>` elements and re-create each one (`innerHTML`-injected `<script>`
tags are inert — a well-known DOM quirk) so it actually executes. `<style>` tags need no special
handling — they *do* execute via `innerHTML`, unlike `<script>`.

**Pros:**
- Zero change to DxKit's core mental model: one `#dx-mount`, one frozen `window.__DXKIT__`, one
  shared `document` — plugins that already read `document.documentElement` (theme,
  `plugins/theme/src/index.ts:53`) or `window.ethereum` (wallet) keep working unmodified.
- The wallet plugin needs **no cross-frame bridging** — same-document `window.ethereum` access.
- Matches the milestone's explicit "core sandbox hardening (additive)" framing — it *is* a small,
  additive, opt-in lifecycle change, not a parallel mounting model.
- Consistent with the existing `sanitizeTemplate` hook's placement (also a post-fetch,
  pre/post-injection string transform) — this is one more step in the same pipeline.

**Cons:**
- Re-executing arbitrary extracted `<script>` content is inherently as trusted as today's
  `dependencies`/`entry` scripts already are (`docs/security.md` already documents entry scripts
  as "trusted code outside the sanitizer's reach," per `src/lifecycle.ts:216-217`'s D-14 comment)
  — this is not a *new* trust boundary, just a new mechanical path to the same trust level.
- A naive HTML document (with `<html>`/`<head>`/`<title>` wrapper tags) injected via `innerHTML`
  produces some inert/meaningless nodes (a stray `<title>` element sitting in the DOM) — cosmetic,
  not functional, but worth stripping to `<body>` content specifically rather than the raw
  document string for cleanliness.

### Option B — `<iframe sandbox srcdoc="...">` per-dapp isolation

Mount the entire on-chain dapp inside a sandboxed iframe instead of into `#dx-mount` directly.

**Pros:**
- Strong isolation: a malicious/buggy on-chain dapp can't touch the parent's DOM, globals, or
  cookies if `sandbox` is set *without* `allow-same-origin`.
- Matches ERC-8244's `html()`-as-a-whole-document shape with zero extraction/parsing needed —
  just `iframe.srcdoc = html`.

**Cons (why this is not the recommendation):**
- **Verified via web search:** unless the iframe is sandboxed *without* `allow-same-origin`, a
  `srcdoc` document is same-origin with the parent and *inherits the parent page's CSP* — so
  `sandbox` without `allow-same-origin` is required for real isolation, and that same flag also
  blocks `localStorage`/cookies (opaque origin), meaning wallet/theme/settings state can't
  persist at all inside the iframe unless you *do* grant `allow-same-origin`, which then largely
  defeats the isolation goal. There's no configuration that gets both strong isolation and
  working persistence.
- Breaks the single-`window.ethereum`, single-`window.__DXKIT__` model: the wallet plugin's
  `getEthereumProvider()` (`plugins/wallet/src/index.ts:23-25`) would resolve `iframe.window.
  ethereum`, which is `undefined` unless a `postMessage`-based provider proxy is built and
  injected — real, non-trivial new surface (a whole EIP-1193-over-postMessage bridge) that
  doesn't exist today and isn't scoped in this milestone's target features.
- `window.__DXKIT__` (`src/shell.ts:437-438`) would need to live *inside* the iframe's own
  `window`, meaning each on-chain dapp effectively runs its own isolated DxKit shell instance —
  fine for a single-dapp on-chain deployment (which is the realistic v1.2 use case: one dapp, one
  `html()` page) but architecturally a dead end for the shell's actual multi-dapp routing model
  (`Router`, `enableDapp`/`disableDapp`) — those features become meaningless per-iframe.

### Recommendation

**Ship Option A (fragment + inline-script re-execution) as the built-in, default behavior in
`dxkit-web3`'s `templateLoader`.** It requires exactly one small, additive, opt-in core hook
(`executeInlineScripts`) and preserves 100% of DxKit's existing single-container architecture,
including every plugin's existing assumptions about a shared `document`/`window`.

**Do not build Option B into core.** Leave it available as a documented *escape hatch* pattern for
dapp authors who explicitly want strict isolation and are willing to give up shell routing,
cross-dapp navigation, and (mostly) storage persistence for it — achievable *today*, with zero
core changes, by writing a custom `templateLoader` that returns `<iframe sandbox srcdoc="...">`
markup as the "fragment." Document it in the cookbook as an advanced pattern, not the default.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Widening `ScriptLoader`/`StyleLoader`/`TemplateLoader` signatures for web3

**What people might do:** Add a `web3://`-aware overload or a new `WebLoader3` type to
`src/lifecycle.ts` so the resolver can pass richer metadata (chain ID, ABI type, etc.) directly.
**Why it's wrong:** Breaks the "one seam, any transport" property that makes the existing
`ShellConfig.lifecycle` override pattern (v1.0 Phase 3) valuable, and creates a permanent core
dependency on web3-specific concepts inside a package whose whole selling point is zero runtime
deps and target-agnosticism.
**Do this instead:** Encode everything the resolver needs *in the URI string itself*
(`web3://addr:chainId/method?args=...`) — parsed entirely inside `dxkit-web3`, invisible to core.

### Anti-Pattern 2: Making `entry` optional without a floor validation

**What people might do:** Just drop the `entry` requirement from `isValidManifest()` without
requiring *something* loadable.
**Why it's wrong:** A manifest with neither `entry` nor `template` silently "mounts" nothing —
reintroducing exactly the class of silent failure v1.0's Phase 1 (Diagnostics) eliminated.
**Do this instead:** `isValidManifest()` should require `entry != null || template != null`,
emitting the existing `dx:error` (`shell:manifest` source, `src/shell.ts:356-364` pattern) when
neither is present.

### Anti-Pattern 3: Building the RPC transport on `fetch()` unconditionally

**What people might do:** Implement `createWeb3Loaders({ rpcUrl })` as the *primary* transport
because it's simpler to write/test than provider-based `eth_call`.
**Why it's wrong:** Under a true ERC-8244 opaque-origin page, `fetch()` to a network URL is
exactly what's forbidden — an `rpcUrl`-only implementation would work in every dev/test harness
and then silently (or loudly, but *late*) fail the moment it's actually served on-chain.
**Do this instead:** `provider` (injected `window.ethereum.request({method:'eth_call'})`) is the
primary, ERC-8244-compliant transport and must be exercised in every Anvil-verification step,
including the fidelity-check ring described below. `rpcUrl` (via `fetch()`-based JSON-RPC POST) is
a secondary convenience transport, explicitly documented as **only for the bundler/webserver
target or local dev harnesses that aren't themselves opaque-origin pages** — never for content
that will actually be served as the on-chain `html()`.

---

## Build Order — Anvil-verifiable increments before Sepolia/mainnet

Each step should be independently provable on Anvil before the next begins. Core changes (step 5)
are deliberately sequenced *after* the resolver proves itself against a script-only dapp, so the
riskiest/least-precedented piece (inline-script re-execution) is isolated and easy to bisect.

| # | Step | Proves | Touches core? | Chain |
|---|------|--------|----------------|-------|
| 1 | Foundry scaffold (`contracts/`) + solady `SSTORE2` dep + a trivial "hello world" facade (`html()`/`source()`/`version()`/`keccak()`, no DxKit content) | Contract pattern + `Makefile` wiring + forge tests | No | Anvil |
| 2 | Publish pipeline: gzip + chunk (exercise the multi-chunk path with a synthetic >24,576 B fixture even though real payloads are smaller) + deploy `dist/index.global.js` as `DxKitFacade_0.4.0-dev` + per-chain address JSON | Real build artifact round-trips through the pipeline; `keccak()` pin is correct | No | Anvil |
| 3 | `@dnzn/dxkit-web3`: URL parser + `eth_call` transport (`provider` mode first) + ABI decode + gunzip + keccak verify, unit-tested against the Anvil-deployed facade from step 2 | Resolver correctly retrieves and verifies real DxKit bytes end-to-end | No | Anvil |
| 4 | `createWeb3Loaders()` wraps step 3 into loader-shaped functions; mount a **trivial script-only demo dapp** (no template) through **unmodified** `src/lifecycle.ts`, in a real browser harness pointed at Anvil via MetaMask | The loader seam works with zero core changes — first real "dapp loads from chain" milestone | No | Anvil |
| 5 | Land the two additive core changes (`entry` optional + `executeInlineScripts`) with `vitest`/happy-dom coverage proving the *default* (unset) path is byte-identical to today, plus new coverage for the on-path case | Core changes are additive and non-regressive for the other two targets | **Yes (additive)** | none (unit tests only) |
| 6 | Deploy a **self-contained demo dapp facade** (`html()` with embedded `<style>`+`<script>`, no separate entry contract) and mount it via `dxkit-web3`'s `templateLoader` using the new `executeInlineScripts` flag | Fragment-extraction + inline-script re-execution works for a real on-chain artifact | No (already landed in 5) | Anvil |
| 7 | Full demo dapp (wallet + theme plugins) + bootstrap snippet finalized; two-ring dev-loop verification (see below); `dx:error` message-prefix taxonomy exercised for each induced failure (no provider, bad keccak, corrupt gzip, revert) | The whole pipeline works for a realistic dapp, and failures are visible, not silent | No | Anvil |
| 8 | Docs pass — cookbook recipe, resolver reference, contract interface reference — verified against the code from steps 1-7 | Documentation truthfulness (project's Core Value) | No | — |
| 9 | Deploy DxKit 0.4.0 + demo dapp to **Sepolia**; real MetaMask against a real public testnet; re-run the fidelity-check ring | Real network latency/gas/finality don't break assumptions baked in against instant Anvil blocks | No | Sepolia |
| 10 | Deploy DxKit 0.4.0 + demo dapp to **Ethereum mainnet** (~$1 gas; ~15 KB gzipped total fits one data contract, no chunking needed in practice) | Production-real | No | Mainnet |

### Two-ring local dev loop (referenced in step 7)

Because a true ERC-8244 page (opaque `data:`/`blob:` origin, no `fetch()`) is awkward to iterate
against directly, use two verification rings:

- **Ring 1 — fast iteration.** Serve the bootstrap snippet + `#dx-mount` shell as an ordinary
  `http://localhost` page (any static server), with MetaMask pointed at Anvil as a custom network
  (chain ID 31337). Normal devtools, normal hot reload of redeployed contracts. This ring will
  *not* catch opaque-origin-specific bugs (localStorage throwing, `history` mode throwing) because
  `http://localhost` is not an opaque origin.
- **Ring 2 — fidelity check.** Before promoting to Sepolia, actually navigate the browser to a
  `data:text/html;base64,...` (or `blob:`) URL built from the *live* `eth_call`'d `html()` output,
  so the page truly runs under an opaque origin. This is what actually exercises the
  `mode: 'hash'` requirement and the storage-fail-soft paths for real, not just in theory.

---

## Scalability / Cost Considerations

| Concern | Anvil (dev) | Sepolia (testnet) | Mainnet |
|---------|-------------|--------------------|---------|
| Deploy cost | Free (instant blocks) | Free (faucet ETH) | ~$1 at current gas (per PROJECT.md's Aug-2026 estimate) — DxKit's ~15 KB gzipped total fits one SSTORE2 data contract, no multi-chunk deploy needed |
| Chunking | Exercised via synthetic fixtures only | Real, but still single-chunk for DxKit itself | Same — multi-chunk path stays available for a future larger demo dapp (e.g. embedded images) without further core work |
| `eth_call` latency | Instant | Real block/RPC latency (still a read call, no mining wait) | Same as Sepolia; consider batching `source()` + `keccak()` into one multicall before Sepolia to cut round trips |
| Discovery | Hardcoded local address | Hardcoded testnet address | Hardcoded mainnet address — ENS-based discovery explicitly deferred (PROJECT.md Next Milestone Goals) |
| L2 | N/A | N/A | Out of scope this milestone; Base et al. listed as a Next Milestone candidate — the resolver's `chainId` parameter already anticipates this without further design work |

---

## Sources

- DxKit source (read directly, HIGH confidence, file:line cited throughout): `src/shell.ts`,
  `src/lifecycle.ts`, `src/router.ts`, `src/events.ts`, `src/types/manifest.ts`,
  `src/types/shell.ts`, `src/types/context.ts`, `src/types/interfaces.ts`, `plugins/wallet/src/index.ts`,
  `plugins/theme/src/index.ts`, `plugins/settings/src/index.ts`, `tsup.config.ts`,
  `plugins/wallet/tsup.config.ts`, `plugins/wallet/package.json`, `docs/system-internals.md`,
  `.planning/PROJECT.md`
- [Vectorized/solady — SSTORE2.sol](https://github.com/Vectorized/solady/blob/main/src/utils/SSTORE2.sol) — HIGH confidence, verified via search
- [7BlockLabs — Cutting Down Contract Size: the 24KB Spurious Dragon limit](https://www.7blocklabs.com/blog/reducing-contract-size-bypassing-the-24kb-spurious-dragon-limit) — EIP-170 24,576-byte limit, HIGH confidence
- SSTORE2 gas-cost comparison (SSTORE ~20,000 gas/new slot vs. ~200 gas/byte via code storage) — verified via web search across multiple sources (ZeframLou/sstore2, 0xsequence/sstore2 READMEs), HIGH confidence
- [MDN — DecompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream) and [caniuse — DecompressionStream gzip](https://caniuse.com/mdn-api_decompressionstream_decompressionstream_gzip) — Baseline widely available since May 2023, HIGH confidence
- [MDN — HTMLIFrameElement: srcdoc property](https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/srcdoc) and [web.dev — Play safely in sandboxed IFrames](https://web.dev/articles/sandboxed-iframes) — `srcdoc` same-origin/CSP-inheritance behavior without `sandbox` (or with `allow-same-origin`), HIGH confidence
- ERC-8244 spec text — **not independently located** via public search (searches returned ERC-4804/ERC-6860 `web3://` URL-translation standards and the unrelated ERC-8004 "Trustless Agents" standard instead). Treated as the milestone brief's working definition; **flagged as a gap requiring a dedicated spike** before contract interfaces are frozen as "immutable."

---
*Architecture research for: DxKit v1.2 On-Chain Deployment (ERC-8244)*
*Researched: 2026-08-16*

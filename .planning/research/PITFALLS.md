# Pitfalls Research

**Domain:** On-chain (ERC-8244) deployment for an existing headless dapp microframework — SSTORE2 data contracts, web3:// `eth_call` resolver loaders, sandboxed `html()` pages, Foundry-in-pnpm-monorepo tooling
**Researched:** 2026-08-16
**Confidence:** MEDIUM (well-documented EVM/CSP/Foundry mechanics; LOW on ERC-8244's exact spec text and Etherscan's handling of raw-bytecode data contracts — see Gaps)

**Sourcing note on ERC-8244 itself:** The ERC-8244 specification could not be located at `eips.ethereum.org` or `github.com/ethereum/ERCs` via web search as of this research (both return 404 on direct fetch of the expected paths). It is either extremely recent/still a draft PR, or the milestone context's description of it (forbids network URL fetches, only `data:`/`blob:`, sandboxed iframe with default-deny CSP, `html()` render function) is the working source of truth already established in this project's `PROJECT.md`/`REQUIREMENTS.md`. **Treat this as Pitfall 0** below — do not build against an assumed spec; pin the actual ERC-8244 text before implementation begins.

## Critical Pitfalls

### Pitfall 0: Building against an unverified/inaccessible ERC-8244 spec text

**What goes wrong:**
The team implements the resolver, sandbox hardening, and bootstrap snippet against a *paraphrased* understanding of ERC-8244 (carried in `PROJECT.md`/milestone context) rather than the actual, current spec text — then a later spec revision (still in Draft/Review status, as most ERCs are during active implementation) changes a constraint (e.g., which sandbox tokens are required, whether `blob:` or only `data:` is permitted, whether `import` statements are allowed in bootstrap scripts) and DxKit's on-chain artifacts silently stop conforming.

**Why it happens:**
ERC/EIP numbers get assigned early and the linked document can churn for months before Final status; teams that bookmark a PR diff or a forum summary instead of re-checking `eips.ethereum.org`/`github.com/ethereum/ERCs` at each phase boundary drift from the canonical text without noticing, because nothing in a CI pipeline can currently check "did the spec change since I read it."

**How to avoid:**
Before Phase B (publish tooling) begins, locate and pin the canonical ERC-8244 URL + commit SHA of the spec markdown the implementation is built against; record it in `.planning/research/` and re-check it at the start of every subsequent on-chain phase (publish tooling → resolver → sandbox hardening → bootstrap/demo → Sepolia → mainnet). Treat any spec status change (Draft → Review → Last Call → Final) as a mandatory re-read, not a formality.

**Warning signs:**
Nobody on the team can produce a direct URL to the ERC-8244 markdown when asked; the only citation anyone can give is "the milestone doc says."

**Phase to address:**
Foundry/Anvil dev-loop phase (before any contract or resolver code is written) — re-verified at the start of the publish-tooling, resolver, and sandbox-hardening phases.

---

### Pitfall 1: EIP-170/EIP-3860 confusion — chunking by the wrong limit, or forgetting the initcode surcharge

**What goes wrong:**
A gzip-chunking script sizes chunks against the 24,576-byte EIP-170 runtime-code cap but doesn't account for the SSTORE2 wrapper bytes (deploy prelude that copies calldata into returned runtime code) eating into that budget, so a chunk that looks "under 24KB" on disk fails to deploy once wrapped. Separately, EIP-3860's *initcode* limit (49,152 bytes, metered at 2 gas/32-byte word) is a distinct constraint from the runtime-code cap — a deploy script that only checks the final chunk size against 24,576 can still blow past the initcode limit or under-budget gas for large chunks.

**Why it happens:**
"24KB limit" is repeated everywhere as if it's one number; the deploy-time (initcode) vs. runtime (deployed code) distinction is a common point of confusion even among experienced Solidity devs, and SSTORE2 wrapper libraries hide the prelude-byte overhead unless you read the assembly.

**How to avoid:**
Budget chunk size with explicit headroom below 24,576 (e.g., cap at ~24,000 bytes of raw payload) to leave room for the SSTORE2 deploy-prelude bytes; add a forge test that asserts `chunk.length + PRELUDE_BYTES <= 24576` and separately that initcode size (chunk + constructor overhead) stays under 49,152. Fail the build script, not just the on-chain deploy, if a chunk is oversized.

**Warning signs:**
`forge script`/`forge create` reverts with a generic out-of-gas or "contract creation code storage out of gas" error on a chunk that "should" fit; deploy succeeds on Anvil (no cap enforced identically in all local configs) but fails on Sepolia.

**Phase to address:**
On-chain publish tooling phase (chunking/build script + forge tests).

**Sources:** [EIP-170](https://eips.ethereum.org/EIPS/eip-170), [EIP-3860](https://eips.ethereum.org/EIPS/eip-3860), [EIP-3860 GitHub](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-3860.md)

---

### Pitfall 2: Chunk-ordering / concatenation bugs corrupt the reassembled asset silently

**What goes wrong:**
The facade/index contract stores chunk-contract addresses in an array and concatenates on read; if chunks are pushed out of deploy order (e.g., a retried/failed deploy re-appends instead of replacing, or parallel `forge script` broadcasts race), `source()`/`html()` returns bytes that gunzip either throws on (good — loud failure) or, worse, *don't* throw on but decompress into garbled HTML/JS (bad — silent corruption that only shows up as a broken dapp in the browser).

**Why it happens:**
Gzip's CRC32 trailer will catch most reordering as a decompression error, but partial corruption within a valid gzip stream boundary (e.g., swapped middle chunks that still parse as a valid-looking but wrong byte sequence) is not guaranteed to be caught by gunzip alone — only the keccak pin check catches it reliably, and only if that check runs *before* rendering, not after.

**How to avoid:**
Make the index/facade contract immutable and append-only within a single deploy transaction (or a single `forge script` run with an explicit ordered array, not incremental pushes across multiple transactions); write a forge test that deploys with a deliberately-corrupted chunk order and asserts the keccak pin check on the resolver side rejects it before any content reaches the DOM.

**Warning signs:**
A dapp renders but with visibly broken/truncated content on-chain while working fine from the same gzip source in local dev; keccak pin mismatches that get silently swallowed instead of blocking render.

**Phase to address:**
On-chain publish tooling phase (facade contract design + forge tests); enforced again by the resolver's pin-before-execute check (see Pitfall 6).

**Sources:** [SSTORE2 pattern (0xsequence)](https://github.com/0xsequence/sstore2/blob/master/README.md), [SSTORE2 gas optimization](https://doc.confluxnetwork.org/docs/general/build/smart-contracts/gas-optimization/sstore2/)

---

### Pitfall 3: Non-deterministic gzip output drifts the keccak pin

**What goes wrong:**
The build pipeline gzips the DxKit bundle with default settings; gzip's header embeds a filename, an mtime, and an OS byte. Two builds of *byte-identical* source, run on different machines/CI runners/gzip tool versions, produce *different* compressed bytes — so a keccak256 pin computed once (e.g., checked into docs or a registry) drifts and every subsequent CI run "fails" a hash check that should have passed, or worse, a legitimate rebuild silently produces a different pin than what was deployed on-chain.

**Why it happens:**
Almost no gzip tooling defaults to reproducible output; Node's `zlib.gzipSync` and CLI `gzip` both embed timestamp/OS metadata unless explicitly told not to. This bit even CPython's stdlib (a 3.11–3.12 regression made the OS byte host-dependent even with `mtime=0`, only fixed in 3.13/3.14).

**How to avoid:**
Pin exact compression parameters in the build script: use `zlib.gzipSync(buf, { level: 9 })` with the mtime field explicitly zeroed (Node's zlib gzip header mtime defaults to the current time unless overridden) and verify the OS byte is fixed across CI runners; add a CI step that gzips the same fixture bytes twice (potentially on two different runner OSes) and asserts byte-for-byte equality, not just successful round-trip decompression. Treat the compressed artifact, not just the source, as the thing under version control / hash-pinned.
- Node's `zlib.gzip`/`gzipSync` accepts an options object; verify whether it exposes an `mtime`-equivalent flag for your Node version, and if not, post-process the gzip header bytes directly to zero it (bytes 4–7 of the gzip header) before hashing/deploying.

**Warning signs:**
CI's computed keccak pin doesn't match the pin recorded from a prior local build of the same commit; re-running the exact same build script twice on the same machine produces different bytes.

**Phase to address:**
On-chain publish tooling phase (build/gzip script) — must be locked down before the first Anvil deploy, because every downstream phase (resolver testing, demo dapp, Sepolia, mainnet) depends on a stable pin.

**Sources:** [Debian ReproducibleBuilds — gzip headers](https://wiki.debian.org/ReproducibleBuilds/TimestampsInGzipHeaders), [Python gzip OS-byte regression](https://github.com/python/cpython/issues/112346), [gzip.compress non-determinism](https://github.com/python/cpython/issues/125260)

---

### Pitfall 4: DecompressionStream assumed present without feature detection or a fallback error path

**What goes wrong:**
The `web3://` resolver's script/template/style loaders call `new DecompressionStream('gzip')` unconditionally. In an unsupported environment (older browser, an embedded/restricted preview surface like the mentioned "Freedom" read-only provider, or any sandboxed context that strips non-essential Web APIs) this throws a `ReferenceError`/`TypeError` at the point of use rather than failing gracefully — and because it's inside a loader that DxKit's `withTimeout`/error-emission machinery wraps, it needs to surface as a normal `dx:error`, not an unhandled exception that skips the existing fail-loud contract.

**Why it happens:**
`DecompressionStream` is Baseline/widely-available in modern desktop/mobile browsers since ~May 2023, so it's easy to treat as universally present — but "widely available" isn't "guaranteed present in every sandboxed/embedded rendering surface an ERC-8244 page might run inside," and that's exactly the deployment target this milestone adds.

**How to avoid:**
Feature-detect (`typeof DecompressionStream === 'function'`) at the top of the web3 resolver loaders and emit a clear `dx:error` (source `web3:<loader>`) with an actionable message ("this environment doesn't support native gzip decompression") instead of letting the constructor throw uncaught — mirrors the existing lifecycle pattern of turning every failure mode into a visible event. Add a unit test that stubs the API's absence.

**Warning signs:**
Reports of dapps "just not loading" with no `dx:error` fired, in specific browsers/wallets/preview contexts that the core team doesn't normally test in.

**Phase to address:**
web3:// resolver package phase (initial implementation) — verified again in the demo-dapp phase across more than one wallet/browser.

**Sources:** [MDN DecompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream), [web.dev Compression Streams](https://web.dev/blog/compressionstreams)

---

### Pitfall 5: Sandboxed-iframe opaque origin breaks `localStorage`/`sessionStorage` in existing plugins

**What goes wrong:**
An iframe sandboxed with `allow-scripts` but *without* `allow-same-origin` (the default-deny posture ERC-8244 pages run under) gets a unique/opaque origin per load. `localStorage`/`sessionStorage`/IndexedDB *throw* `SecurityError` on first access in that context — not "return null," throw. DxKit's wallet, theme, and settings plugins currently call `localStorage` directly (already known to emit `dx:error` on read/write *failure*, per Phase 1/3 hardening) — but a thrown `SecurityError` at *construction* time (some storage APIs throw on the property getter itself, not just on `.getItem()`) could occur somewhere the existing try/catch doesn't reach, silently breaking plugin init instead of degrading.

**Why it happens:**
Storage APIs are origin-tuple-keyed; an opaque origin has no scheme/host/port tuple to key against, so the spec mandates a security exception rather than silent no-op. This is a well-known but frequently-rediscovered gotcha for anyone building sandboxed/embedded content (artifact previews, chat widgets, etc.), not specific to Ethereum.

**How to avoid:**
Audit every direct `localStorage`/`sessionStorage` access point in core + the four plugins (wallet, auth, theme, settings) and confirm each is wrapped in a try/catch that degrades gracefully with a `dx:error`, including the *first* access (property getter), not just `.getItem`/`.setItem` calls — write a happy-dom or custom-provider test that simulates a `SecurityError`-throwing storage object and asserts every plugin still initializes (in a no-persistence degraded mode) rather than throwing out of `init()`.

**Warning signs:**
A plugin's `init()` throws uncaught inside a sandboxed `srcdoc` iframe even though the exact same plugin works fine in a normal top-level page or non-sandboxed iframe.

**Phase to address:**
Core sandbox hardening phase (no-fetch/no-storage graceful degradation) — this is explicitly named in the milestone's target features, so it should be the primary phase, with regression coverage added to existing plugin test suites.

**Sources:** [MDN Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy), [localStorage opaque-origin SecurityError issue](https://github.com/nexu-io/open-design/issues/1403)

---

### Pitfall 6: Executing chain-loaded code before the keccak pin check completes (trust-order bug)

**What goes wrong:**
A malicious or misconfigured RPC (including a compromised public gateway, or a MITM'd `window.ethereum` injection in a hostile browser extension environment) returns tampered bytes for an `eth_call` to the facade contract. If the bootstrap snippet decompresses and executes/injects that payload *before* verifying it against the keccak256 pin, the tampered code runs with full page privileges before anyone catches the mismatch — the pin check becomes decorative rather than protective.

**Why it happens:**
It's tempting to stream-decompress-and-render for perceived performance/simplicity, especially since `DecompressionStream` is itself a streaming API that invites a "start rendering as bytes arrive" design — but that's precisely the ordering that defeats a pin check, which needs the complete byte sequence before it can produce a hash to compare.

**How to avoid:**
Buffer the full response, decompress, hash, *compare to the pinned keccak256*, and only then hand the string to any DOM-injection or `eval`/module-execution path. Treat pin mismatch exactly like the existing lifecycle's fail-closed-on-sanitizer-failure pattern (`docs/security.md`'s sanitizer contract) — abort the mount, emit `dx:error`, never partially render. Decide up front where the pin lives (bundled into the dapp's `html()` bootstrap vs. a separate on-chain registry contract) — a pin embedded in the bootstrap the RPC itself serves is weaker (the attacker controlling the RPC also controls the pin) than one hardcoded in the *previously-audited, already-executing* bootstrap snippet before any further chain calls are trusted.

**Warning signs:**
Code review shows any code path where fetched bytes are used (injected/executed/rendered) before a hash-comparison branch; no forge/vitest test exists that supplies a tampered payload and asserts nothing executes.

**Phase to address:**
web3:// resolver package phase (loader implementation) — this is the single highest-severity trust/security pitfall in the whole milestone and should get its own explicit test in that phase, re-verified in the demo-dapp phase against a real (not mocked) tampered-response scenario on Anvil.

**Sources:** milestone context (ERC-8244 trust model); general pattern corroborated by [ERC-6860 web3:// spec](https://eips.ethereum.org/EIPS/eip-6860) (return-data ABI decoding happens client-side, so nothing on-chain enforces integrity beyond what the caller checks)

---

### Pitfall 7: CSP `script-src` doesn't implicitly allow `blob:` — bootstrap re-execution silently blocked

**What goes wrong:**
The bootstrap snippet's strategy for re-executing inline `<script>` text (since `innerHTML`-injected `<script>` tags never execute — already documented in `docs/security.md`) is to create a `Blob`, get an object URL, and set that as a dynamically-created `<script src="blob:...">`. Under a strict `script-src 'self'` (or default-deny sandbox CSP) policy, `blob:` is a distinct URL scheme that is **not** implicitly covered by `'self'` — the browser silently blocks the script load exactly as it would block any other disallowed origin, and because it's a CSP block (not a JS exception), it may not even reach DxKit's existing script-loader `onerror` handler in every browser (some browsers fire `onerror`, some just silently refuse and never fire either event, right into the loader's timeout path after 30s).

**Why it happens:**
Developers reason "`blob:` is same-origin-ish, it should just work under `'self'`" — it doesn't; CSP treats scheme-based origins (`blob:`, `data:`, `filesystem:`) as needing explicit allowlisting, and the ERC-8244 default-deny CSP the milestone context describes is, by definition, the strictest possible starting point.

**How to avoid:**
Explicitly test the bootstrap snippet's inline-script re-execution path against the *actual* default-deny CSP an ERC-8244 sandboxed iframe applies (not an assumed one) and confirm `blob:` (or whatever scheme the design lands on) is reachable; if the platform's sandbox CSP can't be relaxed to add `blob:`, redesign the re-execution path to avoid needing a script-src-governed load at all (e.g., `new Function()`/module-scoped `eval` via `<script type="module">` inline text handling, if that path is permitted instead). Add an explicit timeout-vs-CSP-block distinction to the lifecycle's script-loader error message so silent CSP blocks don't look identical to slow-network timeouts in `dx:error` payloads.

**Warning signs:**
A dapp works when CSP is loosely configured in local dev but the same code silently hangs to the loader's 30s timeout (or fails with a non-specific "Failed to load dapp script" message) only once deployed inside the real ERC-8244 sandbox.

**Phase to address:**
Bootstrap snippet + demo dapp phase — must be tested against the real sandbox environment, not just Anvil/local, before the docs/cookbook phase writes it up as a working recipe.

**Sources:** [CSP sandbox directive — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/sandbox), [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

---

### Pitfall 8: `import` statements inside injected/blob-loaded script text fail differently than expected

**What goes wrong:**
DxKit's existing `defaultScriptLoader` sets `script.type = 'module'`, so entry scripts already execute as ES modules with all the module-script rules that implies — strict MIME-type checking, and for cross-origin loads, CORS headers on every `import`ed sub-resource. A blob-URL-loaded module script's *internal* `import './foo.js'` statements resolve relative to the blob URL's *base*, which is not a normal same-origin URL — a naive on-chain bootstrap that tries to `import` further on-chain assets by relative path from inside a blob-sourced module script will fail to resolve those imports at all (blob URLs don't support relative-path resolution to other blob URLs the way real hosted URLs do), independent of any CSP concern.

**Why it happens:**
`type="module"` scripts inherit browser module-resolution semantics designed for real hosted URLs; blob URLs are single-use, opaque, and don't compose into a resolvable module graph the way a real origin's paths do — this is a fundamental mismatch that only surfaces once a bootstrap snippet tries to `import` a second chain-loaded asset from inside the first.

**How to avoid:**
Design the bootstrap so it does not rely on ES module `import` resolution across multiple chain-loaded assets — instead, either (a) inline everything into a single classic (non-module) script blob that DxKit's loader can execute without nested resolution, or (b) fetch/resolve every dependency's bytes via explicit `eth_call`s in the bootstrap's own JS logic and construct blob URLs it passes around itself, never relying on the browser's module resolver to find a second `web3://`-sourced file. Document this constraint explicitly in the resolver/cookbook docs so consumers don't reach for `import` reflexively.

**Warning signs:**
A single-file on-chain dapp works, but the moment `manifest.dependencies` (multiple chain-loaded scripts) is used, the second script silently fails to load or throws a module-resolution error referencing a `blob:` URL that "doesn't exist."

**Phase to address:**
Core sandbox hardening phase (entry-optional / fragment-injection design) and web3:// resolver phase jointly — the constraint must be baked into the loader contract, not discovered during the demo-dapp phase.

**Sources:** [MDN JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [ES modules in browsers — Jake Archibald](https://jakearchibald.com/2017/es-modules-in-browsers/)

---

### Pitfall 9: `history.pushState`/hash routing assumptions break under `srcdoc`/opaque-origin sandboxing

**What goes wrong:**
DxKit's router supports `'history'` (pushState-based) and `'hash'` modes; a sandboxed `srcdoc` iframe with an opaque origin has document location semantics that don't behave like a normal top-level page — `history.pushState` can throw or silently no-op depending on sandbox flags (`allow-top-navigation`, presence of `allow-same-origin`), and `document.baseURI` inside a `srcdoc` frame resolves to the *parent* document's URL, not something meaningful to the dapp's own routing logic. A DxKit dapp author who reflexively reaches for `'history'` mode (the more "modern" default expectation) inside an on-chain sandboxed page can get silent navigation failures that look like a router bug rather than an environment constraint.

**Why it happens:**
`history` mode was designed and tested against real top-level/webserver-hosted pages where `pushState` always works; nobody exercised it inside a `sandbox`ed, `srcdoc`-sourced, opaque-origin iframe before this milestone, because that deployment shape didn't exist for DxKit until now.

**How to avoid:**
Document (and where feasible, detect-and-warn) that `'hash'` mode is the only routing mode DxKit currently guarantees works under ERC-8244 `srcdoc`/sandbox constraints; add a lightweight runtime check in `createRouter()` that, when `mode: 'history'` is selected but `pushState` throws once at construction, emits a `dx:error` explaining the likely sandbox cause rather than leaving navigation silently broken. This is explicitly called out in the milestone's target features as "hash-mode guidance under `srcdoc`/opaque origins."

**Warning signs:**
Sub-route navigation inside the demo dapp works in a normal browser tab but breaks (URL doesn't update, or throws) only when the same dapp is loaded via the ERC-8244 bootstrap's sandboxed iframe.

**Phase to address:**
Core sandbox hardening phase (explicitly named: "hash-mode guidance under srcdoc/opaque origins") — verified against the real bootstrap sandbox in the demo-dapp phase.

**Sources:** general sandboxed-iframe origin research (see Pitfall 5 sources); `src/router.ts` history/hash mode support (internal, `.planning/codebase/`)

---

### Pitfall 10: `chainId` mismatch — calling a mainnet-deployed facade from the wrong network

**What goes wrong:**
A `web3://<address>:<chainId>/...` URL embeds the target chain, but the actual `eth_call` executes through whatever provider is currently injected/configured — if a wallet is connected to a different chain than the one the URL specifies (user switched networks, or the resolver defaults to `window.ethereum`'s *current* chain instead of routing to a chain-specific RPC), the call either hits a same-address-different-contract on the wrong chain (returning garbage or reverting) or silently resolves against an empty address, and neither failure mode is obviously "wrong chain" from the error message alone.

**Why it happens:**
EIP-1193 providers expose a single "current chain" concept (`eth_chainId`, `chainChanged` events); building a resolver that needs to reach a *specific* chain regardless of what the user's wallet happens to be connected to requires either switching chains (`wallet_switchEthereumChain`, which is a user-facing prompt) or routing that one call through a separate chain-specific RPC endpoint bypassing the injected provider entirely — a resolver that doesn't explicitly handle this distinction will "work" only when the developer's wallet happens to already be on the right chain.

**How to avoid:**
Have the web3:// resolver loaders explicitly compare the URL's `chainId` against the provider's current `eth_chainId()` before calling, and either (a) fall back to a configured direct-RPC-endpoint-per-chainId path that doesn't depend on wallet state at all (needed anyway for the "Freedom read-only preview" scenario where no wallet may be injected), or (b) surface a clear `dx:error`/prompt distinguishing "wrong network" from "call failed." Never assume the injected provider's current chain matches the target.

**Warning signs:**
The demo dapp works for the deploying developer (whose wallet defaults to the right chain) but fails for anyone else without an actionable error message.

**Phase to address:**
web3:// resolver package phase (initial implementation) — this determines whether the resolver needs a bring-your-own-RPC config option (likely yes, given the milestone explicitly notes Freedom's read-only-provider status is a spike question, not a guaranteed `window.ethereum`).

**Sources:** [EIP-1193 spec](https://eips.ethereum.org/EIPS/eip-1193), [MetaMask provider API docs](https://docs.metamask.io/metamask-connect/evm/reference/provider-api/)

---

### Pitfall 11: Foundry-in-pnpm-monorepo tooling silently ignored, or silently breaks, existing JS gates

**What goes wrong:**
Two failure directions: (a) Biome/tsup/vitest configs that glob the repo root accidentally start linting/typechecking/bundling files under the new `contracts/` directory (Solidity, `lib/` git-submodule vendor code, forge build artifacts), producing noisy false-positive CI failures or bloating `dist/`; or (b) the opposite — `contracts/` is so thoroughly excluded that a `.env`-based private key or RPC URL used for `forge script --broadcast` gets committed because `gitleaks` (already run via `make audit`) was never pointed at `contracts/`, or because Foundry's own `.env`-loading convention (`forge script ... --private-key $PRIVATE_KEY`, sourced from a project-root `.env`) leaks into a monorepo-root `.env` file that other tooling (or a careless `git add .`) picks up.

**Why it happens:**
This milestone is the first time the repo has anything other than TypeScript source; every existing config (`tsconfig.json`, `biome.json`, `tsup.config.ts`, `.gitignore`) was written assuming a pure-TS monorepo and needs deliberate updates, not just "it'll probably just work."

**How to avoid:**
Explicitly scope `biome.json`'s `files.includes`/ignore list and `tsconfig.json`'s excludes to keep `contracts/` out of JS/TS tooling; add `contracts/lib/` (git submodules) and `contracts/out/`/`contracts/cache/` (forge build artifacts) to `.gitignore`; extend `make audit`'s `gitleaks detect --source .` scope confirmation (it already scans the whole repo by default, so verify it actually reaches `contracts/.env*` rather than assuming) and add a `contracts/.env.example` with no real values, documented in the README; keep private keys for `forge script --broadcast` out of any committed `.env` — use `--interactive`/keystore (`cast wallet import`) or CI secrets, never a plaintext `.env` key even for testnet deploys.

**Warning signs:**
`make test`/`make lint` starts taking noticeably longer or reports errors in `.sol` files; `git status` shows `contracts/out/` or `contracts/cache/` as untracked bloat; a `.env` file with a real private key shows up in `git log -p` history at any point (even briefly committed-then-removed) — check via `gitleaks detect` before every push, not just before release.

**Phase to address:**
Foundry/Anvil local dev-loop phase (first phase touching `contracts/`) — config scoping and `.gitignore`/secrets hygiene must land in this phase, not retrofitted later once CI is already noisy or a key is already leaked.

**Sources:** [foundry-toolchain GitHub Action](https://github.com/foundry-rs/foundry-toolchain), [Foundry CI docs](https://getfoundry.sh/config/continuous-integration/), [Soldeer vs. git submodules](https://github.com/mario-eth/soldeer)

---

### Pitfall 12: Privileging the on-chain path and silently regressing IIFE/IPFS or bundler paths

**What goes wrong:**
In the rush to make `entry` optional (for template-only on-chain pages) or to add sandbox-degradation branches, a change to core (`src/lifecycle.ts`, `src/router.ts`, manifest validation) accidentally changes default behavior for the *other two* deployment targets — e.g., making `entry` genuinely optional in the manifest type without gating that optionality behind an on-chain-specific flag means a malformed IIFE/web manifest that's missing `entry` by mistake now fails validation silently instead of loudly, undoing hardening work from the v1.0/v1.1 milestones (`ROB-05`/`ROB-06`, sanitizer fail-closed behavior, etc.).

**Why it happens:**
The three target types share the same core code path (`mount()` in `lifecycle.ts`); it's easy to reason about "make X optional for the on-chain case" without re-deriving what X's absence should mean for the other two cases, especially under time pressure near a milestone deadline.

**How to avoid:**
Every core change in this milestone should ship with an explicit regression test asserting the *existing* IIFE/bundler behavior is byte-for-byte unchanged for manifests that don't opt into on-chain features (no `web3://` URLs present) — treat the existing 400+ vitest specs as a non-negotiable gate, and add new tests additively rather than modifying existing ones to "accommodate" the new code path. The constraint is explicit in `PROJECT.md`: "None is privileged; no milestone may regress another."

**Warning signs:**
An existing test in `tests/` needs to be *changed* (not just extended) to make a new on-chain feature pass; `make test`'s existing spec count drops or an existing spec's assertion is loosened.

**Phase to address:**
Core sandbox hardening phase — this is the single highest architectural risk phase since it's the only one that touches shared core code paths; every other on-chain phase (resolver, publish tooling, demo, deploys) is additive/new-package and inherently lower blast-radius.

**Sources:** internal (`PROJECT.md` constraints section, `docs/security.md` existing fail-closed contracts)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Skip chunk-order forge tests, trust manual review of deploy script | Faster Phase B delivery | Silent asset corruption only caught in browser, post-deploy, expensive to fix (immutable contracts) | Never — chunking is exactly the kind of off-by-one bug tests catch cheaply pre-deploy |
| Hardcode the CREATE2 deployer address without checking chain support | Simpler deploy script | Deploy silently non-deterministic (or fails outright) on a chain lacking the canonical deployer | Only for Anvil-only local dev loop, never Sepolia/mainnet |
| Leave `entry` genuinely optional in the shared manifest type instead of a discriminated on-chain-only variant | Less type ceremony | Web/IIFE manifests missing `entry` by typo now validate when they shouldn't (regresses ROB-05/06 hardening) | Never — use a discriminated union or on-chain-specific manifest shape instead |
| Test the resolver only against Anvil + mocked provider, skip a live Sepolia integration test before shipping the resolver package | Faster resolver phase | `eth_call` gas-cap/return-size quirks specific to real RPC providers (public gateways, MetaMask) go undiscovered until the demo-dapp phase | Acceptable for the *first* resolver PR, but must close before Sepolia deploy phase |
| Defer keccak-pin-before-execute ordering fix ("we'll harden the trust model later") | Faster bootstrap demo | Bootstrap snippet becomes the thing every consumer copy-pastes — a trust-order bug here is now in every deployed dapp | Never — this is the one security property the whole system depends on |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| `window.ethereum` (EIP-1193) | Assuming it's always injected (Freedom preview, headless test environments) | Feature-detect; support a configured direct-RPC fallback per chainId, not just the injected provider |
| Public RPC endpoints for `eth_call` | Assuming a uniform gas cap / return-size ceiling across providers | Test against the actual provider(s) targeted (own RPC, MetaMask default, a public gateway) rather than assuming Geth defaults everywhere |
| Etherscan verification | Trying to "verify source" on raw SSTORE2 data contracts the same way as the Solidity facade | Verify only the facade/index contract's real Solidity source; treat data contracts as opaque bytecode reachable via the facade's `source()` (needs direct confirmation with Etherscan docs before Sepolia — flagged low-confidence in this research) |
| CREATE2 deterministic deployer | Assuming `0x4e59b44847b379578588920ca78fbf26c0b4956c` exists on every target chain | Check deployer presence per chain before relying on determinism; document per-chain deploy addresses regardless |
| `forge script --broadcast` secrets | Sourcing a private key from a monorepo-root `.env` shared with JS tooling | Use `cast wallet import`/keystore or CI-injected secrets scoped to `contracts/`; never a plaintext `.env` key, even for Sepolia |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Un-chunked large `eth_call` return payload | Slow or provider-capped `eth_call` for the full DxKit+dapp bundle in one call | Keep individual facade calls scoped to what fits comfortably under common gas caps (30M is the lowest observed default); split lookups by chunk instead of reassembling server-side | Once total gzipped payload approaches the low end of provider gas caps (~30M gas equivalent read cost) |
| Streaming decompression started before full response buffered | Tempting for "faster first paint" but defeats pin-checking (Pitfall 6) | Always buffer-then-verify-then-decompress-then-render, accept the latency cost | N/A — this isn't a scale threshold, it's a correctness/security requirement at any size |
| Uncached repeated `eth_call`s for the same immutable chain-loaded asset on sub-route navigation | Redundant RPC calls, wallet-prompt fatigue if requests trigger permission checks, rate-limit exhaustion on public RPCs | Cache the web3:// resolver's decoded/verified output client-side, mirroring the existing `templateCache`/`clearTemplateCache()`/`invalidateTemplate()` pattern already in `src/lifecycle.ts` | Any dapp with more than a handful of on-chain sub-navigations per session against a rate-limited public RPC |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Executing/rendering chain-loaded bytes before the keccak pin check completes | Tampered RPC response executes with full page trust (Pitfall 6) | Buffer-verify-then-render, always; treat as fail-closed exactly like the existing `sanitizeTemplate` contract |
| Trusting `window.ethereum`'s current chain implicitly for a `web3://` URL that specifies a different `chainId` | Silent wrong-chain reads, or worse, a dapp acting on stale/incorrect on-chain state without the user realizing (Pitfall 10) | Explicit chainId comparison before every resolver `eth_call`; direct RPC fallback path independent of wallet state |
| Assuming ENS-name resolution for DxKit-version discovery is itself trustworthy without a pin | ENS name pointing at a malicious/outdated contract silently served as "the" DxKit version | Treat ENS resolution (explicitly noted as "optional sugar" in `PROJECT.md`) as a convenience *lookup* only — always verify the resolved address's bytecode/pin, never trust the ENS record as the sole authority |
| Reusing the same `sanitizeTemplate` hook scope assumption for on-chain templates without re-verifying it still covers fragment-injection paths added by sandbox hardening | A new "full-document `html()` → fragment + inline `<script>` re-execution" code path (explicit milestone feature) bypasses the existing sanitizer hook because it's a new injection point the hook wasn't written against | Extend/re-verify `sanitizeTemplate`'s call site coverage to include any new fragment-extraction code path introduced for on-chain `html()` handling — don't assume the existing hook automatically covers a structurally different template shape |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Generic "Failed to load dapp script" error for what's actually a CSP `blob:` block (Pitfall 7) | Developer/user can't tell "slow network" from "misconfigured sandbox" from "wrong chain" | Distinguish error causes in `dx:error` payloads — timeout vs. CSP-block vs. pin-mismatch vs. wrong-chain should all be different, actionable messages |
| Wallet-connect prompt required just to preview a dapp (if resolver always routes through `window.ethereum` even for a read-only `eth_call`) | Unnecessary friction for a simple page view; breaks Freedom's read-only-preview use case entirely if no fallback RPC exists | Support a wallet-free, configured-RPC read path for rendering (`eth_call` doesn't require a signature); reserve wallet connection for anything that actually needs it (the demo dapp's own on-chain interactions, not asset loading) |
| Router silently fails to update the URL under `history` mode inside the sandbox (Pitfall 9) | User can't share/bookmark a sub-route; back button behaves unpredictably | Default to (or strongly steer authors toward) `'hash'` mode for on-chain dapps in docs/cookbook, with a runtime warning if `'history'` is selected in a detected-sandboxed context |

## "Looks Done But Isn't" Checklist

- [ ] **Chunking/gzip pipeline:** Often missing byte-for-byte determinism verification — verify the same source produces identical compressed bytes across two separate CI runs, not just that decompression round-trips correctly.
- [ ] **web3:// resolver:** Often missing the buffer-then-verify-then-render ordering — verify by code review that no decoded byte reaches the DOM/module-execution path before the keccak comparison branch.
- [ ] **Sandbox hardening:** Often missing coverage of the storage-getter-throws case (not just `.getItem()` failing) — verify with a test double that throws on the `localStorage` property access itself, in every plugin, not just core.
- [ ] **Multi-chain deploy scripts:** Often missing a per-chain CREATE2-deployer-presence check — verify the deploy script fails loudly (not silently deploys to a non-deterministic address) if the canonical deployer isn't found on the target chain.
- [ ] **Demo dapp:** Often "works for the person who deployed it" only — verify a *second* person, with a wallet on a different default chain and no prior interaction with the contracts, can load and use it without manual chain-switching guidance outside the dapp itself.
- [ ] **`.gitignore`/secrets hygiene for `contracts/`:** Often assumed covered by existing root `.gitignore`/`gitleaks` config — verify explicitly that `contracts/out/`, `contracts/cache/`, and any `.env` used for `forge script --broadcast` are excluded and scanned, don't assume inheritance from the pre-existing TS-only config.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Chunk-ordering bug discovered post-mainnet-deploy | HIGH | Contracts are immutable — deploy a corrected version-per-contract (already the project's versioning model) and update the keccak pin/registry entry; cannot patch in place |
| Non-deterministic gzip pin drift discovered mid-development | LOW | Fix the build script's gzip parameters, regenerate, re-pin; costless if caught before any on-chain deploy |
| Trust-order (pin-after-execute) bug found via code review before shipping | LOW | Reorder the resolver code, add the missing test; costless if caught pre-release |
| Trust-order bug found *after* the bootstrap snippet is already published/copy-pasted into consumer dapps | HIGH | Publish a corrected bootstrap version, document the vulnerability class in the cookbook/security docs, and cannot force existing on-chain-deployed dapps using the old snippet to update (contracts are immutable) — this is why Pitfall 6 must be caught before Phase E ships the snippet |
| Core regression to IIFE/bundler path caught by existing vitest suite | LOW | Suite fails CI immediately; fix before merge — this is exactly what the existing 400+ spec suite is for |
| Core regression to IIFE/bundler path caught only after release (existing test was weakened to "accommodate" the change) | MEDIUM–HIGH | Requires a patch release with a `BREAKING CHANGE` footer if the fix itself changes behavior again; reinforces why Pitfall 12's "never loosen an existing test" rule matters |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|---------------|
| 0. Unverified ERC-8244 spec text | Foundry/Anvil dev-loop phase (start) | A pinned spec URL+SHA exists in `.planning/research/`, re-checked at each subsequent on-chain phase |
| 1. EIP-170/3860 chunk sizing confusion | On-chain publish tooling phase | forge test asserts chunk + prelude bytes stay under both caps with headroom |
| 2. Chunk-ordering/concatenation corruption | On-chain publish tooling phase | forge test with deliberately-reordered chunks proves resolver-side pin check rejects it |
| 3. Non-deterministic gzip → pin drift | On-chain publish tooling phase | CI step gzips fixture bytes twice, asserts byte-identical output |
| 4. DecompressionStream assumed present | web3:// resolver phase | Unit test stubs API absence, asserts clean `dx:error` not uncaught throw |
| 5. Opaque-origin storage throws | Core sandbox hardening phase | Test double that throws on storage-getter access; every plugin's `init()` still succeeds in degraded mode |
| 6. Execute-before-verify trust-order bug | web3:// resolver phase | Test supplies tampered bytes; asserts nothing executes/renders before pin comparison |
| 7. CSP blob: not implicitly allowed | Bootstrap snippet + demo dapp phase | Manual test against the real ERC-8244 default-deny sandbox CSP, not an assumed/loosened one |
| 8. `import` inside blob-loaded module fails | Core sandbox hardening + web3:// resolver phases (joint) | Multi-dependency on-chain dapp test proves the chosen non-`import`-reliant design works |
| 9. `history` mode breaks under `srcdoc`/opaque origin | Core sandbox hardening phase | Router construction check + `dx:error` on `pushState` failure; demo dapp validated in real sandbox with `'hash'` mode |
| 10. chainId mismatch on `eth_call` | web3:// resolver phase | Test asserts resolver compares URL chainId vs. provider chainId before calling, with a direct-RPC fallback path |
| 11. Foundry tooling pollutes/is-ignored-by JS gates, or leaks secrets | Foundry/Anvil dev-loop phase (first) | `make lint`/`make test` unaffected by `contracts/`; `gitleaks` scan confirmed to reach `contracts/`; no real key ever in a committed `.env` |
| 12. On-chain path regresses IIFE/bundler paths | Core sandbox hardening phase | No existing vitest spec modified (only added) to accommodate new on-chain code paths; full existing suite stays green throughout |

## Sources

- ERC-8244 spec text — **not locatable via public search as of 2026-08-16**; treat milestone context as working description only, pin the real source before implementation (Pitfall 0)
- [EIP-170: Contract code size limit](https://eips.ethereum.org/EIPS/eip-170)
- [EIP-3860: Limit and meter initcode](https://eips.ethereum.org/EIPS/eip-3860)
- [SSTORE2 (0xsequence)](https://github.com/0xsequence/sstore2/blob/master/README.md), [SSTORE2 gas optimization notes](https://doc.confluxnetwork.org/docs/general/build/smart-contracts/gas-optimization/sstore2/)
- [Foundry: Deterministic Deployments with CREATE2](https://www.getfoundry.sh/guides/deterministic-deployments-using-create2)
- [Foundry: Scripting/Deploying](https://getfoundry.sh/forge/deploying/)
- [Foundry Dependencies (submodules) docs](https://www.getfoundry.sh/projects/dependencies)
- [Soldeer](https://github.com/mario-eth/soldeer) / [Soldeer Foundry PR](https://github.com/foundry-rs/foundry/pull/7161)
- [foundry-toolchain GitHub Action](https://github.com/foundry-rs/foundry-toolchain)
- [MDN: DecompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream), [web.dev Compression Streams](https://web.dev/blog/compressionstreams)
- [Chainstack: eth_call/eth_estimateGas gas limitations](https://support.chainstack.com/hc/en-us/articles/900006235503-Gas-limitations-of-eth-call-and-eth-estimateGas-on-EVM-compatible-nodes), [dRPC eth_call docs](https://drpc.org/docs/ethereum-api/executingtransactions/eth_call), [Alchemy gas limits](https://www.alchemy.com/docs/reference/gas-limits-for-eth_call-and-eth_estimategas)
- [MDN: Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy), [sandboxed-iframe localStorage SecurityError issue](https://github.com/nexu-io/open-design/issues/1403)
- [Debian ReproducibleBuilds — gzip header timestamps](https://wiki.debian.org/ReproducibleBuilds/TimestampsInGzipHeaders), [CPython gzip OS-byte regression](https://github.com/python/cpython/issues/112346), [CPython gzip.compress non-determinism](https://github.com/python/cpython/issues/125260)
- [ERC-4804: Web3 URL to EVM Call Message Translation](https://eips.ethereum.org/EIPS/eip-4804), [ERC-6860 (draft refinement)](https://eips.ethereum.org/EIPS/eip-6860)
- [MDN CSP `sandbox` directive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/sandbox), [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [MDN JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [ES modules in browsers — Jake Archibald](https://jakearchibald.com/2017/es-modules-in-browsers/)
- [EIP-1193: Ethereum Provider JavaScript API](https://eips.ethereum.org/EIPS/eip-1193), [MetaMask Provider API docs](https://docs.metamask.io/metamask-connect/evm/reference/provider-api/)
- Internal: `/Users/derks/Development/Denizen/dxkit/.planning/PROJECT.md` (milestone constraints, deployment-target parity requirement), `/Users/derks/Development/Denizen/dxkit/src/lifecycle.ts` (existing loader/sanitizer/timeout/cache contracts to preserve), `/Users/derks/Development/Denizen/dxkit/docs/security.md` (existing CSP/sanitizer/storage limitations to extend, not duplicate), `/Users/derks/Development/Denizen/dxkit/Makefile` (existing `make audit`/`make test`/`make lint` gates that `contracts/` must not silently evade or pollute)

---
*Pitfalls research for: DxKit v1.2 On-Chain Deployment (ERC-8244) milestone*
*Researched: 2026-08-16*

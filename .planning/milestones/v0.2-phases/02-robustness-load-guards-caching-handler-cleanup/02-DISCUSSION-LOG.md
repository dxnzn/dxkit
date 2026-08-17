# Phase 2: Robustness — Load Guards, Caching & Handler Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 2-robustness-load-guards-caching-handler-cleanup
**Areas discussed:** Timeout policy, Timeout cancellation, Template caching, Handler cleanup

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Timeout policy | ROB-01 scope/default/blocking | ✓ |
| Timeout cancellation | ROB-01 abort vs stop-waiting, custom loaders | ✓ |
| Template caching | ROB-03 policy, invalidation API, scope | ✓ |
| Handler cleanup | ROB-04 trigger and scope | ✓ |

**Note:** ROB-02 (router sort cache) was presented as mechanical and excluded from discussion; captured as Claude's discretion (D-08).

---

## Timeout policy (ROB-01)

**Scope**

| Option | Description | Selected |
|--------|-------------|----------|
| Per-fetch | Each load gets its own clock; clean per-asset error | ✓ |
| Whole-mount budget | One deadline for the sequence; harder attribution | |
| Both | Per-fetch + overall cap; two knobs | |

**User's choice:** Per-fetch.

**Default value**

| Option | Description | Selected |
|--------|-------------|----------|
| Off by default | undefined → hang-forever unchanged; fully additive | |
| Ship a default | Default timeout applies; behavior change | ✓ |

**User's choice:** Ship a default.

**Exact value + opt-out**

| Option | Description | Selected |
|--------|-------------|----------|
| 30s, opt-out via 0/Infinity | Generous default, rarely trips real loads | ✓ |
| 10s, opt-out via 0/Infinity | Faster feedback, more false aborts | |
| 60s, opt-out via 0/Infinity | Conservative, mostly catches true hangs | |

**User's choice:** 30s, opt-out via 0/Infinity.

**Style timeout blocking?**

| Option | Description | Selected |
|--------|-------------|----------|
| Non-blocking, same as failure | Emit + continue, like today's style-load failure | ✓ |
| Style timeout aborts | Treat hung stylesheet as fatal | |

**User's choice:** Non-blocking, same as failure.
**Notes:** Behavior change (30s default) will carry a `BREAKING CHANGE:` footer + migration note documenting the `0`/`Infinity` opt-out.

---

## Timeout cancellation (ROB-01)

**Abort vs stop-waiting**

| Option | Description | Selected |
|--------|-------------|----------|
| True abort where possible | AbortController for fetch; remove script/link node | ✓ |
| Just stop waiting (Promise.race) | Underlying load keeps running | |

**User's choice:** True abort where possible.

**Custom loader reach**

| Option | Description | Selected |
|--------|-------------|----------|
| Built-in abort + race fallback for custom | Built-ins truly abort; custom loaders raced | ✓ |
| Pass AbortSignal to loaders | Cleanest, but breaks loader type contract | |
| Timeout only wraps built-in loaders | Custom loaders lose hang protection | |

**User's choice:** Built-in abort + race fallback for custom.
**Notes:** Loader type signatures unchanged (no AbortSignal param) to stay non-breaking for custom loaders; documented that custom loaders are not truly cancelled.

---

## Template caching (ROB-03)

**Policy**

| Option | Description | Selected |
|--------|-------------|----------|
| Default-on | Cached automatically; safe for immutable IPFS URLs | ✓ (modified) |
| Opt-in via config | Off unless enabled | |

**User's choice:** Default-on, **with a config opt-out** (`cacheTemplates: false`).

**Invalidation API**

| Option | Description | Selected |
|--------|-------------|----------|
| invalidateTemplate(url?) | One overloaded method for one/all | |
| clearTemplateCache() only | Wipe all, no per-URL | |
| Both clearTemplateCache() + invalidateTemplate(url) | Two explicit methods | ✓ |

**User's choice:** Both `clearTemplateCache()` + `invalidateTemplate(url)`.

**Cache scope**

| Option | Description | Selected |
|--------|-------------|----------|
| Per-manager, wraps any loader | Map in closure; covers custom loaders; test isolation | ✓ |
| Module-level shared cache | Global; leaks across instances | |
| Inside defaultTemplateLoader only | Custom loaders get nothing | |

**User's choice:** Per-manager, wraps any loader.
**Notes:** Only successful HTML cached; a cache hit skips the fetch (so no timeout on re-mount).

---

## Handler cleanup (ROB-04)

**Trigger**

| Option | Description | Selected |
|--------|-------------|----------|
| Subscribe to dx:dapp:disabled | Decoupled, no new shell API | ✓ |
| New explicit method + shell call | Couples shell to settings plugin | |

**User's choice:** Subscribe to `dx:dapp:disabled`.

**Cleanup scope**

| Option | Description | Selected |
|--------|-------------|----------|
| Only X's own handlers | Sweep X:* + dappHandlers[X]; keep _shell:X bridge | ✓ |
| X's handlers + the _shell toggle for X | Would break the re-enable path | |

**User's choice:** Only X's own handlers.

**Disable-only vs also-unmount**

| Option | Description | Selected |
|--------|-------------|----------|
| Disable only | Handlers survive normal navigation | ✓ |
| Also clean on unmount | Forces re-register per navigation | |

**User's choice:** Disable only.
**Notes:** Re-enabling a dapp remounts it and re-registers handlers — acceptable and expected.

---

## Claude's Discretion

- ROB-02 router sort cache — sort once at construction, reuse (D-08).
- Timeout `Error` message wording; shared `withTimeout` helper vs inline.
- Exact config field names (`timeout`, `cacheTemplates`) if clearer names emerge.
- URL normalization vs verbatim match in `invalidateTemplate`.
- Per-change unit-test approach (dedicated stress suites are Phase 4).

## Deferred Ideas

- `AbortSignal` in loader signatures (rejected — breaks type contract).
- Whole-mount timeout budget / overall cap (rejected — per-fetch chosen).
- Caching scripts/styles by URL with invalidation (out of scope — template-only).
- SEC-01 sanitizer hook / SEC-02 wallet storage key — Phase 3.
- Stress/edge-case/handler-cleanup test suites (TEST-01/02/03) — Phase 4.

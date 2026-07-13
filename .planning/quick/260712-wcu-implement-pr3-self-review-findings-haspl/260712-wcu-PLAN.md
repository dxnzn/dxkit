---
phase: quick-260712-wcu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/shell.ts
  - src/types/shell.ts
  - src/lifecycle.ts
  - plugins/wallet/src/index.ts
  - tests/shell.test.ts
  - tests/lifecycle.test.ts
  - plugins/wallet/tests/wallet.test.ts
autonomous: true
requirements:
  - FIND-1-hasPlugin-override
  - FIND-2-unbounded-sanitizer
  - FIND-3-connected-without-address
  - FIND-4-cause-preservation
  - FIND-5-object-hasown

must_haves:
  truths:
    - "A consumer-supplied lifecycle.hasPlugin (including hasPlugin: undefined) via createShell() cannot disable required-plugin enforcement."
    - "A never-settling sanitizeTemplate aborts the mount after the configured timeout, fail-closed, with dx:error source lifecycle:<id>:sanitize and no injection."
    - "A provider reporting connected: true with no address emits dx:error (source plugin:wallet:state) and does not fire a connected event."
    - "The flat-loader guard rejects own keys whose value is undefined and ignores prototype-chain keys."
    - "The sanitize catch preserves the original thrown value as Error.cause."
  artifacts:
    - src/shell.ts
    - src/types/shell.ts
    - src/lifecycle.ts
    - plugins/wallet/src/index.ts
  key_links:
    - "createShell hasPlugin binding must be spread-last so the registry-backed check always wins."
    - "sanitize timeout reuses the existing timeoutMs + isTimeoutActive opt-out so timeout: 0/Infinity still disables the guard."
---

<objective>
Implement 5 confirmed code-review findings from PR #3 self-review across the shell, lifecycle,
and wallet subsystems. Each finding is a locked requirement — hardening only, no behavior drift
beyond the stated fixes.

Purpose: Close bypass/hang/silent-failure gaps flagged by self-review so the alpha stays
trustworthy — failures visible, never silent; required-plugin enforcement un-bypassable; the
Phase 2 hang guard extended to the sanitizer seam.
Output: Hardened src/shell.ts, src/types/shell.ts, src/lifecycle.ts, plugins/wallet/src/index.ts,
plus regression tests for the three non-trivial findings.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./.claude/CLAUDE.md

@src/shell.ts
@src/types/shell.ts
@src/lifecycle.ts
@plugins/wallet/src/index.ts
@tests/shell.test.ts
@tests/lifecycle.test.ts
@plugins/wallet/tests/wallet.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Shell guard hardening — hasPlugin override + Object.hasOwn (FIND-1, FIND-5)</name>
  <files>src/shell.ts, src/types/shell.ts, tests/shell.test.ts</files>
  <action>
    FIND-1 (runtime + type, both layers): In createShell() (src/shell.ts ~line 42-45), the
    createLifecycleManager call currently spreads `...lifecycleOptions` AFTER the registry-backed
    `hasPlugin`, letting `lifecycle: { hasPlugin: undefined }` clobber it (createLifecycleManager
    then falls back to () => true, disabling required-plugin validation). Reorder so the shell's
    binding wins: spread `...lifecycleOptions` FIRST, then set `hasPlugin: (name) => registry.has(name)`
    last. Keep the existing arrow binding; only the ordering changes. Add a one-line "why" comment
    noting the binding is placed last so a consumer-supplied hasPlugin can't disable required-plugin
    enforcement.

    Then in src/types/shell.ts, change the ShellConfig.lifecycle field type from
    `LifecycleManagerOptions` to `Omit<LifecycleManagerOptions, 'hasPlugin'>` so typed consumers
    cannot pass hasPlugin at all. Update the field's doc comment to note hasPlugin is shell-owned
    and not consumer-configurable.

    FIND-5 (src/shell.ts ~line 21): the flat-loader guard uses `key in config`, which also matches
    prototype-chain keys. Switch the filter predicate to `Object.hasOwn(config, key)`. This still
    catches an own key explicitly set to undefined (preserving D-05 intent) while ignoring inherited
    keys. Leave the throw message and D-05 comment intact.

    Add a regression test in tests/shell.test.ts proving FIND-1: construct a shell via
    createShell({ ...testLoaders, plugins: {}, manifests: [...], lifecycle: { hasPlugin: undefined } })
    against a manifest that requires a plugin (a manifest with a requiredPlugins/plugins entry that
    is NOT registered), and assert the mount is refused — a dx:error is emitted (source
    lifecycle:<id>:...) and the dapp does not mount. Follow the existing shell.test.ts factory-per-test
    style and testLoaders fixture. Mirror the required-plugin assertion pattern already used elsewhere
    in the lifecycle/shell tests; if none exists, drive a route to a manifest declaring an unregistered
    required plugin and assert getCurrentRoute/current dapp does not become that dapp.
  </action>
  <verify>
    <automated>make test</automated>
  </verify>
  <done>
    createShell places hasPlugin after the lifecycleOptions spread; ShellConfig.lifecycle is
    Omit<LifecycleManagerOptions, 'hasPlugin'>; the flat-loader guard uses Object.hasOwn; the new
    shell test proves a consumer-supplied hasPlugin (including undefined) cannot disable required-plugin
    enforcement; lint + full suite pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Lifecycle sanitizer timeout + cause preservation (FIND-2, FIND-4)</name>
  <files>src/lifecycle.ts, tests/lifecycle.test.ts</files>
  <action>
    FIND-2 (src/lifecycle.ts ~line 286-295): the mount path awaits `sanitizeTemplate(html, manifest)`
    directly with no hang guard, so a never-settling sanitizer reintroduces the mount-forever hang
    that Phase 2's timeout machinery (withTimeout / isTimeoutActive at ~line 26-64) eliminated for
    loaders. Bound the sanitizer call with the same timeout discipline: reuse the closure's `timeoutMs`
    (already `options.timeout ?? 30000`, ~line 207) and honor the `isTimeoutActive` opt-out so
    `timeout: 0` / `Infinity` still disables the guard (D-03). Because the sanitizer takes two args
    and returns `string | Promise<string>` (unlike the single-arg loaders), the sanitizer is opaque
    consumer code that can't be truly cancelled — a Promise.race-style hang guard mirroring withTimeout
    is fine: race `Promise.resolve(sanitizeTemplate(html, manifest))` against a rejecting timer, and
    clear the timer on settle (the WR-01 clear-on-settle discipline). A timeout rejects with a
    Timed-out-style message; because that rejection flows into the EXISTING sanitize try/catch, it
    fails closed exactly like a sanitizer throw — dx:error source `lifecycle:<id>:sanitize`, no
    injection into container.innerHTML, and the mount aborts (return). Do not add a new dx:error site;
    let the existing catch handle it. Add a short "why" comment noting the sanitizer is opaque
    consumer code guarded the same way custom loaders are.

    FIND-4 (same sanitize catch, ~line 292): the catch builds `new Error(String(err))` for non-Error
    throws, dropping the original value. Align to the cause-preserving form used on the wallet reconnect
    path: `new Error(String(err), { cause: err })`. Preserve the existing
    `err instanceof Error ? err : ...` shape — only the else branch changes to attach { cause: err }.

    Add a fake-timers regression test in tests/lifecycle.test.ts (follow the `describe('load timeout')`
    block pattern ~line 472: vi.useFakeTimers in beforeEach, vi.useRealTimers in afterEach, a
    `neverResolves` helper, advanceTimersByTimeAsync). Configure a lifecycle manager with a
    never-resolving async sanitizeTemplate and `timeout: 30`, mount a manifest with a template, advance
    timers past the timeout, await the mount, and assert: dx:error fired once with source
    lifecycle:<id>:sanitize, no dx:dapp:mounted, container.innerHTML is '' (or unchanged / not injected),
    and getCurrentDapp() is null. Reuse the template-loader stub style from the existing sanitizeTemplate
    tests (~line 787) so loadTemplate resolves and only the sanitizer hangs.
  </action>
  <verify>
    <automated>make test</automated>
  </verify>
  <done>
    The sanitizer call is bounded by timeoutMs with the isTimeoutActive opt-out honored; a never-settling
    sanitizer aborts the mount fail-closed with source lifecycle:<id>:sanitize and no injection; the
    sanitize catch preserves the thrown value as { cause: err }; the new fake-timers test passes; lint +
    full suite pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wallet connected-without-address visibility (FIND-3)</name>
  <files>plugins/wallet/src/index.ts, plugins/wallet/tests/wallet.test.ts</files>
  <action>
    FIND-3 (plugins/wallet/src/index.ts updateState, ~line 212-225): the connected-event guard
    `newState.connected && newState.address && !wasConnected` silently drops the connected event when
    a custom provider reports `connected: true` with no address — while `wasConnected` still flips via
    `state = { ...newState }`, so the inconsistency is swallowed. Per the project's "failures are
    visible, never silent" posture, add a branch: when `newState.connected` is truthy but
    `newState.address` is falsy, emit dx:error with source `plugin:wallet:state` and a message
    describing the provider-contract violation (connected state reported with no address). Guard on
    `dx` being present (the existing `if (!dx) return;` already covers this — place the new check after
    it). Do NOT change the existing connected/disconnected/changed emission guards otherwise; the new
    error branch is additive and sits alongside them (e.g. an early check that emits the error, the
    existing address-bearing branches unchanged). Add a one-line "why" comment referencing the
    visible-not-silent contract.

    Add a test in plugins/wallet/tests/wallet.test.ts: create a mock WalletProvider whose
    onStateChange, when connected, drives `{ connected: true, address: null, chainId: 0, provider: ... }`
    into the plugin (i.e. connect() triggers updateState with connected true and no address). Register
    it via createWallet({ providers: [mock] }), init with the test ctx, subscribe handlers to both
    dx:error and dx:plugin:wallet:connected on ctx.events, connect, and assert: dx:error was emitted
    with source plugin:wallet:state and no dx:plugin:wallet:connected event fired. Follow the existing
    "emits dx:plugin:wallet:connected event" test (~line 336) and the custom-provider factory style
    already present in the file.
  </action>
  <verify>
    <automated>make test</automated>
  </verify>
  <done>
    updateState emits dx:error (source plugin:wallet:state) when connected is truthy with no address and
    suppresses the connected event; the existing emission guards are unchanged; the new mock-provider
    test proves dx:error fires and no connected event fires; lint + full suite pass.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| consumer config → shell | Untyped/IIFE consumers can pass arbitrary lifecycle options into createShell(). |
| custom sanitizer/provider → framework | Opaque consumer code (sanitizeTemplate, WalletProvider) runs inside the mount/state path. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-wcu-01 | Elevation of Privilege | createShell lifecycle.hasPlugin | high | mitigate | FIND-1: shell-owned hasPlugin bound spread-last + Omit type so required-plugin enforcement cannot be disabled by consumer config. |
| T-wcu-02 | Denial of Service | lifecycle sanitizeTemplate | medium | mitigate | FIND-2: bound the opaque sanitizer with the existing timeout guard; a never-settling sanitizer fails closed instead of hanging the mount. |
| T-wcu-03 | Repudiation / Information Disclosure | wallet updateState | low | mitigate | FIND-3: emit dx:error on connected-without-address so a provider contract violation is visible, not silently swallowed. |
</threat_model>

<verification>
- `make test` passes (Biome lint + full vitest suite) after all three tasks.
- New shell test: consumer-supplied lifecycle.hasPlugin (incl. undefined) cannot disable required-plugin enforcement.
- New lifecycle fake-timers test: never-settling sanitizer aborts mount with source lifecycle:<id>:sanitize, no injection.
- New wallet test: connected-without-address emits dx:error (plugin:wallet:state) and fires no connected event.
- Manual scan: src/shell.ts uses Object.hasOwn in the flat-loader guard; sanitize catch uses { cause: err }.
</verification>

<success_criteria>
All 5 findings implemented as specified, three regression tests added and green, `make test` passes,
no new runtime dependencies, changes committed with conventional-commit messages (scoped, "why" body,
Co-Authored-By footer).
</success_criteria>

<output>
Create `.planning/quick/260712-wcu-implement-pr3-self-review-findings-haspl/260712-wcu-SUMMARY.md` when done.
</output>

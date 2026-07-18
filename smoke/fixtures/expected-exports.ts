// The maintained fixture for FCT-04's exhaustive export-key assertion (D-05). A dropped, renamed,
// or added export key on any of the 5 packages must be reflected here for the smoke test to stay
// green — this is the deliberate drift-detection point, not an incidental list.
//
// createEthereumWallet is intentionally included despite being @deprecated (JSDoc-only, no runtime
// effect) — silently dropping a deprecated export without a BREAKING CHANGE bump is exactly the
// drift this fixture exists to catch.
export const EXPECTED_EXPORTS = {
  core: [
    'createEventBus',
    'createEventRegistry',
    'createLifecycleManager',
    'createPluginRegistry',
    'createRouter',
    'createShell',
  ],
  wallet: ['createEIP1193Provider', 'createEthereumWallet', 'createLocalWalletProvider', 'createWallet'],
  auth: ['createPassthroughAuth'],
  theme: ['createCSSTheme'],
  settings: ['createSettings'],
} as const;

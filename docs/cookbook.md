[Getting Started](getting-started.md) | [Dapp Development](dapp-development.md) | [Plugin Development](plugin-development.md) | [System Internals](system-internals.md) | [Events Reference](events-reference.md) | [API Reference](api-reference.md) | **Cookbook**

---

# Cookbook

Patterns and recipes for common DxKit tasks. Each recipe is self-contained.

[Minimal Shell](#minimal-shell) | [Hash Routing](#hash-routing) | [Permission-Gated Dapps](#permission-gated-dapps) | [Re-render on Settings Change](#re-render-on-settings-change) | [Theme-Aware Dapp](#theme-aware-dapp) | [Programmatic Navigation](#programmatic-navigation) | [Custom Events Between Dapps](#custom-events-between-dapps) | [Optional Dapps with User Toggles](#optional-dapps-with-user-toggles) | [Sub-path Routing Within a Dapp](#sub-path-routing-within-a-dapp) | [Standalone Dapp Fallback](#standalone-dapp-fallback) | [Remote Manifests with Overrides](#remote-manifests-with-overrides) | [Building a Settings UI](#building-a-settings-ui) | [Multiple Wallet Providers](#multiple-wallet-providers)

---

## Minimal Shell

The smallest working setup — one dapp, no plugins:

```html
<div id="dx-mount"></div>
<script src="https://unpkg.com/dxkit/dist/index.global.js"></script>
<script>
  const shell = DxKit.createShell({
    manifests: [{
      id: 'home', name: 'Home', version: '1.0.0',
      route: '/', entry: '/home.js', nav: { label: 'Home' },
    }],
  });
  shell.init();
</script>
```

```js
// home.js
window.addEventListener('dx:mount', (e) => {
  if (e.detail.id !== 'home') return;
  e.detail.container.innerHTML = '<h1>Hello, DxKit</h1>';
});
```

---

## Hash Routing

Use hash mode for static hosting, IPFS, or `file:///` environments:

```js
const shell = DxKit.createShell({
  mode: 'hash',
  manifests: [/* ... */],
});
```

Links use `#/path` format:

```html
<a href="#/dashboard">Dashboard</a>
<a href="#/settings">Settings</a>
```

Programmatic navigation works the same:

```js
const dx = window.__DXKIT__;
dx.router.navigate('/dashboard'); // sets hash to #/dashboard
```

---

## Permission-Gated Dapps

Require plugins before mounting:

```json
{
  "id": "vault",
  "requires": { "plugins": ["wallet", "auth"] },
  "entry": "/vault/dapp.js",
  "route": "/vault",
  "nav": { "label": "Vault" }
}
```

Show feedback when a gated dapp fails to mount:

```js
const dx = window.__DXKIT__;
dx.events.on('dx:error', ({ source, error }) => {
  if (source.startsWith('lifecycle:') && error.message.includes('Missing required plugin')) {
    showBanner('Please connect your wallet to access this dapp.');
  }
});
```

---

## Re-render on Settings Change

Subscribe to setting changes and update the UI:

```js
window.addEventListener('dx:mount', (e) => {
  if (e.detail.id !== 'my-dapp') return;

  const dx = window.__DXKIT__;
  const container = e.detail.container;

  function render() {
    const theme = dx.settings?.get('my-dapp', 'colorScheme') ?? 'blue';
    container.innerHTML = `<div class="card" style="--accent: ${theme}">Content</div>`;
  }

  render();
  const unsub = dx.settings?.onChange('my-dapp', 'colorScheme', render);

  window.addEventListener('dx:unmount', function cleanup(e2) {
    if (e2.detail.id !== 'my-dapp') return;
    unsub?.();
    window.removeEventListener('dx:unmount', cleanup);
  });
});
```

---

## Theme-Aware Dapp

Read and respond to theme changes:

```js
window.addEventListener('dx:mount', (e) => {
  if (e.detail.id !== 'my-dapp') return;

  const dx = window.__DXKIT__;
  const theme = dx?.getPlugin('theme');
  if (!theme) return;

  const container = e.detail.container;

  function render() {
    const mode = theme.getResolvedMode(); // 'light' or 'dark'
    container.style.background = mode === 'dark' ? '#1a1a1a' : '#fff';
  }

  render();
  const unsub = theme.onModeChange(() => render());

  window.addEventListener('dx:unmount', function cleanup(e2) {
    if (e2.detail.id !== 'my-dapp') return;
    unsub();
    window.removeEventListener('dx:unmount', cleanup);
  });
});
```

Or use CSS with the `data-mode` attribute set on `<html>`:

```css
#dx-mount .my-widget { background: #fff; color: #333; }
[data-mode="dark"] #dx-mount .my-widget { background: #222; color: #ddd; }
```

---

## Programmatic Navigation

Navigate from within a dapp:

```js
const dx = window.__DXKIT__;
dx.router.navigate('/settings');
```

Build a link that navigates without page reload:

```js
const dx = window.__DXKIT__;
const link = document.createElement('a');
link.href = '/settings';
link.textContent = 'Settings';
link.addEventListener('click', (e) => {
  e.preventDefault();
  dx.router.navigate('/settings');
});
```

---

## Custom Events Between Dapps

Type your event payloads so both sides get autocomplete and validation:

```ts
// shared types (e.g. in a shared package or ambient declaration)
declare module 'dxkit' {
  interface EventMap {
    'cart:item:added': { productId: string; quantity: number };
    'cart:cleared': Record<string, never>;
  }
}
```

```js
// Dapp A — register and emit
const dx = window.__DXKIT__;
dx.eventRegistry.registerEvent('cart', [
  { name: 'cart:item:added' },
  { name: 'cart:cleared' },
]);

dx.events.emit('cart:item:added', { productId: '123', quantity: 1 });
```

```js
// Dapp B — listen
const dx = window.__DXKIT__;
dx.events.on('cart:item:added', ({ productId, quantity }) => {
  updateCartBadge(quantity);
});
```

---

## Optional Dapps with User Toggles

Declare a dapp as optional:

```json
{
  "id": "analytics",
  "optional": true,
  "enabled": false
}
```

Toggle from code:

```js
const dx = window.__DXKIT__;
dx.enableDapp('analytics');    // adds to router, emits dx:dapp:enabled
dx.disableDapp('analytics');   // removes from router, emits dx:dapp:disabled
dx.isDappEnabled('analytics'); // false
```

With the [settings plugin](plugins/settings.md), toggles appear automatically in the "Dapps" section.

---

## Sub-path Routing Within a Dapp

Handle internal routes beyond the manifest's route prefix:

```js
window.addEventListener('dx:mount', (e) => {
  if (e.detail.id !== 'docs') return;

  const basePath = '/docs';
  const subPath = e.detail.path.replace(basePath, '') || '/';

  const routes = {
    '/': () => renderIndex(e.detail.container),
    '/api': () => renderAPI(e.detail.container),
    '/guides': () => renderGuides(e.detail.container),
  };

  (routes[subPath] || routes['/'])(e.detail.container);
});
```

---

## Standalone Dapp Fallback

Dapps that work both inside the shell and independently:

```js
function render(container) {
  container.innerHTML = '<h1>My Dapp</h1>';
}

if (window.__DXKIT__) {
  window.addEventListener('dx:mount', (e) => {
    if (e.detail.id !== 'my-dapp') return;
    render(e.detail.container);
  });
} else {
  render(document.getElementById('app'));
}
```

---

## Remote Manifests with Overrides

Fetch manifests from URLs and customize them:

```js
const shell = DxKit.createShell({
  dapps: [
    { manifest: '/apps/blog/manifest.json' },
    {
      manifest: '/apps/tools/manifest.json',
      overrides: {
        nav: { order: 99, group: 'admin' },  // rearrange nav
        requires: { plugins: ['wallet'] },    // add requirement gate
      },
    },
  ],
});
```

Deep merge rules: objects merge recursively, arrays replace entirely, `undefined` is skipped.

---

## Building a Settings UI

Use `getSections()` to generate a form dynamically:

```js
const dx = window.__DXKIT__;
const sections = dx.settings.getSections();

for (const section of sections) {
  const heading = document.createElement('h2');
  heading.textContent = section.label;
  form.appendChild(heading);

  for (const def of section.definitions) {
    const current = dx.settings.get(section.id, def.key) ?? def.default;

    if (def.type === 'boolean') {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!current;
      checkbox.addEventListener('change', () => {
        dx.settings.set(section.id, def.key, checkbox.checked);
      });
      form.appendChild(checkbox);
    }
    // ... handle other types: select, text, number, multiselect
  }
}
```

The `_shell` section contains auto-generated toggles for optional dapps.

---

## Multiple Wallet Providers

Configure both browser wallet and local dev provider:

```js
const wallet = DxWallet.createWallet({
  providers: [
    DxWallet.createEIP1193Provider(),            // MetaMask, Brave, etc.
    DxWallet.createLocalWalletProvider(),         // instant dev wallet
  ],
});

const shell = DxKit.createShell({
  plugins: { wallet },
  // ...
});
```

Connect to a specific provider:

```js
const dx = window.__DXKIT__;
const wallet = dx?.getPlugin('wallet');

// First available provider
await wallet.connect();

// Specific provider by ID
await wallet.connect('eip1193');
await wallet.connect('local');

// List all providers
const providers = wallet.getProviders();
// [{ id: 'eip1193', name: 'Browser Wallet', ... }, { id: 'local', name: 'Local (Dev)', ... }]
```

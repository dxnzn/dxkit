<!-- generated-by: gsd-doc-writer -->
[Getting Started](getting-started.md) | [Dapp Development](dapp-development.md) | [Plugin Development](plugin-development.md) | [System Internals](system-internals.md) | [Events Reference](events-reference.md) | [API Reference](api-reference.md) | [Cookbook](cookbook.md)

---

# Security

DxKit enforces no security policy of its own — it dynamically injects `<script>`/`<link>` elements,
fetches manifests and templates, and writes template HTML into the mount container via `innerHTML`.
The browser's Content-Security-Policy (CSP) and a template sanitizer are what turn those operations
into a hardened deployment. This doc covers both, plus every limitation worth knowing before you
trust DxKit with real data.

[Content Security Policy](#content-security-policy) | [Sanitizing Templates](#sanitizing-templates) | [Limitations](#limitations)

---

## Content Security Policy

Three DxKit operations map directly to CSP directives:

- **`script-src`** governs `manifest.entry` and `manifest.dependencies[]` — loaded as real
  `<script type="module">` elements (`src/lifecycle.ts`'s `defaultScriptLoader`), so they execute
  and are subject to `script-src`.
- **`style-src`** governs `manifest.styles` — loaded as a `<link rel="stylesheet">` element
  (`defaultStyleLoader`).
- **`connect-src`** governs every `fetch()` DxKit makes: `manifest.template`, the `registryUrl`
  fallback, and each `dapps[].manifest` URL.

`manifest.template` HTML is written with `container.innerHTML = html`, not injected as a live
`<script>` node — the DOM spec never executes `<script>` tags parsed via `innerHTML`. That does
**not** cover every injection vector: inline event-handler attributes (`onerror`, `onload`) and
`javascript:` URLs in unsanitized template HTML do execute in the browser, and those are exactly
what `script-src` without `'unsafe-inline'` blocks. CSP and the [template sanitizer](#sanitizing-templates)
are complementary layers, not redundant ones — CSP without a sanitizer still leaves untrusted
template markup free to deface the page or exfiltrate data through allowed origins.

### Header vs. `<meta>` tag

A real HTTP response header is enforced in full. A `<meta http-equiv="Content-Security-Policy">`
tag is not — `frame-ancestors`, `report-uri`/`report-to`, and `sandbox` are silently dropped by the
browser when set via `<meta>`. If your deployment can only control a `<meta>` tag (no server-side
header, e.g. IPFS gateways), those three directives cannot be enforced at all; don't write examples
that imply otherwise.

**Meta-safe:** `default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `font-src`,
`object-src`, `base-uri`, `form-action`.
**Header-only:** `frame-ancestors`, `report-uri`/`report-to`, `sandbox`.

### Same-origin static host

Prefer the header (set at your server or hosting platform — nginx, Apache, Vercel, Netlify, etc.):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

`'self'` on `script-src`/`style-src`/`connect-src` permits every DxKit loader as long as dapp
assets and manifests are served from the same origin as the shell. `frame-ancestors 'none'` blocks
embedding in a foreign `<iframe>` — header only.

`<meta>` fallback (drops `frame-ancestors` per the caveat above):

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'">
```

### IPFS gateway

Public IPFS gateways serve content over HTTP but the CID owner controls no response headers — only
a `<meta>` tag reaches the browser, so `frame-ancestors`/`report-uri`/`sandbox` are unavailable on
this deployment shape entirely.

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'">
```

Plain path-style gateways (`https://gateway.example/ipfs/<cid>/...`) serve many people's content
from one shared origin, with no per-CID subdomain isolation — `'self'` on that origin is a weaker
boundary than on a host you control alone. Subdomain-style gateways (`https://<cid>.ipfs.gateway.example/`)
give each CID its own origin and restore the isolation `'self'` implies elsewhere.

### Dapps loading cross-origin assets

When `manifest.entry`, `manifest.dependencies`, `manifest.styles`, or `manifest.template` point at
a CDN or API on another origin, allowlist exactly those origins per directive — not a wildcard:

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com; style-src 'self' https://cdn.example.com; connect-src 'self' https://cdn.example.com https://api.example.com; img-src 'self' https://cdn.example.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

`script-src`/`style-src` need every origin `manifest.entry`/`manifest.dependencies`/`manifest.styles`
actually resolve to. `connect-src` needs every origin `manifest.template`/`registryUrl`/`dapps[].manifest`
fetch from, plus any origin a mounted dapp itself calls at runtime — dapp code runs under the page's
CSP even though DxKit trusts it as an entry script.

None of the three examples above block DxKit's own dynamic injection — verify a new policy against
the loader list at the top of this section before shipping it.

## Sanitizing Templates

`manifest.template` HTML is fetched and written via `innerHTML` on every mount, including template
cache hits (`src/lifecycle.ts`). DxKit ships no built-in sanitizer — `sanitizeTemplate` is an
optional, bring-your-own hook run on the fetched HTML immediately before injection. A throw or
rejection aborts the mount (fail-closed); with no sanitizer configured, injection is byte-identical
to unsanitized behavior.

Don't hand-roll a sanitizer — a regex or strip-tags pass is not real HTML sanitization and will miss
attribute-based vectors. Use a maintained library; the example below is [DOMPurify](https://github.com/cure53/DOMPurify).

**Bundler/ESM:**

```javascript
import DOMPurify from 'dompurify';

DxKit.createShell({
  lifecycle: {
    sanitizeTemplate: (html) => DOMPurify.sanitize(html),
  },
});
```

**IIFE/static** — no bundler, DOMPurify loaded as a global via a pinned vendored or CDN build:

```html
<script src="vendor/purify.min.js"></script>
<script src="vendor/dxkit.global.js"></script>
<script>
  const shell = DxKit.createShell({
    lifecycle: {
      // window.DOMPurify — same .sanitize(html) call shape as the ESM import.
      sanitizeTemplate: (html) => DOMPurify.sanitize(html),
    },
  });
</script>
```

**Scope limit:** `sanitizeTemplate` runs on `manifest.template` HTML only. `manifest.entry` and
`manifest.dependencies` are loaded and executed exactly as configured — dapp entry scripts are
trusted code, never passed through the sanitizer. Sanitizing a template does not make an untrusted
entry script safe to load.

## Limitations

Everything worth knowing before trusting DxKit with real data:

- **Template and entry-script trust.** DxKit does no URL allowlisting of its own — `manifest.template`,
  `manifest.entry`, `manifest.dependencies`, and `manifest.styles` are fetched and injected exactly
  as configured. Only point manifests at sources you trust.
- **Sanitizer scope.** `sanitizeTemplate` covers template HTML only — see above.
- **`localStorage` is plaintext.** The wallet, theme, and settings plugins persist to `localStorage`
  unencrypted. Do not persist secrets through any of them.
- **`storageKey` collision.** Wallet's `storageKey` is configurable (default `'dxkit:wallet'`).
  Theme's (`'dxkit:theme'`) and settings' (`'dxkit:settings'`) are not — two DxKit apps sharing an
  origin at their default keys collide on theme and settings persistence, though not on wallet
  selection.
- **IIFE globals can collide.** IIFE builds attach to `window.DxKit`/`DxWallet`/`DxAuth`/`DxTheme`/`DxSettings`.
  Any other script on the page assigning to the same name overwrites it silently.
- **`shell.destroy()` is required before creating another shell.** The router binds `popstate`/`hashchange`
  listeners to `window` and does not clean them up on its own — a second shell created without
  destroying the first accumulates duplicate listeners firing on every navigation.
- **Single dapp mounted at a time.** Mounting a dapp always unmounts whatever was previously mounted.
  There is no multi-dapp or split-view mode.

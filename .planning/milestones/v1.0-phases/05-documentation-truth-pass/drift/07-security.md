# Drift Log — Plan 05-07 (Security)

`docs/security.md` is a net-new file (D-08) — there is no prior version to diff. This entry records
the doc's content and its source basis instead of a before/after table.

## docs/security.md — net-new

| Section | Content | Source basis |
|---|---|---|
| Content Security Policy — directive mapping | `script-src` ↔ `manifest.entry`/`manifest.dependencies` (real `<script type="module">` nodes); `style-src` ↔ `manifest.styles` (`<link rel="stylesheet">`); `connect-src` ↔ every `fetch()` (template, `registryUrl`, `dapps[].manifest`) | `src/lifecycle.ts` (`defaultScriptLoader`, `defaultStyleLoader`, `defaultTemplateLoader`), `src/shell.ts:208,260` (`loadDappManifest`/registry `fetch()` call sites) |
| Content Security Policy — `innerHTML` execution note | `<script>` tags parsed via `innerHTML` do not execute (DOM spec); inline event-handler attributes and `javascript:` URLs in unsanitized template HTML do execute and are what `script-src` without `'unsafe-inline'` blocks — CSP and the sanitizer are complementary, not redundant | `src/lifecycle.ts:397,399` (`container.innerHTML = ...`); CSP Level 2/3 spec behavior (well-established, cited via MDN in 05-RESEARCH.md's CSP research) |
| Content Security Policy — header vs. `<meta>` + meta-safe directive list | `frame-ancestors`/`report-uri`/`report-to`/`sandbox` are not honored in a `<meta http-equiv="Content-Security-Policy">` tag; meta-safe list given | 05-RESEARCH.md §"Common Pitfalls → Pitfall 4" + Assumptions Log A1 (CITED, MEDIUM confidence per D-09's reasoned-not-browser-tested scope) |
| Content Security Policy — three deployment-shape examples | Same-origin static host (header preferred + `<meta>` fallback), IPFS gateway (`<meta>`-only, path-style-gateway shared-origin caveat), cross-origin-asset dapps (per-origin allowlisting) | 05-RESEARCH.md §"Open Questions" #2 (header+meta for same-origin, meta-only for IPFS) + Assumptions Log A2 (IPFS gateway origin-isolation caveat, sourced from `ipfs/in-web-browsers#196`, directional not normative) |
| Sanitizing Templates — ESM/bundler recipe | `import DOMPurify from 'dompurify'; ... sanitizeTemplate: (html) => DOMPurify.sanitize(html)` | 05-RESEARCH.md §"Code Examples" (verified against `docs/configuration.md:68-75`, already correct, reused verbatim) |
| Sanitizing Templates — IIFE/static recipe | `window.DOMPurify` global, pinned vendored/CDN build, identical `.sanitize(html)` call shape | 05-RESEARCH.md §"Code Examples" (net-new for this doc) + Assumptions Log A3 (UMD call-shape parity, standard but not independently re-verified against a live DOMPurify build this session) |
| Sanitizing Templates — scope limit + don't-hand-roll | `sanitizeTemplate` covers `manifest.template` HTML only; `manifest.entry`/`manifest.dependencies` are never passed through it; no homegrown regex/strip-tags sanitizer suggested | `src/lifecycle.ts:378-401` (sanitize step scoped to the template branch only, entry/dependency loading is separate code below it); 05-RESEARCH.md §"Don't Hand-Roll" (Phase 3 D-02 already rejected a built-in sanitizer as false security) |
| Limitations — template/entry-script trust | No URL allowlisting; manifest fields fetched/injected as configured | `.planning/codebase/CONCERNS.md` §"XSS Risk in Template Injection" |
| Limitations — sanitizer scope | Restated from the Sanitizing Templates section | (see above) |
| Limitations — localStorage plaintext | Wallet/theme/settings persist unencrypted; don't persist secrets | `.planning/codebase/CONCERNS.md` §"Settings Storage Lacks Encryption" |
| Limitations — `storageKey` collision | Wallet's `storageKey` is configurable (Phase 3 SEC-02); theme's/settings' are not | 05-RESEARCH.md §"Code Truth: Config Defaults" — `CSSThemeOptions.storageKey` (`plugins/theme/src/index.ts:31`) and `SettingsPluginOptions.storageKey` (`plugins/settings/src/index.ts:21`) rows explicitly flag theme/settings as NOT given the SEC-02 treatment wallet received |
| Limitations — IIFE global collision | `window.DxKit`/`DxWallet`/`DxAuth`/`DxTheme`/`DxSettings` can be overwritten by any other script | `.planning/codebase/CONCERNS.md` §"IIFE Builds Attach to Global Namespace" |
| Limitations — `shell.destroy()` required before reuse | Router `popstate`/`hashchange` listeners on `window` are not otherwise cleaned up | `.planning/codebase/CONCERNS.md` §"Window Event Listeners Not Cleaned Up on Shell Reuse" (`src/router.ts:98-104`) |
| Limitations — single dapp mounted at a time | Mounting a new dapp always unmounts the previous one | `.planning/codebase/CONCERNS.md` §"Known Limitations"; `src/lifecycle.ts:319-321` (`mount()` calls `unmount()` on the current dapp before proceeding) |

No D-13 booster/hedge words present. README doc-table row for `docs/security.md` is out of this
plan's scope — added in Plan 08 per the plan frontmatter's stated split.

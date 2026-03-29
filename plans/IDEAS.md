# IDEAS.md

Scratch pad for ideas, questions, and explorations. Nothing here is committed to — it's a thinking space.

---

## 3. Shell-Defined Navigation

The Shell should define "navigation zones" via its config — e.g. a default top bar nav, a secondary nav slot, a sidebar, whatever the UI developer wants. Plugins/Dapps register nav items into these zones (similar to what we do today, but formalized).

Example:
```ts
createShell({
  navigation: {
    primary: { position: 'top' },
    secondary: { position: 'sidebar' },
  }
})
```

Plugins/Dapps declare which zone(s) they want to appear in. The Shell owns the layout contract, plugins just say "put me here."

---

## 4. Feature Flags

Feature flags defined via `shellCreate()` and also loadable from Plugin/Dapp manifests.

Key use case: a Plugin can be enabled/disabled, but that plugin might have both "backend" features (data sync, event handlers) and "frontend" features (nav items, pages, UI). The app developer chooses which features to enable — at the app level, or within a plugin/dapp.

**Feature flags vs settings:** A Feature is not a setting. A Feature is a capability that can be on or off. But a Feature *has* settings — if the feature is enabled, its settings appear in the settings UI. If disabled, they don't.

**Feature flags vs plugin enable/disable:** There's obvious overlap here. Enabling/disabling a plugin is essentially a feature flag for the whole plugin. Need to keep this DRY — maybe plugin enable/disable *is* a feature flag, and feature flags are the lower-level primitive that plugin toggling is built on top of.

Explore: `Plugin.features` as the atomic unit, `Plugin.enabled` as sugar for "all features on/off."

---

## 5. `@dxkit/markdown` Plugin

A plugin that makes it easy for a dapp to load content from `.md` files and render it in place (inside a div, mount point, etc). The dapp developer writes content in markdown and the plugin handles fetching, parsing, and rendering.

**Core capability:** Load markdown content (from local files, fetched URLs, or inline strings) and render HTML into a target element.

**Variable interpolation:** Support template variables in markdown content — e.g. `{{appName}}`, `{{version}}` — resolved at render time from a context object passed by the dapp. Keeps content reusable across environments.

**Embedded HTML/JS:** Explore supporting raw HTML blocks (standard in most markdown specs) and potentially inline `<script>` execution for interactive content. This is powerful but has security implications — need to think about sanitization, CSP, and whether to support this at all or gate it behind an explicit opt-in.

**Research areas:**
- Markdown parser: use an existing library (marked, markdown-it, micromark) or ship something minimal? Trade-off between bundle size and feature completeness.
- Rendering strategy: innerHTML vs DOM construction vs a lightweight virtual DOM approach.
- Lazy loading: fetch `.md` files on demand (route change, scroll into view) rather than bundling all content upfront.
- Caching: parsed markdown can be cached so re-renders don't re-parse.
- Frontmatter support: YAML frontmatter (`---` blocks) for metadata — title, description, layout hints — that the dapp can use for SEO, navigation, etc.
- Integration with the router: a dapp could map routes directly to markdown files (`/docs/getting-started` → `docs/getting-started.md`), turning the plugin into a lightweight content/docs site engine.

---

## 6. Mermaid Diagrams & Syntax Highlighting in Markdown

Extend the `@dxkit/markdown` plugin to support fenced code blocks with rich rendering:

**Mermaid diagrams:** Render ` ```mermaid ` fences as SVG diagrams using Mermaid.js. Useful for architecture diagrams, flowcharts, sequence diagrams, etc. directly in markdown content.

**Syntax highlighting:** Render fenced code blocks (` ```ts `, ` ```rust `, etc.) with proper syntax highlighting. Options: Prism, Shiki, highlight.js — or a lighter approach if bundle size is a concern.

**Research areas:**
- Lazy loading Mermaid: it's a large library (~1MB+). Load it only when a ` ```mermaid ` fence is actually present in the rendered content. Same for syntax highlighting libraries.
- Plugin architecture: should Mermaid and syntax highlighting be sub-plugins of `@dxkit/markdown`, or separate plugins that hook into a markdown rendering pipeline? A pipeline model (parse → transform → render) would let third parties add their own custom fence renderers.
- Dark mode: both Mermaid and syntax highlighters need theme-aware rendering. Should integrate with the `@dxkit/theme` plugin so diagrams and code blocks respect the current theme.
- SSR / static rendering: can diagrams and highlighted code be pre-rendered at build time for faster load? Or is runtime-only acceptable for an alpha?
- Custom fences: beyond Mermaid, consider a generic "custom fence renderer" API where a dapp registers handlers for specific language tags — e.g. ` ```chart `, ` ```math ` (KaTeX/MathJax), ` ```ascii `.

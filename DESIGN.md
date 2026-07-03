# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-07-03
- Primary product surfaces: Hugo homepage, article archive, individual article pages, informational pages, embedded interactive explainers, knowledge graph, footer/navigation.
- Evidence reviewed: `layouts/index.html`, `layouts/_default/baseof.html`, `layouts/_default/list.html`, `layouts/posts/single.html`, `layouts/_default/single.html`, `layouts/_default/network.html`, `layouts/_default/about.html`, `layouts/shortcodes/interactiveframe.html`, `layouts/shortcodes/ai_summary.html`, `content/about.md`, `content/posts`, `assets/css/home.css`, `assets/css/archive.css`, `assets/css/main.css`, `assets/css/single.css`, `hugo.toml`, `static/images/og-default.png`.

## Brand
- Personality: academic, contemplative, technically precise, calm, visually current without feeling like a SaaS landing page.
- Trust signals: clear publication metadata, source-backed explanations, stable article URLs, readable long-form structure, local brand imagery, visible routes into the knowledge graph.
- Avoid: marketing-style landing pages, decorative UI that hides the writing, remote placeholder imagery, unexplained interactive controls, one-note blue/purple gradients.

## Product goals
- Goals: make faith, philosophy, science, engineering, and writing content easy to browse, read, cite, revisit, and connect across disciplines.
- Non-goals: replace articles with standalone visual demos, add unrelated social or feed mechanics.
- Success signals: posts appear in Hugo listings, article body remains searchable, embedded tools clarify the theory without breaking reading flow.

## Personas and jobs
- Primary personas: Korean/English readers interested in theological, philosophical, scientific, and technical essays.
- User jobs: scan recent topics, read a coherent article, inspect an interactive model, follow references.
- Key contexts of use: desktop deep reading, mobile article browsing, crawler/RSS access.

## Information architecture
- Primary navigation: Home, Articles, About, Network, Subscribe.
- Core routes/screens: `/`, `/posts/`, `/posts/{slug}/`, `/about/`, `/network/`, legal/public pages, static interactive assets under purpose-specific paths.
- Content hierarchy: homepage brand promise, archive signal row, search, primary routes, atlas-style discipline preview, discipline bento, latest posts, network CTA, newsletter; archive pages expose four discipline filters and article signals; article pages keep discipline, title, metadata, concise summary, optional interactive explainer, long-form body, references; informational pages use the same reading shell without pretending to be posts.

## Design principles
- Principle 1: Keep the article as the primary object; use interactive UI as evidence and intuition, not as a replacement for the post.
- Principle 2: Controls must visibly change the model they describe.
- Principle 3: The whole site should feel like a knowledge atlas, not a generic blog feed; every major page should expose how faith, philosophy, engineering, and prose connect.
- Tradeoffs: iframe isolation keeps custom visual code from leaking into the site, but parent markdown should still carry the body text for search and reading. Homepage trend adoption should improve scanning and orientation without adding external runtime dependencies.

## Visual language
- Color: shared pages use neutral paper/charcoal surfaces with teal, ember, gold, cobalt, and category-specific accents; restrained high-contrast dark explainers are acceptable inside interactive frames.
- Typography: reuse system and site typography; use serif display type for brand moments; avoid viewport-scaled body text and negative tracking.
- Spacing/layout rhythm: dense but breathable article flow; homepage and archive use bento/grid scanning without nesting cards inside cards.
- Shape/radius/elevation: cards, forms, and frames should stay moderate and functional, with 8px radius on new homepage UI.
- Motion: preserve existing 3D identity layers on pages that already use them, especially the About universe canvas, but keep them visible behind thin readable glass surfaces rather than large opaque slabs; use short opacity/transform reveals only when they clarify hierarchy; honor reduced-motion preferences.
- Imagery/iconography: homepage uses local brand imagery; technical content uses real charts, simulated paths, grids, and distributions rather than generic decorative images.

## Components
- Existing components to reuse: `ai_summary` shortcode, `interactiveframe` shortcode, article layout, related-post logic, header/footer partials.
- New/changed components: homepage atlas hero/search, archive signal chips, discipline bento cards, archive filters/cards/search, article field-note header, related-reading cards, network graph controls, about page reading shell, footer discovery links.
- Variants and states: iframe fallback link, responsive frame height, dark/light theme notification, homepage/archive/article light/dark states, archive empty search state, network node panel, subscription success/error states.
- Token/component ownership: keep global site variables in `assets/css/main.css`; keep homepage-specific styling in `assets/css/home.css`; keep archive-specific styling in `assets/css/archive.css`; keep article/informational page styling in `assets/css/single.css`; keep explainer-specific styling inside static explainer HTML.

## Accessibility
- Target standard: semantic articles with keyboard-readable controls and visible labels.
- Keyboard/focus behavior: native range inputs, links, forms, and buttons remain focusable.
- Contrast/readability: homepage and explainer text must remain readable in light and dark modes; chart labels must meet high-contrast dark UI expectations.
- Screen-reader semantics: parent article text must explain the visual model.
- Reduced motion and sensory considerations: avoid continuous animation by default; redraw only after input or explicit button action; homepage decorative transitions must collapse under `prefers-reduced-motion`.

## Responsive behavior
- Supported breakpoints/devices: mobile article reading, tablet, desktop.
- Layout adaptations: homepage hero and bento collapse to one column below tablet width; archive filters/cards collapse to two then one column; article TOC disappears below desktop; iframe content remains in-flow and full-width within the article column.
- Touch/hover differences: controls must work without hover.

## Interaction states
- Loading: iframe keeps a visible fallback link through `noscript`; network graph shows a loading status.
- Empty: archive search/filter shows a resettable empty state.
- Error: failed iframe load still leaves article text readable.
- Success: controls update chart, labels, and summary metrics together.
- Disabled: disabled controls must not imply meaningful interaction.
- Offline/slow network, if applicable: explainers must not depend on external JavaScript.

## Content voice
- Tone: direct, explanatory, careful about limits and assumptions.
- Terminology: keep Korean terms with English technical terms where useful.
- Microcopy rules: label controls by the parameter and say what increasing it means; avoid mojibake or placeholder English/Korean hybrids in user-facing labels.

## Implementation constraints
- Framework/styling system: Hugo with PaperMod-derived layouts, custom CSS, markdown shortcodes, Tailwind CDN still present in the global wrapper.
- Design-token constraints: avoid new global design-system layers for isolated explainers or homepage-only styling.
- Performance constraints: no external JS dependency for static theory explainers; homepage must avoid remote placeholder images and keep animation to composited opacity/transform work.
- Compatibility constraints: static files must work under Hugo/GitHub Pages paths.
- Test/screenshot expectations: run Hugo build; visually smoke-test the homepage, archive, one article, about page, and network page on desktop/mobile; check one interactive post when shortcode or explainer code changes.

## Open questions
- [ ] Whether future theory explainers should share a unified `/theory/` section instead of `content/posts`.

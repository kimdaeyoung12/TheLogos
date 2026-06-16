# Design

## Source of truth
- Status: Draft
- Last refreshed: 2026-06-16
- Primary product surfaces: Hugo homepage, post list, individual article pages, embedded interactive explainers.
- Evidence reviewed: `layouts/index.html`, `layouts/posts/single.html`, `layouts/shortcodes/rawhtml.html`, `content/posts/markov_chains.md`, `assets/css/home.css`, `assets/css/single.css`, `hugo.toml`.

## Brand
- Personality: academic, contemplative, technically precise, calm.
- Trust signals: clear publication metadata, source-backed explanations, stable article URLs, readable long-form structure.
- Avoid: marketing-style landing pages, decorative UI that hides the writing, unexplained interactive controls.

## Product goals
- Goals: make faith, philosophy, science, engineering, and writing content easy to browse, read, cite, and revisit.
- Non-goals: replace articles with standalone visual demos, add unrelated social or feed mechanics.
- Success signals: posts appear in Hugo listings, article body remains searchable, embedded tools clarify the theory without breaking reading flow.

## Personas and jobs
- Primary personas: Korean/English readers interested in theological, philosophical, scientific, and technical essays.
- User jobs: scan recent topics, read a coherent article, inspect an interactive model, follow references.
- Key contexts of use: desktop deep reading, mobile article browsing, crawler/RSS access.

## Information architecture
- Primary navigation: Home, Posts, About.
- Core routes/screens: `/`, `/posts/`, `/posts/{slug}/`, static interactive assets under purpose-specific paths.
- Content hierarchy: article title and metadata first, concise summary, optional interactive explainer, long-form body, references.

## Design principles
- Principle 1: Keep the article as the primary object; use interactive UI as evidence and intuition, not as a replacement for the post.
- Principle 2: Controls must visibly change the model they describe.
- Tradeoffs: iframe isolation keeps custom visual code from leaking into the site, but parent markdown should still carry the body text for search and reading.

## Visual language
- Color: restrained high-contrast dark explainers are acceptable inside interactive frames; site chrome remains governed by existing theme CSS.
- Typography: reuse system and site typography; avoid viewport-scaled body text.
- Spacing/layout rhythm: dense but breathable article flow, with framed tools separated from prose.
- Shape/radius/elevation: cards and frames should stay moderate and functional.
- Motion: model animation or redrawing only when it clarifies state changes.
- Imagery/iconography: use real charts, simulated paths, grids, and distributions for technical content.

## Components
- Existing components to reuse: `ai_summary` shortcode, `rawhtml` shortcode, article layout, related-post logic.
- New/changed components: `interactiveframe` shortcode for isolated static explainers.
- Variants and states: iframe fallback link, responsive frame height, dark/light theme notification.
- Token/component ownership: keep global site styling in existing CSS; keep explainer-specific styling inside static explainer HTML.

## Accessibility
- Target standard: semantic articles with keyboard-readable controls and visible labels.
- Keyboard/focus behavior: native range inputs and buttons remain focusable.
- Contrast/readability: explainer text and chart labels must meet high-contrast dark UI expectations.
- Screen-reader semantics: parent article text must explain the visual model.
- Reduced motion and sensory considerations: avoid continuous animation by default; redraw only after input or explicit button action.

## Responsive behavior
- Supported breakpoints/devices: mobile article reading, tablet, desktop.
- Layout adaptations: iframe content collapses to one column below tablet width.
- Touch/hover differences: controls must work without hover.

## Interaction states
- Loading: iframe keeps a visible fallback link through `noscript`.
- Empty: not applicable for static educational explainers.
- Error: failed iframe load still leaves article text readable.
- Success: controls update chart, labels, and summary metrics together.
- Disabled: disabled controls must not imply meaningful interaction.
- Offline/slow network, if applicable: explainers must not depend on external JavaScript.

## Content voice
- Tone: direct, explanatory, careful about limits and assumptions.
- Terminology: keep Korean terms with English technical terms where useful.
- Microcopy rules: label controls by the parameter and say what increasing it means.

## Implementation constraints
- Framework/styling system: Hugo with PaperMod-derived layouts, custom CSS, markdown shortcodes.
- Design-token constraints: avoid new global design-system layers for isolated explainers.
- Performance constraints: no external JS dependency for these static theory explainers.
- Compatibility constraints: static files must work under Hugo/GitHub Pages paths.
- Test/screenshot expectations: run Hugo build; visually smoke-test at least the homepage and one interactive post when browser tooling is available.

## Open questions
- [ ] Whether future theory explainers should share a unified `/theory/` section instead of `content/posts`.

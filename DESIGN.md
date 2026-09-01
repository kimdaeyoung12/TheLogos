# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-09-02
- Primary product surfaces: Hugo homepage, article archive, individual article pages, informational pages, embedded interactive explainers, knowledge graph, ChristianDays app launcher, footer/navigation, and the unlisted retreat-prayer participant/Admin application under `/retreat-prayer/`.
- Evidence reviewed: `layouts/index.html`, `layouts/_default/baseof.html`, `layouts/_default/list.html`, `layouts/posts/single.html`, `layouts/_default/single.html`, `layouts/_default/network.html`, `layouts/_default/about.html`, `layouts/shortcodes/interactiveframe.html`, `layouts/shortcodes/ai_summary.html`, `content/about.md`, `content/posts`, `assets/css/home.css`, `assets/css/archive.css`, `assets/css/main.css`, `assets/css/single.css`, `hugo.toml`, `static/images/og-default.png`, `static/christiandays-app/icon-192.png`, `static/retreat-prayer/`, `supabase/`, and the supplied Google Stitch project reference.

## Brand
- Personality: academic, contemplative, technically precise, calm, visually current without feeling like a SaaS landing page.
- Trust signals: clear publication metadata, source-backed explanations, stable article URLs, readable long-form structure, local brand imagery, visible routes into the knowledge graph.
- Avoid: marketing-style landing pages, decorative UI that hides the writing, remote placeholder imagery, unexplained interactive controls, one-note blue/purple gradients.
- Retreat prayer platform: sacred ambient minimalism—warm paper, ink, sage, and restrained amber light; communal presence without faces, profiles, competition, stock church photography, or ornamental religious clichés.

## Product goals
- Goals: make faith, philosophy, science, engineering, and writing content easy to browse, read, cite, revisit, and connect across disciplines.
- Non-goals: replace articles with standalone visual demos, add unrelated social or feed mechanics.
- Success signals: posts appear in Hugo listings, article body remains searchable, embedded tools clarify the theory without breaking reading flow.
- Retreat prayer goals: move people from ambient awareness to a gentle invitation and actual prayer; support scheduled communal prayer, freely timed daily prayer, and approved intercession requests without streaks, rankings, likes, empty-time pressure, or engagement-maximizing feeds.
- Retreat prayer success signals: scheduled prayer participation, completion of communal sessions, voluntary daily-prayer starts, and the share of approved requests that lead to focused prayer. These remain internal aggregate signals and are never personal rankings.

## Personas and jobs
- Primary personas: Korean/English readers interested in theological, philosophical, scientific, and technical essays.
- User jobs: scan recent topics, read a coherent article, inspect an interactive model, follow references.
- Key contexts of use: desktop deep reading, mobile article browsing, crawler/RSS access.
- Retreat prayer personas and contexts: no-login participants on mobile, daily-prayer participants entering briefly from any location, request authors choosing a nickname or full anonymity, intercessors entering focus mode, desktop Admin operators, and a representative owner managing up to ten Admin accounts.

## Information architecture
- Primary navigation: Home, Articles, About, Network, Subscribe.
- Core routes/screens: `/`, `/posts/`, `/posts/{slug}/`, `/about/`, `/network/`, `/christiandays-app/`, legal/public pages, static interactive assets under purpose-specific paths.
- Content hierarchy: homepage brand promise, archive signal row, search, distinct ChristianDays app launcher, primary routes, atlas-style discipline preview, discipline bento, latest posts, network CTA, newsletter; archive pages expose four discipline filters and article signals; article pages keep discipline, title, metadata, concise summary, optional interactive explainer, long-form body, references; informational pages use the same reading shell without pretending to be posts; article table-of-contents UI should aid long-form reading as a secondary navigation surface, floating beside the reading column on wide desktop screens and collapsing to a compact top band on narrower screens.
- Retreat prayer IA: `/retreat-prayer/` contains Home/Waiting, Live Prayer, Today's Prayer, Prayer Requests, focused prayer, and completion states; `/retreat-prayer/admin/` contains authenticated Live Control, Run of Show, daily content, moderation, media, accounts, and operations. These routes are unlisted, absent from the main site navigation and sitemap, and marked `noindex`; unlisted is not treated as authentication.

## Design principles
- Principle 1: Keep the article as the primary object; use interactive UI as evidence and intuition, not as a replacement for the post.
- Principle 2: Controls must visibly change the model they describe.
- Principle 3: The whole site should feel like a knowledge atlas, not a generic blog feed; every major page should expose how faith, philosophy, engineering, and prose connect.
- Tradeoffs: iframe isolation keeps custom visual code from leaking into the site, but parent markdown should still carry the body text for search and reading. Homepage trend adoption should improve scanning and orientation without adding external runtime dependencies.
- Retreat prayer principles: Presence → Invitation → Prayer → Community; one primary action per screen; server-authoritative time; active browser connections are ambient awareness rather than a score; prayer focus lowers navigation, canvas salience, and information density; system failure preserves the last meaningful prayer content whenever possible.

### Retreat prayer A–Z ideation and selected direction

- A — Ambient: 먼저 의식되기보다 공간의 분위기로 느껴지는 존재감.
- B — Balance: 말씀, 기도제목, 시간, Presence 사이의 안정된 무게 배분.
- C — Clarity: 현재 무엇을 위해 기도하는지 즉시 이해되는 명료성.
- D — Depth: 앞·중간·뒤 레이어로 형성하는 조용한 공간감.
- E — Editorial: 말씀과 기도제목을 중심에 두는 출판적 구성.
- F — Focus: 기도 시작 후 정보와 장식을 줄이는 집중.
- G — Grid: 화면 크기가 달라도 질서를 유지하는 반응형 골격.
- H — Hierarchy: 말씀 → 기도제목 → 시간 → 공동체 Presence 순의 우선순위.
- I — Illumination: 장식이 아니라 함께 있음의 은유로 쓰는 빛.
- J — Juxtaposition: 따뜻한 종이색과 깊은 잉크색의 절제된 대비.
- K — Kinetics: 기능과 상태 변화를 설명하는 최소한의 움직임.
- L — Luminance: 읽기 대비를 침범하지 않는 낮은 휘도 차이.
- M — Materiality: 종이, 잉크, 얇은 유리처럼 느껴지는 표면성.
- N — Negative Space: 묵상과 호흡을 위한 비어 있는 공간.
- O — Orbit: 개인의 서열 없이 하나의 중심을 함께 둘러싼 관계.
- P — Perspective: 익명 빛들의 전후 관계를 만드는 원근.
- Q — Quietude: 주의를 요구하지 않는 고요함.
- R — Rhythm: 말씀, 침묵, 기도가 이어지는 의식적 시간 리듬.
- S — Sobriety: 과장된 종교 장식과 감정 자극을 피하는 절제.
- T — Tactility: 버튼과 패널의 상태를 부드럽지만 분명하게 느끼게 하는 촉각성.
- U — Unity: 각자의 익명 Presence가 하나의 공동체 장면을 이루는 통일성.
- V — Volume: 평면 점이 아니라 깊이를 가진 빛의 장으로 보이는 부피감.
- W — Wayfinding: 현재 단계와 나갈 길을 놓치지 않게 하는 방향성.
- X — X-height: 작은 모바일 본문에서도 한글과 숫자의 판독성을 지키는 글자 비례.
- Y — Y-axis: 모바일 세로 흐름에서 말씀을 먼저, Presence를 끝에 두는 축.
- Z — Zoning: 기도 콘텐츠와 시스템 상태를 서로 침범하지 않게 구역화하는 원칙.

Selected direction: **Sober Constellation — 절제된 공동체의 별자리**. 개혁주의 예배의 말씀 중심성과 절제된 공간 언어에 맞춰 `Clarity`, `Editorial`, `Focus`, `Hierarchy`, `Negative Space`, `Quietude`, `Sobriety`, `Unity`를 1차 기준으로 삼는다. `Depth`, `Perspective`, `Luminance`, `Orbit`, `Volume`은 기도문 뒤의 낮은 대비 3D Presence와 하단의 작은 인원 창에만 사용한다. 순서는 항상 **말씀/기도제목 > 남은 시간 > 공동체 Presence > 장식**이며, Presence는 사람을 식별하거나 참여를 경쟁시키지 않는다.

Live Prayer의 Presence는 홈 화면과 같은 따뜻한 빛·타원 궤도·익명 입자 언어를 사용하되 기도문보다 낮은 대비로 한 단계 뒤에 둔다. 정확한 지체 수는 같은 장면 안의 작은 caption으로 제공한다. 참여자 공지는 장면과 분리된 compact notice이며, 참여자가 닫을 수 없다. 새 공지로 교체되거나 Admin이 명시적으로 내릴 때까지 모든 일반 화면과 Focus 화면에서 유지한다.

## Visual language
- Color: shared pages use neutral paper/charcoal surfaces with teal, ember, gold, cobalt, and category-specific accents. Every primary route, including About and Network, must provide paired light and dark surface, text, muted-text, border, and control tokens; restrained high-contrast dark explainers are acceptable inside interactive frames.
- Typography: reuse system and site typography; use serif display type for brand moments; avoid viewport-scaled body text and negative tracking.
- Spacing/layout rhythm: dense but breathable article flow; homepage and archive use bento/grid scanning without nesting cards inside cards; page intro areas should read as open bands integrated with the page background, not as isolated rectangular panels.
- Shape/radius/elevation: cards, forms, and frames should stay moderate and functional, with 8px radius on new homepage UI; when a page has a 3D/canvas identity layer, glass panels must stay translucent enough to reveal motion and depth instead of becoming opaque slabs, and the canvas background should belong to the page backdrop rather than a visible bounded rectangle.
- Motion: preserve existing 3D identity layers on pages that already use them, especially the About universe canvas, but keep them visible behind thin readable glass surfaces rather than large opaque slabs; use short opacity/transform reveals only when they clarify hierarchy; honor reduced-motion preferences.
- Imagery/iconography: homepage uses local brand imagery; technical content uses real charts, simulated paths, grids, and distributions rather than generic decorative images.
- Retreat prayer visual language: asymmetric editorial waiting-room composition, narrow reading measures in focus mode, projected 3D light constellation on Canvas with a zero-data/loading state, 8pt spacing, moderate radii, quiet tonal elevation, tabular time, and 120–500ms feedback/content transitions. Ambient motion uses slow drift only and becomes static under reduced motion.

## Components
- Existing components to reuse: `ai_summary` shortcode, `interactiveframe` shortcode, article layout with responsive hash-driven TOC navigation, related-post logic, header/footer partials.
- New/changed components: homepage atlas hero/search, standalone ChristianDays app launcher and wide-screen floating app dock, archive signal chips, discipline bento cards, archive filters/cards/search, article field-note header, related-reading cards, network graph controls, about page reading shell, footer discovery links.
- Variants and states: iframe fallback link, responsive frame height with parent-child resize handshake, article TOC only when real section links exist, wide-screen floating TOC, narrow-screen compact TOC band, dark/light theme notification, homepage/archive/article light/dark states, archive empty search state, network node panel, subscription success/error states.
- Token/component ownership: keep global site variables in `assets/css/main.css`; keep homepage-specific styling in `assets/css/home.css`; keep archive-specific styling in `assets/css/archive.css`; keep article/informational page styling in `assets/css/single.css`; keep explainer-specific styling inside static explainer HTML.
- Retreat prayer component ownership: the isolated app owns tokens and participant components in `static/retreat-prayer/assets/styles.css`, operator components in `admin.css`, shared state/time helpers in `core.js`, and backend adapters in `backend.js`. Do not move its visual tokens into the main Hugo theme or expose future features as disabled navigation.

## Accessibility
- Target standard: semantic articles with keyboard-readable controls and visible labels.
- Keyboard/focus behavior: native range inputs, links, forms, buttons, and article TOC anchors remain focusable and visibly interactive.
- Contrast/readability: homepage, About, Network, and explainer text must remain readable in light and dark modes. Long-form text and controls use strong foreground/background separation; graph labels, panels, and canvas links must adapt with the selected theme.
- Screen-reader semantics: parent article text must explain the visual model.
- Reduced motion and sensory considerations: avoid continuous animation by default; redraw only after input or explicit button action; homepage decorative transitions must collapse under `prefers-reduced-motion`.
- Retreat prayer accessibility: target WCAG 2.2 AA, 16px minimum mobile body copy, 44px touch targets, keyboard-operable native controls/dialogs, explicit focus rings, non-color status labels, no per-second live-region timer announcements, important 5-minute/1-minute/end announcements only, static Canvas under reduced motion, and complete prayer functionality without music or 3D.

## Responsive behavior
- Supported breakpoints/devices: mobile article reading, tablet, desktop.
- Layout adaptations: homepage hero and bento collapse to one column below tablet width; the ChristianDays floating app dock appears only when there is enough right-side desktop gutter and otherwise collapses to the in-flow app launcher; archive filters/cards collapse to two then one column; article TOC floats to the right of the reading column on wide desktop screens, then becomes a compact wrapping band above the article body on narrower screens; iframe content remains in-flow and full-width within the article column and must resize to its inner content instead of becoming a clipped internal viewport.
- Touch/hover differences: controls must work without hover.
- Retreat prayer adaptations: participant UI is mobile-first at 360/390, moves from split Presence hero to a single-column ritual flow, and uses a four-item bottom navigation; the Admin console is desktop-first at 1280/1440 with Program/Preview/Cue/Control regions, while mobile Admin exposes only bounded emergency controls and stacks editing forms.

## Interaction states
- Loading: iframe keeps a visible fallback link through `noscript`; network graph shows a loading status.
- Empty: archive search/filter shows a resettable empty state.
- Error: failed iframe load still leaves article text readable.
- Success: controls update chart, labels, and summary metrics together.
- Disabled: disabled controls must not imply meaningful interaction.
- Offline/slow network, if applicable: explainers must not depend on external JavaScript.
- Retreat prayer states: production without Supabase configuration fails closed; localhost alone may show a labeled preview. Presence never displays a number before sync. Scheduled sessions show a waiting state, late entrants receive the server-derived current stage, disconnection retains the last stage, automatic sessions start/end from server time, empty prayer lists invite submission without pressure, and submitted requests remain pending until Admin approval.
- Retreat prayer operator states: Live Control is single-owner and persistent rather than time-expiring. Status checks, focus, reconnect, and BFCache return never acquire an empty controller slot. Ownership changes only through explicit acquire, release, or generation-checked takeover, with current holder and audit history visible. Run-of-Show step order uses keyboard-accessible up/down controls with disabled boundaries; stored DOM order is the published order.

## Content voice
- Tone: direct, explanatory, careful about limits and assumptions; About copy should preserve the author's aphoristic Korean voice around entropy, order, suffering, gratitude, and Logos rather than flattening it into generic site marketing.
- Terminology: keep Korean terms with English technical terms where useful; preserve the biblical Logos / 말씀 framing on About and do not remove the John 1:1 explanation unless explicitly requested.
- Microcopy rules: label controls by the parameter and say what increasing it means; avoid mojibake or placeholder English/Korean hybrids in user-facing labels.
- Retreat prayer voice: calm, invitational, communal, precise, and non-competitive. Prefer “오늘의 기도에 마음을 보탭니다” and “함께 기다리고 있습니다”; avoid guilt, missed-participation language, developer terms, celebration effects, and personal achievement copy. Admin copy states the exact operational consequence of each action.

## Implementation constraints
- Framework/styling system: Hugo with PaperMod-derived layouts, custom CSS, markdown shortcodes, Tailwind CDN still present in the global wrapper.
- Design-token constraints: avoid new global design-system layers for isolated explainers or homepage-only styling.
- Performance constraints: no external JS dependency for static theory explainers; homepage must avoid remote placeholder images and keep animation to composited opacity/transform work.
- Compatibility constraints: static files must work under Hugo/GitHub Pages paths.
- Test/screenshot expectations: run Hugo build; visually smoke-test the homepage, archive, one article, about page, and network page on desktop/mobile; check one interactive post when shortcode or explainer code changes.
- Retreat prayer constraints: static Hugo/GitHub Pages frontend plus a dedicated Supabase project; private Presence through invisible anonymous Auth; RLS and column grants are the data boundary; anonymous writes and owner-only account changes go through Edge Functions; Admin and participant auth storage are isolated; no service-role secret is shipped to the browser. Live/content subscriptions install idempotently, reconcile both snapshots after connection, and retry initial failure with a capped 2/5/15/30-second backoff. Durable announcements have a server-issued identity and timestamp, and only the current Live Controller can publish or clear them against the latest live-session version. The live 3D backdrop samples at most 36 anonymous light points and redraws at no more than 15fps/DPR 1.25, while the text count always shows the unsampled active-browser-connection value. Validate unit tests, JS module graph, Edge syntax, Hugo build, 360/390/1280 layouts, 200% zoom and mobile landscape, controller generation/version races, and staging RLS before production activation.

## Open questions
- [ ] Whether future theory explainers should share a unified `/theory/` section instead of `content/posts`.
- [ ] Observe the live Presence window on low-end Android devices and reduce sampled points further if sustained animation affects prayer-text scrolling or battery use.

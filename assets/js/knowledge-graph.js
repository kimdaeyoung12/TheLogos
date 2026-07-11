(function () {
    'use strict';

    const D3_SRC = 'https://unpkg.com/d3';
    const FORCE_GRAPH_SRC = 'https://unpkg.com/3d-force-graph';

    const state = window._knowledgeGraphState || {
        initSeq: 0,
        scriptPromises: {},
        graph: null,
        container: null,
        resizeHandler: null
    };
    window._knowledgeGraphState = state;

    function readNetworkPalette() {
        const section = document.querySelector('.graph-section');
        const styles = section ? getComputedStyle(section) : null;
        const token = (name, fallback) => styles?.getPropertyValue(name).trim() || fallback;

        return {
            link: token('--network-graph-link', '#94a3b8'),
            post: token('--network-node-post', '#e2e8f0'),
            tag: token('--network-node-tag', '#475569'),
            fallback: token('--network-node-default', '#ffffff'),
            muted: token('--network-muted', '#94a3b8'),
            error: token('--network-error', '#f87171')
        };
    }

    function nodeColor(node, palette) {
        if (node.group === 'category') {
            const name = node.name.toLowerCase();
            if (name.includes('religion')) return '#d97706';
            if (name.includes('philosophy')) return '#9333ea';
            if (name.includes('engineering') || name.includes('dev')) return '#dc2626';
            if (name.includes('writing') || name.includes('essay')) return '#059669';
            return '#ca8a04';
        }
        if (node.group === 'post') return palette.post;
        if (node.group === 'tag') return palette.tag;
        return palette.fallback;
    }

    function findScript(src) {
        const absoluteSrc = new URL(src, window.location.href).href;
        return Array.from(document.scripts).find(script =>
            script.src === absoluteSrc || script.dataset.knowledgeGraphSrc === src
        );
    }

    function loadScriptOnce(src, isReady) {
        if (isReady()) return Promise.resolve();
        if (state.scriptPromises[src]) return state.scriptPromises[src];

        state.scriptPromises[src] = new Promise((resolve, reject) => {
            let script = findScript(src);

            if (script?.dataset.loaded === 'true' && !isReady()) {
                script.remove();
                script = null;
            }

            if (!script) {
                script = document.createElement('script');
                script.src = src;
                script.async = false;
                script.dataset.knowledgeGraphSrc = src;
            }

            if (isReady()) {
                script.dataset.loaded = 'true';
                resolve();
                return;
            }

            script.addEventListener('load', () => {
                script.dataset.loaded = 'true';
                if (isReady()) {
                    resolve();
                } else {
                    reject(new Error(`Script loaded but global is missing: ${src}`));
                }
            }, { once: true });

            script.addEventListener('error', () => {
                delete state.scriptPromises[src];
                reject(new Error(`Failed to load script: ${src}`));
            }, { once: true });

            if (!script.parentNode) {
                document.head.appendChild(script);
            }
        });

        return state.scriptPromises[src];
    }

    async function ensureDependencies() {
        await loadScriptOnce(D3_SRC, () => typeof window.d3 !== 'undefined');
        await loadScriptOnce(FORCE_GRAPH_SRC, () => typeof window.ForceGraph3D !== 'undefined');
    }

    function setStatus(container, message, isError = false) {
        if (!container) return;
        let status = container.querySelector('.network-graph-status');
        if (!status) {
            status = document.createElement('div');
            status.className = 'network-graph-status';
            container.appendChild(status);
        }
        status.textContent = message;
        status.dataset.networkStatus = isError ? 'error' : 'default';
        const palette = readNetworkPalette();
        status.style.color = isError ? palette.error : palette.muted;
    }

    function getGraphData() {
        let data = window.graphData;
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
            throw new Error('Graph data must include nodes and links arrays.');
        }
        return data;
    }

    function waitForContainerSize(container, seq, attempts = 30) {
        return new Promise((resolve, reject) => {
            function check(remaining) {
                if (seq !== state.initSeq) return;

                const width = container.clientWidth;
                const height = container.clientHeight;
                if (width > 0 && height > 0) {
                    resolve({ width, height });
                    return;
                }

                if (remaining <= 0) {
                    reject(new Error('Graph container has zero width or height.'));
                    return;
                }

                requestAnimationFrame(() => check(remaining - 1));
            }

            check(attempts);
        });
    }

    function removeResizeHandler() {
        if (state.resizeHandler) {
            window.removeEventListener('resize', state.resizeHandler);
            state.resizeHandler = null;
        }
    }

    function destroyKnowledgeGraphPage() {
        state.initSeq += 1;
        removeResizeHandler();

        if (state.graph) {
            try {
                if (typeof state.graph.pauseAnimation === 'function') {
                    state.graph.pauseAnimation();
                }
                if (typeof state.graph._destructor === 'function') {
                    state.graph._destructor();
                }
            } catch (error) {
                console.warn('[KnowledgeGraph] Graph cleanup skipped:', error);
            }
        }

        const container = state.container || document.getElementById('knowledge-graph-container');
        if (container) {
            container.dataset.graphInitialized = 'false';
            container.innerHTML = '<div class="network-graph-status">Loading knowledge graph...</div>';
        }

        state.graph = null;
        state.container = null;
        window.Graph = null;
    }

    async function initKnowledgeGraphPage() {
        const container = document.getElementById('knowledge-graph-container');
        if (!container) return;

        if (container.dataset.graphInitialized === 'true' && state.graph) {
            return;
        }

        if (state.container && state.container !== container) {
            destroyKnowledgeGraphPage();
        }

        const seq = state.initSeq + 1;
        state.initSeq = seq;
        state.container = container;
        setStatus(container, 'Loading knowledge graph...');

        try {
            const { width, height } = await waitForContainerSize(container, seq);
            await ensureDependencies();
            if (seq !== state.initSeq || !document.getElementById('knowledge-graph-container')) return;

            const data = getGraphData();
            container.innerHTML = '';
            container.dataset.graphInitialized = 'true';

            const palette = readNetworkPalette();
            const graph = window.ForceGraph3D()(container)
                .width(width)
                .height(height)
                .graphData(data)
                .nodeLabel('name')
                .nodeColor(node => nodeColor(node, palette))
                .nodeVal(node => node.val)
                .nodeResolution(16)
                .nodeOpacity(0.9)
                .linkWidth(0.5)
                .linkOpacity(0.6)
                .linkColor(palette.link)
                .backgroundColor('rgba(0,0,0,0)')
                .onNodeClick(handleNodeClick);

            state.graph = graph;
            window.Graph = graph;

            graph.d3Force('charge').strength(-60);
            graph.d3Force('link').distance(40);
            graph.controls().zoomSpeed = 2.5;
            graph.cameraPosition({ z: 500 });

            bindNetworkControls(graph);

            state.resizeHandler = () => {
                const activeContainer = document.getElementById('knowledge-graph-container');
                if (!state.graph || !activeContainer) return;
                state.graph.width(activeContainer.clientWidth);
                state.graph.height(activeContainer.clientHeight);
            };
            window.addEventListener('resize', state.resizeHandler);

            setTimeout(() => {
                if (state.graph === graph) {
                    graph.zoomToFit(400);
                }
            }, 1000);
        } catch (error) {
            console.error('[KnowledgeGraph] Failed to render graph:', error);
            setStatus(container, 'Network failed to load. Try refreshing this page.', true);
            container.dataset.graphInitialized = 'false';
        }
    }

    function handleNodeClick(node) {
        const graph = state.graph;
        if (!graph) return;

        if (node.group === 'category' || node.group === 'tag') {
            const distance = 120;
            const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
            graph.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                node,
                1000
            );
        }

        const panel = document.getElementById('node-panel');
        const panelType = document.getElementById('panel-type');
        const panelTitle = document.getElementById('panel-title');
        const panelDate = document.getElementById('panel-date');
        const panelSummary = document.getElementById('panel-summary');
        const panelLink = document.getElementById('panel-link');
        const panelLinkText = document.getElementById('panel-link-text');
        if (!panel || !panelType || !panelTitle || !panelDate || !panelSummary || !panelLink || !panelLinkText) return;

        panelTitle.textContent = node.name;
        panelType.textContent = node.group;
        panelType.className = 'panel-type ' + node.group;

        if (node.group === 'post') {
            panelDate.textContent = node.date || '';
            panelSummary.textContent = node.summary || '';
            panelDate.style.display = 'block';
            panelSummary.style.display = 'block';
            panelLink.href = node.id;
            panelLinkText.textContent = 'Read Article';
        } else {
            panelDate.style.display = 'none';
            panelSummary.style.display = 'none';

            if (node.group === 'category') {
                panelLink.href = '/posts/?category=' + node.id.replace('cat-', '');
                panelLinkText.textContent = 'Explore Category';
            } else if (node.group === 'tag') {
                panelLink.href = '/posts/?tag=' + node.id.replace('tag-', '');
                panelLinkText.textContent = 'Browse Tag';
            }
        }

        panel.classList.add('open');
    }

    function bindNetworkControls(graph) {
        const panel = document.getElementById('node-panel');
        const panelClose = document.getElementById('panel-close');
        const resetView = document.getElementById('reset-view');
        const searchInput = document.getElementById('network-search');
        const searchClear = document.getElementById('network-search-clear');
        let searchQuery = '';

        panelClose?.addEventListener('click', () => panel?.classList.remove('open'));
        resetView?.addEventListener('click', () => {
            graph.zoomToFit(600);
            panel?.classList.remove('open');
        });

        function updateNodeHighlight() {
            if (!searchQuery) {
                graph.nodeVal(node => node.val);
                return;
            }

            graph.nodeVal(node => {
                const nodeName = node.name.toLowerCase();
                return nodeName.includes(searchQuery) ? node.val * 3 : node.val * 0.2;
            });

            const matchingNode = graph.graphData().nodes.find(node =>
                node.name.toLowerCase().includes(searchQuery)
            );

            if (matchingNode && matchingNode.x !== undefined) {
                const distance = 150;
                const distRatio = 1 + distance / Math.hypot(matchingNode.x, matchingNode.y, matchingNode.z);
                graph.cameraPosition(
                    {
                        x: matchingNode.x * distRatio,
                        y: matchingNode.y * distRatio,
                        z: matchingNode.z * distRatio
                    },
                    matchingNode,
                    800
                );
            }
        }

        searchInput?.addEventListener('input', event => {
            searchQuery = event.target.value.trim().toLowerCase();
            if (searchClear) searchClear.style.display = searchQuery ? 'block' : 'none';
            updateNodeHighlight();
        });

        searchClear?.addEventListener('click', () => {
            if (!searchInput) return;
            searchInput.value = '';
            searchQuery = '';
            searchClear.style.display = 'none';
            updateNodeHighlight();
            graph.zoomToFit(600);
        });
    }

    function refreshGraphTheme() {
        if (!document.querySelector('.graph-section')) return;
        const palette = readNetworkPalette();
        const status = document.querySelector('.network-graph-status');
        if (status) {
            status.style.color = status.dataset.networkStatus === 'error' ? palette.error : palette.muted;
        }
        if (!state.graph) return;
        state.graph
            .nodeColor(node => nodeColor(node, palette))
            .linkColor(palette.link);
    }

    window.initKnowledgeGraphPage = initKnowledgeGraphPage;
    window.destroyKnowledgeGraphPage = destroyKnowledgeGraphPage;

    if (!window._knowledgeGraphLifecycleBound) {
        window.addEventListener('beforeSoftNavigate', () => {
            if (document.getElementById('knowledge-graph-container')) {
                window.destroyKnowledgeGraphPage?.();
            }
        });

        window.addEventListener('pageReady', () => {
            if (document.getElementById('knowledge-graph-container')) {
                window.initKnowledgeGraphPage?.();
            }
        });

        window.addEventListener('thelogos-theme-change', refreshGraphTheme);

        window._knowledgeGraphLifecycleBound = true;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.initKnowledgeGraphPage?.(), { once: true });
    } else {
        window.initKnowledgeGraphPage?.();
    }
})();

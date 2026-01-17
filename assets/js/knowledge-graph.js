document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('knowledge-graph-container');
    if (!container) return;

    // Get width/height from container
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Use embedded graphData
    try {
        if (!window.graphData) {
            console.error("No graph data found.");
            return;
        }
        let data = window.graphData;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error("Failed to parse graphData:", e);
                return;
            }
        }

        console.log('Initializing graph with', data.nodes.length, 'nodes and', data.links.length, 'links');

        // Expose globally for debugging
        window.Graph = ForceGraph3D()
            (container)
            .width(width)
            .height(height)
            .graphData(data)
            .nodeLabel('name')
            // Node styling
            .nodeColor(node => {
                if (node.group === 'category') {
                    // Planetary Colors
                    const name = node.name.toLowerCase();
                    if (name.includes('religion') || name.includes('종교')) return '#f59e0b'; // Amber
                    if (name.includes('philosophy') || name.includes('철학')) return '#c084fc'; // Bright Purple
                    if (name.includes('engineering') || name.includes('공학') || name.includes('dev')) return '#ef4444'; // Red
                    if (name.includes('writing') || name.includes('글') || name.includes('essay')) return '#10b981'; // Emerald
                    return '#fbbf24'; // Default Planet Gold
                }
                if (node.group === 'post') return '#e2e8f0'; // White/Star-like
                if (node.group === 'tag') return '#475569'; // Dim Gray Stardust
                return '#ffffff';
            })
            .nodeVal(node => {
                // Use logarithmic scaling or exact 'val' from JSON
                // JSON vals: Post=20, Cat=30, Tag=5
                return node.val;
            })
            .nodeResolution(16) // Higher polygon count for spheres
            .nodeOpacity(0.9)

            // Link styling (using valid API)
            .linkWidth(0.5)
            .linkOpacity(0.3)
            .linkColor('#475569')

            // Background
            .backgroundColor('rgba(0,0,0,0)') // Transparent

            // Interaction - Show floating panel on click
            .onNodeClick(node => {
                // Category/Tag click: zoom to center on this node
                if (node.group === 'category' || node.group === 'tag') {
                    // Calculate camera position to center on this node
                    const distance = 120;  // Distance from node
                    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
                    window.Graph.cameraPosition(
                        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                        node,  // lookAt the clicked node
                        1000   // animation duration
                    );
                }

                // Populate and show panel
                const panel = document.getElementById('node-panel');
                const panelType = document.getElementById('panel-type');
                const panelTitle = document.getElementById('panel-title');
                const panelDate = document.getElementById('panel-date');
                const panelSummary = document.getElementById('panel-summary');
                const panelLink = document.getElementById('panel-link');
                const panelLinkText = document.getElementById('panel-link-text');

                panelTitle.textContent = node.name;
                panelType.textContent = node.group;
                panelType.className = 'panel-type ' + node.group;

                // Show date/summary for posts only
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
                        // Use posts page with category filter
                        const catSlug = node.id.replace('cat-', '');
                        const catUrl = '/posts/?category=' + catSlug;
                        panelLink.href = catUrl;
                        panelLinkText.textContent = 'Explore Category';
                        console.log('Category URL:', catUrl);
                    } else if (node.group === 'tag') {
                        // Tags use the tag taxonomy URL
                        const tagSlug = node.id.replace('tag-', '');
                        const tagUrl = '/tags/' + tagSlug + '/';
                        panelLink.href = tagUrl;
                        panelLinkText.textContent = 'Browse Tag';
                        console.log('Tag URL:', tagUrl);
                    }
                }

                panel.classList.add('open');
            });
        // Note: Removed onEngineStop zoomToFit to prevent camera auto-reset

        // Increase spacing between nodes for better clickability
        window.Graph.d3Force('charge').strength(-60);  // Stronger repulsion = more spacing
        window.Graph.d3Force('link').distance(40);     // Longer links = more spacing

        // Fix: Add explicit click handler for panel link (navigation)
        document.getElementById('panel-link').addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                console.log('Navigating to:', href);
                window.location.href = href;
            }
        });

        // Speed up scroll zoom
        const controls = window.Graph.controls();
        controls.zoomSpeed = 2.5;  // Default is 1.0, increase for faster zoom

        // Panel close handlers
        document.getElementById('panel-close').addEventListener('click', () => {
            document.getElementById('node-panel').classList.remove('open');
        });

        // Reset View Button Handler
        document.getElementById('reset-view').addEventListener('click', () => {
            window.Graph.zoomToFit(600);
            document.getElementById('node-panel').classList.remove('open');
        });

        // Initial Camera setup - start far back
        window.Graph.cameraPosition({ z: 500 });

        // Force zoomToFit after a delay (backup if onEngineStop doesn't fire)
        setTimeout(() => {
            window.Graph.zoomToFit(400);
            console.log('zoomToFit triggered');
        }, 3000);

        // Handle Window Resize
        window.addEventListener('resize', () => {
            if (window.Graph) {
                window.Graph.width(container.clientWidth);
                window.Graph.height(container.clientHeight);
            }
        });



    } catch (err) {
        console.error("Failed to render graph:", err);
    }
});

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

        const Graph = ForceGraph3D()
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
                    if (name.includes('philosophy') || name.includes('철학')) return '#818cf8'; // Indigo
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

            // Physics for Planetary System
            .d3Force('link', d3.forceLink().distance(link => {
                // Longer distance from planets to posts
                if (link.source.group === 'category' || link.target.group === 'category') return 100;
                return 30;
            }))
            .d3Force('charge', d3.forceManyBody().strength(-120)) // Stronger repulsion

            // Link styling
            .linkWidth(0.5)
            .linkOpacity(0.3)
            .linkColor(() => '#ffffff') // White links

            // Background
            .backgroundColor('rgba(0,0,0,0)') // Transparent

            // Interaction
            .onNodeClick(node => {
                if (node.group === 'post') {
                    // Navigate to post
                    window.location.href = node.id;
                } else {
                    // For tags/categories, maybe zoom/focus? 
                    // Or navigate to listing page if ID matches url pattern
                    // IDs are like "cat-religion", "tag-ai"
                    // I'd need to reconstruct the URL. 
                    // For now, focus on posts.

                    // Focus camera on node
                    const distance = 40;
                    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

                    Graph.cameraPosition(
                        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
                        node, // lookAt ({ x, y, z })
                        3000  // ms transition duration
                    );
                }
            });

        // Auto-rotate
        // Graph.controls().autoRotate = true;
        // Graph.controls().autoRotateSpeed = 0.5;

        // Initial Camera setup
        Graph.cameraPosition({ z: 200 });

        // Handle Window Resize
        window.addEventListener('resize', () => {
            if (Graph) {
                Graph.width(container.clientWidth);
                Graph.height(container.clientHeight);
            }
        });

    } catch (err) {
        console.error("Failed to render graph:", err);
    }
});

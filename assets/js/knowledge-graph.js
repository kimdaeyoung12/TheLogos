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
                if (node.group === 'post') return '#a5f3fc'; // Cyan/Light Blue for posts
                if (node.group === 'category') return '#fbbf24'; // Amber/Gold for categories
                if (node.group === 'tag') return '#94a3b8'; // Slate/Gray for tags
                return '#ffffff';
            })
            .nodeVal(node => {
                // Use logarithmic scaling or exact 'val' from JSON
                // JSON vals: Post=20, Cat=30, Tag=5
                return node.val;
            })
            .nodeResolution(16) // Higher polygon count for spheres
            .nodeOpacity(0.9)

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

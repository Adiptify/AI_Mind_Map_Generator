import dagre from 'dagre';

export const getLayoutedElements = (nodes, edges, hiddenIds = new Set(), direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: 200, // Horizontal gap between parent and child
        nodesep: 120, // Vertical gap between sibling nodes
        marginx: 100,
        marginy: 100,
    });

    const visibleNodes = nodes.filter(n => !hiddenIds.has(n.id));
    const visibleEdges = edges.filter(e => !hiddenIds.has(e.source) && !hiddenIds.has(e.target));

    visibleNodes.forEach((node) => {
        const level = node.data?.level || 0;
        // Real CSS bounds of the custom nodes
        let width = 280;
        let height = 120; // Increased height estimation to account for descriptions

        if (level === 0) {
            width = 340;
            height = 140;
        } else if (level === 1) {
            width = 300;
            height = 130;
        }

        dagreGraph.setNode(node.id, { width, height });
    });

    visibleEdges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    // Map to find parents quickly for hidden nodes
    const parentMap = {};
    edges.forEach(e => { parentMap[e.target] = e.source; });

    const layoutedNodes = nodes.map((node) => {
        if (!hiddenIds.has(node.id)) {
            // Visible node -> Get absolute center position from Dagre
            const nodeWithPosition = dagreGraph.node(node.id);

            return {
                ...node,
                targetPosition: 'left',
                sourcePosition: 'right',
                position: {
                    x: nodeWithPosition.x - (nodeWithPosition.width / 2),
                    y: nodeWithPosition.y - (nodeWithPosition.height / 2),
                },
            };
        } else {
            // Hidden node -> Snap to nearest visible ancestor's center position
            let ancestorId = parentMap[node.id];
            let ancestorPos = { x: 0, y: 0 };

            // Traverse up until we find a visible node or run out
            while (ancestorId) {
                if (!hiddenIds.has(ancestorId)) {
                    const nodeWithPosition = dagreGraph.node(ancestorId);
                    if (nodeWithPosition) {
                        ancestorPos = {
                            x: nodeWithPosition.x - (nodeWithPosition.width / 2),
                            y: nodeWithPosition.y - (nodeWithPosition.height / 2)
                        };
                    }
                    break;
                }
                ancestorId = parentMap[ancestorId];
            }

            return {
                ...node,
                position: ancestorPos
            };
        }
    });

    return { nodes: layoutedNodes, edges };
};

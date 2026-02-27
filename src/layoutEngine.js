import dagre from 'dagre';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

export const getLayoutedElements = (nodes, edges, direction = 'LR') => {
    // Increased spacing slightly for readability, but kept compact
    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: 200,
        nodesep: 100,
        marginx: 50,
        marginy: 50,
        align: 'UL' // Align Upper-Left for a cleaner cascading look
    });

    nodes.forEach((node) => {
        // Dynamic sizing based on level to match CSS
        const level = node.data?.level || 0;
        let width = 180;
        let height = 80;

        if (level === 0) {
            width = 280;
            height = 120;
        } else if (level === 1) {
            width = 220;
            height = 100;
        }

        dagreGraph.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);

        // Re-calculate width/height for offset
        const level = node.data?.level || 0;
        let offsetW = 180 / 2;
        let offsetH = 80 / 2;
        if (level === 0) { offsetW = 280 / 2; offsetH = 120 / 2; }
        else if (level === 1) { offsetW = 220 / 2; offsetH = 100 / 2; }

        return {
            ...node,
            targetPosition: 'left',
            sourcePosition: 'right',
            position: {
                x: nodeWithPosition.x - offsetW,
                y: nodeWithPosition.y - offsetH,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

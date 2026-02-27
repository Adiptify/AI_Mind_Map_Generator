import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  useNodesState, useEdgesState, Background, Controls, MiniMap, MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getAIResponse } from './llmService';
import { getLayoutedElements } from './layoutEngine';
import { Send, Trash2, Zap, Cpu, RefreshCcw, Layout } from 'lucide-react';
import CustomNode from './components/CustomNode';
import './App.css';

const nodeTypes = {
  custom: CustomNode,
};

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());

  // Load from Memory
  useEffect(() => {
    const saved = localStorage.getItem('ai_graph_memory');
    if (saved) {
      try {
        const { nodes: n, edges: e } = JSON.parse(saved);
        if (Array.isArray(n) && Array.isArray(e)) {
          setNodes(n);
          setEdges(e);
        }
      } catch (err) {
        console.error("Failed to load memory:", err);
        localStorage.removeItem('ai_graph_memory'); // Clear bad data
      }
    }
  }, [setNodes, setEdges]);

  const toggleChildren = useCallback((nodeId) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // Derived state for hidden nodes/edges to avoid infinite loops
  const hiddenIds = useMemo(() => {
    const ids = new Set();
    const checkHidden = (parentId) => {
      edges.forEach(edge => {
        if (edge.source === parentId) {
          ids.add(edge.target);
          checkHidden(edge.target);
        }
      });
    };
    collapsedNodes.forEach(id => checkHidden(id));
    return ids;
  }, [collapsedNodes, edges]);

  // Automatically re-layout when nodes are expanded/collapsed to ensure compact spacing
  useEffect(() => {
    if (nodes.length > 0) {
      const { nodes: lNodes } = getLayoutedElements(nodes, edges);
      // Only update if positions actually changed to avoid jitter
      setNodes(nds => nds.map(n => {
        const ln = lNodes.find(node => node.id === n.id);
        return ln ? { ...n, position: ln.position } : n;
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsedNodes]);

  const onExpand = useCallback(async (topic, parentId = null) => {
    if (!topic.trim()) return;

    setLoading(true);
    try {
      const data = await getAIResponse(topic, parentId);
      let nodesToAdd = [];
      let edgesToAdd = [];

      if (!parentId && data?.root) {
        // Initial deep load
        const rootId = `root-${Date.now()}`;
        const initialCollapsed = new Set();

        // COLLAPSE BY DEFAULT: Root and Level-1
        initialCollapsed.add(rootId);

        const rootNode = {
          id: rootId,
          type: 'custom',
          data: {
            label: data.root.label || topic,
            desc: data.root.desc || '',
            isRoot: true,
            level: 0,
            onToggleChildren: toggleChildren,
            childCount: data.children?.length || 0
          },
          position: { x: 0, y: 0 }
        };
        nodesToAdd.push(rootNode);

        if (Array.isArray(data.children)) {
          data.children.forEach((l1, i) => {
            const l1Id = `l1-${i}-${Date.now()}`;
            initialCollapsed.add(l1Id);

            nodesToAdd.push({
              id: l1Id,
              type: 'custom',
              data: {
                label: l1.label || 'Category',
                desc: l1.desc || '',
                level: 1,
                childCount: l1.children?.length || 0,
                onToggleChildren: toggleChildren
              },
              position: { x: 0, y: 0 }
            });
            edgesToAdd.push({
              id: `e-${rootId}-${l1Id}`,
              source: rootId,
              target: l1Id,
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
            });

            if (Array.isArray(l1.children)) {
              l1.children.forEach((l2, j) => {
                const l2Id = `l2-${i}-${j}-${Date.now()}`;
                nodesToAdd.push({
                  id: l2Id,
                  type: 'custom',
                  data: {
                    label: l2.label || 'Sub-category',
                    desc: l2.desc || '',
                    level: 2,
                    onToggleChildren: toggleChildren
                  },
                  position: { x: 0, y: 0 }
                });
                edgesToAdd.push({
                  id: `e-${l1Id}-${l2Id}`,
                  source: l1Id,
                  target: l2Id,
                  animated: true,
                  markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
                });
              });
            }
          });
        }
        setCollapsedNodes(prev => new Set([...prev, ...initialCollapsed]));
      } else if (data?.nodes) {
        // Recursive expansion (2 levels deep)
        const parentNode = nodes.find(n => n.id === parentId);
        const parentLevel = parentNode?.data?.level || 0;
        const parentPos = parentNode?.position || { x: 0, y: 0 };

        data.nodes.forEach(n => {
          const l1Id = `${n.id}-${Math.random().toString(36).substr(2, 9)}`;

          nodesToAdd.push({
            id: l1Id,
            type: 'custom',
            data: {
              label: n.label || 'Topic',
              desc: n.desc || '',
              level: parentLevel + 1,
              onToggleChildren: toggleChildren,
              childCount: n.children?.length || 0
            },
            position: { x: parentPos.x + 50, y: parentPos.y } // Offset slightly to the right
          });

          edgesToAdd.push({
            id: `e-${parentId}-${l1Id}`,
            source: parentId,
            target: l1Id,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
          });

          // Handle Level 2 Children if they exist
          if (Array.isArray(n.children)) {
            n.children.forEach(c => {
              const l2Id = `${c.id}-${Math.random().toString(36).substr(2, 9)}`;
              nodesToAdd.push({
                id: l2Id,
                type: 'custom',
                data: {
                  label: c.label || 'Detail',
                  desc: c.desc || '',
                  level: parentLevel + 2,
                  onToggleChildren: toggleChildren
                },
                position: { x: parentPos.x + 100, y: parentPos.y } // Nested offset
              });
              edgesToAdd.push({
                id: `e-${l1Id}-${l2Id}`,
                source: l1Id,
                target: l2Id,
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
              });
            });
          }
        });

        // Ensure the expanded parent is not collapsed
        setCollapsedNodes(prev => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }

      const allNodes = [...nodes, ...nodesToAdd];
      const allEdges = [...edges, ...edgesToAdd];

      // Calculate visibility for layout
      const testHiddenIds = new Set();
      const checkHidden = (pId, currentEdges) => {
        currentEdges.forEach(e => {
          if (e.source === pId) {
            testHiddenIds.add(e.target);
            checkHidden(e.target, currentEdges);
          }
        });
      };

      const tempCollapsed = new Set(collapsedNodes);
      if (!parentId && data?.root) {
        const rootId = nodesToAdd[0]?.id;
        if (rootId) tempCollapsed.add(rootId);
        nodesToAdd.filter(n => n.id.startsWith('l1')).forEach(n => tempCollapsed.add(n.id));
      } else if (parentId) {
        // If expanding an existing node, it's no longer collapsed
        tempCollapsed.delete(parentId);
      }

      tempCollapsed.forEach(id => checkHidden(id, allEdges));

      const visibleNodesSubset = allNodes.filter(n => !testHiddenIds.has(n.id));
      const visibleEdgesSubset = allEdges.filter(e => !testHiddenIds.has(e.target) && !testHiddenIds.has(e.source));

      const { nodes: lNodes } = getLayoutedElements(visibleNodesSubset, visibleEdgesSubset);

      // Merge positions BACK into the full node set
      const updatedNodes = allNodes.map(n => {
        const layouted = lNodes.find(ln => ln.id === n.id);
        if (layouted) return { ...n, position: layouted.position };

        // If hidden, move to parent's position (or near it) for a compact 'cluster'
        const parentEdge = allEdges.find(e => e.target === n.id);
        if (parentEdge) {
          const parent = lNodes.find(ln => ln.id === parentEdge.source);
          if (parent) return { ...n, position: { ...parent.position } };
        }
        return n;
      });

      setNodes(updatedNodes);
      setEdges(allEdges);
      localStorage.setItem('ai_graph_memory', JSON.stringify({ nodes: updatedNodes, edges: allEdges }));
    } catch (error) {
      console.error("Expansion error:", error);
    } finally {
      setLoading(false);
      if (!parentId) setInput('');
    }
  }, [nodes, edges, setNodes, setEdges, toggleChildren, collapsedNodes]);

  const visibleNodes = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      hidden: hiddenIds.has(node.id),
      data: {
        ...node.data,
        isCollapsed: collapsedNodes.has(node.id),
        onToggleChildren: toggleChildren,
        onExpand: onExpand
      }
    }));
  }, [nodes, hiddenIds, collapsedNodes, toggleChildren, onExpand]);

  const visibleEdges = useMemo(() => {
    return edges.map(edge => ({
      ...edge,
      hidden: hiddenIds.has(edge.target) || hiddenIds.has(edge.source)
    }));
  }, [edges, hiddenIds]);

  const clearGraph = useCallback(() => {
    if (window.confirm("Clear all nodes?")) {
      setNodes([]);
      setEdges([]);
      localStorage.removeItem('ai_graph_memory');
      setCollapsedNodes(new Set());
    }
  }, [setNodes, setEdges]);

  const triggerLayout = useCallback(() => {
    const { nodes: lNodes } = getLayoutedElements(nodes, edges);
    setNodes(lNodes);
  }, [nodes, edges, setNodes]);

  const clearMemory = useCallback(() => {
    if (window.confirm("This will clear the saved memory and reload. Continue?")) {
      localStorage.removeItem('ai_graph_memory');
      window.location.reload();
    }
  }, []);

  return (
    <div className="app-container">
      <header className="glass-header">
        <div className="logo">
          <Cpu size={24} className="icon-glow" />
          <span>GEN-AI Graph Explorer</span>
        </div>

        <div className="search-box">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Explore a topic (e.g. LLM Architecture)..."
            onKeyDown={(e) => e.key === 'Enter' && onExpand(input)}
          />
          <button onClick={() => onExpand(input)} disabled={loading}>
            {loading ? <RefreshCcw className="spinning" /> : <Send size={18} />}
          </button>
        </div>

        <div className="actions">
          <button className="btn-icon" onClick={triggerLayout} title="Rearrange Layout">
            <Layout size={18} />
          </button>
          <button className="btn-icon" onClick={clearMemory} title="Reset App Memory">
            <RefreshCcw size={18} />
          </button>
          <button className="btn-icon btn-danger" onClick={clearGraph} title="Clear Current Graph">
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        onNodeDragStop={() => {
          localStorage.setItem('ai_graph_memory', JSON.stringify({ nodes, edges }));
        }}
      >
        <Background color="#1e293b" variant="dots" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => n.hidden ? 'transparent' : '#3b82f6'}
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>

      {loading && (
        <div className="loader-container">
          <div className="loader-overlay">
            <Zap className="spinning" size={16} />
            <span>Generating 2-Level Deep Graph...</span>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { ChevronRight, ChevronDown, Info, PlusCircle } from 'lucide-react';

const CustomNode = ({ id, data }) => {
    const hasChildren = data.childCount > 0;
    const level = data.level || 0;

    return (
        <div className={`custom-node-wrapper ${data.isRoot ? 'root-node' : ''} node-level-${level}`}>
            <Handle type="target" position={Position.Left} />
            <div className="custom-node-content">
                <div className="node-header">
                    <span className="node-label">{data.label}</span>
                    <div className="node-actions">
                        {!hasChildren && (
                            <button
                                className="toggle-btn expand-btn"
                                title="Explore more"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    data.onExpand?.(data.label, id);
                                }}
                            >
                                <PlusCircle size={14} />
                            </button>
                        )}
                        {hasChildren && (
                            <button
                                className="toggle-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    data.onToggleChildren?.(id);
                                }}
                            >
                                {data.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                        )}
                    </div>
                </div>
                <div className="hover-info">
                    <Info size={12} className="info-icon" />
                    <div className="tooltip-desc">{data.desc}</div>
                </div>
            </div>
            <Handle type="source" position={Position.Right} />
        </div>
    );
};

export default memo(CustomNode);

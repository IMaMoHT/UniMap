import React from 'react';
import { MAP_HEIGHT, MAP_WIDTH } from '@/config/mapDimensions';

interface AdminClickerProps {
  mapTransform: { scale: number; x: number; y: number };
  activeFloor: number;
  nodes: { id: string; x: number; y: number; floor: number; roomId?: string }[];
  edges: { from: string; to: string; floor: number }[];
  mode: 'off' | 'nodes' | 'edges';
  currentRoomId: string;
  selectedNodeId: string | null;
  draggingNodeId: string | null;
  onMapClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  onNodeMouseDown: (nodeId: string, e: React.MouseEvent) => void;
  onNodeClick: (nodeId: string, e: React.MouseEvent) => void;
}

export default function AdminClicker({
  mapTransform,
  activeFloor,
  nodes,
  edges,
  mode,
  selectedNodeId,
  onMapClick,
  onMouseMove,
  onMouseUp,
  onNodeMouseDown,
  onNodeClick
}: AdminClickerProps) {

  const visibleNodes = nodes.filter(node => node.floor === activeFloor);
  const visibleEdges = edges.filter(edge => edge.floor === activeFloor);

  return (
    <div
      onClick={onMapClick}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${MAP_WIDTH}px`,
        height: `${MAP_HEIGHT}px`,
        zIndex: 999,
        cursor: mode === 'nodes' ? 'crosshair' : 'default',
        pointerEvents: mode === 'off' ? 'none' : 'auto',
      }}
    >
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {visibleEdges.map((edge, index) => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return null;
          return (
            <line
              key={index}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke="#007bff"
              strokeWidth="4"
            />
          );
        })}
      </svg>

      {visibleNodes.map((node) => (
        <div
          key={node.id}
          onClick={(e) => onNodeClick(node.id, e)}
          onMouseDown={(e) => onNodeMouseDown(node.id, e)}
          style={{
            position: 'absolute',
            left: node.x,
            top: node.y,
            width: '16px',
            height: '16px',
            backgroundColor: selectedNodeId === node.id ? '#ffeb3b' : (node.roomId ? '#00ff00' : 'red'),
            border: '2px solid white',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            cursor: mode === 'edges' ? 'pointer' : (mode === 'nodes' ? 'grab' : 'none'),
          }}
        >
          <span style={{ position: 'absolute', top: 18, left: -10, color: node.roomId ? '#00ff00' : 'red', fontWeight: 'bold', fontSize: '12px', background: 'white', padding: '0 2px', whiteSpace: 'nowrap', userSelect: 'none' }}>
            {node.roomId ? `🚪 ${node.roomId}` : node.id}
          </span>
        </div>
      ))}
    </div>
  );
}
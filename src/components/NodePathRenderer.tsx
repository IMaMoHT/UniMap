import { useMemo } from 'react';
import type { PathResult } from '@/utils/pathfinding';
import { MAP_HEIGHT, MAP_WIDTH } from '@/config/mapDimensions';
import {
  buildSmoothPath,
  getFloorRuns,
  getFloorTransitions,
  sanitizePathNodes,
} from '@/utils/routePath';
import './NodePathRenderer.css';

interface NodePathRendererProps {
  path: PathResult | null;
  activeFloor: number;
  onFloorChange?: (floor: number) => void;
}

export default function NodePathRenderer({ path, activeFloor, onFloorChange }: NodePathRendererProps) {
  // Биті вузли не мають ламати рендер усієї карти
  const nodes = useMemo(() => sanitizePathNodes(path?.nodes), [path]);

  const runs = useMemo(() => getFloorRuns(nodes, activeFloor), [nodes, activeFloor]);
  const transitions = useMemo(() => getFloorTransitions(nodes, activeFloor), [nodes, activeFloor]);

  if (runs.length === 0 && transitions.length === 0) return null;

  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];
  const startOnFloor = firstNode && firstNode.floor === activeFloor ? { x: firstNode.x, y: firstNode.y } : null;
  const finishOnFloor = lastNode && lastNode.floor === activeFloor ? { x: lastNode.x, y: lastNode.y } : null;

  return (
    <div className="node-path-layer" style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}>
      <svg className="node-path-svg" width={MAP_WIDTH} height={MAP_HEIGHT}>
        {runs.map((run, index) => {
          const d = buildSmoothPath(run);
          if (!d) return null;
          return (
            <g key={`run-${index}`}>
              <path className="node-path__casing" d={d} strokeWidth={16} />
              <path className="node-path__line" d={d} strokeWidth={8} />
              <path className="node-path__flow" d={d} strokeWidth={8} />
            </g>
          );
        })}

        {startOnFloor && <circle className="node-path__start" cx={startOnFloor.x} cy={startOnFloor.y} r={13} />}

        {finishOnFloor && (
          <g>
            <circle className="node-path__finish-ring" cx={finishOnFloor.x} cy={finishOnFloor.y} r={16} />
            <circle className="node-path__finish" cx={finishOnFloor.x} cy={finishOnFloor.y} r={15} />
          </g>
        )}
      </svg>

      {transitions.map((transition) => (
        <button
          key={`${transition.nodeId}:${transition.targetFloor}`}
          type="button"
          className={`floor-switch-btn${transition.forward ? '' : ' floor-switch-btn--back'}`}
          style={{ left: transition.at.x, top: transition.at.y }}
          onClick={() => onFloorChange?.(transition.targetFloor)}
        >
          <span className="floor-switch-btn__icon" aria-hidden="true">
            {transition.targetFloor > activeFloor ? '↑' : '↓'}
          </span>
          {transition.forward ? 'Перейти на' : 'Повернутись на'} {transition.targetFloor} поверх
        </button>
      ))}
    </div>
  );
}

import { MAP_HEIGHT, MAP_WIDTH } from '../config/mapDimensions';
import { customBuildings, buildingWalls, buildingOpenings, buildingGreenZones } from '../config/customBuildingItems';
import type { CustomBuilding, GreenZone, Opening, Wall } from '../config/customBuildingTypes';

// Ті самі кольори, якими вже намальовані будівлі в Scenery.tsx —
// нові будівлі з конструктора мають виглядати ідентично існуючим.
const WALL_COLOR = '#2b3440';

interface Props {
  buildings?: CustomBuilding[];
  walls?: Wall[];
  openings?: Opening[];
  zones?: GreenZone[];
  /** Якщо задано — рендерити тільки стіни/зони цього поверху */
  floor?: number;
}

export function renderGreenZone(z: GreenZone, key: string) {
  const rot = z.rotation ?? 0;
  return (
    <rect
      key={key} x={z.x} y={z.y} width={z.width} height={z.height} rx="40"
      transform={`rotate(${rot} ${z.x + z.width / 2} ${z.y + z.height / 2})`}
      fill={z.color ?? '#e4efe1'} stroke="#c8dcc4" strokeWidth="3"
    />
  );
}

export function wallGeometry(w: Wall) {
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const len = Math.hypot(dx, dy) || 1;
  return { dx, dy, len, ux: dx / len, uy: dy / len };
}

function buildingLabelPos(buildingId: string, walls: Wall[]) {
  const bWalls = walls.filter((w) => w.buildingId === buildingId);
  if (bWalls.length === 0) return null;
  const xs = bWalls.flatMap((w) => [w.x1, w.x2]);
  const ys = bWalls.flatMap((w) => [w.y1, w.y2]);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/** Стіна намальована сегментами з розривами під отвори + глюф дверей/вікна в кожному розриві. */
export function renderWall(wall: Wall, allOpenings: Opening[], key: string) {
  const { len, ux, uy } = wallGeometry(wall);
  const nx = -uy;
  const ny = ux;
  const color = wall.color ?? WALL_COLOR;
  const halfT = wall.thickness / 2;
  const at = (t: number) => ({ x: wall.x1 + ux * t, y: wall.y1 + uy * t });

  const gaps = allOpenings
    .filter((o) => o.wallId === wall.id)
    .map((o) => {
      const center = o.offset * len;
      return { o, from: Math.max(0, center - o.width / 2), to: Math.min(len, center + o.width / 2) };
    })
    .sort((a, b) => a.from - b.from);

  const segments: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const g of gaps) {
    if (g.from > cursor) segments.push({ from: cursor, to: g.from });
    cursor = Math.max(cursor, g.to);
  }
  if (cursor < len) segments.push({ from: cursor, to: len });

  return (
    <g key={key}>
      {segments.map((s, i) => {
        const p1 = at(s.from);
        const p2 = at(s.to);
        return (
          <line
            key={i}
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke={color} strokeWidth={wall.thickness} strokeLinecap="square"
            opacity={wall.kind === 'interior' ? 0.85 : 1}
          />
        );
      })}

      {gaps.map(({ o, from, to }) => {
        const mid = at((from + to) / 2);
        if (o.kind === 'door') {
          const hinge = at(from);
          const r = to - from;
          const jamb = at(to);
          const swingEnd = { x: hinge.x + nx * r, y: hinge.y + ny * r };
          return (
            <g key={o.id} opacity={0.55}>
              <line x1={hinge.x} y1={hinge.y} x2={swingEnd.x} y2={swingEnd.y} stroke={color} strokeWidth={2} />
              <path
                d={`M ${jamb.x} ${jamb.y} A ${r} ${r} 0 0 1 ${swingEnd.x} ${swingEnd.y}`}
                fill="none" stroke={color} strokeWidth={1.5}
              />
            </g>
          );
        }
        // вікно: дві тонкі риски по краях розриву + одна легка посередині
        const t1 = at(from);
        const t2 = at(to);
        return (
          <g key={o.id} opacity={0.55}>
            <line x1={t1.x - nx * halfT} y1={t1.y - ny * halfT} x2={t1.x + nx * halfT} y2={t1.y + ny * halfT} stroke={color} strokeWidth={2} />
            <line x1={t2.x - nx * halfT} y1={t2.y - ny * halfT} x2={t2.x + nx * halfT} y2={t2.y + ny * halfT} stroke={color} strokeWidth={2} />
            <line x1={mid.x - nx * halfT * 0.6} y1={mid.y - ny * halfT * 0.6} x2={mid.x + nx * halfT * 0.6} y2={mid.y + ny * halfT * 0.6} stroke={color} strokeWidth={1.5} />
          </g>
        );
      })}
    </g>
  );
}

export default function CustomBuildingRenderer({
  buildings = customBuildings,
  walls = buildingWalls,
  openings = buildingOpenings,
  zones = buildingGreenZones,
  floor,
}: Props) {
  const visibleWalls = floor === undefined ? walls : walls.filter((w) => w.floor === floor);
  const visibleZones = floor === undefined ? zones : zones.filter((z) => z.floor === floor);
  if (visibleWalls.length === 0 && visibleZones.length === 0) return null;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: MAP_WIDTH, height: MAP_HEIGHT, zIndex: 5, pointerEvents: 'none' }}>
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} width={MAP_WIDTH} height={MAP_HEIGHT}>
        {visibleZones.map((z) => renderGreenZone(z, z.id))}
        {visibleWalls.map((w) => renderWall(w, openings, w.id))}
        {buildings.map((b) => {
          const pos = buildingLabelPos(b.id, visibleWalls);
          if (!pos) return null;
          return (
            <text key={b.id} x={pos.x} y={pos.y} textAnchor="middle" fontSize="30" fill="#7a8a80" fontFamily="Inter, sans-serif" opacity={0.8}>
              {b.name}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

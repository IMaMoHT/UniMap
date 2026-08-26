import { MAP_HEIGHT, MAP_WIDTH } from '../config/mapDimensions';
import { sceneryItems } from '../config/sceneryItems';
import type { SceneryItem } from '../config/sceneryTypes';
import Fountain from './Fountain';

export function renderSceneryItem(it: SceneryItem, key: string) {
  const rot = it.rotation ?? 0;
  const transform = `rotate(${rot} ${it.x + it.width / 2} ${it.y + it.height / 2})`;

  if (it.kind === 'tree') {
    const r = it.width / 2;
    const c = it.color ?? '#8fbf93';
    return (
      <g key={key}>
        <ellipse cx={it.x} cy={it.y + r * 0.35} rx={r * 1.05} ry={r * 0.35} fill="#000" opacity="0.08" />
        <circle cx={it.x} cy={it.y} r={r} fill={c} />
        <circle cx={it.x - r * 0.3} cy={it.y - r * 0.25} r={r * 0.6} fill="#6fa576" opacity="0.5" />
      </g>
    );
  }

  if (it.kind === 'bush') {
    const r = it.width / 2;
    const c = it.color ?? '#a8cf9f';
    return (
      <g key={key}>
        <circle cx={it.x} cy={it.y} r={r} fill={c} />
        <circle cx={it.x + r * 0.78} cy={it.y + r * 0.22} r={r * 0.72} fill="#8fbf93" opacity="0.8" />
        <circle cx={it.x - r * 0.72} cy={it.y + r * 0.28} r={r * 0.67} fill="#bfdfae" />
      </g>
    );
  }

  if (it.kind === 'bench') {
    const c = it.color ?? '#d8b98a';
    return (
      <g key={key} transform={transform}>
        <rect x={it.x} y={it.y} width={it.width} height={it.height} rx="6" fill={c} stroke="#a3835a" strokeWidth="2" />
        <rect x={it.x} y={it.y - 6} width={it.width} height="6" rx="3" fill="#e5c894" />
      </g>
    );
  }

  if (it.kind === 'fountain') {
    // Фонтан — окремий анімований компонент <Fountain>, рендериться поза цим svg (див. Scenery()/SceneryEditor).
    return null;
  }

  if (it.kind === 'lawn') {
    if (it.shape && it.shape.length > 1) {
      const abs = it.shape.map((p) => ({
        x: it.x + p.rx * it.width,
        y: it.y + p.ry * it.height,
        c: p.rcx !== undefined && p.rcy !== undefined ? { x: it.x + p.rcx * it.width, y: it.y + p.rcy * it.height } : null,
      }));
      let d = `M ${abs[0].x} ${abs[0].y} `;
      for (let i = 1; i < abs.length; i++) {
        const p = abs[i];
        d += p.c ? `Q ${p.c.x} ${p.c.y} ${p.x} ${p.y} ` : `L ${p.x} ${p.y} `;
      }
      d += 'Z';
      return <path key={key} d={d} transform={transform} fill={it.color ?? '#e4efe1'} stroke="#c8dcc4" strokeWidth="3" />;
    }
    return <rect key={key} x={it.x} y={it.y} width={it.width} height={it.height} rx="70" transform={transform} fill={it.color ?? '#e4efe1'} stroke="#c8dcc4" strokeWidth="3" />;
  }

  if (it.kind === 'path') {
    return (
      <g key={key} transform={transform}>
        <rect x={it.x} y={it.y} width={it.width} height={it.height} rx={it.height / 2} fill="#c9c0a8" />
        <rect x={it.x} y={it.y + 4} width={it.width} height={Math.max(0, it.height - 8)} rx={Math.max(0, it.height - 8) / 2} fill={it.color ?? '#e9e2d0'} />
      </g>
    );
  }

  // building
  const divCount = it.dividers ?? 0;
  const dividers = [];
  for (let i = 1; i <= divCount; i += 1) {
    const dx = it.x + (it.width * i) / (divCount + 1);
    dividers.push(<line key={`d${i}`} x1={dx} y1={it.y} x2={dx} y2={it.y + it.height} stroke="#2b3440" strokeWidth="2.5" opacity="0.6" />);
  }
  return (
    <g key={key} transform={transform}>
      <rect x={it.x} y={it.y} width={it.width} height={it.height} rx="4" fill={it.color ?? '#fcfcfa'} stroke="#2b3440" strokeWidth="7" />
      <rect x={it.x + 16} y={it.y + 16} width={Math.max(0, it.width - 32)} height={Math.max(0, it.height - 32)} rx="2" fill="none" stroke="#2b3440" strokeWidth="2" opacity="0.4" />
      {dividers}
      {it.label && (
        <text x={it.x + it.width / 2} y={it.y + it.height / 2 + 12} textAnchor="middle" fontSize="34" fill="#7a8a80" fontFamily="Inter, sans-serif">{it.label}</text>
      )}
    </g>
  );
}

export default function Scenery({ items = sceneryItems }: { items?: SceneryItem[] }) {
  if (items.length === 0) return null;
  const fountains = items.filter((it) => it.kind === 'fountain');

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: MAP_WIDTH, height: MAP_HEIGHT, zIndex: 5, pointerEvents: 'none' }}>
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} width={MAP_WIDTH} height={MAP_HEIGHT}>
        {items.map((it, i) => renderSceneryItem(it, `${it.id}-${i}`))}
      </svg>
      {fountains.map((f) => (
        <Fountain key={f.id} x={f.x} y={f.y} size={f.width} />
      ))}
    </div>
  );
}

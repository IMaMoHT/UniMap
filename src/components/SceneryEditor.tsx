import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MAP_HEIGHT, MAP_WIDTH } from '../config/mapDimensions';
import { sceneryItems } from '../config/sceneryItems';
import type { SceneryItem, SceneryKind } from '../config/sceneryTypes';
import { renderSceneryItem } from './Scenery';
import Fountain from './Fountain';
import { useDragMove } from '../hooks/useDragMove';
import { useDeleteKey } from '../hooks/useDeleteKey';

interface Props { mapScale: number; }

// Елементи, у яких x/y — це ЦЕНТР (не лівий верхній кут).
const CENTER_ANCHORED: SceneryKind[] = ['tree', 'bush', 'fountain'];

let uid = 0;
const DEFAULTS: Record<SceneryKind, Partial<SceneryItem>> = {
  building: { width: 600, height: 180, color: '#fcfcfa', label: 'Будівля' },
  lawn: { width: 700, height: 500, color: '#e4efe1' },
  path: { width: 600, height: 46, color: '#e9e2d0' },
  tree: { width: 76, height: 76, color: '#8fbf93' },
  bush: { width: 44, height: 44, color: '#a8cf9f' },
  bench: { width: 68, height: 18, color: '#d8b98a' },
  fountain: { width: 300, height: 300 },
};
const KIND_LABEL: Record<SceneryKind, string> = {
  building: '🏢 Будівля', lawn: '🌿 Газон', path: '🛣 Доріжка', tree: '🌳 Дерево',
  bush: '🌱 Кущ', bench: '🪑 Лавка', fountain: '⛲ Фонтан',
};

function make(kind: SceneryKind): SceneryItem {
  const d = DEFAULTS[kind];
  const w = d.width ?? 100;
  const h = d.height ?? 100;
  return {
    id: `${kind}_${uid++}`, kind,
    x: Math.round(MAP_WIDTH / 2 - w / 2), y: Math.round(MAP_HEIGHT / 2 - h / 2),
    width: w, height: h, rotation: 0, color: d.color, label: d.label,
  };
}

const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #444', background: '#111', color: '#fff', boxSizing: 'border-box', fontSize: 13 };
const row: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 };
const lbl: React.CSSProperties = { fontSize: 12, color: '#aaa' };
const btn = (bg: string): React.CSSProperties => ({ padding: 9, background: bg, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 });

export default function SceneryEditor({ mapScale }: Props) {
  const [items, setItems] = useState<SceneryItem[]>(() => sceneryItems.map((s) => ({ ...s })));
  const [selId, setSelId] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const { startDrag, onDrag, endDrag } = useDragMove(mapScale);

  const sel = items.find((i) => i.id === selId) ?? null;
  const patch = (id: string, p: Partial<SceneryItem>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const start = (it: SceneryItem, e: React.MouseEvent) => {
    setSelId(it.id);
    startDrag(it.id, it.x, it.y, e);
  };
  const onMove = (e: React.MouseEvent) => onDrag(e, (id, x, y) => patch(id, { x, y }));
  const add = (k: SceneryKind) => { const it = make(k); setItems((p) => [...p, it]); setSelId(it.id); };
  const del = () => { if (sel) { setItems((p) => p.filter((i) => i.id !== sel.id)); setSelId(null); } };

  useDeleteKey(selId, del);

  const code =
    `import type { SceneryItem } from './sceneryTypes';\n\n` +
    `export const sceneryItems: SceneryItem[] = ${JSON.stringify(items, null, 2)};\n`;
  const copy = () => { navigator.clipboard?.writeText(code).catch(() => {}); setShowCode(true); };

  const panel = (
    <div style={{ position: 'fixed', top: 16, right: 16, width: 300, zIndex: 100000, background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', color: '#fff', padding: 16, fontFamily: 'sans-serif', maxHeight: '94vh', overflowY: 'auto' }}>
      <h4 style={{ margin: '0 0 12px', color: '#00ff00', fontSize: 15 }}>🏗 Двір / будівлі</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {(Object.keys(KIND_LABEL) as SceneryKind[]).map((k) => (
          <button key={k} onClick={() => add(k)} style={btn('#2f6f4f')}>{KIND_LABEL[k]}</button>
        ))}
      </div>
      <button onClick={copy} style={{ ...btn('#17a2b8'), width: '100%', marginBottom: 12 }}>📋 Копіювати код</button>

      {!sel && <p style={{ color: '#888', fontSize: 13, margin: 0 }}>Додай елемент і клікни на нього, щоб редагувати. Перетягуй мишкою.</p>}
      {sel && (
        <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: '#ffd54f', marginBottom: 8 }}>{KIND_LABEL[sel.kind]}</div>
          {(sel.kind === 'building') && (
            <div style={row}><span style={lbl}>Підпис</span><input style={inp} value={sel.label ?? ''} onChange={(e) => patch(sel.id, { label: e.target.value })} /></div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ ...row, flex: 1 }}>
              <span style={lbl}>{sel.kind === 'tree' || sel.kind === 'bush' ? 'Діаметр' : sel.kind === 'fountain' ? 'Розмір' : sel.kind === 'path' ? 'Довжина' : 'Ширина'}</span>
              <input style={inp} type="number" value={sel.width} onChange={(e) => patch(sel.id, { width: Number(e.target.value) })} />
            </div>
            {sel.kind !== 'tree' && sel.kind !== 'bush' && sel.kind !== 'fountain' && (
              <div style={{ ...row, flex: 1 }}><span style={lbl}>{sel.kind === 'path' ? 'Товщина' : 'Висота'}</span><input style={inp} type="number" value={sel.height} onChange={(e) => patch(sel.id, { height: Number(e.target.value) })} /></div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ ...row, flex: 1 }}><span style={lbl}>Поворот°</span><input style={inp} type="number" value={sel.rotation ?? 0} onChange={(e) => patch(sel.id, { rotation: Number(e.target.value) })} /></div>
            <div style={{ ...row, flex: 1 }}><span style={lbl}>Колір</span><input style={{ ...inp, padding: 2, height: 34 }} type="color" value={sel.color ?? '#8fbf93'} onChange={(e) => patch(sel.id, { color: e.target.value })} /></div>
          </div>
          <button onClick={del} style={{ ...btn('#dc3545'), width: '100%' }}>🗑 Видалити</button>
        </div>
      )}
      {showCode && (
        <div style={{ marginTop: 12, borderTop: '1px solid #333', paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: '#ffd54f', marginBottom: 6 }}>Скопійовано. Встав у <b>src/config/sceneryItems.ts</b> (заміни масив).</div>
          <textarea readOnly value={code} onFocus={(e) => e.currentTarget.select()} style={{ width: '100%', height: 150, background: '#0a0a0a', color: '#00ff00', border: '1px solid #333', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', boxSizing: 'border-box', padding: 8 }} />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div onMouseMove={onMove} onMouseUp={endDrag} onMouseLeave={endDrag} onMouseDown={() => setSelId(null)}
        style={{ position: 'absolute', top: 0, left: 0, width: MAP_WIDTH, height: MAP_HEIGHT, zIndex: 500 }}>
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} width={MAP_WIDTH} height={MAP_HEIGHT} style={{ position: 'absolute', pointerEvents: 'none' }}>
          {items.map((it, i) => renderSceneryItem(it, `${it.id}-${i}`))}
          {sel && (() => {
            const centered = CENTER_ANCHORED.includes(sel.kind);
            const rx = centered ? sel.x - sel.width / 2 : sel.x;
            const ry = centered ? sel.y - sel.width / 2 : sel.y;
            const rw = sel.width;
            const rh = centered ? sel.width : sel.height;
            return <rect x={rx} y={ry} width={rw} height={rh} transform={`rotate(${sel.rotation ?? 0} ${rx + rw / 2} ${ry + rh / 2})`} fill="none" stroke="#ffeb3b" strokeWidth="4" strokeDasharray="14 8" />;
          })()}
        </svg>
        {/* живі анімовані фонтани (не вкладаються в спільний svg — власна CSS-анімація) */}
        {items.filter((it) => it.kind === 'fountain').map((f) => (
          <Fountain key={f.id} x={f.x} y={f.y} size={f.width} />
        ))}
        {/* invisible drag hit-boxes */}
        {items.map((it) => {
          const centered = CENTER_ANCHORED.includes(it.kind);
          return (
            <div key={it.id} onMouseDown={(e) => start(it, e)}
              style={{
                position: 'absolute',
                left: centered ? it.x - it.width / 2 : it.x,
                top: centered ? it.y - it.width / 2 : it.y,
                width: it.width,
                height: centered ? it.width : it.height,
                transform: centered ? undefined : `rotate(${it.rotation ?? 0}deg)`,
                transformOrigin: 'center', cursor: 'move',
                background: it.id === selId ? 'rgba(255,235,59,0.12)' : 'transparent',
              }} />
          );
        })}
      </div>
      {createPortal(panel, document.body)}
    </>
  );
}

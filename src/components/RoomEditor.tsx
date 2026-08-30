import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PositionedElementConfig } from '../services/PositionedElementsService';
import { getSquaresConfigForFloor } from '../config/positionedElements';
import { MAP_HEIGHT, MAP_WIDTH } from '../config/mapDimensions';
import { useDragMove } from '../hooks/useDragMove';
import { useDeleteKey } from '../hooks/useDeleteKey';

// ДОДАНО: властивості hiddenName та iconEmoji
type Room = PositionedElementConfig & { 
  _uid: string; 
  hiddenName?: string; 
  iconEmoji?: string; 
};

interface RoomEditorProps {
  activeFloor: number;
  mapScale: number;
}

// Шляхи від кореня сайту — файли лежать у public/Sprite і працюють у білді.
const ICON_OPTIONS = [
  { label: 'Немає', value: '' },
  { label: 'Туалет (WC)', value: '/Sprite/WC-icon.svg' },
  { label: 'Людина', value: '/Sprite/Person-walk.svg' },
  { label: 'Сходи', value: '/Sprite/Stairs-icon.svg' },
  { label: 'Буфет', value: '/Sprite/Buffet-icon.svg' },
  { label: 'Бібліотека', value: '/Sprite/Library-icon.svg' },
  { label: 'Вихід', value: '/Sprite/Exit-icon.svg' },
];

let uid = 0;

function labelOf(r: Room): string {
  const t = r.text as { OnDefault?: { Ukrainian?: string }; Ukrainian?: string } | undefined;
  if (t?.OnDefault?.Ukrainian) return t.OnDefault.Ukrainian;
  if (typeof t?.Ukrainian === 'string') return t.Ukrainian;
  if (typeof r.number === 'number') return String(r.number);
  return r.id;
}

function toRgba(color: string | undefined, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color ?? '');
  if (m) {
    const h = m[1];
    return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
  }
  return color || `rgba(57, 163, 155, ${a})`;
}

function buildCode(rooms: Room[], floor: number): string {
  const items = rooms
    .map((r) => {
      const name = labelOf(r);
      const lines = [
        `        id: ${JSON.stringify(r.id)},`,
        typeof r.number === 'number' ? `        number: ${r.number},` : '',
        `        category: '${r.category ?? 'regular'}',`,
        `        x: ${Math.round(r.x)},`,
        `        y: ${Math.round(r.y)},`,
        `        width: ${Math.round(r.width ?? 100)},`,
        `        height: ${Math.round(r.height ?? 100)},`,
        r.rotation ? `        rotation: ${Math.round(r.rotation)},` : '',
        `        corridor: ${r.corridor ?? 1},`,
        `        text: { OnDefault: { Ukrainian: ${JSON.stringify(name)}, English: ${JSON.stringify(name)} } },`,
        // ДОДАНО: Експорт нових властивостей у JSON
        r.hiddenName ? `        hiddenName: ${JSON.stringify(r.hiddenName)},` : '',
        r.iconEmoji ? `        iconEmoji: ${JSON.stringify(r.iconEmoji)},` : '',
        r.imgSrc ? `        imgSrc: '${r.imgSrc}',` : '',
        `        styleOverrides: { color: '${r.color ?? '#39A39B'}', borderColor: '${r.borderColor ?? '#2d8a84'}' },`,
      ].filter(Boolean);
      return `      createRoom({\n${lines.join('\n')}\n      }),`;
    })
    .join('\n');
  return (
    `import { createRoom, type FloorCorridorGroups } from './positionedElementsCommon';\n\n` +
    `export const corridorGroupsFloor${floor}: FloorCorridorGroups = {\n` +
    `  corridor1: {\n` +
    `    name: "Аудиторії",\n` +
    `    rooms: [\n${items}\n    ],\n` +
    `  },\n};\n`
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #444',
  background: '#111', color: '#fff', boxSizing: 'border-box', fontSize: 13,
};
const rowStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 };
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
const btn = (bg: string): React.CSSProperties => ({
  padding: 10, background: bg, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13,
});

export default function RoomEditor({ activeFloor, mapScale }: RoomEditorProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const { startDrag, onDrag, endDrag } = useDragMove(mapScale);

  useEffect(() => {
    setRooms(getSquaresConfigForFloor(activeFloor).map((r) => ({ ...r, _uid: `r${uid++}` })));
    setSelectedUid(null);
  }, [activeFloor]);

  const selected = rooms.find((r) => r._uid === selectedUid) ?? null;

  const patch = (u: string, p: Partial<Room>) =>
    setRooms((prev) => prev.map((r) => (r._uid === u ? { ...r, ...p } : r)));

  const rename = (u: string, name: string) =>
    patch(u, { text: { OnDefault: { Ukrainian: name, English: name } } } as Partial<Room>);

  const startMove = (r: Room, e: React.MouseEvent) => {
    setSelectedUid(r._uid);
    startDrag(r._uid, r.x, r.y, e);
  };

  const onMove = (e: React.MouseEvent) => onDrag(e, (uid, x, y) => patch(uid, { x, y }));

  const addRoom = () => {
    const u = `r${uid++}`;
    setRooms((prev) => [
      ...prev,
      {
        _uid: u, id: `new_${u}`, x: Math.round(MAP_WIDTH / 2), y: Math.round(MAP_HEIGHT / 2),
        width: 130, height: 90, rotation: 0, category: 'regular', corridor: 1,
        color: '#39A39B', borderColor: '#2d8a84', text: { OnDefault: { Ukrainian: 'Нова', English: 'New' } },
      } as Room,
    ]);
    setSelectedUid(u);
  };

  const removeSelected = () => {
    if (!selected) return;
    setRooms((prev) => prev.filter((r) => r._uid !== selected._uid));
    setSelectedUid(null);
  };

  useDeleteKey(selectedUid, removeSelected);

  const code = buildCode(rooms, activeFloor);
  const copyCode = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setShowCode(true);
  };

  const panel = (
    <div style={{ position: 'fixed', top: 16, right: 16, width: 300, zIndex: 100000, background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', color: '#fff', padding: 16, fontFamily: 'sans-serif', maxHeight: '94vh', overflowY: 'auto' }}>
      <h4 style={{ margin: '0 0 12px', color: '#00ff00', fontSize: 15 }}>✏️ Редактор аудиторій · {activeFloor} пов.</h4>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={addRoom} style={{ ...btn('#28a745'), flex: 1 }}>➕ Додати</button>
        <button onClick={copyCode} style={{ ...btn('#17a2b8'), flex: 1 }}>📋 Копіювати код</button>
      </div>

      {!selected && <p style={{ color: '#888', fontSize: 13, margin: '0 0 12px' }}>Клікни на зелену аудиторію, щоб редагувати. Перетягуй мишкою, щоб рухати.</p>}

      {selected && (
        <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
          <div style={rowStyle}>
            <span style={labelStyle}>Основна назва</span>
            <input style={inputStyle} value={labelOf(selected)} onChange={(e) => rename(selected._uid, e.target.value)} />
          </div>
          
          {/* ДОДАНО: Скрита назва та Емодзі-іконка */}
          <div style={rowStyle}>
            <span style={labelStyle}>Скрита назва (синоніми)</span>
            <input style={inputStyle} placeholder="Напр. деканат, кафедра..." value={selected.hiddenName ?? ''} onChange={(e) => patch(selected._uid, { hiddenName: e.target.value })} />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Емодзі-іконка (в текст)</span>
            <input style={inputStyle} placeholder="Напр. 💻, ☕️, 🚪" value={selected.iconEmoji ?? ''} onChange={(e) => patch(selected._uid, { iconEmoji: e.target.value })} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ ...rowStyle, flex: 1 }}>
              <span style={labelStyle}>Ширина</span>
              <input style={inputStyle} type="number" value={Math.round(selected.width ?? 100)} onChange={(e) => patch(selected._uid, { width: Number(e.target.value) })} />
            </div>
            <div style={{ ...rowStyle, flex: 1 }}>
              <span style={labelStyle}>Висота</span>
              <input style={inputStyle} type="number" value={Math.round(selected.height ?? 100)} onChange={(e) => patch(selected._uid, { height: Number(e.target.value) })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ ...rowStyle, flex: 1 }}>
              <span style={labelStyle}>Поворот°</span>
              <input style={inputStyle} type="number" value={Math.round(selected.rotation ?? 0)} onChange={(e) => patch(selected._uid, { rotation: Number(e.target.value) })} />
            </div>
            <div style={{ ...rowStyle, flex: 1 }}>
              <span style={labelStyle}>Колір</span>
              <input style={{ ...inputStyle, padding: 2, height: 34 }} type="color" value={selected.color ?? '#39A39B'} onChange={(e) => patch(selected._uid, { color: e.target.value, borderColor: e.target.value })} />
            </div>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Накласти SVG іконку</span>
            <select style={inputStyle} value={selected.imgSrc ?? ''} onChange={(e) => patch(selected._uid, { imgSrc: e.target.value || undefined })}>
              {ICON_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={removeSelected} style={{ ...btn('#dc3545'), flex: 1 }}>🗑 Видалити</button>
            <button onClick={() => setSelectedUid(null)} style={btn('#333')}>Зняти вибір</button>
          </div>
        </div>
      )}

      {showCode && (
        <div style={{ marginTop: 14, borderTop: '1px solid #333', paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: '#ffd54f', marginBottom: 6, lineHeight: 1.4 }}>
            Скопійовано в буфер. Встав, замінивши <b>весь</b> вміст файлу <b>src/config/positionedElementsFloor{activeFloor}.ts</b>
          </div>
          <textarea readOnly value={code} onFocus={(e) => e.currentTarget.select()} style={{ width: '100%', height: 160, background: '#0a0a0a', color: '#00ff00', border: '1px solid #333', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', boxSizing: 'border-box', padding: 8 }} />
          <button onClick={() => setShowCode(false)} style={{ ...btn('#333'), marginTop: 6, width: '100%' }}>Сховати код</button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        onMouseMove={onMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onMouseDown={() => setSelectedUid(null)}
        style={{ position: 'absolute', top: 0, left: 0, width: MAP_WIDTH, height: MAP_HEIGHT, zIndex: 500 }}
      >
        {rooms.map((r) => {
          const isSel = r._uid === selectedUid;
          return (
            <div
              key={r._uid}
              onMouseDown={(e) => startMove(r, e)}
              style={{
                position: 'absolute', left: r.x, top: r.y, width: r.width ?? 100, height: r.height ?? 100,
                transform: `rotate(${r.rotation ?? 0}deg)`, transformOrigin: 'center',
                background: toRgba(r.color, 0.5),
                border: `2px solid ${isSel ? '#ffeb3b' : r.borderColor ?? '#2d8a84'}`,
                boxShadow: isSel ? '0 0 0 3px rgba(255,235,59,0.5)' : 'none',
                borderRadius: r.borderRadius ?? 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'move', color: '#0F3A36', fontWeight: 700, fontSize: 22,
                fontFamily: 'Inter, sans-serif', userSelect: 'none', overflow: 'hidden',
              }}
            >
              {/* ДОДАНО: Відображення емодзі-іконки над основною назвою */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {r.iconEmoji && <span style={{ fontSize: 26, lineHeight: 1.2 }}>{r.iconEmoji}</span>}
                <span style={{ padding: 4, textAlign: 'center', lineHeight: 1.1 }}>{labelOf(r)}</span>
              </div>
              
              {r.imgSrc && (
                <img src={r.imgSrc} alt="" style={{ position: 'absolute', top: '50%', left: '50%', width: '65%', height: '65%', objectFit: 'contain', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
              )}
            </div>
          );
        })}
      </div>

      {createPortal(panel, document.body)}
    </>
  );
}
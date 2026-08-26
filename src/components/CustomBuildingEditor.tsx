import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MAP_HEIGHT, MAP_WIDTH } from '../config/mapDimensions';
import { customBuildings, buildingWalls, buildingOpenings, buildingGreenZones } from '../config/customBuildingItems';
import type { CustomBuilding, GreenZone, Opening, OpeningKind, Wall, WallKind } from '../config/customBuildingTypes';
import { renderGreenZone, renderWall, wallGeometry } from './CustomBuildingRenderer';
import { useDragMove } from '../hooks/useDragMove';
import { useDeleteKey } from '../hooks/useDeleteKey';

interface Props {
  mapScale: number;
}

type Selection = { type: 'wall' | 'opening' | 'zone'; id: string } | null;

let uid = 0;
const nextId = (prefix: string) => `${prefix}_${uid++}`;

const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #444', background: '#111', color: '#fff', boxSizing: 'border-box', fontSize: 13 };
const row: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 };
const lbl: React.CSSProperties = { fontSize: 12, color: '#aaa' };
const btn = (bg: string): React.CSSProperties => ({ padding: 9, background: bg, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 });

export default function CustomBuildingEditor({ mapScale }: Props) {
  const [buildings, setBuildings] = useState<CustomBuilding[]>(() => customBuildings.map((b) => ({ ...b, floors: [...b.floors] })));
  const [walls, setWalls] = useState<Wall[]>(() => buildingWalls.map((w) => ({ ...w })));
  const [openings, setOpenings] = useState<Opening[]>(() => buildingOpenings.map((o) => ({ ...o })));
  const [zones, setZones] = useState<GreenZone[]>(() => buildingGreenZones.map((z) => ({ ...z })));

  const [activeBuildingId, setActiveBuildingId] = useState<string | null>(buildings[0]?.id ?? null);
  const [buildingFloor, setBuildingFloor] = useState(1);
  const [newFloorNum, setNewFloorNum] = useState('');
  const [drawKind, setDrawKind] = useState<WallKind | null>(null);
  const [rectMode, setRectMode] = useState(false);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [rectEnd, setRectEnd] = useState<{ x: number; y: number } | null>(null);
  const [movingBuilding, setMovingBuilding] = useState(false);
  const [chain, setChain] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [showCode, setShowCode] = useState(false);

  const { startDrag, onDrag, endDrag } = useDragMove(mapScale);
  const openingDrag = useRef<string | null>(null);
  const buildingMoveSnapshot = useRef<{ walls: Wall[]; zones: GreenZone[] } | null>(null);

  const activeBuilding = buildings.find((b) => b.id === activeBuildingId) ?? null;
  const selectedWall = selection?.type === 'wall' ? walls.find((w) => w.id === selection.id) ?? null : null;
  const selectedOpening = selection?.type === 'opening' ? openings.find((o) => o.id === selection.id) ?? null : null;
  const selectedZone = selection?.type === 'zone' ? zones.find((z) => z.id === selection.id) ?? null : null;

  const deleteSelected = () => {
    if (!selection) return;
    if (selection.type === 'wall') {
      setWalls((prev) => prev.filter((w) => w.id !== selection.id));
      setOpenings((prev) => prev.filter((o) => o.wallId !== selection.id));
    } else if (selection.type === 'opening') {
      setOpenings((prev) => prev.filter((o) => o.id !== selection.id));
    } else {
      setZones((prev) => prev.filter((z) => z.id !== selection.id));
    }
    setSelection(null);
  };
  useDeleteKey(selection?.id ?? null, deleteSelected);

  // Esc — скасувати малювання / прямокутник / переміщення будівлі
  useEffect(() => {
    if (!drawKind && !rectMode && !movingBuilding) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setChain([]);
      setDrawKind(null);
      setRectMode(false);
      setRectStart(null);
      setRectEnd(null);
      setMovingBuilding(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawKind, rectMode, movingBuilding]);

  const addBuilding = (): string => {
    const id = nextId('bld');
    const b: CustomBuilding = { id, name: `Будівля ${buildings.length + 1}`, floors: [1] };
    setBuildings((prev) => [...prev, b]);
    setActiveBuildingId(id);
    setBuildingFloor(1);
    setSelection(null);
    return id;
  };

  const renameBuilding = (name: string) => {
    if (!activeBuilding) return;
    setBuildings((prev) => prev.map((b) => (b.id === activeBuilding.id ? { ...b, name } : b)));
  };

  const deleteBuilding = () => {
    if (!activeBuilding) return;
    const wallIds = new Set(walls.filter((w) => w.buildingId === activeBuilding.id).map((w) => w.id));
    setWalls((prev) => prev.filter((w) => w.buildingId !== activeBuilding.id));
    setOpenings((prev) => prev.filter((o) => !wallIds.has(o.wallId)));
    setZones((prev) => prev.filter((z) => z.buildingId !== activeBuilding.id));
    setBuildings((prev) => prev.filter((b) => b.id !== activeBuilding.id));
    setActiveBuildingId(null);
    setSelection(null);
  };

  const addFloor = () => {
    if (!activeBuilding) return;
    const raw = newFloorNum.trim();
    if (raw === '') return;
    const n = Number(raw);
    if (!Number.isInteger(n) || activeBuilding.floors.includes(n)) return;
    setBuildings((prev) => prev.map((b) => (b.id === activeBuilding.id ? { ...b, floors: [...b.floors, n].sort((a, c) => a - c) } : b)));
    setBuildingFloor(n);
    setNewFloorNum('');
  };

  const toggleDraw = (kind: WallKind) => {
    if (!activeBuildingId) addBuilding();
    setSelection(null);
    setChain([]);
    setRectMode(false);
    setMovingBuilding(false);
    setDrawKind((prev) => (prev === kind ? null : kind));
  };

  const toggleRectMode = () => {
    if (!activeBuildingId) addBuilding();
    setSelection(null);
    setChain([]);
    setDrawKind(null);
    setMovingBuilding(false);
    setRectMode((prev) => !prev);
  };

  const toggleMovingBuilding = () => {
    if (!activeBuildingId) return;
    setSelection(null);
    setChain([]);
    setDrawKind(null);
    setRectMode(false);
    setMovingBuilding((prev) => !prev);
  };

  const addZone = () => {
    const buildingId = activeBuildingId ?? addBuilding();
    const id = nextId('zone');
    const width = 200;
    const height = 150;
    const bWalls = walls.filter((w) => w.buildingId === buildingId && w.floor === buildingFloor);
    let x = Math.round(MAP_WIDTH / 2 - width / 2);
    let y = Math.round(MAP_HEIGHT / 2 - height / 2);
    if (bWalls.length > 0) {
      const xs = bWalls.flatMap((w) => [w.x1, w.x2]);
      const ys = bWalls.flatMap((w) => [w.y1, w.y2]);
      x = Math.round((Math.min(...xs) + Math.max(...xs)) / 2 - width / 2);
      y = Math.round((Math.min(...ys) + Math.max(...ys)) / 2 - height / 2);
    }
    const zone: GreenZone = { id, buildingId, floor: buildingFloor, x, y, width, height, rotation: 0, color: '#e4efe1' };
    setZones((prev) => [...prev, zone]);
    setSelection({ type: 'zone', id });
  };

  const undoLastWall = () => {
    const candidates = walls.filter((w) => w.buildingId === activeBuildingId && w.floor === buildingFloor);
    const last = candidates[candidates.length - 1];
    if (!last) return;
    setWalls((prev) => prev.filter((w) => w.id !== last.id));
    setOpenings((prev) => prev.filter((o) => o.wallId !== last.id));
    setChain([]);
  };

  const placePoint = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawKind || !activeBuildingId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let x = Math.round((e.clientX - rect.left) / mapScale);
    let y = Math.round((e.clientY - rect.top) / mapScale);

    if (chain.length > 0) {
      const first = chain[0];
      const snapPx = 14 / mapScale;
      const closing = chain.length >= 2 && Math.hypot(x - first.x, y - first.y) < snapPx;
      if (closing) {
        x = first.x;
        y = first.y;
      }

      const prevPt = chain[chain.length - 1];
      const wall: Wall = {
        id: nextId('wall'),
        buildingId: activeBuildingId,
        floor: buildingFloor,
        x1: prevPt.x, y1: prevPt.y, x2: x, y2: y,
        thickness: drawKind === 'exterior' ? 16 : 8,
        kind: drawKind,
      };
      setWalls((p) => [...p, wall]);

      if (closing) {
        setChain([]);
        return;
      }
    }
    setChain((p) => [...p, { x, y }]);
  };

  const startBuildingMove = (e: React.MouseEvent) => {
    if (!activeBuildingId) return;
    buildingMoveSnapshot.current = {
      walls: walls.filter((w) => w.buildingId === activeBuildingId).map((w) => ({ ...w })),
      zones: zones.filter((z) => z.buildingId === activeBuildingId).map((z) => ({ ...z })),
    };
    startDrag(activeBuildingId, 0, 0, e);
  };

  const onWrapDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (rectMode) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / mapScale);
      const y = Math.round((e.clientY - rect.top) / mapScale);
      setRectStart({ x, y });
      setRectEnd({ x, y });
      return;
    }
    if (movingBuilding) {
      startBuildingMove(e);
      return;
    }
    if (!drawKind) setSelection(null);
  };

  const onWrapMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (rectMode && rectStart) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / mapScale);
      const y = Math.round((e.clientY - rect.top) / mapScale);
      setRectEnd({ x, y });
      return;
    }

    onDrag(e, (dragId, x, y) => {
      if (dragId.startsWith('bld_')) {
        const snap = buildingMoveSnapshot.current;
        if (!snap) return;
        setWalls((prev) => prev.map((w) => {
          const orig = snap.walls.find((s) => s.id === w.id);
          return orig ? { ...w, x1: orig.x1 + x, y1: orig.y1 + y, x2: orig.x2 + x, y2: orig.y2 + y } : w;
        }));
        setZones((prev) => prev.map((z) => {
          const orig = snap.zones.find((s) => s.id === z.id);
          return orig ? { ...z, x: orig.x + x, y: orig.y + y } : z;
        }));
      } else if (dragId.startsWith('zone_')) {
        setZones((prev) => prev.map((z) => (z.id === dragId ? { ...z, x, y } : z)));
      } else if (dragId.includes(':')) {
        const [wallId, end] = dragId.split(':');
        setWalls((prev) => prev.map((w) => (w.id === wallId ? (end === 'a' ? { ...w, x1: x, y1: y } : { ...w, x2: x, y2: y }) : w)));
      } else {
        setWalls((prev) => prev.map((w) => {
          if (w.id !== dragId) return w;
          const dx = x - w.x1;
          const dy = y - w.y1;
          return { ...w, x1: x, y1: y, x2: w.x2 + dx, y2: w.y2 + dy };
        }));
      }
    });

    if (openingDrag.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / mapScale;
      const my = (e.clientY - rect.top) / mapScale;
      const oid = openingDrag.current;
      setOpenings((prev) => prev.map((o) => {
        if (o.id !== oid) return o;
        const w = walls.find((ww) => ww.id === o.wallId);
        if (!w) return o;
        const { len, ux, uy } = wallGeometry(w);
        const t = ((mx - w.x1) * ux + (my - w.y1) * uy) / len;
        return { ...o, offset: Math.min(1, Math.max(0, t)) };
      }));
    }

    if (drawKind) {
      const rect = e.currentTarget.getBoundingClientRect();
      setMousePos({ x: (e.clientX - rect.left) / mapScale, y: (e.clientY - rect.top) / mapScale });
    }
  };

  const onWrapUp = () => {
    endDrag();
    openingDrag.current = null;
    buildingMoveSnapshot.current = null;

    if (rectMode && rectStart && rectEnd && activeBuildingId) {
      const x1 = Math.min(rectStart.x, rectEnd.x);
      const x2 = Math.max(rectStart.x, rectEnd.x);
      const y1 = Math.min(rectStart.y, rectEnd.y);
      const y2 = Math.max(rectStart.y, rectEnd.y);
      if (x2 - x1 > 10 && y2 - y1 > 10) {
        const corners = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
        const newWalls: Wall[] = corners.map((c, i) => {
          const next = corners[(i + 1) % 4];
          return {
            id: nextId('wall'), buildingId: activeBuildingId, floor: buildingFloor,
            x1: c.x, y1: c.y, x2: next.x, y2: next.y, thickness: 16, kind: 'exterior',
          };
        });
        setWalls((prev) => [...prev, ...newWalls]);
      }
      setRectStart(null);
      setRectEnd(null);
    }
  };

  const addOpening = (kind: OpeningKind) => {
    if (!selectedWall) return;
    const id = nextId('open');
    setOpenings((prev) => [...prev, { id, wallId: selectedWall.id, kind, offset: 0.5, width: kind === 'door' ? 90 : 120 }]);
    setSelection({ type: 'opening', id });
  };

  const visibleWalls = walls.filter((w) => w.buildingId === activeBuildingId && w.floor === buildingFloor);
  const visibleOpenings = openings.filter((o) => visibleWalls.some((w) => w.id === o.wallId));
  const visibleZones = zones.filter((z) => z.buildingId === activeBuildingId && z.floor === buildingFloor);
  const idle = !drawKind && !rectMode && !movingBuilding;

  const code =
    `import type { CustomBuilding, Wall, Opening, GreenZone } from './customBuildingTypes';\n\n` +
    `export const customBuildings: CustomBuilding[] = ${JSON.stringify(buildings, null, 2)};\n\n` +
    `export const buildingWalls: Wall[] = ${JSON.stringify(walls, null, 2)};\n\n` +
    `export const buildingOpenings: Opening[] = ${JSON.stringify(openings, null, 2)};\n\n` +
    `export const buildingGreenZones: GreenZone[] = ${JSON.stringify(zones, null, 2)};\n`;
  const copyCode = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setShowCode(true);
  };

  const panel = (
    <div style={{ position: 'fixed', top: 16, right: 16, width: 310, zIndex: 100000, background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', color: '#fff', padding: 16, fontFamily: 'sans-serif', maxHeight: '94vh', overflowY: 'auto' }}>
      <h4 style={{ margin: '0 0 12px', color: '#00ff00', fontSize: 15 }}>🏛 Конструктор будівель</h4>

      <div style={row}>
        <span style={lbl}>Будівля</span>
        <select style={inp} value={activeBuildingId ?? ''} onChange={(e) => { setActiveBuildingId(e.target.value || null); setBuildingFloor(1); setSelection(null); }}>
          <option value="">— оберіть —</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={addBuilding} style={{ ...btn('#28a745'), flex: 1 }}>➕ Нова будівля</button>
        {activeBuilding && <button onClick={deleteBuilding} style={btn('#dc3545')}>🗑</button>}
      </div>

      {activeBuilding && (
        <>
          <div style={row}>
            <span style={lbl}>Назва будівлі</span>
            <input style={inp} value={activeBuilding.name} onChange={(e) => renameBuilding(e.target.value)} />
          </div>

          <div style={row}>
            <span style={lbl}>Поверх будівлі</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {activeBuilding.floors.map((f) => (
                <button key={f} onClick={() => { setBuildingFloor(f); setSelection(null); }}
                  style={{ ...btn(f === buildingFloor ? '#2f6f4f' : '#333'), padding: '6px 10px' }}>
                  {f}
                </button>
              ))}
              <input type="number" placeholder="№" value={newFloorNum} onChange={(e) => setNewFloorNum(e.target.value)} style={{ ...inp, width: 56 }} />
              <button onClick={addFloor} style={btn('#17a2b8')}>➕ Поверх</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => toggleDraw('exterior')} style={{ ...btn(drawKind === 'exterior' ? '#007bff' : '#222'), flex: 1 }}>🧱 Зовнішня стіна</button>
            <button onClick={() => toggleDraw('interior')} style={{ ...btn(drawKind === 'interior' ? '#007bff' : '#222'), flex: 1 }}>🧱 Внутрішня</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={toggleRectMode} style={{ ...btn(rectMode ? '#007bff' : '#222'), flex: 1 }}>▭ Прямокутник</button>
            <button onClick={toggleMovingBuilding} style={{ ...btn(movingBuilding ? '#e67e22' : '#222'), flex: 1 }}>🖐 Перемістити будівлю</button>
          </div>
          <button onClick={addZone} style={{ ...btn('#2f6f4f'), width: '100%', marginBottom: 8 }}>🌿 Зона озеленення</button>

          {drawKind && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button onClick={() => setChain([])} style={{ ...btn('#333'), flex: 1 }}>✓ Завершити лінію</button>
                <button onClick={undoLastWall} style={{ ...btn('#dc3545'), flex: 1 }}>↩️ Скасувати</button>
              </div>
              <p style={{ color: '#888', fontSize: 12, margin: '0 0 12px' }}>
                Клікай по карті — стіни з'єднуються одна за одною. Клікни біля початкової точки, щоб замкнути контур. Esc — вийти.
              </p>
            </>
          )}
          {rectMode && (
            <p style={{ color: '#888', fontSize: 12, margin: '0 0 12px' }}>Протягни мишкою прямокутник — утвориться замкнутий контур із 4 зовнішніх стін. Esc — вийти.</p>
          )}
          {movingBuilding && (
            <p style={{ color: '#888', fontSize: 12, margin: '0 0 12px' }}>Тягни будь-де по карті — вся будівля (всі поверхи) зсунеться разом. Esc — вийти.</p>
          )}
          {idle && !selection && (
            <p style={{ color: '#888', fontSize: 13, margin: '0 0 12px' }}>Клікни на стіну/зону, щоб редагувати. Тягни за кінці стіни — зміниш форму, за середину — перемістиш.</p>
          )}

          {selectedWall && (
            <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: '#ffd54f', marginBottom: 8 }}>{selectedWall.kind === 'exterior' ? 'Зовнішня стіна' : 'Внутрішня стіна'}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ ...row, flex: 1 }}>
                  <span style={lbl}>Товщина</span>
                  <input type="number" style={inp} value={selectedWall.thickness} onChange={(e) => setWalls((prev) => prev.map((w) => (w.id === selectedWall.id ? { ...w, thickness: Number(e.target.value) } : w)))} />
                </div>
                <div style={{ ...row, flex: 1 }}>
                  <span style={lbl}>Колір</span>
                  <input type="color" style={{ ...inp, padding: 2, height: 34 }} value={selectedWall.color ?? '#2b3440'} onChange={(e) => setWalls((prev) => prev.map((w) => (w.id === selectedWall.id ? { ...w, color: e.target.value } : w)))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button onClick={() => addOpening('door')} style={{ ...btn('#2f6f4f'), flex: 1 }}>➕ Двері</button>
                <button onClick={() => addOpening('window')} style={{ ...btn('#2f6f4f'), flex: 1 }}>➕ Вікно</button>
              </div>
              <button onClick={deleteSelected} style={{ ...btn('#dc3545'), width: '100%' }}>🗑 Видалити стіну</button>
            </div>
          )}

          {selectedOpening && (
            <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: '#ffd54f', marginBottom: 8 }}>{selectedOpening.kind === 'door' ? 'Двері' : 'Вікно'}</div>
              <div style={row}>
                <span style={lbl}>Ширина</span>
                <input type="number" style={inp} value={selectedOpening.width} onChange={(e) => setOpenings((prev) => prev.map((o) => (o.id === selectedOpening.id ? { ...o, width: Number(e.target.value) } : o)))} />
              </div>
              <p style={{ color: '#888', fontSize: 12 }}>Тягни жовту точку по стіні, щоб змістити.</p>
              <button onClick={deleteSelected} style={{ ...btn('#dc3545'), width: '100%' }}>🗑 Видалити</button>
            </div>
          )}

          {selectedZone && (
            <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: '#ffd54f', marginBottom: 8 }}>🌿 Зона озеленення</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ ...row, flex: 1 }}>
                  <span style={lbl}>Ширина</span>
                  <input type="number" style={inp} value={selectedZone.width} onChange={(e) => setZones((prev) => prev.map((z) => (z.id === selectedZone.id ? { ...z, width: Number(e.target.value) } : z)))} />
                </div>
                <div style={{ ...row, flex: 1 }}>
                  <span style={lbl}>Висота</span>
                  <input type="number" style={inp} value={selectedZone.height} onChange={(e) => setZones((prev) => prev.map((z) => (z.id === selectedZone.id ? { ...z, height: Number(e.target.value) } : z)))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ ...row, flex: 1 }}>
                  <span style={lbl}>Поворот°</span>
                  <input type="number" style={inp} value={selectedZone.rotation ?? 0} onChange={(e) => setZones((prev) => prev.map((z) => (z.id === selectedZone.id ? { ...z, rotation: Number(e.target.value) } : z)))} />
                </div>
                <div style={{ ...row, flex: 1 }}>
                  <span style={lbl}>Колір</span>
                  <input type="color" style={{ ...inp, padding: 2, height: 34 }} value={selectedZone.color ?? '#e4efe1'} onChange={(e) => setZones((prev) => prev.map((z) => (z.id === selectedZone.id ? { ...z, color: e.target.value } : z)))} />
                </div>
              </div>
              <button onClick={deleteSelected} style={{ ...btn('#dc3545'), width: '100%' }}>🗑 Видалити зону</button>
            </div>
          )}
        </>
      )}

      <button onClick={copyCode} style={{ ...btn('#17a2b8'), width: '100%', marginTop: 12 }}>📋 Копіювати код</button>
      {showCode && (
        <div style={{ marginTop: 12, borderTop: '1px solid #333', paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: '#ffd54f', marginBottom: 6 }}>
            Скопійовано. Встав у <b>src/config/customBuildingItems.ts</b> (заміни весь вміст файлу).
          </div>
          <textarea readOnly value={code} onFocus={(e) => e.currentTarget.select()} style={{ width: '100%', height: 150, background: '#0a0a0a', color: '#00ff00', border: '1px solid #333', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', boxSizing: 'border-box', padding: 8 }} />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        onClick={placePoint}
        onMouseDown={onWrapDown}
        onMouseMove={onWrapMove}
        onMouseUp={onWrapUp}
        onMouseLeave={onWrapUp}
        style={{
          position: 'absolute', top: 0, left: 0, width: MAP_WIDTH, height: MAP_HEIGHT, zIndex: 500,
          cursor: drawKind || rectMode ? 'crosshair' : movingBuilding ? 'grab' : 'default',
        }}
      >
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} width={MAP_WIDTH} height={MAP_HEIGHT} style={{ position: 'absolute', pointerEvents: 'none' }}>
          {visibleZones.map((z) => renderGreenZone(z, z.id))}
          {visibleWalls.map((w) => renderWall(w, visibleOpenings, w.id))}

          {chain.length > 0 && mousePos && (
            <line x1={chain[chain.length - 1].x} y1={chain[chain.length - 1].y} x2={mousePos.x} y2={mousePos.y} stroke="#ffeb3b" strokeWidth={2} strokeDasharray="8 6" />
          )}
          {chain.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill="#ffeb3b" />
          ))}

          {rectMode && rectStart && rectEnd && (
            <rect
              x={Math.min(rectStart.x, rectEnd.x)} y={Math.min(rectStart.y, rectEnd.y)}
              width={Math.abs(rectEnd.x - rectStart.x)} height={Math.abs(rectEnd.y - rectStart.y)}
              fill="rgba(255,235,59,0.08)" stroke="#ffeb3b" strokeWidth={2} strokeDasharray="8 6"
            />
          )}

          {selectedWall && (
            <line x1={selectedWall.x1} y1={selectedWall.y1} x2={selectedWall.x2} y2={selectedWall.y2} stroke="#ffeb3b" strokeWidth={selectedWall.thickness + 6} strokeDasharray="14 8" opacity={0.55} />
          )}
          {selectedZone && (
            <rect
              x={selectedZone.x} y={selectedZone.y} width={selectedZone.width} height={selectedZone.height}
              transform={`rotate(${selectedZone.rotation ?? 0} ${selectedZone.x + selectedZone.width / 2} ${selectedZone.y + selectedZone.height / 2})`}
              fill="none" stroke="#ffeb3b" strokeWidth={3} strokeDasharray="10 6"
            />
          )}
          {selectedOpening && (() => {
            const w = walls.find((ww) => ww.id === selectedOpening.wallId);
            if (!w) return null;
            const p = { x: w.x1 + (w.x2 - w.x1) * selectedOpening.offset, y: w.y1 + (w.y2 - w.y1) * selectedOpening.offset };
            return <circle cx={p.x} cy={p.y} r={9} fill="none" stroke="#ffeb3b" strokeWidth={3} />;
          })()}
        </svg>

        {/* невидимі hit-area для вибору/перетягування — тільки в режимі "спокою" */}
        {idle && visibleZones.map((z) => (
          <div
            key={z.id}
            onMouseDown={(e) => { e.stopPropagation(); setSelection({ type: 'zone', id: z.id }); startDrag(z.id, z.x, z.y, e); }}
            style={{
              position: 'absolute', left: z.x, top: z.y, width: z.width, height: z.height,
              transform: `rotate(${z.rotation ?? 0}deg)`, transformOrigin: 'center', cursor: 'move',
              background: selection?.type === 'zone' && selection.id === z.id ? 'rgba(255,235,59,0.10)' : 'transparent',
            }}
          />
        ))}

        {idle && visibleWalls.map((w) => {
          const { len } = wallGeometry(w);
          const angleDeg = (Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180) / Math.PI;
          const midX = (w.x1 + w.x2) / 2;
          const midY = (w.y1 + w.y2) / 2;
          const hitH = Math.max(20, w.thickness + 14);
          return (
            <div
              key={w.id}
              onMouseDown={(e) => { e.stopPropagation(); setSelection({ type: 'wall', id: w.id }); startDrag(w.id, w.x1, w.y1, e); }}
              style={{
                position: 'absolute', left: midX - len / 2, top: midY - hitH / 2, width: len, height: hitH,
                transform: `rotate(${angleDeg}deg)`, transformOrigin: 'center', cursor: 'move',
                background: selectedWall?.id === w.id ? 'rgba(255,235,59,0.10)' : 'transparent',
              }}
            />
          );
        })}

        {idle && selectedWall && (
          <>
            <div
              onMouseDown={(e) => { e.stopPropagation(); startDrag(`${selectedWall.id}:a`, selectedWall.x1, selectedWall.y1, e); }}
              style={{ position: 'absolute', left: selectedWall.x1 - 8, top: selectedWall.y1 - 8, width: 16, height: 16, borderRadius: '50%', background: '#fff', border: '3px solid #ffeb3b', cursor: 'crosshair' }}
            />
            <div
              onMouseDown={(e) => { e.stopPropagation(); startDrag(`${selectedWall.id}:b`, selectedWall.x2, selectedWall.y2, e); }}
              style={{ position: 'absolute', left: selectedWall.x2 - 8, top: selectedWall.y2 - 8, width: 16, height: 16, borderRadius: '50%', background: '#fff', border: '3px solid #ffeb3b', cursor: 'crosshair' }}
            />
          </>
        )}

        {idle && visibleOpenings.map((o) => {
          const w = walls.find((ww) => ww.id === o.wallId);
          if (!w) return null;
          const p = { x: w.x1 + (w.x2 - w.x1) * o.offset, y: w.y1 + (w.y2 - w.y1) * o.offset };
          return (
            <div
              key={o.id}
              onMouseDown={(e) => { e.stopPropagation(); setSelection({ type: 'opening', id: o.id }); openingDrag.current = o.id; }}
              style={{
                position: 'absolute', left: p.x - 9, top: p.y - 9, width: 18, height: 18, borderRadius: '50%', cursor: 'move',
                background: selection?.id === o.id ? 'rgba(255,235,59,0.5)' : 'rgba(255,235,59,0.15)', border: '2px solid #ffeb3b',
              }}
            />
          );
        })}
      </div>

      {createPortal(panel, document.body)}
    </>
  );
}

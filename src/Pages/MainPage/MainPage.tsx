import React, { useState, Suspense, lazy, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

import { MAP_WIDTH, MAP_HEIGHT } from "@/config/mapDimensions";
import { mapNodes } from '@/config/mapNodes';
import { mapEdges } from '@/config/mapEdges';
import { mapPolygons } from '@/config/mapPolygons';
import routeService from '@/services/RouteService';
import type { PathResult } from '@/utils/pathfinding';

import MapBackground from "../Components/MapBackground";
import MenuBar from "../Components/MenuBarFolder/MenuBar";
import AppLayout from "../Layout/AppLayout";
import PositionedElementsRenderer from "@/components/PositionedElementsRenderer";
import AdminClicker from "@/components/AdminClicker";
import NodePathRenderer from "@/components/NodePathRenderer";
import RoomEditor from "@/components/RoomEditor";
import { useDeleteKey } from "@/hooks/useDeleteKey";
import Courtyard from "@/components/Courtyard";
import Scenery from "@/components/Scenery";
import SceneryEditor from "@/components/SceneryEditor";
import CustomBuildingRenderer from "@/components/CustomBuildingRenderer";
import CustomBuildingEditor from "@/components/CustomBuildingEditor";
import QrCodeAdmin from "@/components/QrCodeAdmin";
import MapErrorBoundary from "@/components/MapErrorBoundary";
import { ADMIN_ENABLED } from "@/config/appConfig";

const BeaconRenderer = lazy(() => import("@/components/BeaconRenderer"));

type GraphNode = { id: string; x: number; y: number; floor: number; roomId?: string };

/** Масштаб, за якого карта повністю влазить у вікно (з невеликим полем). */
function computeFitScale(): number {
  if (typeof window === 'undefined') return 0.4;
  const scale = Math.min(window.innerWidth / MAP_WIDTH, window.innerHeight / MAP_HEIGHT) * 0.95;
  return Math.max(0.05, Math.min(scale, 1));
}

/**
 * Генерація id вузла, стійка до колізій.
 *
 * БУЛО: `f${floor}_node_${nodes.length + 1}` — лічильник від ДОВЖИНИ масиву.
 * Після видалення будь-якого вузла довжина стає меншою за максимальний номер,
 * і наступний доданий вузол отримує id, який ВЖЕ існує. Два різні вузли з одним
 * id зливаються в одну сутність (Map у dijkstra лишає останній, sanitizeNodes —
 * перший), через що зв'язок, намальований для одного, «прилипав» до іншого.
 *
 * СТАЛО: беремо максимальний уже використаний номер +1 і додатково
 * перевіряємо унікальність.
 */
function createNode(
  existing: GraphNode[],
  floor: number,
  x: number,
  y: number,
  roomId: string,
): GraphNode {
  let maxSuffix = 0;
  const used = new Set<string>();
  for (const node of existing) {
    used.add(node.id);
    const match = /_node_(\d+)$/.exec(node.id);
    if (match) maxSuffix = Math.max(maxSuffix, Number(match[1]));
  }

  let suffix = maxSuffix + 1;
  let id = `f${floor}_node_${suffix}`;
  while (used.has(id)) {
    suffix += 1;
    id = `f${floor}_node_${suffix}`;
  }

  const trimmedRoomId = roomId.trim();
  return { id, x, y, floor, ...(trimmedRoomId ? { roomId: trimmedRoomId } : {}) };
}

/** Пошук дублікатів id — тільки в dev, щоб проблема не тонула мовчки. */
function warnAboutDuplicateNodeIds(nodes: GraphNode[]): void {
  if (!import.meta.env?.DEV) return;
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const node of nodes) {
    if (seen.has(node.id)) dups.add(node.id);
    seen.add(node.id);
  }
  if (dups.size > 0) {
    console.error(
      '[UniMap] Дубльовані id вузлів — вони зіллються в одну точку маршруту:',
      [...dups].join(', '),
    );
  }
}

export default function MainPage() {
  const [activeFloor, setActiveFloor] = useState(1);
  
  // --- СТАН АДМІН-КЛІКЕРА ---
  const [nodes, setNodes] = useState<GraphNode[]>(mapNodes);
  const [edges, setEdges] = useState<{ from: string; to: string; floor: number }[]>(mapEdges);
  
  const [polygons, setPolygons] = useState<{ id: string; points: {x: number, y: number}[]; fill: string; layer: number; floor: number }[]>(mapPolygons || []);
  const [currentPolygon, setCurrentPolygon] = useState<{x: number, y: number}[]>([]);
  const [polygonFill, setPolygonFill] = useState('rgba(39, 174, 107, 0.5)');
  const [polygonLayer, setPolygonLayer] = useState(1);

  const [mode, setMode] = useState<'off' | 'nodes' | 'edges' | 'rooms' | 'delnode' | 'scenery' | 'building' | 'polygons' | 'qr'>('off');
  const [currentRoomId, setCurrentRoomId] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isPanelVisible, setIsPanelVisible] = useState(ADMIN_ENABLED);
  const [mapScale, setMapScale] = useState(1);
  const [nodePath, setNodePath] = useState<PathResult | null>(null);
  const [showNodes, setShowNodes] = useState(true);

  /**
   * Масштаб, за якого вся карта вміщується у видиму область.
   * Раніше minScale був жорстко 0.4 — на телефоні (≈375 px) для карти 3100 px
   * потрібно ≈0.12, тож карту неможливо було віддалити до повного вигляду.
   */
  const [fitScale, setFitScale] = useState(() => computeFitScale());
  const minScale = Math.min(fitScale * 0.6, 0.5);

  useEffect(() => {
    const onResize = () => setFitScale(computeFitScale());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Масштаб потрібен лише адмін-редакторам; у продакшні не чіпаємо стан взагалі
  const handleTransform = ADMIN_ENABLED
    ? (ref: { state: { scale: number } }) => {
        const next = ref.state.scale;
        setMapScale((prev) => (Math.abs(prev - next) > 0.01 ? next : prev));
      }
    : undefined;

  useEffect(() => {
    warnAboutDuplicateNodeIds(nodes);
    routeService.setGraph(nodes, edges);
  }, [nodes, edges]);

  useEffect(() => {
    return routeService.onRoutesChange((routes) => {
      if (routes.length === 0) {
        setNodePath(null);
        return;
      }
      setNodePath(routes[0].nodePath ?? null);
    });
  }, []);

  // --- ЛОГІКА АДМІН-КЛІКЕРА ---
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingNodeId) return;
    if (mode !== 'nodes' && mode !== 'polygons') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / mapScale);
    const y = Math.round((e.clientY - rect.top) / mapScale);
    
    if (mode === 'nodes') {
      setNodes(prev => [...prev, createNode(prev, activeFloor, x, y, currentRoomId)]);
      setCurrentRoomId('');
    } else if (mode === 'polygons') {
      setCurrentPolygon([...currentPolygon, { x, y }]);
    }
  };

  const finishPolygon = () => {
    if (currentPolygon.length < 3) {
      alert('Полігон повинен мати хоча б 3 точки!');
      return;
    }
    const newPolygon = {
      id: `poly_f${activeFloor}_${Date.now()}`,
      points: currentPolygon,
      fill: polygonFill,
      layer: polygonLayer,
      floor: activeFloor
    };
    setPolygons([...polygons, newPolygon]);
    setCurrentPolygon([]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingNodeId || mode !== 'nodes') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / mapScale);
    const y = Math.round((e.clientY - rect.top) / mapScale);
    setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x, y } : n));
  };

  const handleMouseUp = () => setDraggingNodeId(null);

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode === 'nodes') setDraggingNodeId(nodeId);
  };

  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode === 'delnode') {
      setNodes(prev => prev.filter(n => n.id !== nodeId));
      setEdges(prev => prev.filter(ed => ed.from !== nodeId && ed.to !== nodeId));
      setSelectedNodeId(null);
      return;
    }
    if (mode !== 'edges') return;
    if (!selectedNodeId) {
      setSelectedNodeId(nodeId);
    } else {
      if (selectedNodeId !== nodeId) {
        const idx = edges.findIndex(edge =>
          (edge.from === selectedNodeId && edge.to === nodeId) ||
          (edge.from === nodeId && edge.to === selectedNodeId));
        if (idx >= 0) {
          setEdges(prev => prev.filter((_, i) => i !== idx));
        } else {
          setEdges([...edges, { from: selectedNodeId, to: nodeId, floor: activeFloor }]);
        }
      }
      setSelectedNodeId(null);
    }
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
    setEdges(prev => prev.filter(ed => ed.from !== selectedNodeId && ed.to !== selectedNodeId));
    setSelectedNodeId(null);
  };
  useDeleteKey(selectedNodeId, deleteSelectedNode);

  // --- БЕЗПЕЧНЕ КОПІЮВАННЯ ДЛЯ HTTP / WI-FI ---
  const safeCopy = (text: string, successMessage: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => alert(successMessage));
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert(successMessage);
      } catch (err) {
        alert('Не вдалося скопіювати автоматично. Скопіюйте код вручну з чорного поля внизу!');
      }
      document.body.removeChild(textArea);
    }
  };

  const copyNodes = () => safeCopy(`export const mapNodes = ${JSON.stringify(nodes, null, 2)};`, 'Вузли скопійовано!');
  const copyEdges = () => safeCopy(`export const mapEdges = ${JSON.stringify(edges, null, 2)};`, 'Зв’язки скопійовано!');
  const copyPolygons = () => safeCopy(`export const mapPolygons = ${JSON.stringify(polygons, null, 2)};`, 'Зони скопійовано!');

  const clearLast = () => {
    if (mode === 'nodes') setNodes(nodes.slice(0, -1));
    else if (mode === 'edges') setEdges(edges.slice(0, -1));
    else if (mode === 'polygons') {
      if (currentPolygon.length > 0) setCurrentPolygon(currentPolygon.slice(0, -1));
      else setPolygons(polygons.slice(0, -1));
    }
  };

  return (
    <AppLayout>
      <TransformWrapper
        initialScale={fitScale}
        minScale={minScale}
        maxScale={2.5}
        // limitToBounds лишаємо увімкненим, щоб карту не можна було відтягнути
        // за край екрана; centerZoomedOut центрує її, коли масштаб менший за
        // «вписаний» — саме ця пара дозволяє вільно віддаляти і не губити карту.
        limitToBounds
        centerZoomedOut
        centerOnInit
        // ВАЖЛИВО: onTransform спрацьовує на КОЖНОМУ кадрі панорамування/зуму.
        // setState тут перемальовував усю карту 60 разів на секунду — головна
        // причина лагів. Тепер масштаб зберігаємо лише коли він реально потрібен
        // (адмін-редактори рахують від нього координати), у продакшні — ніколи.
        onTransform={handleTransform}
        zoomAnimation={{ disabled: false, animationTime: 250, animationType: "easeOut" }}
        wheel={{ step: 0.06, wheelDisabled: false }}
        pinch={{ step: 6 }}
        doubleClick={{ disabled: false, step: 0.8, animationTime: 200 }}
        panning={{ disabled: mode !== 'off', velocityDisabled: true }}
      >
        {() => (
          <TransformComponent wrapperStyle={{ width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#ffffff' }}>
            <div 
              style={{ position: 'relative', width: `${MAP_WIDTH}px`, height: `${MAP_HEIGHT}px`, willChange: 'transform', transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
              onClick={handleMapClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              
              <MapBackground activeFloor={activeFloor} />

              <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                {polygons
                  .filter(p => p.floor === activeFloor)
                  .sort((a, b) => a.layer - b.layer)
                  .map(poly => (
                    <polygon
                      key={poly.id}
                      points={poly.points.map(p => `${p.x},${p.y}`).join(' ')}
                      fill={poly.fill}
                      stroke={poly.fill.replace(/[\d.]+\)$/g, '0.8)')} 
                      strokeWidth="2"
                      style={{ transition: 'all 0.3s ease' }}
                    />
                ))}

                {currentPolygon.length > 0 && mode === 'polygons' && (
                  <>
                    <polyline
                      points={currentPolygon.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="rgba(243, 156, 18, 0.2)"
                      stroke="#f39c12"
                      strokeWidth="3"
                      strokeDasharray="5,5"
                    />
                    {currentPolygon.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={5 / mapScale} fill="#f39c12" stroke="white" strokeWidth={2 / mapScale} />
                    ))}
                  </>
                )}
              </svg>

              {/* Декоративні шари ізольовані: биті дані в sceneryItems/будівлях
                  не мають ронити карту й маршрут */}
              <div style={{ position: 'relative', zIndex: 5 }}>
                <MapErrorBoundary section="Двір і озеленення">
                  {activeFloor === 1 && <Courtyard />}
                  {activeFloor === 1 && mode !== 'scenery' && <Scenery />}
                  {ADMIN_ENABLED && mode === 'scenery' && <SceneryEditor mapScale={mapScale} />}
                </MapErrorBoundary>
                <MapErrorBoundary section="Конструктор будівель">
                  {activeFloor === 1 && mode !== 'building' && <CustomBuildingRenderer floor={1} />}
                  {ADMIN_ENABLED && mode === 'building' && <CustomBuildingEditor mapScale={mapScale} />}
                </MapErrorBoundary>
              </div>

              {mode !== 'rooms' && (
                <MapErrorBoundary section="Аудиторії">
                  <PositionedElementsRenderer mapTransform={{ scale: 1, x: 0, y: 0 }} activeFloor={activeFloor} />
                </MapErrorBoundary>
              )}

              <MapErrorBoundary section="Маршрут">
                <NodePathRenderer path={nodePath} activeFloor={activeFloor} onFloorChange={setActiveFloor} />
              </MapErrorBoundary>

              {ADMIN_ENABLED && mode === 'rooms' && (
                <MapErrorBoundary section="Редактор аудиторій">
                  <RoomEditor activeFloor={activeFloor} mapScale={mapScale} />
                </MapErrorBoundary>
              )}

              {ADMIN_ENABLED && mode === 'qr' && (
                <MapErrorBoundary section="Генератор QR">
                  <QrCodeAdmin />
                </MapErrorBoundary>
              )}

              {/* Шар вузлів/зв'язків — суто адмінський, у продакшн не потрапляє */}
              {ADMIN_ENABLED && (
                <AdminClicker
                  mapTransform={{ scale: 1, x: 0, y: 0 }}
                  activeFloor={activeFloor}
                  nodes={nodes} edges={edges} mode={mode} currentRoomId={currentRoomId}
                  selectedNodeId={selectedNodeId} draggingNodeId={draggingNodeId} showNodes={showNodes}
                  onMapClick={() => {}}
                  onMouseMove={() => {}}
                  onMouseUp={() => {}}
                  onNodeMouseDown={handleNodeMouseDown}
                  onNodeClick={handleNodeClick}
                />
              )}
              
              <Suspense fallback={null}>
                <BeaconRenderer mapTransform={{ scale: 1, x: 0, y: 0 }} showBeacons={false} />
              </Suspense>

            </div>
          </TransformComponent>
        )}
      </TransformWrapper>

      {/* --- АДМІН-ПАНЕЛЬ (тільки в dev-збірці, див. config/appConfig.ts) --- */}
      {ADMIN_ENABLED && !isPanelVisible && (
        <button onClick={() => setIsPanelVisible(true)} style={{ position: 'fixed', top: 20, left: 20, zIndex: 1000, background: '#222', color: '#00ff00', padding: '12px 20px', border: '2px solid #333', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          🛠 Відкрити адмін-панель
        </button>
      )}

      {ADMIN_ENABLED && isPanelVisible && (
        <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '320px', zIndex: 1000, background: '#1a1a1a', borderRight: '1px solid #333', boxShadow: '4px 0 15px rgba(0,0,0,0.5)', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column', overflowY: 'auto', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, color: '#00ff00', fontSize: '18px' }}>🛠 Адмін-панель</h3>
            <button onClick={() => setIsPanelVisible(false)} style={{ background: '#333', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', padding: '5px 10px', borderRadius: '4px' }}>Сховати</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => { setMode('off'); setSelectedNodeId(null); setCurrentPolygon([]); }} style={{ padding: '12px', fontWeight: 'bold', background: mode === 'off' ? '#444' : '#222', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>📱 Рухати мапу</button>
            <button onClick={() => { setMode('nodes'); setSelectedNodeId(null); setCurrentPolygon([]); }} style={{ padding: '12px', fontWeight: 'bold', background: mode === 'nodes' ? '#28a745' : '#222', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>📍 Додавати Вузли</button>
            <button onClick={() => { setMode('edges'); setCurrentPolygon([]); }} style={{ padding: '12px', fontWeight: 'bold', background: mode === 'edges' ? '#007bff' : '#222', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>🔗 З'єднувати Зв’язки</button>
            <button onClick={() => { setMode('delnode'); setSelectedNodeId(null); setCurrentPolygon([]); }} style={{ padding: '12px', fontWeight: 'bold', background: mode === 'delnode' ? '#dc3545' : '#222', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>🗑 Видаляти вузли</button>
            
            <button onClick={() => { setMode('polygons'); setSelectedNodeId(null); }} style={{ padding: '12px', fontWeight: 'bold', background: mode === 'polygons' ? '#f39c12' : '#222', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>🌿 Малювати зони (шари)</button>
            
            <button onClick={() => { setMode(mode === 'scenery' ? 'off' : 'scenery'); setSelectedNodeId(null); setCurrentPolygon([]); }} style={{ padding: '12px', fontWeight: 'bold', background: mode === 'scenery' ? '#2f6f4f' : '#222', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>🏗 Двір/будівлі</button>
            <button onClick={() => { setMode(mode === 'building' ? 'off' : 'building'); setSelectedNodeId(null); setCurrentPolygon([]); }} style={{ padding: '12px', fontWeight: 'bold', background: mode === 'building' ? '#6f42c1' : '#222', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>🏛 Конструктор будівель</button>
            <button onClick={() => { setMode(mode === 'rooms' ? 'off' : 'rooms'); setSelectedNodeId(null); setCurrentPolygon([]); }} style={{ padding: '12px', fontWeight: 'bold', background: mode === 'rooms' ? '#ff9800' : '#222', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>✏️ Редагувати аудиторії</button>
            <button onClick={() => { setMode(mode === 'qr' ? 'off' : 'qr'); setSelectedNodeId(null); setCurrentPolygon([]); }} style={{ padding: '12px', fontWeight: 'bold', background: mode === 'qr' ? '#0d9488' : '#222', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>🔳 QR-коди аудиторій</button>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#222', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', border: '1px solid #444' }}>
              <input type="checkbox" checked={!showNodes} onChange={(e) => setShowNodes(!e.target.checked)} />
              👁 Сховати вузли
            </label>
          </div>

          {mode === 'nodes' && (
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '5px', background: '#222', padding: '10px', borderRadius: '6px' }}>
              <label style={{ fontSize: '13px', color: '#aaa' }}>ID аудиторії (опціонально):</label>
              <input type="text" value={currentRoomId} onChange={(e) => setCurrentRoomId(e.target.value)} placeholder="Напр. 12 або 204" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#111', color: '#fff' }} />
            </div>
          )}

          {mode === 'polygons' && (
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#222', padding: '15px', borderRadius: '6px' }}>
              <label style={{ fontSize: '13px', color: '#ccc' }}>Колір заливки (rgba):</label>
              <input type="text" value={polygonFill} onChange={(e) => setPolygonFill(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#111', color: '#fff' }} />
              
              <label style={{ fontSize: '13px', color: '#ccc', marginTop: '10px' }}>Шар накладання (Layer):</label>
              <input type="number" value={polygonLayer} onChange={(e) => setPolygonLayer(Number(e.target.value))} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#111', color: '#fff' }} />

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button onClick={finishPolygon} style={{ flex: 1, padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>✅ Завершити</button>
                <button onClick={() => setCurrentPolygon([])} style={{ flex: 1, padding: '10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>❌ Скинути</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={mode === 'polygons' ? copyPolygons : (mode === 'edges' ? copyEdges : copyNodes)} style={{ flex: 1, padding: '10px', background: '#17a2b8', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold' }}>📋 Копіювати код</button>
            <button onClick={clearLast} style={{ padding: '10px', background: '#dc3545', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold' }}>↩️ Скасувати</button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '13px', color: '#aaa', marginBottom: '5px' }}>Згенерований код (JSON):</label>
            <pre style={{ flex: 1, background: '#0a0a0a', padding: '10px', borderRadius: '6px', border: '1px solid #333', overflowY: 'auto', fontSize: '12px', color: '#00ff00', margin: 0 }}>
              {JSON.stringify(mode === 'polygons' ? polygons : (mode === 'edges' ? edges : nodes), null, 2)}
            </pre>
          </div>
        </div>
      )}

      <MenuBar activeFloor={activeFloor} onFloorChange={setActiveFloor} />
    </AppLayout>
  );
}
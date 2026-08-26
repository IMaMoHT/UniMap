import { useRef } from 'react';
import type React from 'react';

interface DragState {
  id: string;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

/**
 * Спільна математика перетягування для редакторів карти (кімнати, двір/будівлі,
 * стіни конструктора). Екранні координати переводяться в координати карти
 * діленням дельти на поточний zoom (mapScale).
 */
export function useDragMove(mapScale: number) {
  const drag = useRef<DragState | null>(null);

  const startDrag = (id: string, ox: number, oy: number, e: React.MouseEvent) => {
    e.stopPropagation();
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox, oy };
  };

  const onDrag = (e: React.MouseEvent, onMove: (id: string, x: number, y: number) => void) => {
    const d = drag.current;
    if (!d) return;
    onMove(
      d.id,
      Math.round(d.ox + (e.clientX - d.sx) / mapScale),
      Math.round(d.oy + (e.clientY - d.sy) / mapScale),
    );
  };

  const endDrag = () => {
    drag.current = null;
  };

  return { startDrag, onDrag, endDrag };
}

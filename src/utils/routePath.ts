import type { MapNode } from './pathfinding';

/**
 * Чиста геометрія/логіка маршруту — без React, тому легко тестується окремо.
 * NodePathRenderer лише малює те, що порахували тут.
 */

export interface Point {
  x: number;
  y: number;
}

export interface FloorTransition {
  nodeId: string;
  at: Point;
  targetFloor: number;
  /** true — крок уперед по маршруту (до цілі), false — повернення назад */
  forward: boolean;
}

/** Відкидає вузли з NaN/undefined координатами, щоб не зламати SVG-шлях. */
export function sanitizePathNodes(nodes: MapNode[] | undefined | null): MapNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.filter(
    (node): node is MapNode =>
      Boolean(node) &&
      Number.isFinite(node.x) &&
      Number.isFinite(node.y) &&
      Number.isFinite(node.floor),
  );
}

/**
 * Розбиває маршрут на неперервні відрізки в межах активного поверху,
 * щоб лінія «розрізалась» на сходах, а не стрибала через усю карту.
 */
export function getFloorRuns(nodes: MapNode[], activeFloor: number): Point[][] {
  const runs: Point[][] = [];
  let current: Point[] = [];

  for (const node of nodes) {
    if (node.floor === activeFloor) {
      current.push({ x: node.x, y: node.y });
    } else if (current.length > 0) {
      runs.push(current);
      current = [];
    }
  }

  if (current.length > 0) runs.push(current);
  return runs;
}

/**
 * Сходи на активному поверсі, де маршрут переходить на інший поверх.
 *
 * У маршруті 1→2→3 той самий вузол сходів на 2 поверсі бере участь у ДВОХ
 * переходах: назад на 1 і вперед на 3. Раніше дедуплікація йшла лише за id
 * вузла, тож вигравав перший знайдений (назад на 1), а кнопка «на 3 поверх»
 * зникала. Тепер перехід уперед (до цілі) має пріоритет.
 */
export function getFloorTransitions(nodes: MapNode[], activeFloor: number): FloorTransition[] {
  const byNode = new Map<string, FloorTransition>();

  for (let i = 0; i < nodes.length - 1; i += 1) {
    const a = nodes[i];
    const b = nodes[i + 1];
    if (!a || !b || a.floor === b.floor) continue;

    // Якір — той кінець переходу, що лежить на активному поверсі
    const anchorIsCurrent = a.floor === activeFloor;
    const anchor = anchorIsCurrent ? a : b.floor === activeFloor ? b : null;
    if (!anchor) continue;

    const candidate: FloorTransition = {
      nodeId: anchor.id,
      at: { x: anchor.x, y: anchor.y },
      targetFloor: anchorIsCurrent ? b.floor : a.floor,
      // якір == nodes[i] означає, що маршрут іде з нього далі => вперед
      forward: anchorIsCurrent,
    };

    const existing = byNode.get(anchor.id);
    if (!existing || (!existing.forward && candidate.forward)) {
      byNode.set(anchor.id, candidate);
    }
  }

  return Array.from(byNode.values());
}

/** Catmull-Rom подібне згладжування: ламана -> округлений SVG-шлях. */
export function buildSmoothPath(points: Point[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  const tension = 0.18;
  const commands = [`M ${points[0].x},${points[0].y}`];

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;

    commands.push(`C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`);
  }

  return commands.join(' ');
}

import { selectableRoomsById, selectableRooms } from '../config/positionedElements';
import { mapNodes } from '../config/mapNodes';
import { sanitizeId, sanitizeInteger } from './sanitize';

/**
 * Deep-link для QR-кодів.
 *
 * Фізичний QR біля дверей веде на `https://<сайт>/?start=<roomId>`, застосунок
 * зчитує параметр і одразу підставляє його як точку «Звідки».
 *
 * Підтримувані параметри:
 *   ?start= | ?from=  — точка старту (id кімнати або id вузла графа)
 *   ?to=   | ?dest=   — точка призначення (необовʼязково)
 *   ?floor=           — початковий поверх (необовʼязково)
 *
 * Усе, що приходить із URL, вважається недовіреним: id санітизується і
 * ОБОВʼЯЗКОВО звіряється з наявним каталогом. Невідомі значення ігноруються,
 * тож підроблений QR не може ні зламати стан, ні щось інʼєктувати.
 */

export interface DeepLinkParams {
  startRoomId: string | null;
  destinationRoomId: string | null;
  floor: number | null;
  /** true — у URL були параметри, але жоден не вдалося розпізнати */
  hadUnknownTarget: boolean;
}

const EMPTY: DeepLinkParams = {
  startRoomId: null,
  destinationRoomId: null,
  floor: null,
  hadUnknownTarget: false,
};

/**
 * Перетворює довільний ідентифікатор із QR на id кімнати.
 * Приймає: id кімнати ("Кабінет 55"), номер ("55"), id вузла ("f1_node_181")
 * або roomId вузла ("55", "library").
 */
export function resolveRoomIdentifier(rawValue: string): string | null {
  const value = sanitizeId(rawValue);
  if (!value) return null;

  // 1) прямий збіг з id кімнати
  if (selectableRoomsById.has(value)) return value;

  // 2) номер кабінету / roomId, що збігається з id кімнати
  const direct = resolveByRoomIdOrNumber(value);
  if (direct) return direct;

  // 3) вузол графа: за id ("f1_node_181") або за roomId ("library", "rectorat")
  const node =
    mapNodes.find((entry) => entry.id === value) ??
    mapNodes.find((entry) => (entry as GraphNodeLike).roomId === value) ??
    mapNodes.find(
      (entry) => (entry as GraphNodeLike).roomId?.toLowerCase() === value.toLowerCase(),
    );

  if (node) {
    const nodeRoomId = (node as GraphNodeLike).roomId;
    if (nodeRoomId && nodeRoomId !== value) {
      const viaRoomId = resolveByRoomIdOrNumber(nodeRoomId);
      if (viaRoomId) return viaRoomId;
    }
    // Багато вузлів мають власні назви ("library", "actova"), яким не відповідає
    // жодна кімната. Щоб QR усе одно спрацював, беремо найближче приміщення
    // на тому ж поверсі — користувач опиняється саме там, де наклеєний код.
    return findNearestRoomId(node as GraphNodeLike);
  }

  return null;
}

interface GraphNodeLike {
  id: string;
  x: number;
  y: number;
  floor: number;
  roomId?: string;
}

function findNearestRoomId(node: GraphNodeLike): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const room of selectableRooms) {
    if (room.floor !== node.floor) continue;
    const distance = Math.hypot(room.x - node.x, room.y - node.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = room.id;
    }
  }
  return best;
}

function resolveByRoomIdOrNumber(value: string): string | null {
  if (selectableRoomsById.has(value)) return value;

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    const byNumber = selectableRooms.find((room) => room.number === asNumber);
    if (byNumber) return byNumber.id;
  }

  const lower = value.toLowerCase();
  const byLooseId = selectableRooms.find((room) => room.id.toLowerCase() === lower);
  return byLooseId ? byLooseId.id : null;
}

/** Читає deep-link параметри з рядка запиту (за замовчуванням — поточний URL). */
export function readDeepLinkParams(search?: string): DeepLinkParams {
  try {
    const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
    if (!query) return EMPTY;

    const params = new URLSearchParams(query);
    const rawStart = params.get('start') ?? params.get('from');
    const rawDest = params.get('to') ?? params.get('dest');
    const rawFloor = params.get('floor');

    const startRoomId = rawStart ? resolveRoomIdentifier(rawStart) : null;
    const destinationRoomId = rawDest ? resolveRoomIdentifier(rawDest) : null;

    let floor: number | null = null;
    if (rawFloor !== null) {
      const parsed = sanitizeInteger(rawFloor, Number.NaN, 1, 3);
      floor = Number.isFinite(parsed) ? parsed : null;
    }
    // якщо старт відомий, поверх беремо з нього — він завжди достовірніший
    if (startRoomId) {
      floor = selectableRoomsById.get(startRoomId)?.floor ?? floor;
    }

    return {
      startRoomId,
      destinationRoomId,
      floor,
      hadUnknownTarget: Boolean((rawStart && !startRoomId) || (rawDest && !destinationRoomId)),
    };
  } catch {
    // пошкоджений URL не має ронити застосунок
    return EMPTY;
  }
}

/** Будує URL для друку на QR-коді. */
export function buildDeepLinkUrl(baseUrl: string, roomId: string, destinationId?: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('start', roomId);
  if (destinationId) url.searchParams.set('to', destinationId);
  return url.toString();
}

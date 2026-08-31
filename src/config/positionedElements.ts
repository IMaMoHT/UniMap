import type { PositionedElementConfig } from '../services/PositionedElementsService';
import type { FloorCorridorGroups } from './positionedElementsCommon';
import { getRoomLabel, isSelectableRoom } from '../utils/roomLabels';
import { corridorGroupsFloor1 } from './positionedElementsFloor1';
import { corridorGroupsFloor2 } from './positionedElementsFloor2';
import { corridorGroupsFloor3 } from './positionedElementsFloor3';

export const corridorGroupsByFloor: Record<number, FloorCorridorGroups> = {
  1: corridorGroupsFloor1,
  2: corridorGroupsFloor2,
  3: corridorGroupsFloor3,
};

// Keep existing export for backward compatibility with single-floor usage
export const corridorGroups = corridorGroupsByFloor[1];

const buildSquaresForFloor = (corridors: FloorCorridorGroups, floor: number) =>
  Object.values(corridors)
    .flatMap(corridor => corridor.rooms || [])
    .filter(Boolean)
    .map(room => ({
      ...room,
      floor,
      category: room.category ?? 'regular',
      number: typeof room.number === 'number' ? room.number : undefined,
    }));

export const squaresConfigByFloor: Record<number, PositionedElementConfig[]> = Object.entries(corridorGroupsByFloor)
  .reduce<Record<number, PositionedElementConfig[]>>((acc, [floor, corridors]) => {
    acc[Number(floor)] = buildSquaresForFloor(corridors, Number(floor));
    return acc;
  }, {});

export const squaresConfigFloor1 = squaresConfigByFloor[1] ?? [];
export const squaresConfigFloor2 = squaresConfigByFloor[2] ?? [];
export const squaresConfigFloor3 = squaresConfigByFloor[3] ?? [];

export const getSquaresConfigForFloor = (floor: number = 1): PositionedElementConfig[] =>
  squaresConfigByFloor[floor] ?? [];

export const squaresConfig: PositionedElementConfig[] = getSquaresConfigForFloor(1);

export interface RegularRoomInfo {
  id: string;
  number: number;
  corridor?: number;
  floor: number;
}

export const regularRoomsByFloor: Record<number, RegularRoomInfo[]> = Object.entries(squaresConfigByFloor)
  .reduce<Record<number, RegularRoomInfo[]>>((acc, [floor, rooms]) => {
    const floorNumber = Number(floor);
    acc[floorNumber] = rooms
      .filter(room => room.category === 'regular' && typeof room.number === 'number')
      .map(room => ({
        id: room.id,
        number: room.number as number,
        corridor: room.corridor,
        floor: floorNumber,
      }))
      .sort((a, b) => a.number - b.number);
    return acc;
  }, {});

export const regularRooms: RegularRoomInfo[] = Object.values(regularRoomsByFloor)
  .flat()
  .sort((a, b) => a.number - b.number);

// ---------------------------------------------------------------------------
// Каталог точок маршруту
// ---------------------------------------------------------------------------

export interface SelectableRoom {
  id: string;
  /** Готова людська назва за конвенцією «[Номер] - [Назва]» */
  label: string;
  number?: number;
  floor: number;
  corridor?: number;
  category: NonNullable<PositionedElementConfig['category']>;
  /** Центр приміщення — потрібен, щоб зіставити вузол графа з кімнатою */
  x: number;
  y: number;
}

/**
 * Усі приміщення, які можна обрати як точку маршруту — включно з іменованими
 * (Ректорат, Актова зала, Бібліотека, нові кабінети без номера тощо).
 *
 * Раніше списки «Звідки/Куди» будувалися з `regularRooms`, куди потрапляли лише
 * кімнати з числовим `number`, тож усі нові іменовані приміщення були недоступні.
 *
 * Дублікати id (той самий id на різних поверхах — напр. `stairs1`) відсіюються:
 * лишається перше входження, бо маршрут резолвиться саме по id.
 */
export const selectableRooms: SelectableRoom[] = (() => {
  const seen = new Set<string>();
  const result: SelectableRoom[] = [];

  for (const [floorKey, rooms] of Object.entries(squaresConfigByFloor)) {
    const floor = Number(floorKey);
    for (const room of rooms) {
      if (!isSelectableRoom(room)) continue;
      const id = room.id;
      if (seen.has(id)) continue;
      seen.add(id);

      result.push({
        id,
        label: getRoomLabel({ ...room, floor }),
        number: typeof room.number === 'number' ? room.number : undefined,
        floor,
        corridor: room.corridor,
        category: room.category ?? 'regular',
        x: room.x + (room.width ?? 0) / 2,
        y: room.y + (room.height ?? 0) / 2,
      });
    }
  }

  // Спершу нумеровані кабінети підряд (1, 2, 3 … незалежно від поверху),
  // далі іменовані приміщення за алфавітом.
  return result.sort((a, b) => {
    const aHasNumber = typeof a.number === 'number';
    const bHasNumber = typeof b.number === 'number';

    if (aHasNumber && bHasNumber) {
      if (a.number !== b.number) return (a.number as number) - (b.number as number);
      return a.floor - b.floor; // однаковий номер на різних поверхах
    }
    if (aHasNumber) return -1;
    if (bHasNumber) return 1;
    return a.label.localeCompare(b.label, 'uk');
  });
})();

export const selectableRoomsById: Map<string, SelectableRoom> = new Map(
  selectableRooms.map((room) => [room.id, room]),
);

// ---------------------------------------------------------------------------
// Групи однойменних приміщень
// ---------------------------------------------------------------------------

export interface RoomGroup {
  id: string;
  label: string;
  memberIds: string[];
  floors: number[];
}

const GROUP_PREFIX = 'group:';

/**
 * Приміщення з однаковою назвою («Туалет», «Ректорат», «Сходи») об'єднуємо
 * в одну позицію списку. Раніше вони дублювались і їх доводилось нумерувати
 * — «Ректорат (1)», «Ректорат (2)», — що ні про що не говорить користувачу.
 * Конкретне приміщення з групи обирається автоматично: найближче до другої
 * точки маршруту (див. resolveRoomPairIds).
 */
export const roomGroups: RoomGroup[] = (() => {
  const byLabel = new Map<string, SelectableRoom[]>();
  for (const room of selectableRooms) {
    const list = byLabel.get(room.label);
    if (list) list.push(room);
    else byLabel.set(room.label, [room]);
  }

  const groups: RoomGroup[] = [];
  for (const [label, members] of byLabel) {
    if (members.length < 2) continue;
    groups.push({
      id: `${GROUP_PREFIX}${label}`,
      label,
      memberIds: members.map((m) => m.id),
      floors: Array.from(new Set(members.map((m) => m.floor))).sort((a, b) => a - b),
    });
  }
  return groups;
})();

export const roomGroupsById: Map<string, RoomGroup> = new Map(roomGroups.map((g) => [g.id, g]));

const groupedRoomIds = new Set(roomGroups.flatMap((g) => g.memberIds));

export interface RoutePickerOption {
  id: string;
  label: string;
  /** Поверх або null, якщо група охоплює кілька поверхів */
  floor: number | null;
  category: NonNullable<PositionedElementConfig['category']>;
  number?: number;
  isGroup: boolean;
}

/** Те, що показуємо у списках «Звідки/Куди» та в пошуку. */
export const routePickerOptions: RoutePickerOption[] = (() => {
  const options: RoutePickerOption[] = selectableRooms
    .filter((room) => !groupedRoomIds.has(room.id))
    .map((room) => ({
      id: room.id,
      label: room.label,
      floor: room.floor,
      category: room.category,
      number: room.number,
      isGroup: false,
    }));

  for (const group of roomGroups) {
    const first = selectableRoomsById.get(group.memberIds[0]);
    options.push({
      id: group.id,
      label: group.label,
      floor: group.floors.length === 1 ? group.floors[0] : null,
      category: first?.category ?? 'regular',
      isGroup: true,
    });
  }

  return options.sort((a, b) => {
    const aNum = typeof a.number === 'number';
    const bNum = typeof b.number === 'number';
    if (aNum && bNum) return (a.number as number) - (b.number as number);
    if (aNum) return -1;
    if (bNum) return 1;
    return a.label.localeCompare(b.label, 'uk');
  });
})();

export const routePickerOptionsById: Map<string, RoutePickerOption> = new Map(
  routePickerOptions.map((o) => [o.id, o]),
);

/** Чи існує така точка вибору (конкретна кімната або група). */
export const isKnownPickId = (id: string): boolean =>
  selectableRoomsById.has(id) || roomGroupsById.has(id);

/** Людська назва для будь-якого id (кімнати або групи). */
export const getPickLabel = (id: string): string =>
  roomGroupsById.get(id)?.label ?? selectableRoomsById.get(id)?.label ?? '';

const membersOf = (id: string): SelectableRoom[] => {
  const group = roomGroupsById.get(id);
  if (group) {
    return group.memberIds
      .map((memberId) => selectableRoomsById.get(memberId))
      .filter((room): room is SelectableRoom => Boolean(room));
  }
  const room = selectableRoomsById.get(id);
  return room ? [room] : [];
};

/** Конкретні кімнати, що стоять за точкою вибору (для групи — усі її члени). */
export const getPickMemberIds = (id: string): string[] =>
  roomGroupsById.get(id)?.memberIds ?? (selectableRoomsById.has(id) ? [id] : []);

/** Перехід між поверхами дорожчий за кілька метрів коридором. */
const FLOOR_PENALTY = 2500;

const pairCost = (a: SelectableRoom, b: SelectableRoom): number =>
  Math.hypot(a.x - b.x, a.y - b.y) + Math.abs(a.floor - b.floor) * FLOOR_PENALTY;

/**
 * Перетворює вибір користувача на конкретну пару приміщень.
 * Якщо обрано групу («Туалет»), береться той її представник, який найближчий
 * до другої точки маршруту.
 */
export function resolveRoomPairIds(
  fromId: string,
  toId: string,
): { fromId: string; toId: string } | null {
  const fromCandidates = membersOf(fromId);
  const toCandidates = membersOf(toId);
  if (fromCandidates.length === 0 || toCandidates.length === 0) return null;

  let best: { fromId: string; toId: string } | null = null;
  let bestCost = Infinity;

  for (const from of fromCandidates) {
    for (const to of toCandidates) {
      if (from.id === to.id) continue;
      const cost = pairCost(from, to);
      if (cost < bestCost) {
        bestCost = cost;
        best = { fromId: from.id, toId: to.id };
      }
    }
  }
  return best;
}

/** Пошук конфігурації кімнати за id по всіх поверхах (без прив'язки до поверху). */
export const findRoomConfigById = (roomId: string): PositionedElementConfig | undefined => {
  for (const rooms of Object.values(squaresConfigByFloor)) {
    const found = rooms.find((room) => room.id === roomId);
    if (found) return found;
  }
  return undefined;
};

export default squaresConfig;

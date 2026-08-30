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

  // Однакові назви (кілька «Туалет 1 поверх», «Сходи 2 поверх») нумеруємо,
  // щоб у списку вибору їх можна було розрізнити.
  const labelCounts = new Map<string, number>();
  for (const room of result) labelCounts.set(room.label, (labelCounts.get(room.label) ?? 0) + 1);
  const labelSeen = new Map<string, number>();
  for (const room of result) {
    if ((labelCounts.get(room.label) ?? 0) < 2) continue;
    const index = (labelSeen.get(room.label) ?? 0) + 1;
    labelSeen.set(room.label, index);
    room.label = `${room.label} (${index})`;
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

/** Пошук конфігурації кімнати за id по всіх поверхах (без прив'язки до поверху). */
export const findRoomConfigById = (roomId: string): PositionedElementConfig | undefined => {
  for (const rooms of Object.values(squaresConfigByFloor)) {
    const found = rooms.find((room) => room.id === roomId);
    if (found) return found;
  }
  return undefined;
};

export default squaresConfig;

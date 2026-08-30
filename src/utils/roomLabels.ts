import type { PositionedElementConfig } from '../services/PositionedElementsService';
import { sanitizeText } from './sanitize';

/**
 * Єдине джерело правди для «людської» назви кімнати.
 * Раніше кожен компонент рахував назву по-своєму (RouteInput показував
 * «Кабінет N» навіть для іменованих приміщень, RoomEditor — свій варіант),
 * через що іменовані кімнати або дублювались, або зникали зі списків.
 */

type TextShape =
  | string
  | {
      Ukrainian?: string;
      English?: string;
      OnDefault?: { Ukrainian?: string; English?: string };
      OnHover?: unknown;
    }
  | undefined;

export type Language = 'Ukrainian' | 'English';

/**
 * Технічний слаг замість назви: суцільна латиниця/цифри без пробілів
 * («stairs1», «toileteconom1floor», «Stairsagronomiv1floor», «rectorat»).
 * Такі значення — внутрішні ключі, а не назви для користувача.
 */
const TECHNICAL_SLUG = /^[a-z][a-z0-9_-]*$/i;

/**
 * Службові/тестові приміщення, які не мають потрапляти у вибір маршруту:
 * номери-заглушки (1001, 1002…), крапки, порожні назви.
 */
const SYSTEM_NUMBER_MIN = 1000;
const PLACEHOLDER_LABEL = /^[.\-_\s]*$/;

/**
 * Переноси рядків у підписах замінюємо роздільником ДО санітизації —
 * інакше sanitizeText вирізає \n як керуючий символ і слова злипаються
 * («…забезпеченняВійськовий облік»).
 */
const normalizeLabel = (value: string): string =>
  sanitizeText(value.replace(/\s*[\r\n]+\s*/g, ' · '), 140);

/** Сира підпис-назва з конфігурації кімнати (без фолбеків). */
export function getRoomText(room: PositionedElementConfig, language: Language = 'Ukrainian'): string {
  const text = room.text as TextShape;
  if (!text) return '';

  if (typeof text === 'string') return normalizeLabel(text);

  const pick = (uk?: string, en?: string) =>
    language === 'English' ? en || uk || '' : uk || en || '';

  if (text.OnDefault) {
    return normalizeLabel(pick(text.OnDefault.Ukrainian, text.OnDefault.English));
  }
  return normalizeLabel(pick(text.Ukrainian, text.English));
}

/**
 * Назва кімнати за єдиною конвенцією:
 *   «[Номер] - [Назва]»  якщо є і номер, і змістовна назва
 *   «[Номер]»            якщо назви немає
 *   «[Назва]»            якщо номера немає
 */
export function getRoomLabel(room: PositionedElementConfig, language: Language = 'Ukrainian'): string {
  const raw = getRoomText(room, language);
  const hasNumber = typeof room.number === 'number';

  const isPlaceholder =
    !raw ||
    PLACEHOLDER_LABEL.test(raw) ||
    TECHNICAL_SLUG.test(raw) ||
    raw === String(room.number ?? '');

  const name = isPlaceholder ? '' : raw.trim();

  if (hasNumber && name) return `${room.number} - ${name}`;
  if (hasNumber) return String(room.number);
  if (name) return name;

  // Немає ні номера, ні назви — підставляємо тип приміщення
  const floor = room.floor ?? 1;
  switch (room.category) {
    case 'toilet':
      return language === 'English' ? `Restroom, floor ${floor}` : `Туалет ${floor} поверх`;
    case 'stairs':
      return language === 'English' ? `Stairs, floor ${floor}` : `Сходи ${floor} поверх`;
    case 'buffet':
      return language === 'English' ? `Cafeteria, floor ${floor}` : `Буфет ${floor} поверх`;
    default:
      return sanitizeText(room.id, 120) || (language === 'English' ? 'Unnamed' : 'Без назви');
  }
}

/** Короткий підзаголовок: «2 поверх» / «2nd floor». */
export function getRoomFloorLabel(room: PositionedElementConfig, language: Language = 'Ukrainian'): string {
  const floor = room.floor ?? 1;
  return language === 'English' ? `Floor ${floor}` : `${floor} поверх`;
}

/**
 * Чи можна вибрати приміщення як точку маршруту.
 *
 * Сходи/вбиральні лишаємо — до них теж будують маршрут. Ховаємо:
 *  • службові номери-заглушки 1000+ («Кабінет 1001», «1002»…);
 *  • приміщення з назвою-заглушкою («.», «-», порожньо) і без номера;
 *  • невидимі елементи.
 */
export function isSelectableRoom(room: PositionedElementConfig): boolean {
  if (!room.id || room.visible === false) return false;

  if (typeof room.number === 'number') {
    if (!Number.isFinite(room.number) || room.number >= SYSTEM_NUMBER_MIN) return false;
    return true;
  }

  const raw = getRoomText(room);
  if (!raw || PLACEHOLDER_LABEL.test(raw) || TECHNICAL_SLUG.test(raw)) {
    // без номера і без людської назви лишаємо лише типізовані приміщення
    return room.category === 'toilet' || room.category === 'stairs' || room.category === 'buffet';
  }
  return true;
}

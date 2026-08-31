import { isKnownPickId, resolveRoomPairIds } from '../config/positionedElements';

export interface RouteSelection {
  /** Що обрав користувач: id кімнати або id групи («group:Туалет») */
  fromId: string | null;
  toId: string | null;
  /** Конкретні приміщення після розкриття груп — для маршруту й міток на карті */
  resolvedFromId: string | null;
  resolvedToId: string | null;
}

type Listener = (selection: RouteSelection) => void;

/**
 * Спільний стан «Звідки / Куди» для всіх точок вибору:
 *  • клік по аудиторії на карті,
 *  • випадні списки в панелі маршруту,
 *  • пошук над кнопками поверхів.
 *
 * Сервіс-сінглтон (той самий патерн, що RoomHighlightService/RouteService) —
 * щоб карта й бічне меню не передавали пропси одне одному через півдерева.
 */
class RouteSelectionService {
  private fromId: string | null = null;
  private toId: string | null = null;
  private listeners: Listener[] = [];

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    // одразу віддаємо поточний стан, щоб новий підписник не чекав події
    listener(this.get());
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  get(): RouteSelection {
    const base = { fromId: this.fromId, toId: this.toId };

    if (this.fromId && this.toId) {
      // Група («Туалет») розкривається в найближчого представника
      const pair = resolveRoomPairIds(this.fromId, this.toId);
      return {
        ...base,
        resolvedFromId: pair?.fromId ?? null,
        resolvedToId: pair?.toId ?? null,
      };
    }

    // Одна точка: групу поки не розкриваємо — нема відносно чого шукати найближче
    return {
      ...base,
      resolvedFromId: this.fromId && !this.isGroup(this.fromId) ? this.fromId : null,
      resolvedToId: this.toId && !this.isGroup(this.toId) ? this.toId : null,
    };
  }

  private isGroup(id: string): boolean {
    return id.startsWith('group:');
  }

  private emit(): void {
    const snapshot = this.get();
    for (const listener of [...this.listeners]) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('RouteSelectionService: помилка в підписнику', error);
      }
    }
  }

  /** Невідомі id ігноруємо — у стан не має потрапити те, чого немає на карті. */
  private isValid(id: string): boolean {
    return isKnownPickId(id);
  }

  /**
   * Клік по аудиторії на карті.
   *   немає жодної точки       → «Звідки»
   *   є «Звідки»               → «Куди» (маршрут будується одразу)
   *   є обидві                 → міняємо «Куди», старт лишається
   *   клік по вже обраній      → знімаємо її
   */
  pick(roomId: string): void {
    if (!this.isValid(roomId)) return;

    if (this.fromId === roomId) {
      this.fromId = this.toId;
      this.toId = null;
      this.emit();
      return;
    }
    if (this.toId === roomId) {
      this.toId = null;
      this.emit();
      return;
    }

    if (!this.fromId) {
      this.fromId = roomId;
    } else {
      // Ключова поведінка: коли маршрут уже прокладено, наступний клік замінює
      // ПРИЗНАЧЕННЯ, а не скидає все. Так новий маршрут будується одразу тим
      // самим кліком, без потреби вибирати старт наново.
      this.toId = roomId;
    }
    this.emit();
  }

  setFrom(roomId: string | null): void {
    if (roomId !== null && !this.isValid(roomId)) return;
    this.fromId = roomId;
    if (this.toId === roomId) this.toId = null;
    this.emit();
  }

  setTo(roomId: string | null): void {
    if (roomId !== null && !this.isValid(roomId)) return;
    this.toId = roomId;
    if (this.fromId === roomId) this.fromId = null;
    this.emit();
  }

  clear(): void {
    this.fromId = null;
    this.toId = null;
    this.emit();
  }
}

export const routeSelectionService = new RouteSelectionService();
export default routeSelectionService;

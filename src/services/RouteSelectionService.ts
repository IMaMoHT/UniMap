import { selectableRoomsById } from '../config/positionedElements';

export interface RouteSelection {
  fromId: string | null;
  toId: string | null;
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
    return { fromId: this.fromId, toId: this.toId };
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
  private isValid(roomId: string): boolean {
    return selectableRoomsById.has(roomId);
  }

  /**
   * Клік по аудиторії. Логіка «одним пальцем»:
   *   1-й клік            → точка «Звідки»
   *   2-й клік по іншій   → точка «Куди»
   *   клік по вже обраній → знімає її
   *   клік, коли обидві є → починаємо заново з нової точки «Звідки»
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
    } else if (!this.toId) {
      this.toId = roomId;
    } else {
      this.fromId = roomId;
      this.toId = null;
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

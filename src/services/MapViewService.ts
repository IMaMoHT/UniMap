export interface MapFocusRequest {
  /** Координати центру цілі в системі координат карти */
  x: number;
  y: number;
  /** Бажаний масштаб; якщо не задано — лишаємо поточний */
  scale?: number;
  /** Тривалість анімації, мс */
  animationTime?: number;
}

type Listener = (request: MapFocusRequest) => void;

/**
 * Керування виглядом карти ззовні (наблизити до конкретної точки).
 *
 * Потрібне, бо `setTransform` доступний лише всередині рендер-пропу
 * TransformWrapper у MainPage, а запит на фокус приходить з інших місць:
 * QR deep-link у SetARoute, пошук у MenuBar тощо.
 */
class MapViewService {
  private listeners: Listener[] = [];

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  focusOn(request: MapFocusRequest): void {
    if (!Number.isFinite(request.x) || !Number.isFinite(request.y)) return;
    for (const listener of [...this.listeners]) {
      try {
        listener(request);
      } catch (error) {
        console.error('MapViewService: помилка в підписнику', error);
      }
    }
  }
}

export const mapViewService = new MapViewService();
export default mapViewService;

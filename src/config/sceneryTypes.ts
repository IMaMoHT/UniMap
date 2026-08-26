export type SceneryKind = 'building' | 'lawn' | 'path' | 'tree' | 'bush' | 'bench' | 'fountain';

/** Точка органічної форми газону, відносно bounding box (0..1). Без rcx/rcy — пряма лінія до точки. */
export interface LawnPoint {
  rx: number;
  ry: number;
  rcx?: number;
  rcy?: number;
}

export interface SceneryItem {
  id: string;
  kind: SceneryKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  color?: string;
  label?: string;
  /** lawn: довільна органічна форма (квадратичні криві), масштабована під x/y/width/height. Якщо відсутнє — простий заокруглений прямокутник. */
  shape?: LawnPoint[];
  /** building: кількість вертикальних розділових ліній фасаду */
  dividers?: number;
}

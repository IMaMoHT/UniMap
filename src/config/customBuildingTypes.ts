export type WallKind = 'exterior' | 'interior';
export type OpeningKind = 'door' | 'window';

export interface Wall {
  id: string;
  buildingId: string;
  /** Поверх будівлі, до якого належить стіна (номер довільний: 1, 2, 0, -1 для підвалу/укриття...) */
  floor: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Товщина стіни, px */
  thickness: number;
  kind: WallKind;
  color?: string;
}

export interface Opening {
  id: string;
  /** Батьківська стіна — отвір завжди прив'язаний (child) до конкретної стіни */
  wallId: string;
  kind: OpeningKind;
  /** Положення вздовж стіни: 0 = точка (x1,y1), 1 = точка (x2,y2) */
  offset: number;
  /** Ширина отвору вздовж стіни, px */
  width: number;
}

export interface CustomBuilding {
  id: string;
  name: string;
  /** Список поверхів будівлі. Довільні числа (можна додати 0 або -1 під підвал/укриття) */
  floors: number[];
}

/** Зона озеленення всередині/біля будівлі (газон, клумба) — прив'язана до будівлі і поверху. */
export interface GreenZone {
  id: string;
  buildingId: string;
  floor: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  color?: string;
}

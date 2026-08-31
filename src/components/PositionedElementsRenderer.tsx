import React, { useEffect, useMemo, useState } from 'react';
import type { PositionedElementConfig } from '../services/PositionedElementsService';
import roomHighlightService from '../services/RoomHighlightService';
import { getSquaresConfigForFloor, selectableRoomsById } from '../config/positionedElements';
import { MAP_HEIGHT, MAP_WIDTH } from '../config/mapDimensions';
import { getRoomLabel } from '../utils/roomLabels';
import routeSelectionService, { type RouteSelection } from '../services/RouteSelectionService';
import './PositionedElementsRenderer.css';

interface PositionedElementsRendererProps {
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  mapTransform?: {
    scale: number;
    x: number;
    y: number;
  };
  language?: Language;
  activeFloor?: number;
}

type Language = 'Ukrainian' | 'English';

const PRIMARY_COLOR = '#39A39B';
const PRIMARY_BORDER_COLOR = '#2d8a84';
const DEFAULT_HIGHLIGHT_COLOR = '#9BEF8B';
const ROOM_FILL_ALPHA = 0.5;

const calculateResponsiveFontSize = (
  text: string | number | undefined,
  width?: number,
  height?: number,
  baseSize: number = 24
): number => {
  const minSize = 8;
  const content = (text ?? '').toString();
  const lines = content.split('\n').filter(line => line.length > 0);
  const lineCount = lines.length || 1;
  const longestLineLength = lines.reduce((max, line) => Math.max(max, line.length), content.length) || 1;
  const paddedWidth = Math.max((width ?? 0) - 8, 20);
  const paddedHeight = Math.max((height ?? 0) - 8, 20);

  // Estimate character width (~0.55em) and line height (~1.2em) to derive safe sizes
  const widthBasedSize = paddedWidth / (longestLineLength * 0.55);
  const heightBasedSize = paddedHeight / (lineCount * 1.2);
  const calculatedSize = Math.min(baseSize, widthBasedSize, heightBasedSize);

  if (Number.isNaN(calculatedSize) || !Number.isFinite(calculatedSize)) {
    return baseSize;
  }

  return Math.max(minSize, Math.floor(calculatedSize));
};

const parseColorToRgb = (color: string): { r: number; g: number; b: number } | null => {
  const trimmed = color.trim();
  const rgbMatch = trimmed.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  const rgbaMatch = trimmed.match(
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(?:0|1|0?\.\d+)\s*\)$/i
  );
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
    };
  }

  const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((char) => char + char)
        .join('');
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
};

const toSemiTransparent = (color: string, alpha: number): string => {
  const rgb = parseColorToRgb(color);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : color;
};

const buildHighlightVars = (color: string): React.CSSProperties => {
  const rgb = parseColorToRgb(color);
  if (!rgb) {
    return {
      '--room-highlight-color': color,
      '--room-highlight-border': color,
      '--room-highlight-border-strong': color,
      '--room-highlight-glow': color,
      '--room-highlight-glow-soft': color,
    } as React.CSSProperties;
  }

  return {
    '--room-highlight-color': `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    '--room-highlight-border': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.75)`,
    '--room-highlight-border-strong': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`,
    '--room-highlight-glow': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`,
    '--room-highlight-glow-soft': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
  } as React.CSSProperties;
};

type ExtendedText = {
  OnDefault?: { Ukrainian: string; English: string };
  OnHover?: { Ukrainian: string; English: string; Time?: { Ukrainian: string; English: string } } | string;
  Ukrainian?: string;
  English?: string;
};

interface PreparedRoom extends PositionedElementConfig {
  resolvedImgSrc?: string;
  defaultText?: string | number;
  hoverText?: string;
  hasHoverText: boolean;
  /** Іконка замість підпису — щоб текст не накладався на іконку */
  showIconOnly: boolean;
  /** Доступний опис іконки (для скрінрідерів), коли підпис прихований */
  iconAlt?: string;
  /** Чи можна обрати кімнату як точку маршруту кліком по карті */
  isSelectable: boolean;
  /** Людська назва для aria-label */
  routeLabel: string;
  baseStyle: React.CSSProperties;
  baseCardStyle: React.CSSProperties;
  contentStyle: React.CSSProperties;
}

/** Категорії, для яких іконка самодостатня і підпис лише заважає. */
const ICON_ONLY_CATEGORIES = new Set(['toilet', 'stairs', 'buffet']);

/** Максимальний зсув пальця/миші (px), за якого натискання ще вважається кліком. */
const MAX_TAP_MOVE = 10;

/**
 * Технічні підписи, що приїхали з конфігів ("stairs1", "toilet1",
 * "stairsrotunda2"...). Такий текст ніколи не має накладатися на іконку.
 */
const TECHNICAL_LABEL = /^(?:stairs|toilet|wc|buffet|сходи|stairs?\d*)[\s_-]*\d*$/i;

/**
 * Рішення «іконка АБО текст».
 *  1. явний iconOnly у конфігу має найвищий пріоритет;
 *  2. без іконки — завжди текст;
 *  3. утилітарні категорії (вбиральня/сходи/буфет) — лише іконка;
 *  4. інакше іконка+текст дозволені, але технічний підпис приховуємо.
 */
const resolveIconOnly = (
  room: PositionedElementConfig,
  hasIcon: boolean,
  defaultText: string | number | undefined,
): boolean => {
  if (typeof room.iconOnly === 'boolean') return room.iconOnly && hasIcon;
  if (!hasIcon) return false;
  if (ICON_ONLY_CATEGORIES.has(room.category ?? 'regular')) return true;

  const label = (defaultText ?? '').toString().trim();
  if (!label) return true;
  return TECHNICAL_LABEL.test(label);
};

const resolveRoomText = (
  squareConfig: PositionedElementConfig,
  language: Language
): { defaultText?: string | number; hoverText?: string } => {
  let defaultText: string | number | undefined = squareConfig.number;
  let hoverText: string | undefined;

  if (squareConfig.text) {
    const textExtended = squareConfig.text as ExtendedText;

    if (textExtended.OnDefault || (textExtended.OnHover && typeof textExtended.OnHover === 'object')) {
      if (textExtended.OnDefault) {
        defaultText = language === 'English'
          ? (textExtended.OnDefault.English || textExtended.OnDefault.Ukrainian || '')
          : (textExtended.OnDefault.Ukrainian || textExtended.OnDefault.English || '');
      }

      if (textExtended.OnHover && typeof textExtended.OnHover === 'object') {
        const hoverTextBase = language === 'English'
          ? (textExtended.OnHover.English || textExtended.OnHover.Ukrainian || '')
          : (textExtended.OnHover.Ukrainian || textExtended.OnHover.English || '');
        const timeText = textExtended.OnHover.Time
          ? (language === 'English' ? textExtended.OnHover.Time.English : textExtended.OnHover.Time.Ukrainian)
          : '';
        const combined = timeText ? `${hoverTextBase}\n${timeText}` : hoverTextBase;
        hoverText = combined.trim() ? combined : undefined;
      }
    } else {
      const t: any = squareConfig.text as any;
      const baseText = language === 'English'
        ? (t.English || t.Ukrainian || '')
        : (t.Ukrainian || t.English || '');
      defaultText = baseText;

      if (typeof t.OnHover === 'string' && t.OnHover.trim()) {
        hoverText = t.OnHover;
      }
    }
  }

  if (typeof defaultText === 'string' && defaultText.trim() === '') {
    defaultText = squareConfig.number;
  }

  if (typeof defaultText === 'undefined') {
    defaultText = squareConfig.number;
  }

  return { defaultText, hoverText };
};

const getSizingText = (
  defaultText: string | number | undefined,
  hoverText?: string
): string | number => {
  const defaultValue = defaultText ?? '';
  const hoverValue = hoverText ?? '';
  const defaultLength = defaultValue.toString().length;
  const hoverLength = hoverValue.toString().length;

  if (hoverLength > defaultLength) {
    return hoverValue;
  }

  return defaultValue;
};

/**
 * Іконки лежать у public/Sprite і віддаються з кореня сайту (`/Sprite/...`).
 *
 * Раніше шлях був `./src/Sprite/...` — це працювало лише в dev-режимі, бо Vite
 * роздає вихідні файли. У продакшн-збірці папки `src` не існує, тож усі іконки
 * туалетів/сходів/буфету віддавали 404. Тут же нормалізуємо старі значення,
 * які могли лишитись у конфігах після «Копіювати код».
 */
const SPRITE_BASE = '/Sprite/';

export const normalizeSpritePath = (value: string): string =>
  value.replace(/^\.?\/?src\/Sprite\//, SPRITE_BASE);

const resolveImgSrc = (squareConfig: PositionedElementConfig): string | undefined => {
  if (squareConfig.imgSrc) {
    return normalizeSpritePath(squareConfig.imgSrc);
  }

  switch (squareConfig.category) {
    case 'toilet':
      return `${SPRITE_BASE}WC-icon.svg`;
    case 'stairs':
      return `${SPRITE_BASE}Stairs-icon.svg`;
    case 'buffet':
      return `${SPRITE_BASE}Buffet-icon.svg`;
    default:
      return undefined;
  }
};

interface RoomElementProps {
  room: PreparedRoom;
  isHighlighted: boolean;
  highlightVars: React.CSSProperties;
  highlightColor: string;
  /** 'from' — початкова точка маршруту, 'to' — кінцева */
  routeRole: 'from' | 'to' | null;
  onPick: (roomId: string) => void;
}

const RoomElement = React.memo(
  ({ room, isHighlighted, highlightVars, highlightColor, routeRole, onPick }: RoomElementProps) => {
    const rootClassName = [
      'positioned-element',
      room.className,
      room.hasHoverText ? 'positioned-element--has-hover-text' : ''
    ].filter(Boolean).join(' ');

    const cardClassName = [
      'positioned-element__card',
      isHighlighted ? 'positioned-element__card--highlighted' : '',
      routeRole === 'from' ? 'positioned-element__card--from' : '',
      routeRole === 'to' ? 'positioned-element__card--to' : '',
    ].filter(Boolean).join(' ');

    const cardStyle = isHighlighted
      ? {
          ...room.baseCardStyle,
          ...highlightVars,
          background: highlightColor,
          border: `${room.borderWidth || 2}px solid var(--room-highlight-border)`,
          color: '#0F3A36',
        }
      : room.baseCardStyle;

    // Взаємовиключний рендер: або іконка, або підпис — інакше вони накладаються
    const showDefaultText =
      !room.showIconOnly && room.defaultText !== undefined && room.defaultText !== null;
    const showHoverText = !room.showIconOnly && room.hasHoverText;

    const isSelectable = room.isSelectable;
    // Точка натискання — щоб відрізнити клік від перетягування карти.
    // Через react-zoom-pan-pinch звичайний onClick ненадійний: і мишею, і пальцем
    // найменший зсув перетворює натискання на панорамування.
    const pressRef = React.useRef<{ x: number; y: number; id: number } | null>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
      if (!isSelectable) return;
      pressRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!isSelectable) return;
      const press = pressRef.current;
      pressRef.current = null;
      if (!press || press.id !== e.pointerId) return;

      // Зсув більший за поріг — це було перетягування карти, не вибір аудиторії
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      if (moved > MAX_TAP_MOVE) return;

      e.stopPropagation();
      room.onClick?.();
      onPick(room.id);
    };

    return (
      <div
        className={rootClassName}
        style={{ ...room.baseStyle, cursor: isSelectable ? 'pointer' : room.baseStyle.cursor }}
        role={isSelectable ? 'button' : undefined}
        tabIndex={isSelectable ? 0 : undefined}
        aria-label={isSelectable ? `${room.routeLabel}. Обрати як точку маршруту` : undefined}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { pressRef.current = null; }}
        onKeyDown={(e) => {
          if (!isSelectable) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPick(room.id);
          }
        }}
        onMouseEnter={room.onHover}
      >
        <div style={room.contentStyle}>
          {routeRole && (
            <span className={`positioned-element__pin positioned-element__pin--${routeRole}`} aria-hidden="true">
              {routeRole === 'from' ? 'А' : 'Б'}
            </span>
          )}
          <div style={cardStyle} className={cardClassName}>
            {showDefaultText && (
              <span className="positioned-element__text positioned-element__text--default">
                {room.defaultText}
              </span>
            )}
            {showHoverText && (
              <span className="positioned-element__text positioned-element__text--hover">
                {room.hoverText}
              </span>
            )}
          </div>
          {room.resolvedImgSrc && (
            <img
              src={room.resolvedImgSrc}
              alt={room.iconAlt ?? room.id}
              className="positioned-element__img"
              loading="lazy"
              draggable={false}
              onError={(e) => {
                // Немає спрайта — ховаємо <img>, щоб не було "битої" іконки
                e.currentTarget.style.display = 'none';
              }}
              style={{ transform: `translate(-50%, -50%) rotate(${-(room.rotation || 0)}deg)` }}
            />
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    if (prev.room !== next.room) {
      return false;
    }

    if (prev.isHighlighted !== next.isHighlighted) {
      return false;
    }

    if (prev.routeRole !== next.routeRole) {
      return false;
    }

    if (prev.isHighlighted && prev.highlightColor !== next.highlightColor) {
      return false;
    }

    return true;
  }
);

export const PositionedElementsRenderer: React.FC<PositionedElementsRendererProps> = ({
  containerClassName = '',
  containerStyle = {},
  mapTransform = { scale: 1, x: 0, y: 0 },
  language = 'Ukrainian',
  activeFloor = 1,
}) => {
  const [highlightedRoomIds, setHighlightedRoomIds] = useState<string[]>([]);
  const [currentHighlightColor, setCurrentHighlightColor] = useState<string>(DEFAULT_HIGHLIGHT_COLOR);
  const [selection, setSelection] = useState<RouteSelection>({
    fromId: null,
    toId: null,
    resolvedFromId: null,
    resolvedToId: null,
  });

  useEffect(() => routeSelectionService.subscribe(setSelection), []);

  const handlePick = React.useCallback((roomId: string) => {
    routeSelectionService.pick(roomId);
  }, []);

  useEffect(() => {
    const handleHighlight = (event: { roomId: string | null; roomIds?: string[]; highlightColor: string }) => {
      const nextRoomIds = event.roomIds?.length
        ? event.roomIds
        : (event.roomId ? [event.roomId] : []);
      setHighlightedRoomIds(nextRoomIds);
      if (event.highlightColor) {
        setCurrentHighlightColor(event.highlightColor);
      }
    };
    const unsubscribe = roomHighlightService.onHighlight(handleHighlight);
    return () => {
      unsubscribe();
    };
  }, []);

  const highlightColor = currentHighlightColor || DEFAULT_HIGHLIGHT_COLOR;
  const highlightVars = useMemo(() => buildHighlightVars(highlightColor), [highlightColor]);
  const highlightedRoomIdsSet = useMemo(() => new Set(highlightedRoomIds), [highlightedRoomIds]);

  const preparedRooms = useMemo<PreparedRoom[]>(() => {
    const floorRooms = getSquaresConfigForFloor(activeFloor);
    return floorRooms.map(squareConfig => {
      const resolvedImgSrc = resolveImgSrc(squareConfig);
      const { defaultText, hoverText } = resolveRoomText(squareConfig, language);
      const sizingText = getSizingText(defaultText, hoverText);
      const adaptiveFontSize = calculateResponsiveFontSize(
        sizingText,
        squareConfig.width,
        squareConfig.height,
        squareConfig.fontSize || 24
      );
      const hasHoverText = Boolean(hoverText && hoverText.trim());
      const showIconOnly = resolveIconOnly(squareConfig, Boolean(resolvedImgSrc), defaultText);
      const routeLabel = getRoomLabel(squareConfig, language);
      const iconAlt = showIconOnly ? routeLabel : '';
      // Клікабельні лише ті кімнати, які реально можна обрати як точку маршруту
      const isSelectable = selectableRoomsById.has(squareConfig.id);

      const baseStyle: React.CSSProperties = {
        position: 'absolute',
        left: squareConfig.x,
        top: squareConfig.y,
        width: squareConfig.width,
        height: squareConfig.height,
        zIndex: squareConfig.zIndex || 1,
        cursor: squareConfig.onClick ? 'pointer' : 'default',
        pointerEvents: 'auto',
        ...squareConfig.style
      };

      const baseCardStyle: React.CSSProperties = {
        background: toSemiTransparent(squareConfig.color || PRIMARY_COLOR, ROOM_FILL_ALPHA),
        border: `${squareConfig.borderWidth || 2}px solid ${squareConfig.borderColor || PRIMARY_BORDER_COLOR}`,
        borderRadius: `${squareConfig.borderRadius || 8}px`,
        color: squareConfig.fontColor || '#ffffff',
        fontSize: `${adaptiveFontSize}px`,
      };

      const contentStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        position: 'relative',
        transform: `rotate(${squareConfig.rotation || 0}deg)`,
      };

      return {
        ...squareConfig,
        resolvedImgSrc,
        defaultText,
        hoverText,
        hasHoverText,
        showIconOnly,
        iconAlt,
        isSelectable,
        routeLabel,
        baseStyle,
        baseCardStyle,
        contentStyle,
      };
    });
  }, [activeFloor, language]);

  /**
   * Ключ містить поверх та індекс, а не лише id.
   *
   * У конфігах є дублікати id (напр. `stairs1` двічі на 2 поверсі, «Кабінет 99»
   * двічі на 3-му). При однакових ключах React перевикористовує DOM-вузли
   * попереднього списку — саме тому при перемиканні поверхів на активному
   * лишалися елементи/іконки з іншого поверху. Префікс поверху гарантує, що
   * при зміні floor піддерево створюється заново.
   */
  const renderedRooms = useMemo(
    () =>
      preparedRooms
        .filter(element => element.visible !== false)
        .map((element, index) => (
          <RoomElement
            key={`f${activeFloor}:${element.id}:${index}`}
            room={element}
            isHighlighted={highlightedRoomIdsSet.has(element.id)}
            highlightColor={highlightColor}
            highlightVars={highlightVars}
            // Мітки ставимо на РОЗКРИТІ id: якщо обрано групу («Туалет»),
            // підсвічуємо саме той туалет, який реально увійшов у маршрут.
            routeRole={
              selection.resolvedFromId === element.id
                ? 'from'
                : selection.resolvedToId === element.id
                  ? 'to'
                  : null
            }
            onPick={handlePick}
          />
        )),
    [preparedRooms, highlightedRoomIdsSet, highlightColor, highlightVars, activeFloor, selection, handlePick]
  );

  /*
   * position: absolute замість fixed — контейнер і так живе всередині
   * трансформованого контейнера карти, де fixed поводиться як absolute, але
   * менш передбачувано (у деяких мобільних браузерах шар «відв'язується»).
   *
   * Прибрано will-change/translate3d: вони промотували елемент 3100×3300 в
   * окремий GPU-шар, який при зумі не встигав растеризуватись — саме через це
   * підписи аудиторій зникали при віддаленні.
   *
   * transform лишаємо лише тоді, коли він реально щось робить (адмін-режими
   * передають власний mapTransform); у звичайному режимі це тотожність.
   */
  const isIdentityTransform =
    mapTransform.scale === 1 && mapTransform.x === 0 && mapTransform.y === 0;

  return (
    <div
      className={`positioned-elements-container ${containerClassName}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${MAP_WIDTH}px`,
        height: `${MAP_HEIGHT}px`,
        pointerEvents: 'none',
        zIndex: 10,
        ...(isIdentityTransform
          ? {}
          : {
              transform: `translate(${mapTransform.x}px, ${mapTransform.y}px) scale(${mapTransform.scale})`,
              transformOrigin: '0 0',
            }),
        ...containerStyle
      }}
    >
      {renderedRooms}
    </div>
  );
};

export default React.memo(PositionedElementsRenderer);
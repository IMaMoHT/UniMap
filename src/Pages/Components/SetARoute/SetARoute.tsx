import React, { useCallback, useEffect, useRef, useState } from 'react';
import './SetARoute.css';
import RouteInput from './RouteInput';
import RouteButton from './RouteButton';
import routeService from '../../../services/RouteService';
import roomHighlightService from '../../../services/RoomHighlightService';
import {
  getSquaresConfigForFloor,
  selectableRoomsById,
  type SelectableRoom,
} from '../../../config/positionedElements';
import { readDeepLinkParams } from '../../../utils/deepLink';
import routeSelectionService from '../../../services/RouteSelectionService';

interface SetARouteProps {
  onRouteBuild?: (from: string, to: string) => void;
  activeFloor?: number;
  onFloorChange?: (floor: number) => void;
}

interface RouteInfo {
  fromId: string;
  toId: string;
  fromFloor: number;
  toFloor: number;
}

const ROUTE_HIGHLIGHT_COLOR = '#9BEF8B';

const SetARoute: React.FC<SetARouteProps> = ({ onRouteBuild, activeFloor, onFloorChange }) => {
  const [fromValue, setFromValue] = useState('');
  const [toValue, setToValue] = useState('');
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deepLinkNotice, setDeepLinkNotice] = useState<string | null>(null);
  const deepLinkApplied = useRef(false);

  const getRoomInfo = (roomId: string): SelectableRoom | undefined => selectableRoomsById.get(roomId);

  const buildRoute = useCallback(
    (fromId: string, toId: string, focusStartFloor = true) => {
      const fromRoom = selectableRoomsById.get(fromId);
      const toRoom = selectableRoomsById.get(toId);
      if (!fromRoom || !toRoom) {
        setError('Не вдалося знайти обрані приміщення.');
        return;
      }

      try {
        // Кімнати з обох поверхів — щоб RouteService бачив і старт, і фініш
        const allFloorRooms = [
          ...getSquaresConfigForFloor(fromRoom.floor),
          ...getSquaresConfigForFloor(toRoom.floor),
        ];

        const route = routeService.buildRoute(fromId, toId, allFloorRooms);
        if (!route) {
          setError('Маршрут не побудовано: між цими точками немає зв’язку на карті.');
          return;
        }

        setError(null);
        setRouteInfo({
          fromId,
          toId,
          fromFloor: fromRoom.floor,
          toFloor: toRoom.floor,
        });
        roomHighlightService.highlightRooms([fromId, toId], { color: ROUTE_HIGHLIGHT_COLOR });

        // Перемикаємо поверх ЛИШЕ при першій побудові конкретного маршруту.
        // Раніше це робилось при кожній побудові, тож щойно користувач вручну
        // перемикався на 2/3 поверх, будь-який перерахунок кидав його назад
        // на поверх старту — саме звідси відчуття «не можу перейти».
        if (focusStartFloor && fromRoom.floor !== toRoom.floor) {
          onFloorChange?.(fromRoom.floor);
        }

        onRouteBuild?.(fromId, toId);
      } catch (err) {
        console.error('SetARoute: помилка побудови маршруту', err);
        setError('Сталася помилка під час побудови маршруту. Спробуйте ще раз.');
      }
    },
    [onFloorChange, onRouteBuild],
  );

  // --- QR deep-link: ?start=<roomId>&to=<roomId> ---
  useEffect(() => {
    if (deepLinkApplied.current) return;
    deepLinkApplied.current = true;

    const params = readDeepLinkParams();
    if (params.hadUnknownTarget) {
      setDeepLinkNotice('QR-код вказує на невідоме приміщення — оберіть точку вручну.');
    }
    if (!params.startRoomId) return;

    // Пишемо в спільний сервіс — підписка нижче сама оновить поля й побудує маршрут
    routeSelectionService.setFrom(params.startRoomId);
    if (typeof params.floor === 'number') onFloorChange?.(params.floor);

    const startLabel = selectableRoomsById.get(params.startRoomId)?.label;
    if (startLabel && !params.destinationRoomId) {
      setDeepLinkNotice(`Ви тут: ${startLabel}. Оберіть, куди прокласти маршрут.`);
    }

    if (params.destinationRoomId && params.destinationRoomId !== params.startRoomId) {
      routeSelectionService.setTo(params.destinationRoomId);
    }
  }, [onFloorChange]);

  /**
   * Синхронізація зі спільним сервісом вибору: клік по аудиторії на карті або
   * вибір у пошуку одразу відображається в полях «Звідки/Куди», а щойно обидві
   * точки задані — маршрут будується сам, без натискання кнопки.
   */
  // buildRoute змінює ідентичність разом із пропсами MenuBar, тому тримаємо його
  // в ref: підписка створюється РІВНО один раз і не перезапускає побудову маршруту
  // на кожному ререндері (це і давало зайві перерахунки та підгальмовування).
  const buildRouteRef = useRef(buildRoute);
  buildRouteRef.current = buildRoute;

  const lastBuiltRef = useRef<string>('');

  useEffect(
    () =>
      routeSelectionService.subscribe(({ fromId, toId }) => {
        setFromValue(fromId ?? '');
        setToValue(toId ?? '');

        if (fromId && toId && fromId !== toId) {
          // не перебудовуємо ту саму пару двічі
          const key = `${fromId}->${toId}`;
          // та сама пара вже побудована — нічого не робимо (і не смикаємо поверх)
          if (lastBuiltRef.current === key) return;
          lastBuiltRef.current = key;
          setDeepLinkNotice(null);
          buildRouteRef.current(fromId, toId, true);
        } else {
          lastBuiltRef.current = '';
          // одна точка або жодної — прибираємо стару лінію, лишаємо підсвітку
          routeService.clearRoutes();
          setRouteInfo(null);
          setError(null);
          roomHighlightService.highlightRooms(
            [fromId, toId].filter((id): id is string => Boolean(id)),
            { color: ROUTE_HIGHLIGHT_COLOR },
          );
        }
      }),
    [],
  );

  const handleRouteBuild = () => {
    if (!fromValue || !toValue || fromValue === toValue) return;
    setDeepLinkNotice(null);
    buildRoute(fromValue, toValue);
  };

  const handleClearRoutes = () => {
    routeService.clearRoutes();
    roomHighlightService.clearHighlight();
    routeSelectionService.clear();
    setRouteInfo(null);
    setFromValue('');
    setToValue('');
    setError(null);
    setDeepLinkNotice(null);
  };

  const fromRoomInfo = routeInfo ? getRoomInfo(routeInfo.fromId) : null;
  const toRoomInfo = routeInfo ? getRoomInfo(routeInfo.toId) : null;
  const showCrossFloorHint = Boolean(
    routeInfo && fromRoomInfo && toRoomInfo && routeInfo.fromFloor !== routeInfo.toFloor,
  );
  const currentFloor = typeof activeFloor === 'number' ? activeFloor : routeInfo?.fromFloor;
  const isShowingDestination = showCrossFloorHint && currentFloor === routeInfo?.toFloor;
  const currentRoom = showCrossFloorHint ? (isShowingDestination ? toRoomInfo : fromRoomInfo) : null;
  const nextRoom = showCrossFloorHint ? (isShowingDestination ? fromRoomInfo : toRoomInfo) : null;
  const nextFloor = showCrossFloorHint
    ? (isShowingDestination ? routeInfo?.fromFloor ?? null : routeInfo?.toFloor ?? null)
    : null;
  const actionLabel = isShowingDestination ? 'Щоб повернутися до' : 'Щоб побачити';

  return (
    <div className="SetARoute">
      <span className="SetARoute-title">Прокласти маршрут:</span>
      <RouteInput
        fromValue={fromValue}
        toValue={toValue}
        onFromChange={(id) => routeSelectionService.setFrom(id || null)}
        onToChange={(id) => routeSelectionService.setTo(id || null)}
      />
      <p className="SetARoute-hint">Або просто натисніть на аудиторію на карті: перша — «Звідки», друга — «Куди».</p>
      <div className="route-controls">
        <RouteButton
          onClick={handleRouteBuild}
          disabled={!fromValue || !toValue || fromValue === toValue}
        />
        <button className="clear-routes-btn" onClick={handleClearRoutes} type="button">
          Очистити
        </button>
      </div>

      {deepLinkNotice && (
        <div className="route-hint" role="status">
          <span className="route-hint__text">{deepLinkNotice}</span>
        </div>
      )}

      {error && (
        <div className="route-hint route-hint--error" role="alert">
          <span className="route-hint__text">{error}</span>
        </div>
      )}

      {showCrossFloorHint && currentRoom && nextRoom && nextFloor !== null && (
        <div className="route-hint" role="status">
          <span className="route-hint__title">Маршрут між поверхами</span>
          <span className="route-hint__text">
            Показано: <strong>{currentRoom.label}</strong> ({currentRoom.floor} поверх). {actionLabel}{' '}
            <strong>{nextRoom.label}</strong> на <strong>{nextFloor}</strong> поверсі.
          </span>
          <button
            type="button"
            className="route-hint__switch"
            onClick={() => onFloorChange?.(nextFloor)}
          >
            {nextFloor > (currentFloor ?? nextFloor) ? '↑' : '↓'} Перейти на {nextFloor} поверх
          </button>
        </div>
      )}
    </div>
  );
};

export default SetARoute;

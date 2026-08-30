import React, { useEffect, useMemo, useRef, useState } from 'react';
import './RouteInput.css';
import Button from '../UI/Button';
import { selectableRooms, selectableRoomsById, type SelectableRoom } from '../../../config/positionedElements';
import { sanitizeText } from '../../../utils/sanitize';

interface RouteInputProps {
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

type Side = 'from' | 'to';

const CATEGORY_BADGE: Record<string, string> = {
  toilet: 'WC',
  stairs: 'Сходи',
  buffet: 'Буфет',
};

const RouteInput: React.FC<RouteInputProps> = ({ fromValue, toValue, onFromChange, onToChange }) => {
  const [openSide, setOpenSide] = useState<Side | null>(null);
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');

  const fromRootRef = useRef<HTMLDivElement>(null);
  const toRootRef = useRef<HTMLDivElement>(null);

  const getDisplayName = (roomId: string) =>
    selectableRoomsById.get(roomId)?.label ?? 'Оберіть приміщення';

  /**
   * Пошук по всіх приміщеннях (не лише нумерованих кабінетах).
   * Запит санітизується — у фільтр не потрапляють керуючі символи.
   */
  const filterRooms = (query: string): SelectableRoom[] => {
    const q = sanitizeText(query, 60).toLowerCase();
    if (!q) return selectableRooms;
    return selectableRooms.filter(
      (room) =>
        room.label.toLowerCase().includes(q) ||
        room.id.toLowerCase().includes(q) ||
        (typeof room.number === 'number' && String(room.number).includes(q)),
    );
  };

  const fromRooms = useMemo(() => filterRooms(fromQuery), [fromQuery]);
  const toRooms = useMemo(() => filterRooms(toQuery), [toQuery]);

  // Закриття списків кліком поза ними + по Escape
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!fromRootRef.current?.contains(target) && !toRootRef.current?.contains(target)) {
        setOpenSide(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenSide(null);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const toggle = (side: Side) => setOpenSide((prev) => (prev === side ? null : side));

  const handleSelect = (side: Side, roomId: string) => {
    if (!selectableRoomsById.has(roomId)) return; // ігноруємо невідомі id
    if (side === 'from') onFromChange(roomId);
    else onToChange(roomId);
    setOpenSide(null);
  };

  const renderSelector = (
    side: Side,
    label: string,
    value: string,
    query: string,
    setQuery: (v: string) => void,
    rooms: SelectableRoom[],
    rootRef: React.RefObject<HTMLDivElement | null>,
  ) => {
    const isOpen = openSide === side;
    return (
      <div ref={rootRef} className={`RouteSelector ${isOpen ? 'open' : ''}`}>
        <span className="RouteSelector-label">{label}</span>
        <Button
          className="ui-btn--block route-btn"
          variant="ghost"
          onClick={() => toggle(side)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {getDisplayName(value)}
        </Button>
        <div className={`RouteSelector-list ${isOpen ? 'open' : ''}`}>
          <input
            className="RouteSelector-search"
            type="text"
            value={query}
            placeholder="Пошук: номер або назва…"
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`Пошук: ${label}`}
            maxLength={60}
          />
          <ul className="RouteSelector-options" role="listbox">
            {rooms.length === 0 && <li className="RouteSelector-empty">Нічого не знайдено</li>}
            {rooms.map((room) => {
              const badge = CATEGORY_BADGE[room.category];
              return (
                <li
                  key={room.id}
                  role="option"
                  aria-selected={value === room.id}
                  className={`RouteSelector-item ${value === room.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(side, room.id)}
                >
                  <span className="RouteSelector-item__name">
                    {room.label}
                    {badge ? ` · ${badge}` : ''}
                  </span>
                  <span className="RouteSelector-item__floor">{room.floor} поверх</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="RouteInput">
      {renderSelector('from', 'Звідки:', fromValue, fromQuery, setFromQuery, fromRooms, fromRootRef)}
      {renderSelector('to', 'Куди:', toValue, toQuery, setToQuery, toRooms, toRootRef)}
    </div>
  );
};

export default RouteInput;

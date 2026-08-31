import React, { useEffect, useState, useMemo } from "react";
import "./MenuBar.css";
import MenuArrowBtn from '../MenuArrowBtn/MenuArrowBtn';
import DoubleAltArrowLeft from '../../../Sprite/Double-Alt-Arrow-Left-Icon.svg';
import DoubleAltArrowRight from '../../../Sprite/Double-Alt-Arrow-Right-Icon.svg';
import logonobg from '../../../Sprite/UniMap-Logo.svg'
import FloorContainer from '../FloorContainer/FloorContainer';
import SetARoute from '../SetARoute/SetARoute';
import SettingsContainer from '../SettingsContainer/SettingsContainer';
import LupaIcon from '../../../Sprite/Loupe.svg';
import roomHighlightService from '../../../services/RoomHighlightService';
import routeSelectionService from '../../../services/RouteSelectionService';
import {
  routePickerOptions,
  getPickMemberIds,
  selectableRoomsById,
  type RoutePickerOption,
} from '../../../config/positionedElements';
import { sanitizeText } from '../../../utils/sanitize';

interface MenuBarProps {
  activeFloor?: number;
  onFloorChange?: (floor: number) => void;
}

const MenuBar: React.FC<MenuBarProps> = ({ activeFloor: propActiveFloor, onFloorChange }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isContentMounted, setIsContentMounted] = useState(true);
  const [internalActiveFloor, setInternalActiveFloor] = useState(1);
  
  // Use prop if provided, otherwise use internal state
  const activeFloor = propActiveFloor ?? internalActiveFloor;
  const handleFloorChange = (floor: number) => {
    if (onFloorChange) {
      onFloorChange(floor);
    } else {
      setInternalActiveFloor(floor);
    }
  };
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [searchSelectedRoomId, setSearchSelectedRoomId] = useState<string | null>(null);

  /**
   * Пошук по ВСІХ приміщеннях (не лише нумерованих) — за номером і за назвою.
   * Раніше список брався з `regularRooms`, тож іменовані приміщення
   * (Бібліотека, Актова зала…) не знаходились взагалі.
   */
  const filteredRooms = useMemo<RoutePickerOption[]>(() => {
    const query = sanitizeText(searchQuery, 60).toLowerCase();
    if (!query) return [];

    return routePickerOptions
      .filter(room =>
        room.label.toLowerCase().includes(query) ||
        (typeof room.number === 'number' && String(room.number).includes(query))
      )
      .slice(0, 40);
  }, [searchQuery]);

  const selectedSearchRoom = searchSelectedRoomId
    ? routePickerOptions.find(room => room.id === searchSelectedRoomId) ?? null
    : null;
  const showSearchHint = Boolean(selectedSearchRoom);
  const isSearchRoomOnActiveFloor = selectedSearchRoom?.floor === activeFloor;

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsSearchDropdownOpen(value.trim().length > 0);

    if (!value.trim()) {
      roomHighlightService.clearHighlight();
      setSearchSelectedRoomId(null);
    }
  };

  /** Показати кімнату: підсвітити і перемкнути поверх, якщо вона на іншому. */
  const revealRoom = (room: RoutePickerOption) => {
    const memberIds = getPickMemberIds(room.id);
    roomHighlightService.highlightRooms(memberIds);
    setSearchQuery(room.label);
    setSearchSelectedRoomId(room.id);
    setIsSearchDropdownOpen(false);

    // Для групи («Туалет») переходимо на поверх найближчого до поточного члена
    const targetFloor =
      room.floor ??
      memberIds
        .map((id) => selectableRoomsById.get(id)?.floor ?? activeFloor)
        .sort((a, b) => Math.abs(a - activeFloor) - Math.abs(b - activeFloor))[0];
    if (targetFloor !== activeFloor) handleFloorChange(targetFloor);
  };

  const handleSearchSubmit = () => {
    if (filteredRooms.length > 0) {
      revealRoom(filteredRooms[0]);
    } else {
      roomHighlightService.clearHighlight();
      setSearchSelectedRoomId(null);
    }
  };

  const handleRoomSelect = (room: RoutePickerOption) => revealRoom(room);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /**
   * На телефоні меню займає майже весь екран, тож дотик до карти або будь-якого
   * порожнього місця має його згортати. На великих екранах меню закріплене —
   * там така поведінка лише заважала б.
   */
  useEffect(() => {
    if (windowWidth >= 720 || isCollapsed) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      // дотик усередині самого меню не рахуємо
      if (target?.closest('.menu-bar')) return;
      setIsContentMounted(false);
      setIsCollapsed(true);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [windowWidth, isCollapsed]);

  let className = "menu-bar";
  if (windowWidth < 720) {
    className += " menu-bar--phone";
  } else if (windowWidth < 1100) {
    className += " menu-bar--tablet";
  } else if (windowWidth < 1440) {
    className += " menu-bar--laptop";
  } else {
    className += " menu-bar--desktop";
  }
  if (isCollapsed) {
    className += " menu-bar--collapsed";
  }

  const handleCollapse = () => {
    // Immediately unmount content, then animate container to collapsed
    setIsContentMounted(false);
    setIsCollapsed(true);
  };

  const handleExpand = () => {
    // Animate container to expanded first, mount content after transition end
    setIsCollapsed(false);
  };

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    // After expanding finished, mount content
    if (!isCollapsed && !isContentMounted) {
      setIsContentMounted(true);
    }
  };

  return (
    <aside className={className} aria-label="Sidebar navigation" onTransitionEnd={handleTransitionEnd}>
      <div className="menu-bar__collapsed" aria-hidden={!isCollapsed}>
        <MenuArrowBtn
          aria-label="Открыть меню"
          icon={<img src={DoubleAltArrowLeft} />}
          onClick={handleExpand}
        />
      </div>

      {isContentMounted && (
        <>
          <div className="menu-bar__content">
            <header className="HeaderContainer">
              <div className="LogoContainer">
                <img src={logonobg} alt="logo" className="LogoImg" />
                <h1 className="LogoText">UniMap</h1>
              </div>
              <MenuArrowBtn
                aria-label="Свернуть меню"
                icon={<img src={DoubleAltArrowRight} />}
                onClick={handleCollapse}
              />
            </header>

            <section className="menu-bar__section" aria-labelledby="search-heading">
              <h2 id="search-heading" className="visually-hidden">Пошук</h2>
              <div className="search-container">
                <label className="ui-input search-input">
                  <span className="visually-hidden">Пошук</span>
                  <span className="search-input__icon" aria-hidden="true">
                    <img 
                      src={LupaIcon} 
                      alt="" 
                      onClick={handleSearchSubmit}
                      style={{ cursor: 'pointer' }}
                    />
                  </span>
                  <input 
                    className="ui-input__field search-input__field" 
                    placeholder={'\u0417\u043d\u0430\u0439\u0442\u0438 \u043a\u0430\u0431\u0456\u043d\u0435\u0442'} 
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onKeyPress={handleKeyPress}
                    onFocus={() => setIsSearchDropdownOpen(searchQuery.trim().length > 0)}
                  />
                </label>
                
                {/* Search Dropdown */}
                <div className={`search-dropdown ${isSearchDropdownOpen && filteredRooms.length > 0 ? 'show' : ''}`}>
                  {filteredRooms.map(room => (
                    <div
                      key={room.id}
                      className="search-dropdown-item"
                      onClick={() => handleRoomSelect(room)}
                    >
                      <span className="room-id">{room.label}</span>
                      <span className="corridor">{room.floor} \u043f\u043e\u0432\u0435\u0440\u0445</span>
                    </div>
                  ))}
                </div>
              </div>
              {showSearchHint && selectedSearchRoom && (
                <div className="route-hint search-hint" role="status">
                  <span className="route-hint__title">Знайдено</span>
                  <span className="route-hint__text">
                    <strong>{selectedSearchRoom.label}</strong>{selectedSearchRoom.floor !== null ? ` — ${selectedSearchRoom.floor} поверх` : ''}.{' '}
                    {isSearchRoomOnActiveFloor ? 'Підсвічено на карті.' : ''}
                  </span>
                  <div className="search-hint__actions">
                    <button
                      type="button"
                      className="route-hint__switch"
                      onClick={() => routeSelectionService.setFrom(selectedSearchRoom.id)}
                    >
                      Звідси
                    </button>
                    <button
                      type="button"
                      className="route-hint__switch"
                      onClick={() => routeSelectionService.setTo(selectedSearchRoom.id)}
                    >
                      Сюди
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="menu-bar__section" aria-labelledby="floors-heading">
              <h2 id="floors-heading" className="visually-hidden">Поверх</h2>
              <FloorContainer
                activeFloor={activeFloor}
                onFloorChange={handleFloorChange}
              />
            </section>

            <section className="menu-bar__section" aria-labelledby="route-heading">
              <h2 id="route-heading" className="visually-hidden">Маршрут</h2>
              <SetARoute activeFloor={activeFloor} onFloorChange={handleFloorChange} />
            </section>

            <div className="Line"></div>

            <section className="menu-bar__section" aria-labelledby="links-heading">
              <h2 id="links-heading" className="visually-hidden">Посилання</h2>
              <SettingsContainer />
            </section>
          </div>
        </>
      )}
    </aside>
  )
}
export default MenuBar

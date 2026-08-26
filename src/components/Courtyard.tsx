import { MAP_HEIGHT, MAP_WIDTH } from '../config/mapDimensions';

const PAPER = '#fcfcfa';

/**
 * Двір тепер повністю редагований через "🏗 Двір/будівлі" (див. Scenery.tsx /
 * SceneryEditor.tsx / config/sceneryItems.ts): доріжки, фонтан, будівля, газони,
 * дерева, кущі, лавки — все там.
 *
 * Цей компонент лишає тільки функціональну латку: у 55 аудиторії на floor-1
 * SVG намальовані зайві сходи — накриваємо їх білим прямокутником. Це не
 * декоративний елемент, тому він навмисно НЕ винесений у сценарій (переміщення
 * знову оголить сходи).
 */
export default function Courtyard() {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: MAP_WIDTH, height: MAP_HEIGHT, zIndex: 6, pointerEvents: 'none' }}>
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} width={MAP_WIDTH} height={MAP_HEIGHT}>
        <rect x="696" y="2312" width="112" height="100" rx="8" fill={PAPER} />
      </svg>
    </div>
  );
}

import React from "react";
import floor1 from "../../Sprite/Floor-1-icon.svg";
import floor2 from "../../Sprite/Floor-2-icon.svg";
import floor3 from "../../Sprite/Floor-3-icon.svg";

import { MAP_WIDTH, MAP_HEIGHT } from "../../config/mapDimensions"; 

interface MapBackgroundProps {
  activeFloor?: number;
}

const floorImages = {
  1: floor1,
  2: floor2,
  3: floor3,
};

const MapBackground: React.FC<MapBackgroundProps> = ({ activeFloor = 1 }) => {
  const currentFloorImage = floorImages[activeFloor as keyof typeof floorImages] || floor1;

  return (
    <img
      src={currentFloorImage}
      alt={`Поверх ${activeFloor}`}
      draggable={false}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${MAP_WIDTH}px`,
        height: `${MAP_HEIGHT}px`,
        display: "block",
        pointerEvents: "none" 
      }}
    />
  );
};

export default MapBackground;
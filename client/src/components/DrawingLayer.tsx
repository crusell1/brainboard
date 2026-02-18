import React, { useRef } from "react";
import { useViewport } from "@xyflow/react";
import type { Drawing, Point } from "../types/drawing";

type DrawingLayerProps = {
  drawings: Drawing[];
  currentPoints: Point[]; // Ny prop: punkter som ritas just nu
  isDrawingMode: boolean;
  selectedDrawingId: string | null;
  onSelectDrawing: (id: string | null) => void;
  onDeleteDrawing: (id: string) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
};

export default function DrawingLayer({
  drawings,
  currentPoints,
  isDrawingMode,
  selectedDrawingId,
  onSelectDrawing,
  onDeleteDrawing,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: DrawingLayerProps) {
  const { x, y, zoom } = useViewport();
  const svgRef = useRef<SVGSVGElement>(null);

  // Helper: Konvertera punkter till SVG Path string
  const getSvgPathFromPoints = (points: Point[]) => {
    if (points.length === 0) return "";
    const d = points.reduce((acc, point, i) => {
      return i === 0
        ? `M ${point.x} ${point.y}`
        : `${acc} L ${point.x} ${point.y}`;
    }, "");
    return d;
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: isDrawingMode ? 1500 : 10, // Ligg över noder men under UI
        // 🔥 VIKTIGT: 'all' fångar musen för ritning. 'none' låter oss klicka på noder.
        // Scroll/Zoom fungerar ändå eftersom vi inte stoppar wheel-events.
        pointerEvents: isDrawingMode ? "all" : "none",
        cursor: isDrawingMode ? "crosshair" : "default",
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClick={(e) => {
        // Stoppa klick så inte radialmenyn öppnas om vi råkar klicka i draw mode
        if (isDrawingMode) e.stopPropagation();
      }}
    >
      <svg
        ref={svgRef}
        style={{
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        {/* 
            Vi applicerar en transform group som matchar React Flows viewport.
            Detta gör att våra koordinater (som är i "Flow Space") renderas korrekt
            när användaren zoomar och panorerar.
        */}
        <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
          {/* 1. Färdiga ritningar */}
          {drawings.map((drawing) => {
            const isSelected = selectedDrawingId === drawing.id;
            // Hitta sista punkten för att placera delete-knappen
            const lastPoint = drawing.points[drawing.points.length - 1];

            return (
              <React.Fragment key={drawing.id}>
                {/* 1. Osynlig "Hit Area" för enklare klick på mobil */}
                <path
                  d={getSvgPathFromPoints(drawing.points)}
                  stroke="transparent"
                  strokeWidth={Math.max(drawing.width + 20, 30)} // Öka träffytan rejält
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    cursor: isDrawingMode ? "crosshair" : "pointer",
                    pointerEvents: "stroke", // Fånga klick även om transparent
                  }}
                  onClick={(e) => {
                    if (!isDrawingMode) {
                      onSelectDrawing(drawing.id);
                      e.stopPropagation();
                    }
                  }}
                />

                {/* 2. Den faktiska synliga linjen */}
                <path
                  d={getSvgPathFromPoints(drawing.points)}
                  stroke={drawing.color}
                  strokeWidth={drawing.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    pointerEvents: "none", // Låt klick gå igenom till hit-arean
                    opacity: isSelected ? 0.6 : 1,
                    filter: isSelected
                      ? "drop-shadow(0 0 4px rgba(255, 255, 255, 0.8))"
                      : "none",
                  }}
                />

                {/* Delete-knapp (visas endast om vald och inte i rit-läge) */}
                {isSelected && !isDrawingMode && lastPoint && (
                  <g
                    // Placera vid sista punkten, motverka zoom för konstant storlek
                    transform={`translate(${lastPoint.x}, ${lastPoint.y}) scale(${1 / zoom})`}
                    style={{ cursor: "pointer", pointerEvents: "auto" }} // 🔥 Viktigt: auto för att kunna klicka
                    onMouseDown={(e) => {
                      // Stoppa mousedown så vi inte börjar rita när vi klickar på krysset
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDrawing(drawing.id);
                    }}
                  >
                    {/* Osynlig hit-area för bättre touch/klick (40px diameter) */}
                    <circle r="20" fill="transparent" />

                    {/* Synlig knapp */}
                    <circle
                      r="12"
                      fill="#ff0055"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <text
                      x="0"
                      y="0"
                      dy="3"
                      textAnchor="middle"
                      fill="white"
                      fontSize="10"
                      fontWeight="bold"
                      style={{ userSelect: "none" }}
                    >
                      ✕
                    </text>
                  </g>
                )}
              </React.Fragment>
            );
          })}

          {/* 2. Pågående ritning (Preview) */}
          {currentPoints.length > 0 && (
            <path
              d={getSvgPathFromPoints(currentPoints)}
              stroke="#ff0055"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: "none", opacity: 0.7 }}
            />
          )}
        </g>
      </svg>
    </div>
  );
}

import { useViewport } from "@xyflow/react";
import { MousePointer2 } from "lucide-react";

type Cursor = {
  x: number;
  y: number;
  color: string;
  email: string;
};

export default function CursorLayer({
  cursors,
}: {
  cursors: Record<string, Cursor>;
}) {
  const { x, y, zoom } = useViewport();

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999, // 🔥 FIX: Höj z-index rejält och ta bort overflow: hidden
      }}
    >
      {Object.entries(cursors).map(([key, cursor]) => {
        if (cursor.x == null || cursor.y == null) return null;

        return (
          <div
            key={key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: `translate(${x + cursor.x * zoom}px, ${y + cursor.y * zoom}px)`,
              transition: "transform 0.1s linear", // 🔥 FIX: Lite längre transition döljer lagg/jitter
              willChange: "transform",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <MousePointer2
              size={20}
              fill={cursor.color}
              color="white" // Vit outline
              style={{ transform: "rotate(-15deg)" }} // Luta pilen lite
            />
            <div
              style={{
                backgroundColor: cursor.color,
                color: "white",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "10px",
                marginTop: "2px",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              }}
            >
              {cursor.email.split("@")[0]} {/* Visa bara namnet innan @ */}
            </div>
          </div>
        );
      })}
    </div>
  );
}

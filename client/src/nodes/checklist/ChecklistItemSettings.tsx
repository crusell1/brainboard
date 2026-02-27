import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { HabitItem, HabitResetRule } from "./types";

interface ChecklistItemSettingsProps {
  item: HabitItem;
  onUpdate: (id: string, data: Partial<HabitItem>) => void;
  onClose: () => void;
  triggerRect: DOMRect | null; // 🔥 NY: För positionering
}

const WEEKDAYS = [
  { label: "M", value: 1 }, // Monday
  { label: "T", value: 2 },
  { label: "O", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
  { label: "L", value: 6 },
  { label: "S", value: 0 }, // Sunday
];

export default function ChecklistItemSettings({
  item,
  onUpdate,
  onClose,
  triggerRect,
}: ChecklistItemSettingsProps) {
  // 🔥 FIX: Initiera position direkt för att slippa "flash" i hörnet (0,0)
  const [position, setPosition] = useState(() => {
    if (triggerRect) {
      return {
        top: triggerRect.bottom + window.scrollY + 5,
        left: triggerRect.right + window.scrollX - 220,
      };
    }
    return { top: 0, left: 0 };
  });

  // 🔥 Räkna ut position när menyn öppnas
  useEffect(() => {
    if (triggerRect) {
      setPosition({
        top: triggerRect.bottom + window.scrollY + 5, // Lite under knappen
        left: triggerRect.right + window.scrollX - 220, // Justera vänster så högerkanten livar (bredd 220)
      });
    }
  }, [triggerRect]);

  const handleResetRuleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRule = e.target.value as HabitResetRule;
    const updates: Partial<HabitItem> = { resetRule: newRule };
    // If changing away from weekly, clear resetDays
    if (item.resetRule === "weekly" && newRule !== "weekly") {
      updates.resetDays = [];
    }
    onUpdate(item.id, updates);
  };

  const handleDayToggle = (dayValue: number) => {
    const currentDays = item.resetDays || [];
    const newDays = currentDays.includes(dayValue)
      ? currentDays.filter((d) => d !== dayValue)
      : [...currentDays, dayValue].sort();
    onUpdate(item.id, { resetDays: newDays });
  };

  // 🔥 Rendera i Portal (document.body) för att slippa clipping
  return createPortal(
    <>
      {/* Osynlig bakgrund för att stänga vid klick utanför */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={onClose}
        // 🔥 FIX: Stoppa mousedown även på bakgrunden för säkerhets skull
        onMouseDown={(e) => e.stopPropagation()}
      />
      <div
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        onMouseDown={(e) => e.stopPropagation()} // 🔥 FIX: Stoppa eventet så menyn inte stängs eller drar canvasen
        style={{
          position: "absolute", // Absolut i förhållande till body
          top: position.top,
          left: position.left,
          width: 220,
          background: "rgba(30, 30, 35, 0.95)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 12,
          padding: 12,
          zIndex: 9999, // Högt z-index
          boxShadow: "0 10px 30px -5px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#888",
            textTransform: "uppercase",
          }}
        >
          Återställning
        </div>
        <select
          value={item.resetRule}
          onChange={handleResetRuleChange}
          className="nodrag" // 🔥 FIX: Säkerställ att React Flow ignorerar drag här
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "white",
            fontSize: "13px",
            padding: "8px 12px",
            borderRadius: 8,
            outline: "none",
          }}
        >
          <option value="none">Aldrig</option>
          <option value="daily">Varje dag</option>
          <option value="weekly">Varje vecka</option>
          <option value="monthly">Varje månad</option>
        </select>

        {item.resetRule === "weekly" && (
          <div
            style={{ display: "flex", justifyContent: "space-between", gap: 4 }}
          >
            {WEEKDAYS.map((day) => {
              const isSelected = item.resetDays?.includes(day.value);
              return (
                <button
                  key={day.value}
                  onClick={() => handleDayToggle(day.value)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: isSelected ? "1px solid #84cc16" : "1px solid #555",
                    background: isSelected
                      ? "rgba(132, 204, 22, 0.2)"
                      : "transparent",
                    color: isSelected ? "#84cc16" : "#888",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: "bold",
                  }}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

import React from "react";
import { StickyNote, Image, Pen, Mic } from "lucide-react";

type RadialMenuProps = {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export default function RadialMenu({
  x,
  y,
  isOpen,
  onClose,
  onSelect,
}: RadialMenuProps) {
  if (!isOpen) return null;

  // Konfiguration av menyval
  const options = [
    { id: "node", icon: StickyNote, label: "Notis" },
    { id: "image", icon: Image, label: "Bild" },
    { id: "draw", icon: Pen, label: "Rita" },
    { id: "voice", icon: Mic, label: "Röst" }, // Förberedd för V2
  ];

  // Layout-inställningar
  const radius = 70; // Avstånd från mitten
  const buttonSize = 48;
  const iconSize = 24;

  return (
    <>
      {/* Overlay: Stänger menyn om man klickar utanför */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 999,
        }}
        onMouseDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* Meny-container centrerad på x, y */}
      <div
        style={{
          position: "absolute",
          top: y,
          left: x,
          zIndex: 1000,
          width: 0,
          height: 0,
        }}
      >
        {/* Radiella knappar */}
        {options.map((option, index) => {
          // Beräkna position i cirkeln (startar kl 12)
          const angle = (index * (360 / options.length) - 90) * (Math.PI / 180);
          const dx = Math.cos(angle) * radius;
          const dy = Math.sin(angle) * radius;

          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              title={option.label}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                // Centrera knappen exakt på sin koordinat
                transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`,
                width: buttonSize,
                height: buttonSize,
                borderRadius: "50%",
                background: "#333",
                border: "1px solid #555",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                zIndex: 1001,
                padding: 0,
                transition: "transform 0.1s ease, background 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#444";
                e.currentTarget.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.1)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#333";
                e.currentTarget.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`;
              }}
            >
              {/* Lucide-ikon med konsekvent storlek och tjocklek */}
              <option.icon size={iconSize} strokeWidth={1.5} />
            </button>
          );
        })}
      </div>
    </>
  );
}

import React from "react";

type DrawModeControlsProps = {
  onExit: () => void;
  style?: React.CSSProperties;
};

export default function DrawModeControls({
  onExit,
  style,
}: DrawModeControlsProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 60, // Flyttad upp litegrann
        left: "50%",
        transform: "translateX(-50%)",
        background: "#ff0055",
        color: "white",
        padding: "8px 16px",
        borderRadius: "24px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 2000,
        pointerEvents: "auto", // Säkerställ att knappen går att klicka på
        ...style, // 🔥 Tillåt överskuggning av stilar
      }}
    >
      <span style={{ fontWeight: 600, fontSize: "14px" }}>
        Draw Mode Enabled
      </span>
      <button
        onClick={onExit}
        style={{
          background: "rgba(255,255,255,0.2)",
          border: "none",
          borderRadius: "50%",
          width: "24px",
          height: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          cursor: "pointer",
          fontSize: "14px",
          padding: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

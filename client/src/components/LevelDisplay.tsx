// d:\programmering\BrainBoard\client\src\components\LevelDisplay.tsx

import { getProgressToNextLevel } from "../lib/progression";

export default function LevelDisplay({ totalXp }: { totalXp: number }) {
  const { currentLevel, percentage, progress, totalNeeded } =
    getProgressToNextLevel(totalXp);

  return (
    <div
      style={{
        width: "100%",
        padding: "0 4px",
        marginTop: "8px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          fontSize: "11px",
          color: "#888",
          marginBottom: "4px",
          fontWeight: 600,
        }}
      >
        <span style={{ color: "#fbbf24" }}>Lvl {currentLevel}</span>
        <span>
          {Math.floor(progress)} / {totalNeeded} XP
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: "6px",
          background: "rgba(255,255,255,0.1)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
            transition: "width 0.5s ease-out",
            boxShadow: "0 0 8px rgba(251, 191, 36, 0.4)",
          }}
        />
      </div>
    </div>
  );
}

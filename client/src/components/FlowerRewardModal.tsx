import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Palette } from "lucide-react";
import { StitchFlower } from "../pomodoro/plantSystem/StitchPlant";
import type { PlantDNA } from "../pomodoro/types";
import { BACKGROUNDS } from "../config/backgrounds";

export interface FlowerDrop {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  dna: PlantDNA;
  count: number; // Hur många man har totalt
  xpGained?: number; // 🔥 NY
  levelUp?: boolean; // 🔥 NY
  newLevel?: number; // 🔥 NY
}

interface FlowerRewardModalProps {
  flower: FlowerDrop;
  onClose: () => void;
}

const RARITY_COLORS = {
  common: "#9ca3af", // Gray
  uncommon: "#10b981", // Green
  rare: "#3b82f6", // Blue
  epic: "#a855f7", // Purple
  legendary: "#f59e0b", // Gold
  mythic: "#ef4444", // Red
};

export default function FlowerRewardModal({
  flower,
  onClose,
}: FlowerRewardModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const rarityColor = RARITY_COLORS[flower.rarity] || "#fff";

  // 🔥 Kolla om vi låste upp en bakgrund
  const unlockedBackground =
    flower.levelUp && flower.newLevel
      ? BACKGROUNDS.find((bg) => bg.level === flower.newLevel)
      : null;

  return createPortal(
    <div
      className="nodrag"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(145deg, #1e1e24, #111)",
          border: `2px solid ${rarityColor}`,
          borderRadius: "24px",
          padding: "32px",
          width: "90%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          boxShadow: `0 0 50px ${rarityColor}40`,
          transform: isVisible ? "scale(1)" : "scale(0.8)",
          transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "transparent",
            border: "none",
            color: "#666",
            cursor: "pointer",
          }}
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              color: rarityColor,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "2px",
              fontSize: "12px",
              marginBottom: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Sparkles size={14} /> NY UPPTÄCKT
          </div>
          <h2 style={{ margin: 0, fontSize: "28px", color: "white" }}>
            {flower.name}
          </h2>
        </div>

        {/* Flower Preview */}
        <div
          style={{
            width: "200px",
            height: "200px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "20px",
            margin: "10px 0",
          }}
        >
          <StitchFlower progress={0} status="work" dna={flower.dna} />
        </div>

        {/* Info */}
        <div style={{ textAlign: "center", color: "#ccc", fontSize: "14px" }}>
          <p style={{ margin: "0 0 12px 0", fontStyle: "italic" }}>
            "{flower.description}"
          </p>

          {/* 🔥 XP & Level Up Info */}
          {flower.xpGained ? (
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  color: "#fbbf24",
                  fontWeight: "bold",
                  fontSize: "16px",
                }}
              >
                +{flower.xpGained} XP
              </div>
              {flower.levelUp && (
                <div
                  style={{
                    color: "#a855f7",
                    fontWeight: "800",
                    fontSize: "18px",
                    marginTop: "4px",
                    textShadow: "0 0 15px rgba(168, 85, 247, 0.6)",
                  }}
                >
                  LEVEL UP! {flower.newLevel}
                </div>
              )}

              {/* 🔥 Visa upplåst bakgrund */}
              {unlockedBackground && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    marginTop: "8px",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    color: "#fff",
                  }}
                >
                  <Palette size={14} />
                  <span>
                    Ny bakgrund: <strong>{unlockedBackground.name}</strong>
                  </span>
                </div>
              )}
            </div>
          ) : null}

          <div
            style={{
              fontSize: "12px",
              color: "#666",
              background: "rgba(0,0,0,0.3)",
              padding: "4px 12px",
              borderRadius: "12px",
              display: "inline-block",
            }}
          >
            Du har samlat:{" "}
            <span style={{ color: "white" }}>{flower.count}</span> st
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          style={{
            background: rarityColor,
            color: "#000",
            border: "none",
            padding: "12px 32px",
            borderRadius: "12px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            marginTop: "8px",
            width: "100%",
            transition: "transform 0.1s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Samla
        </button>
      </div>
    </div>,
    document.body,
  );
}

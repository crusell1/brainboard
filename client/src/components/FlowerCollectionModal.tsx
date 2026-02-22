import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Sprout, Lock, HelpCircle, Palette } from "lucide-react";
import { supabase } from "../lib/supabase";
import { StitchFlower } from "../pomodoro/plantSystem/StitchPlant";
import type { PlantDNA, PomodoroStats } from "../pomodoro/types";
import LevelDisplay from "./LevelDisplay";
import { BACKGROUNDS } from "../config/backgrounds";
import { getLevelFromXp } from "../lib/progression";

interface CollectedFlower {
  id: string;
  count: number;
  definition: {
    name: string;
    description: string;
    rarity: string;
    dna: PlantDNA;
  };
  unlocked: boolean; // 🔥 NY: Håll koll på om vi har den
}

const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#10b981",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
  mythic: "#ef4444",
};

export default function FlowerCollectionModal({
  onClose,
  totalXp,
  selectedBackground,
  onSelectBackground,
  stats,
}: {
  onClose: () => void;
  totalXp: number;
  selectedBackground: string | null;
  onSelectBackground: (bg: string) => void;
  stats: PomodoroStats;
}) {
  const [flowers, setFlowers] = useState<CollectedFlower[]>([]);
  const [activeTab, setActiveTab] = useState<"flowers" | "backgrounds">(
    "flowers",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollection();
  }, []);

  const fetchCollection = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Hämta ALLA definitioner (Katalogen)
      const { data: definitions, error: defError } = await supabase
        .from("flower_definitions")
        .select("*");

      if (defError) throw defError;

      // 2. Hämta användarens samling
      const { data: userFlowers, error: userError } = await supabase
        .from("user_flowers")
        .select("flower_id, count")
        .eq("user_id", user.id);

      if (userError) throw userError;

      // 3. Merge: Skapa en lista med status för alla blommor
      const userFlowerMap = new Map(
        userFlowers?.map((uf) => [uf.flower_id, uf.count]),
      );

      const formatted: CollectedFlower[] = definitions.map((def: any) => ({
        id: def.id,
        count: userFlowerMap.get(def.id) || 0,
        definition: {
          name: def.name,
          description: def.description,
          rarity: def.rarity,
          dna: def.dna,
        },
        unlocked: userFlowerMap.has(def.id),
      }));

      // Sortera efter rarity (Mythic först)
      const rarityOrder = [
        "mythic",
        "legendary",
        "epic",
        "rare",
        "uncommon",
        "common",
      ];
      formatted.sort((a, b) => {
        // 1. Sortera på unlocked (upplåsta först)
        if (a.unlocked && !b.unlocked) return -1;
        if (!a.unlocked && b.unlocked) return 1;

        // 2. Sortera på rarity (Mythic först)
        return (
          rarityOrder.indexOf(a.definition.rarity) -
          rarityOrder.indexOf(b.definition.rarity)
        );
      });

      setFlowers(formatted);
    } catch (err) {
      console.error("Error fetching collection:", err);
    } finally {
      setLoading(false);
    }
  };

  const currentLevel = getLevelFromXp(totalXp);

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
        backdropFilter: "blur(5px)",
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1e1e24",
          border: "1px solid #333",
          borderRadius: "24px",
          width: "90%",
          maxWidth: "800px",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #333",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, color: "white", display: "flex", gap: 10 }}>
            <Sprout color="#10b981" /> Min Trädgård
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#888",
              cursor: "pointer",
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* 🔥 Level Header */}
        <div style={{ padding: "0 20px", marginTop: "20px" }}>
          <LevelDisplay totalXp={totalXp} />

          {/* 🔥 Stats Display */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "24px",
              marginTop: "16px",
              padding: "12px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  color: "#888",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                }}
              >
                Streak
              </span>
              <span
                style={{ fontSize: "18px", color: "#fff", fontWeight: 700 }}
              >
                {stats.streak} 🔥
              </span>
            </div>
            <div
              style={{ width: "1px", background: "rgba(255,255,255,0.1)" }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  color: "#888",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                }}
              >
                Totalt
              </span>
              <span
                style={{ fontSize: "18px", color: "#fff", fontWeight: 700 }}
              >
                {stats.completed}
              </span>
            </div>
          </div>
        </div>

        {/* 🔥 Tabs */}
        <div
          style={{
            display: "flex",
            padding: "0 20px",
            marginTop: "16px",
            gap: "12px",
          }}
        >
          <button
            onClick={() => setActiveTab("flowers")}
            style={{
              flex: 1,
              padding: "8px",
              background:
                activeTab === "flowers" ? "#6366f1" : "rgba(255,255,255,0.1)",
              border:
                activeTab === "flowers"
                  ? "1px solid #6366f1"
                  : "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Sprout size={16} /> Blommor
          </button>
          <button
            onClick={() => setActiveTab("backgrounds")}
            style={{
              flex: 1,
              padding: "8px",
              background:
                activeTab === "backgrounds"
                  ? "#6366f1"
                  : "rgba(255,255,255,0.1)",
              border:
                activeTab === "backgrounds"
                  ? "1px solid #6366f1"
                  : "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Palette size={16} /> Bakgrunder
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {activeTab === "flowers" ? (
            loading ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: 40,
                }}
              >
                <Loader2 className="animate-spin" color="#6366f1" />
              </div>
            ) : flowers.length === 0 ? (
              <div
                style={{ textAlign: "center", color: "#666", marginTop: 40 }}
              >
                Du har inte samlat några blommor än. Slutför en fokus-session
                för att hitta en!
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "16px",
                }}
              >
                {flowers.map((flower) => (
                  <div
                    key={flower.id}
                    style={{
                      background: flower.unlocked
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(0,0,0,0.2)",
                      borderRadius: "16px",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      border: `1px solid ${flower.unlocked ? RARITY_COLORS[flower.definition.rarity] : "#333"}40`,
                      position: "relative",
                      opacity: flower.unlocked ? 1 : 0.6,
                    }}
                  >
                    <div
                      style={{
                        width: "100px",
                        height: "100px",
                        marginBottom: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {flower.unlocked ? (
                        <StitchFlower
                          progress={0}
                          status="work"
                          dna={flower.definition.dna}
                        />
                      ) : (
                        <div style={{ color: "#444" }}>
                          <HelpCircle size={48} strokeWidth={1.5} />
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        fontWeight: 600,
                        color: "white",
                        fontSize: "14px",
                        textAlign: "center",
                      }}
                    >
                      {flower.unlocked ? flower.definition.name : "???"}
                    </div>

                    <div
                      style={{
                        fontSize: "10px",
                        color: flower.unlocked
                          ? RARITY_COLORS[flower.definition.rarity]
                          : "#666",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        marginTop: "4px",
                      }}
                    >
                      {flower.definition.rarity}
                    </div>

                    {flower.unlocked && (
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          background: "rgba(0,0,0,0.5)",
                          color: "white",
                          fontSize: "10px",
                          padding: "2px 6px",
                          borderRadius: "8px",
                        }}
                      >
                        x{flower.count}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            // 🔥 BACKGROUNDS TAB
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: "16px",
              }}
            >
              {BACKGROUNDS.map((bg) => {
                const isUnlocked = currentLevel >= bg.level;
                const isSelected =
                  selectedBackground === bg.value ||
                  (!selectedBackground &&
                    isUnlocked &&
                    bg.level ===
                      Math.max(
                        ...BACKGROUNDS.filter(
                          (b) => currentLevel >= b.level,
                        ).map((b) => b.level),
                      ));

                return (
                  <div
                    key={bg.level}
                    onClick={() => isUnlocked && onSelectBackground(bg.value)}
                    style={{
                      height: "100px",
                      borderRadius: "12px",
                      background: bg.value,
                      position: "relative",
                      cursor: isUnlocked ? "pointer" : "not-allowed",
                      border: isSelected // 🔥 Tydligare border
                        ? "2px solid #6366f1"
                        : "1px solid rgba(255,255,255,0.2)",
                      opacity: isUnlocked ? 1 : 0.5,
                      boxShadow: isSelected
                        ? "0 0 15px rgba(99, 102, 241, 0.5)"
                        : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                    }}
                  >
                    {!isUnlocked && (
                      <div
                        style={{
                          background: "rgba(0,0,0,0.6)",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Lock size={12} color="#fff" />
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#fff",
                            fontWeight: "bold",
                          }}
                        >
                          Lvl {bg.level}
                        </span>
                      </div>
                    )}

                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: "8px",
                        background: "rgba(0,0,0,0.5)",
                        borderBottomLeftRadius: "10px",
                        borderBottomRightRadius: "10px",
                        fontSize: "11px",
                        color: "white",
                        textAlign: "center",
                      }}
                    >
                      {bg.name}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

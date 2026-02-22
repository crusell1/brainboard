import React, { useMemo } from "react";
import { getPlant } from "./registry";
import type { PomodoroStatus, PlantDNA } from "../types";

interface PlantRendererProps {
  plantId: string;
  progress: number; // 0.0 till 1.0
  status: PomodoroStatus;
  dna?: PlantDNA; // 🔥 NY: Ta emot DNA
}

const PlantRenderer: React.FC<PlantRendererProps> = ({
  plantId,
  progress,
  status,
  dna,
}) => {
  const plant = useMemo(() => getPlant(plantId), [plantId]);
  const safeProgress = typeof progress === "number" ? progress : 1;

  // 1. Beräkna stage index ALLTID (för att inte bryta Rules of Hooks)
  // Logik för att mappa progress (0-100%) till stadier (0-5)
  const currentStageIndex = useMemo(() => {
    if (status === "idle") return 0;

    const totalStages = plant.stages.length - 1;

    // Under BREAK: Vissna tillbaka (1.0 -> 0.0)
    if (status === "break") {
      const stage = Math.floor(safeProgress * totalStages);
      return Math.min(stage, totalStages);
    }

    // Under WORK: Väx upp (0.0 -> 1.0)
    const growthProgress = 1 - safeProgress;
    const stage = Math.floor(growthProgress * totalStages);
    return Math.min(stage, totalStages);
  }, [safeProgress, status, plant.stages.length]);

  // 2. Nu kan vi göra conditional return
  if (plant.renderContinuous) {
    return (
      <div style={{ width: "100%", height: "100%" }}>
        {plant.renderContinuous(safeProgress, status, dna)}{" "}
        {/* 🔥 Skicka vidare DNA */}
      </div>
    );
  }

  const stageContent = plant.stages[currentStageIndex]?.render || null;

  return (
    <div
      className="plant-container"
      style={{
        width: "100%",
        height: "120px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.5s ease-in-out",
        opacity: status === "paused" ? 0.5 : 1,
        filter: status === "break" ? "grayscale(0.8)" : "none",
      }}
    >
      {stageContent}
    </div>
  );
};

export default PlantRenderer;

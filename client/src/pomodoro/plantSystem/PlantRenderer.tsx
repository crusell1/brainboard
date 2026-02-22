import React, { useMemo } from "react";
import { getPlant } from "./registry";
import type { PomodoroStatus } from "../types";

interface PlantRendererProps {
  plantId: string;
  progress: number; // 0.0 till 1.0
  status: PomodoroStatus;
}

const PlantRenderer: React.FC<PlantRendererProps> = ({
  plantId,
  progress,
  status,
}) => {
  const plant = useMemo(() => getPlant(plantId), [plantId]);

  // Logik för att mappa progress (0-100%) till stadier (0-5)
  const currentStageIndex = useMemo(() => {
    if (status === "idle") return 0;

    const totalStages = plant.stages.length - 1;

    // Under BREAK: Vissna tillbaka (1.0 -> 0.0)
    // Progress går från 1.0 (start av rast) till 0.0 (slut av rast).
    // Vi mappar detta direkt så att full progress = full växt, 0 progress = frö.
    if (status === "break") {
      const stage = Math.floor(progress * totalStages);
      return Math.min(stage, totalStages);
    }

    // Under WORK: Väx upp (0.0 -> 1.0)
    // Progress går från 1.0 (start) till 0.0 (slut).
    // Vi vänder på det: 1 - progress.
    const growthProgress = 1 - progress;
    const stage = Math.floor(growthProgress * totalStages);
    return Math.min(stage, totalStages);
  }, [progress, status, plant.stages.length]);

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

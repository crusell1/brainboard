import React from "react";
import type { Node } from "@xyflow/react"; // Flyttad till toppen

export type PomodoroStatus = "idle" | "work" | "break" | "paused";

export interface PomodoroStats {
  completed: number;
  streak: number;
  totalMinutes: number;
  pendingDna?: PlantDNA; // 🔥 NY: Lagra nästa blomma här under rasten
}

export type PomodoroData = {
  status: PomodoroStatus;
  startTime?: number;
  pausedTime?: number;
  duration?: number;
  plantId?: string;
  plantDna?: PlantDNA; // 🔥 NY: Spara blommans DNA på noden
  currentFlower?: {
    // 🔥 NY: Spara info om nuvarande blomma
    id: string;
    name: string;
    rarity: string;
    description: string;
  };
  stats?: PomodoroStats;
  currentUserEmail?: string; // För dev-tools
  onDelete?: (id: string) => void;
  onResize?: (
    id: string,
    width: number,
    height: number,
    x?: number,
    y?: number,
  ) => void;
  onResizeStart?: (id: string) => void;
  onResizeEnd?: (
    id: string,
    width: number,
    height: number,
    x?: number,
    y?: number,
  ) => void;
  onDataChange?: (id: string, data: Partial<PomodoroData>) => void;
};

// 🔥 NY: DNA-struktur för parametriska blommor (matchar databasen)
export interface PlantDNA {
  color: string;
  centerColor: string;
  petals: number;
  petalShape:
    | "round"
    | "spiky"
    | "heart"
    | "cup"
    | "tiny"
    | "long"
    | "wave"
    | "layered"
    | "star"
    | "exotic"
    | "pointed"
    | "notched";
  stemHeight: number;
  leafType:
    | "simple"
    | "jagged"
    | "round"
    | "clover"
    | "long"
    | "thin"
    | "large"
    | "rose"
    | "thick"
    | "water"
    | "branch"
    | "gold";
}

export interface PlantStage {
  stageIndex: number;
  render: React.ReactNode;
}

export interface PlantDefinition {
  id: string;
  name: string;
  stages: PlantStage[];
  // 🔥 NY: För steglös rendering baserat på progress (0-1)
  renderContinuous?: (
    progress: number,
    status: PomodoroStatus,
    dna?: PlantDNA | null, // 🔥 Uppdatera typen här också
  ) => React.ReactNode;
}

export type PomodoroNodeType = Node<PomodoroData, "pomodoro">;

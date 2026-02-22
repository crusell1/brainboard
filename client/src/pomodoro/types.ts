import React from "react";
import type { Node } from "@xyflow/react";

export type PomodoroStatus = "idle" | "work" | "break" | "paused";

export interface PomodoroStats {
  completed: number;
  streak: number;
  totalMinutes: number;
}

// Ändrat till type för bättre kompatibilitet med Node<T>
export type PomodoroData = {
  status: PomodoroStatus;
  startTime?: number;
  pausedTime?: number;
  duration: number;
  plantId: string;
  stats: PomodoroStats;
  currentUserEmail?: string; // 🔥 För att identifiera användaren (Debug-meny)
  // Callbacks
  onDataChange?: (nodeId: string, data: Partial<PomodoroData>) => void;
  onDelete?: (nodeId: string) => void;
  onResize?: (
    nodeId: string,
    width: number,
    height: number,
    x?: number,
    y?: number,
  ) => void;
  onResizeStart?: (nodeId: string) => void;
  onResizeEnd?: (
    nodeId: string,
    width: number,
    height: number,
    x?: number,
    y?: number,
  ) => void;
};

// Definiera nod-typen explicit
export type PomodoroNodeType = Node<PomodoroData, "pomodoro">;

export interface PlantStage {
  stageIndex: number;
  render: React.ReactNode;
}

export interface PlantDefinition {
  id: string;
  name: string;
  stages: PlantStage[];
}

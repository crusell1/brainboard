import type { Node } from "@xyflow/react";

export type HabitResetRule = "none" | "daily" | "weekly" | "monthly";

// Frontend-vänlig typ (camelCase) som används i komponenterna
export type HabitItem = {
  id: string;
  nodeId: string;
  content: string;
  isCompleted: boolean;
  completedAt?: string | null;
  sortOrder: number;
  resetRule: HabitResetRule;
  resetDays?: number[] | null;
  streakCurrent: number;
  streakLongest: number;
  streakLastCompletedAt?: string | null;
  lastResetAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

// Data-prop för React Flow-noden
// VIKTIGT: Ändrat från interface till type för att lösa "Index signature is missing"-felet
export type ChecklistNodeData = {
  boardId: string; // 🔥 NY: Krävs för att skapa items
  title: string;
  // Handlers som skickas ner från Canvas.tsx
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
  onTitleChange?: (id: string, title: string) => void;
};

export type ChecklistNodeType = Node<ChecklistNodeData, "checklist">;

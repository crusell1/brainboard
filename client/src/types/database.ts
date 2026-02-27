export interface Note {
  id: string;
  user_id: string;
  board_id: string; // 🔥 FIX: Denna saknades!
  position_x: number;
  position_y: number;
  content: string;
  type: string;
  title?: string;
  width?: number;
  height?: number;
  color?: string;
  created_at: string;
  updated_at: string;
}

// En hjälp-typ för när vi skapar nya noder (då har vi inte ID eller datum än)
export interface NewNote {
  position_x: number;
  position_y: number;
  content: string;
}

export interface DbEdge {
  id: string;
  user_id: string;
  source: string;
  target: string;
  source_handle?: string | null;
  target_handle?: string | null;
  created_at: string;
}

export interface DbDrawing {
  id: string;
  user_id: string;
  points: any; // JSONB från databasen
  color: string;
  width: number;
  created_at: string;
}

export type HabitResetRuleDb = "none" | "daily" | "weekly" | "monthly";

export interface DbHabitItem {
  id: string;
  node_id: string;
  user_id: string;
  board_id: string;
  content: string;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  reset_rule: HabitResetRuleDb;
  reset_days: number[] | null;
  streak_current: number;
  streak_longest: number;
  streak_last_completed_at: string | null;
  last_reset_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
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

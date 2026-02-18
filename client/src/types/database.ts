export interface Note {
  id: string;
  user_id: string;
  position_x: number;
  position_y: number;
  content: string;
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
  created_at: string;
}

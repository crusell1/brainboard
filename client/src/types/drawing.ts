export type Point = {
  x: number;
  y: number;
};

export type Drawing = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  createdAt: number;
};

interface InitAction {
  type: "init";
  image: string;
}

export interface DrawAction {
  type: "draw";
  points: { x: number; y: number }[];
  color: string;
  brushSize: number;
}

export interface FillAction {
  type: "fill";
  x: number;
  y: number;
  color: string;
}

interface ClearAction {
  type: "clear";
}

export type CanvasAction = InitAction | DrawAction | FillAction | ClearAction;

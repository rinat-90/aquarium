export type Vector2 = {
  x: number;
  y: number;
};

export type FishDirection =
  | 'left'
  | 'right';

export type FishBehavior =
  | 'wandering'
  | 'seeking-food';

export type Fish = {
  id: string;

  position: Vector2;
  velocity: Vector2;
  target: Vector2;

  speed: number;
  direction: FishDirection;

  behavior: FishBehavior;
  targetFoodId?: string;
};

export type Food = {
  id: string;
  position: Vector2;

  sinkSpeed: number;
};
export type Vector2 = {
  x: number;
  y: number;
};

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type FishDirection =
  | 'left'
  | 'right';

export type FishBehavior =
  | 'wandering'
  | 'seeking-food';

export type Fish = {
  id: string;

  position: Vector3;
  velocity: Vector3;
  target: Vector3;

  speed: number;
  direction: FishDirection;

  behavior: FishBehavior;
  targetFoodId?: string;
};

export type Food = {
  id: string;

  position: Vector3;

  sinkSpeed: number;
};
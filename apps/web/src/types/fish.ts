type DrawnFish = {
  id: string;
  type: 'drawn';
  image: string;
  size: number;
  name: string;
  createdAt: string;
  headDirection?: 'left' | 'right' | null;
};

type ThreeDFish = {
  id: string;
  type: '3d';
  model?: 'basic' | 'classic' | 'angelfish' | 'guppy' | 'finny';
  bodyColor: string;
  finColor: string;
  paintImage?: string;
  size: number;
  name: string;
  createdAt: string;
};

export type CreatedFish = DrawnFish | ThreeDFish;

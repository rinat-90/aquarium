type DrawnFish = {
  id: string;
  type: 'drawn';
  image: string;
  size: number;
  name: string;
  createdAt: string;
};

type ThreeDFish = {
  id: string;
  type: '3d';
  model?: 'basic' | 'classic' | 'angelfish' | 'guppy';
  bodyColor: string;
  finColor: string;
  paintImage?: string;
  size: number;
  name: string;
  createdAt: string;
};

export type CreatedFish = DrawnFish | ThreeDFish;
export type AquariumBackground =
  | 'ocean'
  | 'coral'
  | 'deep-sea'
  | 'fantasy';

export type AquariumSubstrate =
  | 'sand'
  | 'pebbles'
  | 'dark-gravel'
  | 'white-sand';

export type AquariumDecoration =
  | 'rocks'
  | 'driftwood'
  | 'green-plants'
  | 'red-coral'
  | 'cave';

export type AquariumLighting = 'sunny' | 'soft' | 'night';

export type AquariumBubbles = 'none' | 'some' | 'lots';

export type AquariumCustomization = {
  background: AquariumBackground;
  substrate: AquariumSubstrate;
  decorations: AquariumDecoration[];
  decorationInstances: AquariumDecorationInstance[];
  lighting: AquariumLighting;
  bubbles: AquariumBubbles;
};

export const DEFAULT_AQUARIUM_CUSTOMIZATION: AquariumCustomization = {
  background: 'ocean',
  substrate: 'sand',
  decorations: [],
  decorationInstances: [],
  lighting: 'soft',
  bubbles: 'some',
};


export type AquariumDecorationAssetId =
  | 'rocks'
  | 'seaweed'
  | 'coral';

export type AquariumDecorationInstance = {
  id: string;
  assetId: AquariumDecorationAssetId;

  // Normalized horizontal position, 0 = left, 1 = right.
  x: number;

  // Relative position along the seabed.
  // 0 = back, 1 = front.
  depth: number;

  scale: number;
  rotation: number;
  color?: string;
};

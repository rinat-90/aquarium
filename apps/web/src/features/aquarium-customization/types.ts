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
  lighting: AquariumLighting;
  bubbles: AquariumBubbles;
};

export const DEFAULT_AQUARIUM_CUSTOMIZATION: AquariumCustomization = {
  background: 'ocean',
  substrate: 'sand',
  decorations: [],
  lighting: 'soft',
  bubbles: 'some',
};
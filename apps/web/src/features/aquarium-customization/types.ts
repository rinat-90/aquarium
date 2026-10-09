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

export type AquariumCustomization = {
  background: AquariumBackground;
  substrate: AquariumSubstrate;
  decorations: AquariumDecoration[];
};

export const DEFAULT_AQUARIUM_CUSTOMIZATION: AquariumCustomization = {
  background: 'ocean',
  substrate: 'sand',
  decorations: [],
};
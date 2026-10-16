export type FishSpeciesId = 'classic' | 'angelfish' | 'guppy' | 'finny';

export type FishAccess = 'free' | 'premium';

export type FishSpeciesDefinition = {
  id: FishSpeciesId;
  name: string;
  access: FishAccess;
  packId?: string;
  previewOnly?: boolean;
};

export const FISH_SPECIES: Record<FishSpeciesId, FishSpeciesDefinition> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    access: 'free',
  },
  angelfish: {
    id: 'angelfish',
    name: 'Angelfish',
    access: 'free',
  },
  guppy: {
    id: 'guppy',
    name: 'Guppy',
    access: 'premium',
    packId: 'colorful-fish-pack',
  },
  finny: {
    id: 'finny',
    name: 'Finny',
    access: 'free',
    previewOnly: true,
  },
};

export const FISH_SPECIES_LIST = Object.values(FISH_SPECIES);

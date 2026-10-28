export const FISH_TEMPLATES = [
  { id: 'clownfish', name: 'Clownfish' },
  { id: 'angelfish', name: 'Angelfish' },
  { id: 'goldfish', name: 'Goldfish' },
  { id: 'blue-tang', name: 'Blue Tang' },
  { id: 'betta', name: 'Betta' },
  { id: 'guppy', name: 'Guppy' },
] as const;

export type FishTemplateId = (typeof FISH_TEMPLATES)[number]['id'];

export function getFishTemplateAssets(id: FishTemplateId) {
  return {
    reference: `/fish-templates/references/${id}.png`,
    mask: `/fish-templates/masks/${id}.png`,
  };
}

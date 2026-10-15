import type { AquariumDecorationAssetId } from './types';

export type DecorationAssetDefinition = {
  id: AquariumDecorationAssetId;
  name: string;
  category: 'plants' | 'rocks' | 'coral';
  defaultColor: string;
  defaultScale: number;
  minScale: number;
  maxScale: number;
};

export const DECORATION_REGISTRY: Record<AquariumDecorationAssetId, DecorationAssetDefinition> = {
  rocks: {
    id: 'rocks',
    name: 'Ocean Rocks',
    category: 'rocks',
    defaultColor: '#739fc8',
    defaultScale: 0.9,
    minScale: 0.5,
    maxScale: 1.8,
  },

  seaweed: {
    id: 'seaweed',
    name: 'Wavy Seaweed',
    category: 'plants',
    defaultColor: '#43ca78',
    defaultScale: 0.85,
    minScale: 0.5,
    maxScale: 1.6,
  },

  coral: {
    id: 'coral',
    name: 'Pink Coral',
    category: 'coral',
    defaultColor: '#ff83a9',
    defaultScale: 1,
    minScale: 0.5,
    maxScale: 1.8,
  },
};

export const DECORATION_CATEGORIES = [
  { id: 'plants', label: '🌿 Plants' },
  { id: 'rocks', label: '🪨 Rocks' },
  { id: 'coral', label: '🪸 Coral' },
] as const;

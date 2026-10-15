import { getPublishedThemeScenery } from './publishedScenery';
import type { AquariumCustomization } from './types';
import type { ThemeAsset } from '../../components/Aquarium3D/environment/createThemeScenery.ts';

type ThemeInstance = {
  id: string;
  assetId: ThemeAsset;
  x: number;
  depth: number;
  scale: number;
  rotation: number;
  color?: string;
};

// Themes are content definitions, not rendering logic. Future packs can be
// delivered through the same registry without changing the editor UI.
export type AquariumTheme = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  gradient: string;
  packId: string;
  access: 'free' | 'premium';
  appearance: Pick<AquariumCustomization, 'background' | 'substrate' | 'lighting' | 'bubbles'>;
};

export const AQUARIUM_THEMES: readonly AquariumTheme[] = [
  {
    id: 'sunny-reef',
    name: 'Sunny Reef',
    description: 'Bright and bubbly',
    emoji: '🐠',
    gradient: 'linear-gradient(145deg,#3ed6d0,#0871a7 65%,#073e70)',
    packId: 'starter',
    access: 'free',
    appearance: {
      background: 'coral',
      substrate: 'white-sand',
      lighting: 'sunny',
      bubbles: 'lots',
    },
  },
  {
    id: 'ocean-garden',
    name: 'Ocean Garden',
    description: 'Peaceful blue waters',
    emoji: '🌿',
    gradient: 'linear-gradient(145deg,#55bfd3,#146a9e 60%,#06294f)',
    packId: 'starter',
    access: 'free',
    appearance: { background: 'ocean', substrate: 'sand', lighting: 'soft', bubbles: 'some' },
  },
  {
    id: 'midnight-sea',
    name: 'Midnight Sea',
    description: 'A magical night',
    emoji: '🌙',
    gradient: 'linear-gradient(145deg,#374f9d,#152651 55%,#030b21)',
    packId: 'starter',
    access: 'free',
    appearance: {
      background: 'deep-sea',
      substrate: 'dark-gravel',
      lighting: 'night',
      bubbles: 'some',
    },
  },
  {
    id: 'magic-lagoon',
    name: 'Magic Lagoon',
    description: 'A dreamy underwater world',
    emoji: '✨',
    gradient: 'linear-gradient(145deg,#c287ee,#694cb8 55%,#1d1c61)',
    packId: 'starter',
    access: 'free',
    appearance: { background: 'fantasy', substrate: 'pebbles', lighting: 'soft', bubbles: 'lots' },
  },
];

// Preserve hand-placed decorations when applying a theme. Theme selection
// changes the environment only; kids never lose their creations accidentally.
export function applyAquariumTheme(
  current: AquariumCustomization,
  theme: AquariumTheme,
): AquariumCustomization {
  return { ...current, ...theme.appearance, themeId: theme.id };
}

// Explicit theme IDs persist independently of the individual environment settings.
// Legacy appearances without themeId retain their Sunny Reef scenery if they
// exactly match the original preset. An explicit null disables theme scenery.
export function isAquariumThemeSelected(
  appearance: AquariumCustomization,
  theme: AquariumTheme,
): boolean {
  if (appearance.themeId !== undefined) return appearance.themeId === theme.id;
  return Object.entries(theme.appearance).every(
    ([key, setting]) => appearance[key as keyof typeof theme.appearance] === setting,
  );
}

export function getAquariumThemeScenery(appearance: AquariumCustomization): ThemeInstance[] {
  const published = getPublishedThemeScenery(appearance.themeId);
  if (published) return published;

  const themeId =
    appearance.themeId === undefined
      ? isAquariumThemeSelected(appearance, AQUARIUM_THEMES[0])
        ? 'sunny-reef'
        : null
      : appearance.themeId;
  if (themeId === 'sunny-reef')
    return [
      {
        id: 'reef-arch-left',
        assetId: 'reef-arch',
        x: 0.17,
        depth: 0.5,
        scale: 1.3,
        rotation: -0.12,
        color: '#9e94a4',
      },
      {
        id: 'reef-fan-pink',
        assetId: 'reef-fan',
        x: 0.32,
        depth: 0.5,
        scale: 1.4,
        rotation: 0.12,
        color: '#ff729e',
      },
      {
        id: 'reef-fan-orange',
        assetId: 'reef-fan',
        x: 0.72,
        depth: 0.5,
        scale: 1.2,
        rotation: -0.2,
        color: '#ffab5d',
      },
      {
        id: 'reef-arch-right',
        assetId: 'reef-arch',
        x: 0.88,
        depth: 0.5,
        scale: 1.1,
        rotation: 0.15,
        color: '#b7a1ad',
      },
    ];
  if (themeId === 'ocean-garden')
    return [
      {
        id: 'garden-kelp-left',
        assetId: 'kelp',
        x: 0.13,
        depth: 0.5,
        scale: 1.35,
        rotation: -0.08,
        color: '#2ca986',
      },
      {
        id: 'garden-grass-left',
        assetId: 'seagrass',
        x: 0.29,
        depth: 0.5,
        scale: 1.1,
        rotation: 0,
        color: '#75d99d',
      },
      {
        id: 'garden-kelp-center',
        assetId: 'kelp',
        x: 0.49,
        depth: 0.5,
        scale: 1.12,
        rotation: 0.1,
        color: '#278a7a',
      },
      {
        id: 'garden-grass-right',
        assetId: 'seagrass',
        x: 0.7,
        depth: 0.5,
        scale: 1.2,
        rotation: 0.1,
        color: '#55c9a0',
      },
      {
        id: 'garden-kelp-right',
        assetId: 'kelp',
        x: 0.87,
        depth: 0.5,
        scale: 1.4,
        rotation: 0.12,
        color: '#3ab28c',
      },
    ];
  if (themeId === 'midnight-sea')
    return [
      {
        id: 'midnight-kelp-left',
        assetId: 'kelp',
        x: 0.12,
        depth: 0.5,
        scale: 1.3,
        rotation: -0.1,
        color: '#276b85',
      },
      {
        id: 'midnight-glow-left',
        assetId: 'glow-plant',
        x: 0.28,
        depth: 0.5,
        scale: 1.2,
        rotation: 0.1,
        color: '#4de4db',
      },
      {
        id: 'midnight-glow-center',
        assetId: 'glow-plant',
        x: 0.55,
        depth: 0.5,
        scale: 1.5,
        rotation: -0.12,
        color: '#7b8dff',
      },
      {
        id: 'midnight-grass-right',
        assetId: 'seagrass',
        x: 0.72,
        depth: 0.5,
        scale: 1.1,
        rotation: 0.1,
        color: '#387f98',
      },
      {
        id: 'midnight-glow-right',
        assetId: 'glow-plant',
        x: 0.89,
        depth: 0.5,
        scale: 1.4,
        rotation: 0.12,
        color: '#56d6e9',
      },
    ];
  if (themeId === 'magic-lagoon')
    return [
      {
        id: 'lagoon-mushroom-left',
        assetId: 'glow-mushroom',
        x: 0.13,
        depth: 0.5,
        scale: 1.4,
        rotation: -0.08,
        color: '#ff7bbd',
      },
      {
        id: 'lagoon-glow-left',
        assetId: 'glow-plant',
        x: 0.29,
        depth: 0.5,
        scale: 1.2,
        rotation: 0.1,
        color: '#6af5e3',
      },
      {
        id: 'lagoon-mushroom-center',
        assetId: 'glow-mushroom',
        x: 0.52,
        depth: 0.5,
        scale: 1.6,
        rotation: 0,
        color: '#e68bff',
      },
      {
        id: 'lagoon-glow-right',
        assetId: 'glow-plant',
        x: 0.72,
        depth: 0.5,
        scale: 1.3,
        rotation: -0.1,
        color: '#8fe8ff',
      },
      {
        id: 'lagoon-mushroom-right',
        assetId: 'glow-mushroom',
        x: 0.88,
        depth: 0.5,
        scale: 1.2,
        rotation: 0.12,
        color: '#ff9cda',
      },
    ];
  return [];
}

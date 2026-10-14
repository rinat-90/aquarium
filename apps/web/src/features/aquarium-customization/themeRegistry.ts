import type { AquariumCustomization, AquariumDecorationInstance } from './types.ts';

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
    id: 'sunny-reef', name: 'Sunny Reef', description: 'Bright and bubbly',
    emoji: '🐠', gradient: 'linear-gradient(145deg,#3ed6d0,#0871a7 65%,#073e70)',
    packId: 'starter', access: 'free',
    appearance: { background: 'coral', substrate: 'white-sand', lighting: 'sunny', bubbles: 'lots' },
  },
  {
    id: 'ocean-garden', name: 'Ocean Garden', description: 'Peaceful blue waters',
    emoji: '🌿', gradient: 'linear-gradient(145deg,#55bfd3,#146a9e 60%,#06294f)',
    packId: 'starter', access: 'free',
    appearance: { background: 'ocean', substrate: 'sand', lighting: 'soft', bubbles: 'some' },
  },
  {
    id: 'midnight-sea', name: 'Midnight Sea', description: 'A magical night',
    emoji: '🌙', gradient: 'linear-gradient(145deg,#374f9d,#152651 55%,#030b21)',
    packId: 'starter', access: 'free',
    appearance: { background: 'deep-sea', substrate: 'dark-gravel', lighting: 'night', bubbles: 'some' },
  },
  {
    id: 'magic-lagoon', name: 'Magic Lagoon', description: 'A dreamy underwater world',
    emoji: '✨', gradient: 'linear-gradient(145deg,#c287ee,#694cb8 55%,#1d1c61)',
    packId: 'starter', access: 'free',
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

export function getSunnyReefScenery(
  appearance: AquariumCustomization,
): AquariumDecorationInstance[] {
  const reef = AQUARIUM_THEMES.find((theme) => theme.id === 'sunny-reef');
  if (!reef || !isAquariumThemeSelected(appearance, reef)) return [];

  return [
    { id: 'theme-sunny-reef-rock-left', assetId: 'rocks', x: 0.11, depth: 0.5, scale: 1.12, rotation: -0.25, color: '#8cabc2' },
    { id: 'theme-sunny-reef-coral-left', assetId: 'coral', x: 0.19, depth: 0.5, scale: 1.08, rotation: 0.22, color: '#ff839b' },
    { id: 'theme-sunny-reef-seaweed-left', assetId: 'seaweed', x: 0.29, depth: 0.5, scale: 0.88, rotation: -0.1, color: '#43ca78' },
    { id: 'theme-sunny-reef-rock-right', assetId: 'rocks', x: 0.86, depth: 0.5, scale: 1.22, rotation: 0.32, color: '#a3a9d5' },
    { id: 'theme-sunny-reef-coral-right', assetId: 'coral', x: 0.79, depth: 0.5, scale: 1.1, rotation: -0.28, color: '#ffb16e' },
    { id: 'theme-sunny-reef-seaweed-right', assetId: 'seaweed', x: 0.7, depth: 0.5, scale: 0.92, rotation: 0.12, color: '#55d6a0' },
  ];
}

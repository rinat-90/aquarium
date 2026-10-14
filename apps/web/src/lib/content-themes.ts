import type { AquariumTheme } from '../features/aquarium-customization/themeRegistry';
import { AQUARIUM_THEMES } from '../features/aquarium-customization/themeRegistry';
import { apiFetch } from './api-client';

type PublishedTheme = {
  type: 'THEME';
  slug: string;
  name: string;
  definition: {
    id: string;
    name: string;
    emoji?: string;
    appearance: AquariumTheme['appearance'];
  };
};

// Only built-in theme IDs have an established appearance and supported renderer.
// The API remains the source of truth for which themes are published.
const supportedThemes = AQUARIUM_THEMES;

export const FALLBACK_THEMES: readonly AquariumTheme[] = supportedThemes;

export async function fetchPublishedThemes(): Promise<readonly AquariumTheme[]> {
  const response = await apiFetch<{ items: PublishedTheme[] }>('/content?type=THEME');
  if (!Array.isArray(response?.items)) throw new Error('Invalid theme catalog');

  const themes: AquariumTheme[] = [];
  for (const item of response.items) {
    const builtIn = supportedThemes.find((theme) => theme.id === item.slug);
    // A published theme without renderer support should not appear yet.
    if (!builtIn || item.type !== 'THEME' || item.definition?.id !== item.slug) continue;
    const appearance = item.definition.appearance;
    if (!appearance || !['ocean','coral','deep-sea','fantasy'].includes(appearance.background)
      || !['sand','white-sand','pebbles','dark-gravel'].includes(appearance.substrate)
      || !['sunny','soft','night'].includes(appearance.lighting)
      || !['none','some','lots'].includes(appearance.bubbles)) continue;
    themes.push({
      ...builtIn,
      name: item.name,
      emoji: item.definition.emoji || builtIn.emoji,
      appearance,
    });
  }
  return themes;
}

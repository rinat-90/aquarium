import { apiFetch } from '../../lib/api-client';
import type { AquariumTheme } from './themeRegistry';

export type PublishedSceneryInstance = {
  id: string;
  assetId: 'reef-fan' | 'reef-arch' | 'kelp' | 'seagrass' | 'glow-plant';
  x: number;
  depth: number;
  scale: number;
  rotation: number;
  color?: string;
};

type CatalogItem = {
  type?: unknown;
  slug?: unknown;
  schemaVersion?: unknown;
  definition?: unknown;
};

const supportedAssets = new Set(['reef-fan', 'reef-arch', 'kelp', 'seagrass', 'glow-plant']);
const listeners = new Set<() => void>();
const scenery = new Map<string, PublishedSceneryInstance[]>();
let pending: Promise<void> | null = null;
let loaded = false;

function validInstance(value: unknown): value is PublishedSceneryInstance {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && v.id.length > 0
    && typeof v.assetId === 'string' && supportedAssets.has(v.assetId)
    && typeof v.x === 'number' && Number.isFinite(v.x) && v.x >= 0 && v.x <= 1
    && typeof v.depth === 'number' && Number.isFinite(v.depth) && v.depth >= 0 && v.depth <= 1
    && typeof v.scale === 'number' && Number.isFinite(v.scale) && v.scale > 0 && v.scale <= 5
    && typeof v.rotation === 'number' && Number.isFinite(v.rotation)
    && (v.color === undefined || (typeof v.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.color)));
}

function validScenery(value: unknown): value is PublishedSceneryInstance[] {
  return Array.isArray(value) && value.length <= 30 && value.every(validInstance)
    && new Set(value.map((instance: PublishedSceneryInstance) => instance.id)).size === value.length;
}

/** Load once after success; retry on a later mount if the API was unavailable. */
export function loadPublishedScenery(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const response = await apiFetch<{ items: CatalogItem[] }>('/content?type=THEME');
    if (!Array.isArray(response?.items)) throw new Error('Invalid theme catalog');
    const next = new Map<string, PublishedSceneryInstance[]>();
    for (const item of response.items) {
      if (item.type !== 'THEME' || typeof item.slug !== 'string') continue;
      const definition = item.definition;
      if (!definition || typeof definition !== 'object') continue;
      const data = definition as Record<string, unknown>;
      if (data.schemaVersion !== 2 || data.id !== item.slug || !validScenery(data.scenery)) continue;
      next.set(item.slug, data.scenery);
    }
    scenery.clear();
    for (const [id, instances] of next) scenery.set(id, instances);
    loaded = true;
    listeners.forEach((notify) => notify());
  })().catch((error: unknown) => {
    console.warn('Using built-in aquarium scenery:', error);
  }).finally(() => { pending = null; });
  return pending;
}

export function subscribeToPublishedScenery(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Undefined means use the existing built-in layout. An empty array is intentional. */
export function getPublishedThemeScenery(themeId: AquariumTheme['id'] | null | undefined): PublishedSceneryInstance[] | undefined {
  return themeId ? scenery.get(themeId) : undefined;
}

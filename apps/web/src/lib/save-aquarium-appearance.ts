import { apiFetch } from './api-client';
import type { AquariumCustomization } from '../features/aquarium-customization/types';
import type { ApiAquarium } from './aquarium-api';

/** Persist a complete, validated appearance through the existing PATCH route. */
export function saveAquariumAppearance(id: string, appearance: AquariumCustomization) {
  return apiFetch<ApiAquarium>(`/aquariums/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ appearance }),
  });
}


import { apiFetch } from './api-client';

export type ApiFish = {
  id: string;
  name: string;
  species: string;
  bodyColor: string;
  finColor: string;
  paintKey: string | null;
  size: number;
  ownerId: string;
  aquariumId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiAquarium = {
  id: string;
  name: string;
  ownerId: string;
  themeId: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  fish: ApiFish[];
};

export const aquariumApi = {
  list: () =>
    apiFetch<ApiAquarium[]>('/aquariums'),

  get: (id: string) =>
    apiFetch<ApiAquarium>(
      `/aquariums/${encodeURIComponent(id)}`,
    ),

  create: (name: string) =>
    apiFetch<ApiAquarium>('/aquariums', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
};

export const fishApi = {
  list: () =>
    apiFetch<ApiFish[]>('/fish'),

  create: (data: {
    name: string;
    species: 'classic' | 'angelfish';
    bodyColor: string;
    finColor: string;
    size: number;
    aquariumId?: string;
  }) =>
    apiFetch<ApiFish>('/fish', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    id: string,
    data: Partial<{
      name: string;
      bodyColor: string;
      finColor: string;
      size: number;
      aquariumId: string | null;
    }>,
  ) =>
    apiFetch<ApiFish>(
      `/fish/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    ),

  remove: (id: string) =>
    apiFetch<void>(
      `/fish/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};

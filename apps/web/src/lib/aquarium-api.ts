
import { apiFetch } from './api-client';

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export type FishSpecies = 'classic' | 'angelfish' | 'drawn';

export type ApiFish = {
  id: string;
  name: string;
  species: FishSpecies;
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

export type CreateFishInput = {
  name: string;
  species: FishSpecies;
  bodyColor: string;
  finColor: string;
  size: number;
  aquariumId?: string;
};

export type UpdateFishInput = Partial<{
  name: string;
  bodyColor: string;
  finColor: string;
  size: number;
  aquariumId: string | null;
}>;

// Aquarium API
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

  update: (id: string, name: string) =>
    apiFetch<ApiAquarium>(
      `/aquariums/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      },
    ),

  remove: (id: string) =>
    apiFetch<void>(
      `/aquariums/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),

  setDefault: (id: string) =>
    apiFetch<ApiAquarium>(
      `/aquariums/${encodeURIComponent(id)}/default`,
      {
        method: 'PATCH',
      },
    ),
};

// Fish API
export const fishApi = {
  list: () =>
    apiFetch<ApiFish[]>('/fish'),

  get: (id: string) =>
    apiFetch<ApiFish>(
      `/fish/${encodeURIComponent(id)}`,
    ),

  create: (data: CreateFishInput) =>
    apiFetch<ApiFish>('/fish', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateFishInput) =>
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
      {
        method: 'DELETE',
      },
    ),

  uploadTexture: (id: string, image: Blob) => {
    const formData = new FormData();

    formData.append(
      'texture',
      image,
      'fish.png',
    );

    return apiFetch<ApiFish>(
      `/fish/${encodeURIComponent(id)}/texture`,
      {
        method: 'POST',
        body: formData,
      },
    );
  },

  getTexture: async (id: string): Promise<Blob> => {
    const response = await fetch(
      `${API_URL}/fish/${encodeURIComponent(id)}/texture`,
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to load fish texture (${response.status})`,
      );
    }

    return response.blob();
  },
};

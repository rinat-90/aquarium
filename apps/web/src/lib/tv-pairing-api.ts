const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export class TvApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'TvApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options?.body
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options?.headers,
    },
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : `Request failed (${response.status})`;

    throw new TvApiError(response.status, message);
  }

  return data as T;
}

export type PairingResult =
  | { status: 'pending' }
  | { status: 'expired' }
  | {
  status: 'paired';
  token: string;
  aquariumId: string;
  expiresAt: string;
};

export const tvPairingApi = {
  create: () => request<{ code: string; expiresAt: string }>('/api/tv/pairing', { method: 'POST' }),
  poll: (code: string) => request<PairingResult>(`/api/tv/pairing/${encodeURIComponent(code)}`),
  approve: (code: string, aquariumId: string) => request<{ ok: boolean }>(
    `/api/tv/pairing/${encodeURIComponent(code)}/approve`,
    { method: 'POST', body: JSON.stringify({ aquariumId }) },
  ),
  fish: (token: string) => request<{ aquariumId: string; fish: import('./aquarium-api').ApiFish[] }>(
    '/api/tv/display/fish', { headers: { Authorization: `Bearer ${token}` } },
  ),
  texture: async (token: string, fishId: string): Promise<Blob> => {
    const response = await fetch(
      `${API_URL}/api/tv/display/fish/${encodeURIComponent(fishId)}/texture`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to load TV fish texture (${response.status})`,
      );
    }

    return response.blob();
  },
  revoke: (sessionId: string) =>
    request<{ ok: boolean }>(
      `/api/tv/display/sessions/${encodeURIComponent(sessionId)}/revoke`,
      { method: 'POST' },
    ),
  sessions: () =>
    request<{
      sessions: {
        id: string;
        aquariumId: string;
        createdAt: string;
        expiresAt: string;
        isOnline: boolean;
      }[];
    }>('/api/tv/display/sessions'),
  switchAquarium: (sessionId: string, aquariumId: string) =>
    request<{ ok: boolean }>(
      `/api/tv/display/sessions/${encodeURIComponent(sessionId)}/switch`,
      {
        method: 'POST',
        body: JSON.stringify({ aquariumId }),
      },
    ),
};

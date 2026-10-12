import { useCallback, useEffect, useState } from 'react';
import { ThreeAquariumView } from '../../components/Aquarium3D/ThreeAquariumView';
import {
  TvPairingScreen,
  type TvDisplayCredentials,
} from './TvPairingScreen';
import {
  tvPairingApi,
  TvApiError,
} from '../../lib/tv-pairing-api';
import { createTvSocket } from '../../lib/tv-socket';
import type { CreatedFish } from '../../types/fish';
import type { ApiFish } from '../../lib/aquarium-api';

const STORAGE_KEY = 'aquarium-tv-display';
const MAX_TIMEOUT_MS = 2_147_483_647;

function restore(): TvDisplayCredentials | null {
  try {
    // Migrate an existing pairing from session storage once.
    const value =
      localStorage.getItem(STORAGE_KEY) ??
      sessionStorage.getItem(STORAGE_KEY);

    if (value && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, value);
      sessionStorage.removeItem(STORAGE_KEY);
    }

    if (!value) {
      console.log('[TV] No saved display credentials');
      return null;
    }

    const parsed: unknown = JSON.parse(value);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('token' in parsed) ||
      !('aquariumId' in parsed) ||
      !('expiresAt' in parsed)
    ) {
      console.warn('[TV] Saved credentials have invalid structure');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const item = parsed as TvDisplayCredentials;

    if (
      typeof item.token !== 'string' ||
      typeof item.aquariumId !== 'string' ||
      typeof item.expiresAt !== 'string'
    ) {
      console.warn('[TV] Saved credentials have invalid fields');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const expiresAt = Date.parse(item.expiresAt);

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      console.warn('[TV] Saved display credentials expired', {
        expiresAt: item.expiresAt,
        currentTime: new Date().toISOString(),
      });

      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    console.log('[TV] Restored display credentials', {
      aquariumId: item.aquariumId,
      expiresAt: item.expiresAt,
    });

    return item;
  } catch (err) {
    console.error('[TV] Failed to restore display credentials:', err);
    return null;
  }
}

function mapDisplayFish(item: ApiFish): CreatedFish | null {
  if (item.species === 'drawn') return null;

  return {
    id: item.id,
    type: '3d',
    model:
      item.species === 'angelfish'
        ? 'angelfish'
        : item.species === 'guppy'
          ? 'guppy'
          : 'basic',
    bodyColor: item.bodyColor,
    finColor: item.finColor,
    size: item.size,
    name: item.name,
    createdAt: item.createdAt,
  };
}

export function TvAquariumPage() {
  const [credentials, setCredentials] =
    useState<TvDisplayCredentials | null>(restore);

  const [fish, setFish] = useState<CreatedFish[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [feedSequence, setFeedSequence] = useState(0);

  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn('[TV] Fullscreen unavailable:', err);
    }
  };

  useEffect(() => {
    console.log('[TV] Aquarium page mounted');

    return () => {
      console.log('[TV] Aquarium page unmounted');
    };
  }, []);

  useEffect(() => {
    console.log('[TV] Credentials state changed', {
      paired: Boolean(credentials),
      aquariumId: credentials?.aquariumId,
      expiresAt: credentials?.expiresAt,
    });
  }, [credentials]);

  const onPaired = useCallback((next: TvDisplayCredentials) => {
    const remainingMs = Date.parse(next.expiresAt) - Date.now();

    console.log('[TV] Pairing callback received', {
      aquariumId: next.aquariumId,
      expiresAt: next.expiresAt,
      currentTime: new Date().toISOString(),
      remainingMs,
      remainingDays: remainingMs / 86_400_000,
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    console.log('[TV] Display credentials saved to localStorage');

    setError(null);
    setLoading(true);
    setCredentials(next);
  }, []);

  useEffect(() => {
    if (!credentials) {
      console.log('[TV] No credentials, showing pairing screen');
      return;
    }

    let active = true;
    let requestId = 0;

    const { token, aquariumId, expiresAt } = credentials;
    const socket = createTvSocket(token);

    console.log('[TV] Starting aquarium display', {
      aquariumId,
    });

    const reset = (reason: string) => {
      if (!active) return;

      console.error('[TV] DISPLAY RESET:', reason);
      console.trace('[TV] Reset call stack');

      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);

      setCredentials(null);
      setFish([]);
      setError(null);
      setLoading(true);
    };

    async function reload() {
      const id = ++requestId;

      console.log('[TV] Loading aquarium fish');

      try {
        const result = await tvPairingApi.fish(token);

        if (!active || id !== requestId) return;

        console.log('[TV] Fish API succeeded', {
          aquariumId: result.aquariumId,
          fishCount: result.fish.length,
        });

        if (result.aquariumId !== aquariumId) {
          console.error('[TV] Aquarium ID mismatch', {
            expected: aquariumId,
            received: result.aquariumId,
          });

          reset('The display token belongs to another aquarium');
          return;
        }

        const mappedFish = result.fish
          .map(mapDisplayFish)
          .filter((item): item is CreatedFish => item !== null);

        setFish(mappedFish);
        setError(null);

        console.log('[TV] Aquarium fish loaded', {
          visibleFish: mappedFish.length,
        });
      } catch (err) {
        if (!active || id !== requestId) return;

        const message =
          err instanceof Error
            ? err.message
            : 'Unable to load aquarium';

        console.error('[TV] Fish API failed:', message);

        if (
          err instanceof TvApiError &&
          (err.status === 401 || err.status === 403)
        ) {
          reset(`Display session rejected (${err.status})`);
          return;
        }

        setError(message);
      } finally {
        if (active && id === requestId) {
          setLoading(false);
        }
      }
    }

    const join = () => {
      if (!active) return;

      console.log('[TV] Socket connected, joining aquarium');

      // Backend already knows the aquarium from the display token.
      // It expects only the acknowledgment callback.
      socket.emit('tv:join', (result: { ok: boolean }) => {
        if (!active) return;

        console.log('[TV] Socket join result:', result);

        if (result.ok) {
          void reload();
        } else {
          console.warn(
            '[TV] Socket join rejected, keeping display session',
          );
        }
      });
    };

    const changed = (event: { aquariumId: string }) => {
      if (!active) return;

      if (event.aquariumId === aquariumId) {
        console.log('[TV] Aquarium changed, reloading fish');
        void reload();
      }
    };

    const handleFeed = (event: {
      aquariumId: string;
      eventId: string;
    }) => {
      if (!active || event.aquariumId !== aquariumId) return;

      setFeedSequence((current) => current + 1);
    };

    socket.on('aquarium:feed', handleFeed);

    socket.on('connect', join);
    socket.on('aquarium:changed', changed);

    socket.on('connect_error', (err: Error) => {
      if (!active) return;

      console.warn('[TV] Socket connection error:', err.message);

      // Keep the aquarium visible if live updates are unavailable.
    });

    socket.on('disconnect', (reason) => {
      if (!active) return;

      console.warn('[TV] Socket disconnected:', reason);

      // Do not reset credentials for temporary socket disconnects.
    });

    socket.on('tv:session-revoked', () => {
      reset('Display session revoked by server');
    });

    socket.on('tv:session-expired', () => {
      reset('Display session expired on server');
    });

    socket.connect();

    void reload();

    // Display sessions can last 30 days, but setTimeout supports
    // a maximum delay of approximately 24.8 days.
    // Reschedule until the actual expiration time.
    const expiresAtMs = Date.parse(expiresAt);
    const initialRemainingMs = expiresAtMs - Date.now();

    console.log('[TV] Display expiration details', {
      expiresAt,
      currentTime: new Date().toISOString(),
      remainingMs: initialRemainingMs,
      remainingMinutes: initialRemainingMs / 60_000,
      remainingDays: initialRemainingMs / 86_400_000,
    });

    let expirationTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleExpiration = () => {
      if (!active) return;

      const remainingMs = expiresAtMs - Date.now();

      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        reset('Display token expired');
        return;
      }

      const delay = Math.min(remainingMs, MAX_TIMEOUT_MS);

      console.log('[TV] Scheduling expiration check', {
        remainingDays: remainingMs / 86_400_000,
        nextCheckDays: delay / 86_400_000,
      });

      expirationTimer = setTimeout(scheduleExpiration, delay);
    };

    scheduleExpiration();

    return () => {
      console.log('[TV] Cleaning up aquarium display effect');

      active = false;
      requestId++;

      if (expirationTimer !== undefined) {
        clearTimeout(expirationTimer);
      }

      socket.disconnect();
    };
  }, [credentials]);

  if (!credentials) {
    return <TvPairingScreen onPaired={onPaired} />;
  }

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        backgroundColor: '#087fc4',
      }}
    >
      <ThreeAquariumView
        createdFish={fish}
        feedSequence={feedSequence}
        interactive={false}
        showDebugStats={false}
      />

      <button
        type="button"
        onClick={() => void enterFullscreen()}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 100,
          padding: '12px 20px',
          borderRadius: 12,
          background: 'rgba(0, 30, 50, 0.75)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          cursor: 'pointer',
        }}
      >
        ⛶ Fullscreen
      </button>

      {(loading || error) && (
        <div
          role={error ? 'alert' : 'status'}
          style={{
            position: 'fixed',
            top: 20,
            left: 20,
            zIndex: 100,
            padding: 12,
            borderRadius: 8,
            background: '#102e3b',
            color: '#fff',
          }}
        >
          {error ?? 'Loading aquarium...'}
        </div>
      )}
    </main>
  );
}

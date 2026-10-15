import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

const ThreeAquariumView = lazy(() =>
  import('../../components/Aquarium3D/ThreeAquariumView').then((module) => ({
    default: module.ThreeAquariumView,
  })),
);
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

import {
  DEFAULT_AQUARIUM_CUSTOMIZATION,
  type AquariumCustomization,
} from '../../features/aquarium-customization/types';

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

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read fish texture'));

    reader.readAsDataURL(blob);
  });
}

async function mapDisplayFish(
  item: ApiFish,
  token: string,
): Promise<CreatedFish | null> {
  let texture: string | undefined;

  if (item.paintKey) {
    try {
      const blob = await tvPairingApi.texture(token, item.id);
      texture = await blobToDataUrl(blob);
    } catch (error) {
      console.error('[TV] Failed to load texture', {
        fishId: item.id,
        error,
      });

      if (item.species === 'drawn') {
        return null;
      }
    }
  }

  if (item.species === 'drawn') {
    if (!texture) return null;

    return {
      id: item.id,
      type: 'drawn',
      image: texture,
      size: item.size,
      name: item.name,
      createdAt: item.createdAt,
      headDirection: item.headDirection,
    };
  }

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
    paintImage: texture,
    size: item.size,
    name: item.name,
    createdAt: item.createdAt,
  };
}

export function TvAquariumPage() {
  const [credentials, setCredentials] =
    useState<TvDisplayCredentials | null>(restore);

  const [fish, setFish] = useState<CreatedFish[]>([]);
  const [appearance, setAppearance] = useState<AquariumCustomization>(
    DEFAULT_AQUARIUM_CUSTOMIZATION,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);

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
    setPaused(false);
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
    let joinVersion = 0;
    let broadcastPaused = false;
    let previewVersion = 0;
    let previewActive = false;

    const { token, expiresAt } = credentials;
    let currentAquariumId = credentials.aquariumId;

    const socket = createTvSocket(token);

    console.log('[TV] Starting aquarium display', {
      currentAquariumId,
    });

    const reset = (reason: string) => {
      if (!active) return;

      console.error('[TV] DISPLAY RESET:', reason);
      console.trace('[TV] Reset call stack');

      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);

      setCredentials(null);
      setFish([]);
      setPaused(false);
      setError(null);
      setLoading(true);
    };

    function setBroadcastPaused(nextPaused: boolean) {
      broadcastPaused = nextPaused;
      if (nextPaused) joinVersion++;
      requestId++; // Invalidate fish/texture responses already in flight.
      previewActive = false;
      previewVersion++;
      setPaused(nextPaused);
      setFish([]);
      setError(null);
      setLoading(!nextPaused);
      if (nextPaused) setFeedSequence(0);
    }

    async function reload() {
      if (broadcastPaused) return;
      const id = ++requestId;
      const requestedAquariumId = currentAquariumId;
      const startedPreviewVersion = previewVersion;

      console.log('[TV] Loading aquarium fish');

      try {
        const result = await tvPairingApi.fish(token);

        if (!active || broadcastPaused || id !== requestId) return;
        // Do not overwrite a more recent live preview with a stale fetch.
        if (!previewActive && startedPreviewVersion === previewVersion) {
          setAppearance({
            ...DEFAULT_AQUARIUM_CUSTOMIZATION,
            ...(result.appearance ?? {}),
          });
        }

        console.log('[TV] Fish API succeeded', {
          aquariumId: result.aquariumId,
          fishCount: result.fish.length,
        });

        // The server is authoritative about which aquarium
        // belongs to this TV display session.
        if (result.aquariumId !== currentAquariumId) {
          currentAquariumId = result.aquariumId;

          setCredentials((current) => {
            if (!current || current.token !== token) return current;

            const updated = {
              ...current,
              aquariumId: result.aquariumId,
            };

            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(updated),
            );

            return updated;
          });
        }

        // Ignore responses from requests that started before
        // another aquarium switch.
        if (
          !active ||
          broadcastPaused ||
          id !== requestId ||
          (
            requestedAquariumId !== currentAquariumId &&
            result.aquariumId !== currentAquariumId
          )
        ) {
          return;
        }

        const mapped = await Promise.all(
          result.fish.map((item) => mapDisplayFish(item, token)),
        );

        // Another switch may have happened while textures loaded.
        if (
          !active ||
          broadcastPaused ||
          id !== requestId ||
          result.aquariumId !== currentAquariumId
        ) {
          return;
        }

        const mappedFish = mapped.filter(
          (item): item is CreatedFish => item !== null,
        );

        setFish(mappedFish);
        setError(null);

        console.log('[TV] Aquarium fish loaded', {
          aquariumId: currentAquariumId,
          visibleFish: mappedFish.length,
        });
      } catch (err) {
        if (!active || broadcastPaused || id !== requestId) return;

        const message =
          err instanceof Error
            ? err.message
            : 'Unable to load aquarium';

        console.error('[TV] Fish API failed:', message);

        if (
          err instanceof TvApiError &&
          err.status === 409
        ) {
          setBroadcastPaused(true);
          return;
        }

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
      const version = ++joinVersion;
      socket.emit('tv:join', (result: { ok: boolean }) => {
        if (!active || version !== joinVersion) return;

        console.log('[TV] Socket join result:', result);

        if (result.ok) {
          if (broadcastPaused) {
            setBroadcastPaused(false);
          }
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

      if (!broadcastPaused && event.aquariumId === currentAquariumId) {
        previewActive = false;
        previewVersion++;
        void reload();
      }
    };

    const previewAppearance = (event: {
      aquariumId: string;
      appearance: AquariumCustomization;
    }) => {
      if (!active || broadcastPaused || event.aquariumId !== currentAquariumId) return;
      previewActive = true;
      previewVersion++;
      setAppearance({ ...DEFAULT_AQUARIUM_CUSTOMIZATION, ...event.appearance });
    };

    const handleFeed = (event: {
      aquariumId: string;
      eventId: string;
    }) => {
      if (!active || broadcastPaused || event.aquariumId !== currentAquariumId) return;

      setFeedSequence((current) => current + 1);
    };

    socket.on('tv:broadcast-status', (event: { paused: boolean; aquariumId: string | null }) => {
      if (!active || typeof event?.paused !== 'boolean') return;
      if (event.paused) {
        setBroadcastPaused(true);
      } else {
        // Re-authorize room membership instead of joining directly.
        join();
      }
    });

    socket.on('aquarium:feed', handleFeed);

    socket.on('connect', join);
    socket.on('aquarium:changed', changed);
    socket.on('aquarium:appearance-preview', previewAppearance);

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

    socket.on(
      'tv:aquarium-switched',
      (event: { aquariumId: string }) => {
        if (!active || !event.aquariumId) return;

        console.log('[TV] Switching aquarium:', event.aquariumId);

        currentAquariumId = event.aquariumId;
        previewActive = false;
        previewVersion++;

        setFish([]);
        setFeedSequence(0);
        setLoading(true);

        if (!broadcastPaused) {
          join();
        }
      },
    );

    socket.connect();

    // The initial socket join authorizes loading. A paused session
    // receives tv:broadcast-status from the server.

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

      socket.off('aquarium:changed', changed);
      socket.off('aquarium:appearance-preview', previewAppearance);
      socket.disconnect();
    };
  }, [credentials?.token, credentials?.expiresAt]);

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
      {!paused && (
        <Suspense fallback={<div role="status" style={{ color: '#fff', padding: 24 }}>Loading aquarium…</div>}>
          <ThreeAquariumView
            createdFish={fish}
            appearance={appearance}
            feedSequence={feedSequence}
            interactive={false}
            showDebugStats={false}
          />
        </Suspense>
      )}

      {paused && (
        <div
          role="status"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
            background: '#092b3a',
            color: '#fff',
            textAlign: 'center',
            padding: 24,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 56px)' }}>Broadcast paused</h1>
          <p style={{ margin: 0, opacity: 0.8 }}>Resume broadcasting from Aquarium Settings.</p>
        </div>
      )}

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

      {!paused && (loading || error) && (
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

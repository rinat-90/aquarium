import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { socket } from '../../lib/socket';

import {
  aquariumApi,
  fishApi,
  type ApiAquarium,
} from '../../lib/aquarium-api';

import {
  FishDrawingCanvas,
  type FishCreation,
} from '../../components/FishDrawing/FishDrawingCanvas';
import { ThreeAquariumView } from '../../components/Aquarium3D/ThreeAquariumView';
import { AquariumAppearanceEditor } from '../../components/AquariumAppearanceEditor/AquariumAppearanceEditor';
import { DEFAULT_AQUARIUM_CUSTOMIZATION, type AquariumCustomization } from '../../features/aquarium-customization/types';
import { useAquarium } from '../../hooks/useAquarium';
import { AquariumHUD } from '../../components/AquariumHUD/AquariumHUD';
import { FishPanel } from '../../components/FishPanel/FishPanel';

import './AquariumPage.css';
import '../../components/AquariumAppearanceEditor/AquariumAppearanceEditor.css';
import { AquariumSettingsPanel } from '../../components/FishPanel/AquariumSettingsPanel';
import { createFish } from '../../lib/create-fish';
import { mapApiFish } from '../../lib/mapApiFish';
import { useLiveAquariumFish } from '../../hooks/useLiveAquariumFish';
import { tvPairingApi } from '../../lib/tv-pairing-api';
import { saveAquariumAppearance } from '../../lib/save-aquarium-appearance';
import { FALLBACK_THEMES, fetchPublishedThemes } from '../../lib/content-themes';
import type { AquariumTheme } from '../../features/aquarium-customization/themeRegistry';

import {
  AquariumRemote,
} from '../../components/AquariumRemote/AquariumRemote';

import {
  MobileAquariumViewer,
} from '../../components/AquariumRemote/MobileAquariumViewer';

const AQUARIUM_CAPACITY = 8;

// async function imageToBlob(image: string): Promise<Blob> {
//   const response = await fetch(image);
//   return response.blob();
// }

export function AquariumPage() {
  const navigate = useNavigate();
  const { id: aquariumId } = useParams<{ id: string }>();

  const {
    aquarium,
    aquariums,
    loading: aquariumLoading,
    error: aquariumError,
  } = useAquarium(aquariumId);

  const { fish, setFish, loading: fishLoading, error: fishError } = useLiveAquariumFish(aquarium?.id);
  const [drawing, setDrawing] = useState(false);
  const [selectedFishId, setSelectedFishId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fishCollectionOpen, setFishCollectionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  // Allow the dashboard's Edit button to open the appearance editor directly.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('decorate') === '1') {
      setAppearanceOpen(true);
    }
  }, []);
  const [availableThemes, setAvailableThemes] = useState<readonly AquariumTheme[]>(FALLBACK_THEMES);

  useEffect(() => {
    let active = true;

    void fetchPublishedThemes()
      .then((themes) => {
        if (!active) return;
        // Keep bundled starter themes available when nothing is published yet.
        setAvailableThemes(themes.length > 0 ? themes : FALLBACK_THEMES);
      })
      .catch((error) => {
        console.warn('Failed to load published themes:', error);
        if (active) setAvailableThemes(FALLBACK_THEMES);
      });

    return () => { active = false; };
  }, []);

  const [appearance, setAppearance] = useState<AquariumCustomization>(DEFAULT_AQUARIUM_CUSTOMIZATION);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceSaveError, setAppearanceSaveError] = useState<string | null>(null);
  const hydratedAppearanceId = useRef<string | null>(null);
  const lastSavedAppearanceRef = useRef<AquariumCustomization>(DEFAULT_AQUARIUM_CUSTOMIZATION);

  // Preview edits on paired TVs without persisting every tap to PostgreSQL.
  // This is deliberately separate from the existing Done/save flow.
  useEffect(() => {
    if (!aquarium?.id || !appearanceOpen) return;
    const aquariumId = aquarium.id;
    const timeout = window.setTimeout(() => {
      socket.emit('aquarium:appearance-preview', { aquariumId, appearance });
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [aquarium?.id, appearance, appearanceOpen]);

  const stopAppearancePreview = () => {
    if (!aquarium?.id) return;
    socket.emit('aquarium:appearance-preview', {
      aquariumId: aquarium.id,
      appearance: lastSavedAppearanceRef.current,
    });
  };


  // Hydrate only when switching aquariums; avoid overwriting live edits
  // when another request refreshes the current aquarium.
  useEffect(() => {
    if (!aquarium) return;
    if (hydratedAppearanceId.current === aquarium.id) return;
    hydratedAppearanceId.current = aquarium.id;
    const hydrated = {
      ...DEFAULT_AQUARIUM_CUSTOMIZATION,
      ...(aquarium.appearance ?? {}),
    };
    lastSavedAppearanceRef.current = hydrated;
    setAppearance(hydrated);
    setAppearanceSaveError(null);
    setAppearanceOpen(false);
  }, [aquarium]);

  const handleSaveAppearance = async () => {
    if (!aquarium?.id || appearanceSaving) return;
    const id = aquarium.id;
    setAppearanceSaving(true);
    setAppearanceSaveError(null);
    try {
      await saveAquariumAppearance(id, appearance);
      if (activeAquariumId.current === id) {
        lastSavedAppearanceRef.current = appearance;
        setAppearanceOpen(false);
      }
    } catch (err) {
      if (activeAquariumId.current === id) {
        setAppearanceSaveError(err instanceof Error ? err.message : 'Could not save aquarium appearance.');
      }
    } finally {
      setAppearanceSaving(false);
    }
  };

  const [endingBroadcast, setEndingBroadcast] = useState(false);

  const [switchingAquarium, setSwitchingAquarium] = useState(false);
  const [aquariumChoices, setAquariumChoices] = useState<ApiAquarium[]>([]);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [selectedAquariumId, setSelectedAquariumId] = useState('');

  const [mobileViewerOpen, setMobileViewerOpen] = useState(false);

  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');

    const update = () => setIsMobile(media.matches);

    update();
    media.addEventListener('change', update);

    return () => media.removeEventListener('change', update);
  }, []);

  const [renamedAquarium, setRenamedAquarium] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const aquariumName =
    renamedAquarium && renamedAquarium.id === aquarium?.id
      ? renamedAquarium.name
      : aquarium?.name ?? 'My Aquarium';

  const activeAquariumId = useRef<string | null>(null);
  activeAquariumId.current = aquarium?.id ?? null;

  const [feedSequence, setFeedSequence] = useState(0);

  const [broadcastStatus, setBroadcastStatus] = useState<
    'loading' | 'live' | 'paused' | 'disconnected' | 'offline' | 'error'
  >('loading');

  const getBroadcastStatus = (sessions: Array<{ aquariumId: string; isOnline: boolean; pausedAt?: string | null }>, id: string) => {
    const assigned = sessions.filter((session) => session.aquariumId === id);
    if (assigned.length === 0) return 'offline' as const;
    if (assigned.some((session) => session.isOnline && !session.pausedAt)) return 'live' as const;
    if (assigned.every((session) => Boolean(session.pausedAt))) return 'paused' as const;
    return 'disconnected' as const;
  };

  useEffect(() => {
    if (!settingsOpen || !aquarium?.id) return;

    let cancelled = false;
    const id = aquarium.id;

    async function refreshBroadcastStatus() {
      try {
        const { sessions } = await tvPairingApi.sessions();

        if (cancelled) return;

        setBroadcastStatus(
          getBroadcastStatus(sessions, id),
        );
      } catch {
        if (!cancelled) setBroadcastStatus('error');
      }
    }

    setBroadcastStatus('loading');
    void refreshBroadcastStatus();

    // Fallback refresh while the settings panel is open.
    const interval = window.setInterval(
      refreshBroadcastStatus,
      5000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [settingsOpen, aquarium?.id]);



  const [feedCooldownUntil, setFeedCooldownUntil] = useState(0);
  const [feedCooldownSeconds, setFeedCooldownSeconds] = useState(0);
  const [feedPending, setFeedPending] = useState(false);

  useEffect(() => {
    if (!feedCooldownUntil) {
      setFeedCooldownSeconds(0);
      return;
    }


    const updateCountdown = () => {
      setFeedCooldownSeconds(
        Math.max(0, Math.ceil((feedCooldownUntil - Date.now()) / 1000)),
      );
    };

    updateCountdown();

    const interval = window.setInterval(updateCountdown, 200);

    return () => window.clearInterval(interval);
  }, [feedCooldownUntil]);

  const handleFeedFish = () => {
    if (!aquarium?.id || feedPending || Date.now() < feedCooldownUntil) {
      return;
    }

    setFeedPending(true);

    socket.timeout(5000).emit(
      'aquarium:feed',
      aquarium.id,
      (
        error: Error | null,
        result?: {
          ok: boolean;
          retryAfterMs?: number;
        },
      ) => {
        setFeedPending(false);

        if (error || !result) {
          console.warn('[Aquarium] Feeding request timed out');
          return;
        }

        if (result.ok) {
          setFeedCooldownUntil(Date.now() + 3000);
          return;
        }

        if (result.retryAfterMs) {
          setFeedCooldownUntil(Date.now() + result.retryAfterMs);
        }

        console.warn('[Aquarium] Feeding rejected by server');
      },
    );
  };

  const usedCapacity = fish.reduce(
    (total, item) => total + item.size * item.size,
    0,
  );

  const remainingCapacity = Math.max(
    0,
    AQUARIUM_CAPACITY - usedCapacity,
  );

  const handleFishCreated = async (creation: FishCreation) => {
    if (!aquarium || busy) return;

    const aquariumId = aquarium.id;
    const cost = creation.size * creation.size;

    if (usedCapacity + cost > AQUARIUM_CAPACITY + 0.0001) {
      setError('Not enough space in this aquarium');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const saved = await createFish(
        aquariumId,
        creation,
        fish.length,
      );

      const mapped = await mapApiFish(saved);

      if (activeAquariumId.current === aquariumId) {
        setFish((current) => [...current, mapped]);
        setDrawing(false);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create fish',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRenameFish = async (fishId: string, name: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) return;

    await fishApi.update(fishId, {
      name: trimmedName,
    });

    setFish((previous) =>
      previous.map((item) =>
        item.id === fishId
          ? { ...item, name: trimmedName }
          : item,
      ),
    );
  };

  const handleReleaseFish = async () => {
    if (!selectedFishId || busy) return;

    setBusy(true);
    setError(null);

    try {
      await fishApi.remove(selectedFishId);

      setFish((current) =>
        current.filter((item) => item.id !== selectedFishId),
      );
      setSelectedFishId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to release fish',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleMoveFish = async (
    fishId: string,
    destinationAquariumId: string,
  ) => {
    if (!aquarium) {
      throw new Error('No aquarium selected.');
    }

    if (destinationAquariumId === aquarium.id) {
      return;
    }

    // Persist the move in PostgreSQL first.
    await fishApi.update(fishId, {
      aquariumId: destinationAquariumId,
    });

    // Only update the UI after the API succeeds.
    setFish((previous) =>
      previous.filter((fish) => fish.id !== fishId),
    );

    // Close the profile for the moved fish.
    setSelectedFishId(null);
  };

  const handleOpenFishList = () => {
    setSelectedFishId(null);
    setFishCollectionOpen(true);
  };

  const handleOpenFishProfile = (fishId: string) => {
    setSelectedFishId(fishId);
    setFishCollectionOpen(true);
  };

  const handleCloseFishPanel = () => {
    setFishCollectionOpen(false);
    setSelectedFishId(null);
  };

  const handleRenameAquarium = async (name: string) => {
    if (!aquarium) {
      throw new Error('No aquarium selected.');
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error('Aquarium name cannot be empty.');
    }

    const updated = await aquariumApi.update(aquarium.id, trimmedName);

    setRenamedAquarium({
      id: updated.id,
      name: updated.name,
    });
  };

  useEffect(() => {
    if (!aquarium?.id) return;

    const handleFeed = (event: {
      aquariumId: string;
      eventId: string;
    }) => {
      if (event.aquariumId !== aquarium.id) return;

      setFeedSequence((current) => current + 1);
    };

    socket.on('aquarium:feed', handleFeed);

    return () => {
      socket.off('aquarium:feed', handleFeed);
    };
  }, [aquarium?.id]);

  useEffect(() => {
    if (!aquarium?.id || !appearanceOpen) return;

    const join = () => {
      socket.emit(
        'aquarium:join',
        aquarium.id,
        (result: { ok: boolean }) => {
          if (!result.ok) {
            console.warn('[Aquarium] Socket join rejected');
          }
        },
      );
    };

    socket.on('connect', join);

    if (!socket.connected) {
      socket.connect();
    } else {
      join();
    }

    return () => {
      socket.off('connect', join);
    };
  }, [aquarium?.id, appearanceOpen]);

  async function handleEndBroadcast() {
    if (endingBroadcast) return;
    const confirmed = window.confirm('Pause the TV broadcast? You can resume without pairing again.');
    if (!confirmed) return;

    setEndingBroadcast(true);
    try {
      await handleSettingsEndBroadcast();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to pause TV broadcast.');
    } finally {
      setEndingBroadcast(false);
    }
  }

  async function handleSettingsStartBroadcast() {
    if (!aquarium?.id) throw new Error('No aquarium selected.');
    const id = aquarium.id;
    const { sessions } = await tvPairingApi.sessions();
    const assigned = sessions.filter((session) => session.aquariumId === id);

    if (assigned.length > 1) {
      throw new Error('Multiple TVs are assigned to this aquarium. Choose a TV before resuming.');
    }

    if (assigned.length === 1) {
      // Resume even if the TV is currently offline; it will reconnect
      // using its existing display token and read the persisted state.
      await tvPairingApi.resume(assigned[0].id);
      setBroadcastStatus(assigned[0].isOnline ? 'live' : 'disconnected');
      return;
    }

    const available = sessions.filter((session) => session.isOnline);
    if (available.length === 0) {
      throw new Error('No paired TV is connected. Open the TV pairing screen and connect a TV first.');
    }
    if (available.length > 1) {
      throw new Error('Multiple TVs are connected. Select a TV before starting the broadcast.');
    }

    await tvPairingApi.switchAquarium(available[0].id, id);
    await tvPairingApi.resume(available[0].id);
    setBroadcastStatus('live');
  }

  async function handleSettingsEndBroadcast() {
    if (!aquarium?.id) throw new Error('No aquarium selected.');
    const id = aquarium.id;
    const { sessions } = await tvPairingApi.sessions();
    const assigned = sessions.filter((session) => session.aquariumId === id);

    if (assigned.length === 0) {
      setBroadcastStatus('offline');
      return;
    }
    if (assigned.length > 1) {
      throw new Error('Multiple TVs are assigned to this aquarium. Choose a TV before pausing.');
    }

    // Pausing keeps the TV token valid; revoking would force QR pairing again.
    await tvPairingApi.pause(assigned[0].id);
    setBroadcastStatus('paused');
  }

  async function handleOpenSwitchAquarium() {
    if (switchingAquarium) return;

    setSwitchingAquarium(true);

    try {
      const aquariums = await aquariumApi.list();

      setAquariumChoices(aquariums);
      setSelectedAquariumId(
        aquariums.find((item) => item.id !== aquariumId)?.id ?? '',
      );
      setSwitchDialogOpen(true);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Failed to load aquariums.',
      );
    } finally {
      setSwitchingAquarium(false);
    }
  }

  async function handleConfirmSwitchAquarium() {
    if (!selectedAquariumId || switchingAquarium) return;

    setSwitchingAquarium(true);

    try {
      const { sessions } = await tvPairingApi.sessions();

      const matchingSessions = sessions.filter(
        (session) => session.aquariumId === aquariumId,
      );

      if (matchingSessions.length === 0) {
        window.alert('No active TV broadcast found for this aquarium.');
        return;
      }

      if (matchingSessions.length > 1) {
        window.alert(
          'Multiple TV broadcasts found. TV selection is required.',
        );
        return;
      }

      await tvPairingApi.switchAquarium(
        matchingSessions[0].id,
        selectedAquariumId,
      );

      setSwitchDialogOpen(false);
      navigate(`/aquariums/${encodeURIComponent(selectedAquariumId)}`);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Failed to switch aquarium.',
      );
    } finally {
      setSwitchingAquarium(false);
    }
  }


  const handleReleaseAllFish = async () => {
    if (!aquarium?.id) {
      throw new Error('No aquarium selected.');
    }

    const id = aquarium.id;

    await aquariumApi.releaseAllFish(id);

    if (activeAquariumId.current === id) {
      setFish([]);
      setSelectedFishId(null);
      setFishCollectionOpen(false);
    }
  };

  const handleDeleteAquarium = async () => {
    if (!aquarium?.id) {
      throw new Error('No aquarium selected.');
    }

    const id = aquarium.id;

    // Recheck immediately before requesting deletion.
    const { sessions } = await tvPairingApi.sessions();

    if (sessions.some((session) => session.aquariumId === id)) {
      setBroadcastStatus('offline');
      throw new Error(
        'Disconnect the paired TV before deleting this aquarium. Pausing does not revoke its session.',
      );
    }

    await aquariumApi.deletePermanently(id);

    setSettingsOpen(false);
    navigate('/aquariums', { replace: true });
  };


  return (
    <div className="aquarium-page">

      {isMobile ? (
        mobileViewerOpen ? (
          <MobileAquariumViewer
            fish={fish}
            feedSequence={feedSequence}
            onClose={() => setMobileViewerOpen(false)}
          />
        ) : aquariumId ? (
          <AquariumRemote
            aquariumId={aquariumId}
            name={aquariumName}
            fish={fish}
            onBack={() => navigate('/aquariums')}
            onFeed={handleFeedFish}
            onAddFish={() => {
              if (!aquarium?.id) return;

              navigate(
                `/fish/create?aquariumId=${encodeURIComponent(aquarium.id)}`,
              );
            }}
            onViewFish={handleOpenFishList}
            onSettings={() => setSettingsOpen(true)}
            feedCooldownSeconds={feedCooldownSeconds}
            feedPending={feedPending}
            onEndBroadcast={handleEndBroadcast}
            endingBroadcast={endingBroadcast}
            onSwitchAquarium={handleOpenSwitchAquarium}
            switchingAquarium={switchingAquarium}
            onDecorate={() => setAppearanceOpen(true)}
          />
        ) : null
      ) : (

        <>
          <AquariumHUD
            name={aquariumName}
            fishCount={fish.length}
            feedCooldownSeconds={feedCooldownSeconds}
            feedPending={feedPending}
            onBack={() => navigate('/aquariums')}
            onAddFish={() => {
              if (!aquarium?.id) return;

              navigate(
                `/fish/create?aquariumId=${encodeURIComponent(aquarium.id)}`,
              );
            }}
            onViewFish={handleOpenFishList}
            onFeed={handleFeedFish}
            onSettings={() => setSettingsOpen(true)}
          />

          <ThreeAquariumView
            createdFish={fish}
            appearance={appearance}
            decorationEditing={appearanceOpen}
            onDecorationMove={(id, normalizedX) => {
              setAppearance((previous) => ({
                ...previous,
                decorationInstances: (
                  previous.decorationInstances ?? []
                ).map((decoration) =>
                  decoration.id === id
                    ? { ...decoration, x: normalizedX }
                    : decoration,
                ),
              }));

              setAppearanceSaveError(null);
            }}
            onFishSelect={(selectedFish) => {
              handleOpenFishProfile(selectedFish.id);
            }}
            feedSequence={feedSequence}
            onAppearanceChange={(next) => {
              setAppearance(next);
              setAppearanceSaveError(null);
            }}
          />
        </>
      )}

      {!isMobile && !appearanceOpen && (
        <button
          type="button"
          className="aquarium-appearance-launch"
          onClick={() => setAppearanceOpen(true)}
          aria-label="Customize aquarium appearance"
        >
          <span aria-hidden="true">🎨</span> Decorate
        </button>
      )}

      <AquariumAppearanceEditor
        themes={availableThemes}
        open={appearanceOpen}
        value={appearance}
        onChange={(next) => {
          setAppearance(next);
          setAppearanceSaveError(null);
        }}
        onClose={() => {
          stopAppearancePreview();
          setAppearanceOpen(false);
        }}
        onSave={() => void handleSaveAppearance()}
        saving={appearanceSaving}
        saveError={appearanceSaveError}
      />

      {!isMobile && (
        <button
          type="button"
          disabled={!aquarium || busy || fishLoading}
          onClick={() => setDrawing(true)}
          // Keep your existing styles and button contents
        >
          {/* Existing content */}
        </button>
      )}

      {(aquariumLoading || fishLoading) && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            left: 20,
            zIndex: 100,
            background: 'white',
            padding: 12,
            borderRadius: 12,
          }}
        >
          Loading aquarium...
        </div>
      )}

      {(error || fishError || aquariumError) && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 80,
            right: 20,
            zIndex: 100,
            background: '#fff1f1',
            color: '#a32626',
            padding: 12,
            borderRadius: 12,
            maxWidth: 320,
          }}
        >
          {error || fishError || aquariumError}
        </div>
      )}

      <AquariumSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        name={aquariumName}
        fishCount={fish.length}
        onRename={handleRenameAquarium}
        broadcastStatus={broadcastStatus}
        onReleaseAll={handleReleaseAllFish}
        onDelete={handleDeleteAquarium}
        onStartBroadcast={handleSettingsStartBroadcast}
        onEndBroadcast={handleSettingsEndBroadcast}
      />

      <FishPanel
        open={fishCollectionOpen}
        fish={fish}
        selectedFishId={selectedFishId}
        onSelectFish={setSelectedFishId}
        onClose={handleCloseFishPanel}
        onViewAquarium={() => {
          handleCloseFishPanel();
          setMobileViewerOpen(true);
        }}
        onAddFish={() => {
          if (!aquarium?.id) return;

          handleCloseFishPanel();

          navigate(
            `/fish/create?aquariumId=${encodeURIComponent(aquarium.id)}`,
          );
        }}
        onRename={handleRenameFish}
        onRelease={handleReleaseFish}
        onMove={handleMoveFish}
        aquariums={aquariums}
        currentAquariumId={aquarium?.id ?? ''}
      />

      {drawing && (
        <FishDrawingCanvas
          remainingCapacity={remainingCapacity}
          onDone={handleFishCreated}
          onCancel={() => setDrawing(false)}
        />
      )}

      {switchDialogOpen && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Switch Aquarium"
            style={{
              width: '100%',
              maxWidth: 400,
              padding: 24,
              borderRadius: 16,
              background: '#123746',
              color: 'white',
            }}
          >
            <h2>Switch Aquarium</h2>
            <p>Choose which aquarium to display on your TV.</p>

            <select
              value={selectedAquariumId}
              onChange={(event) => setSelectedAquariumId(event.target.value)}
              disabled={switchingAquarium}
              style={{
                width: '100%',
                padding: 12,
                marginBottom: 20,
                borderRadius: 8,
              }}
            >
              <option value="">Select aquarium</option>

              {aquariumChoices
                .filter((item) => item.id !== aquariumId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.fish.length} fish)
                  </option>
                ))}
            </select>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setSwitchDialogOpen(false)}
                disabled={switchingAquarium}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleConfirmSwitchAquarium()}
                disabled={!selectedAquariumId || switchingAquarium}
              >
                {switchingAquarium ? 'Switching...' : 'Switch Aquarium'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

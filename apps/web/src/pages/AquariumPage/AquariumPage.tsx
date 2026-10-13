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
import { useAquarium } from '../../hooks/useAquarium';
import { AquariumHUD } from '../../components/AquariumHUD/AquariumHUD';
import { FishPanel } from '../../components/FishPanel/FishPanel';

import './AquariumPage.css';
import {AquariumSettingsPanel} from "../../components/FishPanel/AquariumSettingsPanel.tsx";
import {createFish} from "../../lib/create-fish.ts";
import { mapApiFish } from '../../lib/mapApiFish';
import { useLiveAquariumFish } from '../../hooks/useLiveAquariumFish';
import { tvPairingApi } from '../../lib/tv-pairing-api';

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

  async function handleEndBroadcast() {
    if (!aquarium?.id || endingBroadcast) return;

    const confirmed = window.confirm(
      'End the TV broadcast for this aquarium?',
    );

    if (!confirmed) return;

    setEndingBroadcast(true);

    try {
      const { sessions } = await tvPairingApi.sessions();

      const activeSessions = sessions.filter(
        (session) => session.aquariumId === aquarium.id,
      );

      if (activeSessions.length === 0) {
        window.alert('No active TV sessions found for this aquarium.');
        return;
      }

      if (activeSessions.length > 1) {
        window.alert(
          'Multiple TV sessions found. Individual TV selection is needed before ending a broadcast.',
        );
        return;
      }

      await tvPairingApi.revoke(activeSessions[0].id);

      window.alert('TV broadcast ended.');
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Failed to end TV broadcast.',
      );
    } finally {
      setEndingBroadcast(false);
    }
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
            onFishSelect={(selectedFish) => {
              handleOpenFishProfile(selectedFish.id);
            }}
            feedSequence={feedSequence}
          />
        </>
      )}

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
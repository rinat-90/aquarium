import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { socket } from '../../lib/socket';

import {
  aquariumApi,
  fishApi,
  type ApiFish,
} from '../../lib/aquarium-api';

import type {CreatedFish} from "../../types/fish.ts";
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

const AQUARIUM_CAPACITY = 8;

// async function imageToBlob(image: string): Promise<Blob> {
//   const response = await fetch(image);
//   return response.blob();
// }

async function mapApiFish(item: ApiFish): Promise<CreatedFish> {
  let texture: string | undefined;

  if (item.paintKey) {
    const blob = await fishApi.getTexture(item.id);
    texture = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read texture'));
      reader.readAsDataURL(blob);
    });
  }

  if (item.species === 'drawn') {
    return {
      id: item.id,
      type: 'drawn',
      image: texture ?? '',
      size: item.size,
      name: item.name,
      createdAt: item.createdAt,
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

export function AquariumPage() {
  const navigate = useNavigate();
  const { id: aquariumId } = useParams<{ id: string }>();

  const {
    aquarium,
    aquariums,
    loading: aquariumLoading,
    error: aquariumError,
  } = useAquarium(aquariumId);

  const [fish, setFish] = useState<CreatedFish[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [selectedFishId, setSelectedFishId] = useState<string | null>(null);
  const [fishLoading, setFishLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fishCollectionOpen, setFishCollectionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [refreshVersion, setRefreshVersion] = useState(0);
  const lastLoadVersion = useRef(0);

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

  const handleFeedFish = () => {
    setFeedSequence((current) => current + 1);
  };

  useEffect(() => {
    if (!aquarium?.id) {
      setFish([]);
      setFishLoading(false);
      return;
    }

    const aquariumId = aquarium.id;
    const version = ++lastLoadVersion.current;
    let cancelled = false;

    async function loadFish() {
      setFishLoading(true);

      try {
        const items = await fishApi.list();

        const matching = items.filter(
          (item) => item.aquariumId === aquariumId,
        );

        const mapped = await Promise.all(
          matching.map(mapApiFish),
        );

        if (
          !cancelled &&
          version === lastLoadVersion.current
        ) {
          setFish(mapped);
          setError(null);
        }
      } catch (err) {
        if (
          !cancelled &&
          version === lastLoadVersion.current
        ) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load fish',
          );
        }
      } finally {
        if (
          !cancelled &&
          version === lastLoadVersion.current
        ) {
          setFishLoading(false);
        }
      }
    }

    void loadFish();

    return () => {
      cancelled = true;
    };
  }, [aquarium?.id, refreshVersion]);

  useEffect(() => {
    if (!aquarium?.id) return;

    const aquariumId = aquarium.id;

    const refresh = () => {
      setRefreshVersion((value) => value + 1);
    };

    const joinAquarium = () => {
      socket.emit(
        'aquarium:join',
        aquariumId,
        (result: { ok: boolean }) => {
          if (result.ok) {
            // Reload after joining to avoid missing changes
            // between the initial REST request and subscription.
            refresh();
          } else {
            console.warn('Failed to join aquarium room');
          }
        },
      );
    };

    const handleChanged = (event: {
      aquariumId: string;
    }) => {
      if (event.aquariumId === aquariumId) {
        refresh();
      }
    };

    socket.on('connect', joinAquarium);
    socket.on('aquarium:changed', handleChanged);

    socket.connect();

    if (socket.connected) {
      joinAquarium();
    }

    return () => {
      socket.emit('aquarium:leave', aquariumId);
      socket.off('connect', joinAquarium);
      socket.off('aquarium:changed', handleChanged);
      socket.disconnect();
    };
  }, [aquarium?.id]);

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

  return (
    <div className="aquarium-page">
      <AquariumHUD
        name={aquariumName}
        fishCount={fish.length}
        onBack={() => navigate('/aquariums')}
        onAddFish={() => {
          if (!aquarium?.id) return;

          navigate(`/fish/create?aquariumId=${encodeURIComponent(aquarium.id)}`);
        }}
        onViewFish={handleOpenFishList}
        onFeed={handleFeedFish}
        onSettings={() => {
          setSettingsOpen(true);
        }}
      />

      <ThreeAquariumView
        createdFish={fish}
        onFishSelect={(selectedFish) => {
          handleOpenFishProfile(selectedFish.id);
        }}
        feedSequence={feedSequence}
      />

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

      {(error || aquariumError) && (
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
          {error || aquariumError}
        </div>
      )}

      <button
        type="button"
        disabled={!aquarium || busy || fishLoading}
        onClick={() => setDrawing(true)}
        style={{
          position: 'fixed',
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          padding: '14px 24px',
          borderRadius: 30,
          border: 0,
          fontSize: 18,
          cursor: 'pointer',
        }}
      >
        ✏️ Draw Fish
      </button>

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
    </div>
  );
}
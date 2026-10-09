
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { authClient } from './lib/auth-client';
import {
  aquariumApi,
  fishApi,
  type ApiFish,
} from './lib/aquarium-api';

import {
  FishDrawingCanvas,
  type FishCreation,
} from './components/FishDrawing/FishDrawingCanvas';
import { FishProfileCard } from './components/FishProfile/FishProfileCard';
import { ThreeAquariumView } from './components/Aquarium3D/ThreeAquariumView';
import { AquariumControls } from './components/AquariumControls/AquariumControls';
import { useAquarium } from './hooks/useAquarium';

const AQUARIUM_CAPACITY = 8;

export type DrawnFish = {
  id: string;
  type: 'drawn';
  image: string;
  size: number;
  name: string;
  createdAt: string;
};

export type ThreeDFish = {
  id: string;
  type: '3d';
  model: 'basic' | 'angelfish';
  bodyColor: string;
  finColor: string;
  paintImage?: string;
  size: number;
  name: string;
  createdAt: string;
};

export type CreatedFish = DrawnFish | ThreeDFish;

async function imageToBlob(image: string): Promise<Blob> {
  const response = await fetch(image);
  return response.blob();
}

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
    model: item.species === 'angelfish' ? 'angelfish' : 'basic',
    bodyColor: item.bodyColor,
    finColor: item.finColor,
    paintImage: texture,
    size: item.size,
    name: item.name,
    createdAt: item.createdAt,
  };
}

function App() {
  const navigate = useNavigate();

  const {
    aquarium,
    aquariums,
    loading: aquariumLoading,
    error: aquariumError,
    selectAquarium,
    refreshAquariums,
  } = useAquarium();

  const [fish, setFish] = useState<CreatedFish[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [selectedFishId, setSelectedFishId] = useState<string | null>(null);
  const [fishLoading, setFishLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAquariumId = useRef<string | null>(null);
  activeAquariumId.current = aquarium?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    setFish([]);
    setSelectedFishId(null);
    setDrawing(false);
    setError(null);

    if (!aquarium) {
      setFishLoading(false);
      return;
    }

    const aquariumId = aquarium.id;
    setFishLoading(true);

    async function load() {
      try {
        const items = await fishApi.list();
        const matching = items.filter(
          (item) => item.aquariumId === aquariumId,
        );
        const mapped = await Promise.all(matching.map(mapApiFish));

        if (!cancelled) {
          setFish(mapped);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load fish',
          );
        }
      } finally {
        if (!cancelled) {
          setFishLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
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

  const selectedFish =
    fish.find((item) => item.id === selectedFishId) ?? null;

  const handleSignOut = async () => {
    const { error: signOutError } = await authClient.signOut({});

    if (signOutError) {
      setError(signOutError.message ?? 'Failed to sign out');
      return;
    }

    navigate('/login', { replace: true });
  };

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

    let createdId: string | null = null;

    try {
      const created = await fishApi.create({
        name: `Fish ${fish.length + 1}`,
        species:
          creation.type === 'drawn'
            ? 'drawn'
            : creation.model === 'angelfish'
              ? 'angelfish'
              : 'classic',
        bodyColor:
          creation.type === 'drawn' ? '#4F9CF9' : creation.bodyColor,
        finColor:
          creation.type === 'drawn' ? '#3B82F6' : creation.finColor,
        size: creation.size,
        aquariumId,
      });

      createdId = created.id;

      const image =
        creation.type === 'drawn'
          ? creation.image
          : creation.paintImage;

      let saved = created;

      if (image) {
        saved = await fishApi.uploadTexture(
          created.id,
          await imageToBlob(image),
        );
      }

      const mapped = await mapApiFish(saved);

      if (activeAquariumId.current === aquariumId) {
        setFish((current) => [...current, mapped]);
        setDrawing(false);
      }
    } catch (err) {
      // If texture upload fails, avoid leaving an incomplete fish.
      if (createdId) {
        try {
          await fishApi.remove(createdId);
        } catch {
          // Preserve the original error.
        }
      }

      setError(
        err instanceof Error ? err.message : 'Failed to create fish',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRenameFish = async (name: string) => {
    if (!selectedFishId || busy) return;

    setBusy(true);
    setError(null);

    try {
      const updated = await fishApi.update(selectedFishId, { name });

      setFish((current) =>
        current.map((item) =>
          item.id === updated.id ? { ...item, name: updated.name } : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to rename fish',
      );
    } finally {
      setBusy(false);
    }
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

  const handleCreateAquarium = async () => {
    const name = window.prompt('Name your new aquarium:')?.trim();

    if (!name || busy) return;

    setBusy(true);
    setError(null);

    try {
      const created = await aquariumApi.create(name);
      await refreshAquariums(created.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create aquarium',
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

  return (
    <div className="aquarium-page">
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          zIndex: 100,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <AquariumControls
          aquarium={aquarium}
          aquariums={aquariums}
          disabled={aquariumLoading || busy}
          onSelect={selectAquarium}
          onCreate={async (name) => {
            const created = await aquariumApi.create(name);
            await refreshAquariums(created.id);
          }}
          onRename={async (id, name) => {
            console.log('[Aquarium] Renaming:', { id, name });

            const updated = await aquariumApi.update(id, name);
            console.log('[Aquarium] Updated:', updated);

            await refreshAquariums(id);
            console.log('[Aquarium] Refreshed after rename');
          }}
          onDelete={async (id, destinationAquariumId) => {
            console.log('Deleting aquarium:', {
              id,
              destinationAquariumId,
            });

            await aquariumApi.remove(id, destinationAquariumId);
            await refreshAquariums();
          }}
          onSetDefault={async (id) => {
            await aquariumApi.setDefault(id);
            await refreshAquariums(id);
          }}
        />

        <button
          type="button"
          onClick={() => void handleCreateAquarium()}
          disabled={busy}
        >
          + Aquarium
        </button>
      </div>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 100,
          padding: '10px 18px',
          borderRadius: 20,
          background: 'white',
          color: '#064b78',
          border: 'none',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}
      >
        Sign Out
      </button>

      <ThreeAquariumView
        createdFish={fish}
        onFishSelect={(selected) => setSelectedFishId(selected.id)}
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

      {selectedFish && (
        <FishProfileCard
          fish={selectedFish}
          onRename={handleRenameFish}
          onRelease={handleReleaseFish}
          onClose={() => setSelectedFishId(null)}
          aquariums={aquariums}
          currentAquariumId={aquarium.id}
          onMove={handleMoveFish}
        />
      )}

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

export default App;

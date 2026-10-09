import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
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

const AQUARIUM_CAPACITY = 8;



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

  return (
    <div className="aquarium-page">
      <AquariumHUD
        name={aquarium?.name ?? 'Aquarium'}
        fishCount={fish.length}
        onBack={() => navigate('/aquariums')}
        onAddFish={() => {
          if (!aquarium?.id) return;

          navigate(`/fish/create?aquariumId=${encodeURIComponent(aquarium.id)}`);
        }}
        onEdit={() => {
          // Edit Aquarium is on hold.
        }}
        onViewFish={handleOpenFishList}
      />

      <ThreeAquariumView
        createdFish={fish}
        onFishSelect={(selected) => handleOpenFishProfile(selected.id)}
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
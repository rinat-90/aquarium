
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
  FishDrawingCanvas,
  type FishCreation,
} from '../../components/FishDrawing/FishDrawingCanvas';

import { fishApi, type ApiFish } from '../../lib/aquarium-api';
import {
  AQUARIUM_CAPACITY,
  createFish,
} from '../../lib/create-fish';

import './CustomizeFishPage.css';

export function CustomizeFishPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const aquariumId = searchParams.get('aquariumId');

  const [fish, setFish] = useState<ApiFish[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    setFish([]);
    setError(null);

    if (!aquariumId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    async function loadFish() {
      try {
        const items = await fishApi.list();

        if (cancelled) return;

        setFish(
          items.filter((item) => item.aquariumId === aquariumId),
        );
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load aquarium fish',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFish();

    return () => {
      cancelled = true;
    };
  }, [aquariumId]);

  const usedCapacity = fish.reduce(
    (total, item) => total + item.size * item.size,
    0,
  );

  const remainingCapacity = Math.max(
    0,
    AQUARIUM_CAPACITY - usedCapacity,
  );

  const handleBack = () => {
    if (savingRef.current) return;

    navigate(
      aquariumId
        ? `/fish/create?aquariumId=${encodeURIComponent(aquariumId)}`
        : '/aquariums',
    );
  };

  const handleDone = async (creation: FishCreation) => {
    if (!aquariumId || savingRef.current) return;

    if (creation.type !== '3d') {
      setError('Please create a 3D fish on this page.');
      return;
    }

    const cost = creation.size * creation.size;

    if (usedCapacity + cost > AQUARIUM_CAPACITY + 0.0001) {
      setError('Not enough space in this aquarium.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);

    try {
      await createFish(aquariumId, creation, fish.length);

      navigate(`/aquariums/${encodeURIComponent(aquariumId)}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create fish',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!aquariumId) {
    return (
      <main className="customize-fish-page">
        <div className="customize-fish-page__empty">
          <h1>No aquarium selected</h1>
          <p>Please select an aquarium before creating a fish.</p>

          <button
            type="button"
            onClick={() => navigate('/aquariums')}
          >
            My Aquariums
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="customize-fish-page">
      <header className="customize-fish-page__header">
        <button
          type="button"
          className="customize-fish-page__back"
          onClick={handleBack}
          disabled={saving}
        >
          ← Back
        </button>

        <div>
          <h1>Paint Your Fish</h1>
          <p>
            Choose a species, customize its colors, and bring it
            to life in your aquarium.
          </p>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="customize-fish-page__error"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="customize-fish-page__empty">
          <p>Loading aquarium...</p>
        </div>
      ) : error && fish.length === 0 ? (
        <div className="customize-fish-page__empty">
          <p>Unable to load aquarium capacity.</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="customize-fish-page__content">
          <div className="customize-fish-page__editor">
            <FishDrawingCanvas
              mode="color-3d"
              remainingCapacity={remainingCapacity}
              onDone={handleDone}
              onCancel={handleBack}
            />

            {saving && (
              <div
                className="customize-fish-page__saving"
                role="status"
              >
                Saving your fish...
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

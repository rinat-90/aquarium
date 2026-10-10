
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
  aquariumApi,
  type ApiAquarium,
} from '../../lib/aquarium-api';

import './CreateFishPage.css';

export function CreateFishPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const aquariumId = searchParams.get('aquariumId');

  const [aquariums, setAquariums] = useState<ApiAquarium[]>([]);
  const [selectedAquariumId, setSelectedAquariumId] = useState(
    aquariumId ?? '',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAquariums() {
      setLoading(true);
      setError(null);

      try {
        const items = await aquariumApi.list();

        if (cancelled) return;

        setAquariums(items);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load aquariums',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAquariums();

    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the selected aquarium synchronized with the URL
  // when navigating from an aquarium.
  useEffect(() => {
    if (aquariumId) {
      setSelectedAquariumId(aquariumId);
    }
  }, [aquariumId]);

  const validAquariumId = aquariums.some(
    (aquarium) => aquarium.id === selectedAquariumId,
  )
    ? selectedAquariumId
    : '';

  const canCreate = !loading && !!validAquariumId;

  const backToAquarium = () => {
    navigate(
      aquariumId
        ? `/aquariums/${encodeURIComponent(aquariumId)}`
        : '/aquariums',
    );
  };

  const handleDrawFish = () => {
    if (!canCreate) return;

    navigate(
      `/fish/create/draw?aquariumId=${encodeURIComponent(validAquariumId)}`,
    );
  };

  const handleCustomizeFish = () => {
    if (!canCreate) return;

    navigate(
      `/fish/create/3d?aquariumId=${encodeURIComponent(validAquariumId)}`,
    );
  };

  return (
    <div className="create-fish-page">
      <header className="create-fish-header">
        {aquariumId && (
          <button
            type="button"
            className="create-fish-back"
            onClick={backToAquarium}
          >
            ← Back
          </button>
        )}

        <div>
          <h1>Create a Fish</h1>
          <p>Choose how you want to bring your fish to life.</p>
        </div>
      </header>

      <section className="create-fish-destination">
        <label htmlFor="create-fish-aquarium">
          Choose Aquarium
        </label>

        <p>Where should your new fish live?</p>

        {loading ? (
          <p>Loading your aquariums...</p>
        ) : aquariums.length > 0 ? (
          <select
            id="create-fish-aquarium"
            value={validAquariumId}
            onChange={(event) => {
              setSelectedAquariumId(event.target.value);
            }}
          >
            <option value="">
              Select an aquarium
            </option>

            {aquariums.map((aquarium) => (
              <option
                key={aquarium.id}
                value={aquarium.id}
              >
                {aquarium.name}
              </option>
            ))}
          </select>
        ) : !error ? (
          <div className="create-fish-empty">
            <p>
              You don't have any aquariums yet.
              Create one before adding fish.
            </p>

            <button
              type="button"
              onClick={() => navigate('/aquariums')}
            >
              Go to My Aquariums →
            </button>
          </div>
        ) : null}

        {error && (
          <p className="create-fish-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <div className="create-fish-options">
        <button
          type="button"
          className="create-fish-card"
          disabled={!canCreate}
          onClick={handleDrawFish}
        >
          <div className="create-fish-card__art create-fish-card__art--draw">
            <span>🎨</span>
            <span>🐠</span>
          </div>

          <div className="create-fish-card__content">
            <h2>Draw Your Fish</h2>

            <p>
              Draw your own fish, give it a name, and watch it swim in your
              aquarium.
            </p>

            <span className="create-fish-card__action">
              Start Drawing →
            </span>
          </div>
        </button>

        <button
          type="button"
          className="create-fish-card"
          disabled={!canCreate}
          onClick={handleCustomizeFish}
        >
          <div className="create-fish-card__art create-fish-card__art--3d">
            <span>🐟</span>
            <span>✨</span>
          </div>

          <div className="create-fish-card__content">
            <h2>Customize 3D Fish</h2>

            <p>
              Choose a fish, change its colors and appearance, and make it
              your own.
            </p>

            <span className="create-fish-card__action">
              Customize Fish →
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { aquariumApi, type ApiAquarium } from '../../lib/aquarium-api';
import {
  DEFAULT_AQUARIUM_CUSTOMIZATION,
  type AquariumCustomization,
  type AquariumBackground,
  type AquariumSubstrate,
  type AquariumDecoration,
} from '../../features/aquarium-customization/types';

import './EditAquariumPage.css';

const backgrounds: { id: AquariumBackground; label: string }[] = [
  { id: 'ocean', label: 'Ocean' },
  { id: 'coral', label: 'Coral Reef' },
  { id: 'deep-sea', label: 'Deep Sea' },
  { id: 'fantasy', label: 'Fantasy' },
];

const substrates: { id: AquariumSubstrate; label: string }[] = [
  { id: 'sand', label: 'Sand' },
  { id: 'pebbles', label: 'Pebbles' },
  { id: 'dark-gravel', label: 'Dark Gravel' },
  { id: 'white-sand', label: 'White Sand' },
];

const decorations: { id: AquariumDecoration; label: string; icon: string }[] = [
  { id: 'rocks', label: 'Rocks', icon: '🪨' },
  { id: 'driftwood', label: 'Driftwood', icon: '🪵' },
  { id: 'green-plants', label: 'Plants', icon: '🌿' },
  { id: 'red-coral', label: 'Coral', icon: '🪸' },
  { id: 'cave', label: 'Cave', icon: '🏔️' },
];

export function EditAquariumPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [aquarium, setAquarium] = useState<ApiAquarium | null>(null);
  const [customization, setCustomization] =
    useState<AquariumCustomization>(DEFAULT_AQUARIUM_CUSTOMIZATION);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Aquarium ID is missing');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const result = await aquariumApi.get(id!);

        if (!cancelled) {
          setAquarium(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load aquarium',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  function toggleDecoration(decoration: AquariumDecoration) {
    setCustomization((current) => ({
      ...current,
      decorations: current.decorations.includes(decoration)
        ? current.decorations.filter((item) => item !== decoration)
        : [...current.decorations, decoration],
    }));
  }

  if (loading) {
    return <div className="edit-aquarium-loading">Loading aquarium...</div>;
  }

  if (!aquarium || !id) {
    return (
      <div className="edit-aquarium-loading">
        {error ?? 'Aquarium not found'}
      </div>
    );
  }

  return (
    <div className="edit-aquarium-page">
      <header className="edit-aquarium-header">
        <button type="button" onClick={() => navigate(`/aquariums/${id}`)}>
          ← Back
        </button>

        <div>
          <h1>Edit Aquarium</h1>
          <p>{aquarium.name}</p>
        </div>
      </header>

      <div className="edit-aquarium-layout">
        <section className="edit-aquarium-preview">
          <div className={`edit-aquarium-scene background-${customization.background}`}>
            <div className={`edit-aquarium-ground substrate-${customization.substrate}`} />

            <div className="edit-aquarium-preview-decorations">
              {customization.decorations.map((item) => {
                const decoration = decorations.find((entry) => entry.id === item);

                return (
                  <span key={item} title={decoration?.label}>
                    {decoration?.icon}
                  </span>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="edit-aquarium-panel">
          <h2>Customize Your Aquarium</h2>

          <section>
            <h3>Background</h3>
            <div className="edit-aquarium-options">
              {backgrounds.map((background) => (
                <button
                  key={background.id}
                  type="button"
                  className={
                    customization.background === background.id ? 'selected' : ''
                  }
                  onClick={() =>
                    setCustomization((current) => ({
                      ...current,
                      background: background.id,
                    }))
                  }
                >
                  {background.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Substrate</h3>
            <div className="edit-aquarium-options">
              {substrates.map((substrate) => (
                <button
                  key={substrate.id}
                  type="button"
                  className={
                    customization.substrate === substrate.id ? 'selected' : ''
                  }
                  onClick={() =>
                    setCustomization((current) => ({
                      ...current,
                      substrate: substrate.id,
                    }))
                  }
                >
                  {substrate.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Decorations</h3>
            <div className="edit-aquarium-options">
              {decorations.map((decoration) => (
                <button
                  key={decoration.id}
                  type="button"
                  className={
                    customization.decorations.includes(decoration.id)
                      ? 'selected'
                      : ''
                  }
                  onClick={() => toggleDecoration(decoration.id)}
                >
                  <span>{decoration.icon}</span>
                  {decoration.label}
                </button>
              ))}
            </div>
          </section>

          <div className="edit-aquarium-footer">
            <button
              type="button"
              onClick={() => navigate(`/aquariums/${id}`)}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled
              title="Saving will be enabled after API persistence is implemented"
            >
              Save Changes
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
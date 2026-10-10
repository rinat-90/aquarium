
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import {
  aquariumApi,
  type ApiAquarium,
} from '../../lib/aquarium-api';

import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { AquariumCard } from './AquariumCard';

import './AquariumsPage.css';

export function AquariumsPage() {
  const navigate = useNavigate();

  const [aquariums, setAquariums] = useState<ApiAquarium[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newAquariumName, setNewAquariumName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAquariums() {
      setLoading(true);
      setError(null);

      try {
        const items = await aquariumApi.list();

        if (!cancelled) {
          setAquariums(items);
        }
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

  function openCreateModal() {
    setNewAquariumName('');
    setCreateError(null);
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (creating) return;

    setCreateOpen(false);
    setNewAquariumName('');
    setCreateError(null);
  }

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const name = newAquariumName.trim();

    if (!name || name.length > 100 || creating) return;

    setCreating(true);
    setCreateError(null);

    try {
      const aquarium = await aquariumApi.create(name);

      setCreateOpen(false);

      navigate(
        `/aquariums/${encodeURIComponent(aquarium.id)}`,
      );
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : 'Failed to create aquarium',
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <header className="aquariums-header">
        <div>
          <h1>My Aquariums</h1>
          <p>Create different underwater worlds</p>
        </div>

        <button
          className="aquariums-create-button"
          type="button"
          onClick={openCreateModal}
        >
          <span>＋</span>
          New Aquarium
        </button>
      </header>

      {error && (
        <div className="aquariums-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="aquariums-message">
          Loading your aquariums...
        </p>
      ) : (
        <div className="aquariums-grid">
          {aquariums.map((aquarium) => (
            <AquariumCard
              key={aquarium.id}
              aquarium={aquarium}
            />
          ))}

          <button
            type="button"
            className="aquariums-new-card"
            onClick={openCreateModal}
          >
            <span className="aquariums-new-card__icon">
              +
            </span>

            <strong>Create a new aquarium</strong>
            <small>Design a new underwater world</small>
          </button>
        </div>
      )}

      <Modal
        open={createOpen}
        title="Create an Aquarium"
        description="Give your new underwater world a name."
        onClose={closeCreateModal}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={creating}
              onClick={closeCreateModal}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="dashboard-create-aquarium-form"
              disabled={
                creating ||
                !newAquariumName.trim() ||
                newAquariumName.trim().length > 100
              }
            >
              {creating ? 'Creating...' : 'Create Aquarium'}
            </Button>
          </>
        }
      >
        <form
          id="dashboard-create-aquarium-form"
          onSubmit={(event) => void handleCreate(event)}
        >
          <label
            className="aquarium-settings-label"
            htmlFor="dashboard-aquarium-name"
          >
            Aquarium Name
          </label>

          <input
            id="dashboard-aquarium-name"
            className="ui-input"
            autoFocus
            required
            maxLength={100}
            placeholder="e.g. Coral Paradise"
            value={newAquariumName}
            onChange={(event) => {
              setNewAquariumName(event.target.value);
            }}
            disabled={creating}
          />

          {createError && (
            <p className="aquarium-form-error" role="alert">
              {createError}
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}

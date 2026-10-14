
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import {
  aquariumApi,
  type ApiAquarium,
} from '../../lib/aquarium-api';
import { tvPairingApi } from '../../lib/tv-pairing-api';

import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { AquariumCard } from './AquariumCard';

import './AquariumsPage.css';

const BROADCAST_REFRESH_INTERVAL = 10_000;

export function AquariumsPage() {
  const navigate = useNavigate();

  const [aquariums, setAquariums] = useState<ApiAquarium[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [broadcastAquariumIds, setBroadcastAquariumIds] = useState<
    Set<string>
  >(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [newAquariumName, setNewAquariumName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    let requestInProgress = false;

    async function loadBroadcastStatus() {
      if (requestInProgress) return;

      requestInProgress = true;

      try {
        const result = await tvPairingApi.sessions();

        if (cancelled) return;

        const now = Date.now();

        const activeAquariumIds = new Set(
          result.sessions
            .filter(
              (session) =>
                session.isOnline &&
                Date.parse(session.expiresAt) > now,
            )
            .map((session) => session.aquariumId),
        );

        setBroadcastAquariumIds(activeAquariumIds);
      } catch (err) {
        // Broadcast status is optional metadata.
        // Don't prevent the aquarium list from loading.
        console.error('Failed to load TV broadcast status:', err);

        if (!cancelled) {
          setBroadcastAquariumIds(new Set());
        }
      } finally {
        requestInProgress = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void loadBroadcastStatus();
      }
    }

    void loadBroadcastStatus();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadBroadcastStatus();
      }
    }, BROADCAST_REFRESH_INTERVAL);

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      cancelled = true;

      window.clearInterval(intervalId);

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, []);

  useEffect(() => {
    const handleOpenCreate = () => {
      openCreateModal();
    };

    window.addEventListener('aquarium:open-create', handleOpenCreate);

    return () => {
      window.removeEventListener(
        'aquarium:open-create',
        handleOpenCreate,
      );
    };
  }, []);

  return (
    <>
      <header className="aquariums-header">
        <div>
          <h1>My Aquariums</h1>

          <p className="aquariums-header__description">
            Create, customize, and explore your underwater worlds
          </p>

          <p className="aquariums-header__count">
            {aquariums.length}{' '}
            {aquariums.length === 1 ? 'aquarium' : 'aquariums'}
          </p>
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
          {aquariums.map((aquarium) => {
            const isBroadcasting = broadcastAquariumIds.has(aquarium.id);

            console.log('Aquarium card:', {
              name: aquarium.name,
              id: aquarium.id,
              isBroadcasting,
            });

            return (
              <AquariumCard
                key={aquarium.id}
                aquarium={aquarium}
                isBroadcasting={isBroadcasting}
              />
            );
          })}

          <button
            type="button"
            className="aquariums-new-card"
            onClick={openCreateModal}
          >
            <span className="aquariums-new-card__icon">
              +
            </span>

            <strong>Create a new aquarium</strong>
            <small>Choose a theme, add fish, and make it your own.</small>
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

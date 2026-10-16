import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { aquariumApi, type ApiAquarium } from '../../lib/aquarium-api';
import { onboardingApi } from '../../lib/onboarding-api';
import { tvPairingApi } from '../../lib/tv-pairing-api';
import { saveAquariumAppearance } from '../../lib/save-aquarium-appearance';
import { AQUARIUM_THEMES } from '../../features/aquarium-customization/themeRegistry';
import { DEFAULT_AQUARIUM_CUSTOMIZATION } from '../../features/aquarium-customization/types';

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
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [completingOnboarding, setCompletingOnboarding] = useState(false);

  const [broadcastAquariumIds, setBroadcastAquariumIds] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [newAquariumName, setNewAquariumName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMode, setCreateMode] = useState<'empty' | 'starter'>('starter');
  const [starterThemeId, setStarterThemeId] = useState(AQUARIUM_THEMES[0].id);
  const [createError, setCreateError] = useState<string | null>(null);

  function openCreateModal() {
    setNewAquariumName('');
    setCreateMode(aquariums.length === 0 ? 'starter' : 'empty');
    setStarterThemeId(AQUARIUM_THEMES[0].id);
    setCreateError(null);
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (creating) return;

    setCreateOpen(false);
    setNewAquariumName('');
    setCreateError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newAquariumName.trim();

    if (!name || name.length > 100 || creating) return;

    setCreating(true);
    setCreateError(null);

    try {
      const aquarium = await aquariumApi.create(name);
      const starter =
        AQUARIUM_THEMES.find((theme) => theme.id === starterThemeId) ?? AQUARIUM_THEMES[0];
      const appearance =
        createMode === 'empty'
          ? { ...DEFAULT_AQUARIUM_CUSTOMIZATION, themeId: null, bubbles: 'none' as const }
          : { ...DEFAULT_AQUARIUM_CUSTOMIZATION, ...starter.appearance, themeId: starter.id };

      // Creation uses the existing POST endpoint, then saves initial appearance.
      try {
        await saveAquariumAppearance(aquarium.id, appearance);
      } catch (appearanceError) {
        // The aquarium already exists: don't retry creation and duplicate it.
        console.error('Could not save initial aquarium appearance:', appearanceError);
      }
      setCreateOpen(false);
      navigate(`/aquariums/edit/${encodeURIComponent(aquarium.id)}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create aquarium');
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
        const [items, status] = await Promise.all([aquariumApi.list(), onboardingApi.get()]);

        if (!cancelled) {
          setAquariums(items);
          setOnboardingCompleted(status.onboardingCompleted);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load aquariums');
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
            .filter((session) => session.isOnline && Date.parse(session.expiresAt) > now)
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

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;

      window.clearInterval(intervalId);

      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleOpenCreate = () => {
      openCreateModal();
    };

    window.addEventListener('aquarium:open-create', handleOpenCreate);

    return () => {
      window.removeEventListener('aquarium:open-create', handleOpenCreate);
    };
  }, []);

  // Completing the first fish is a durable onboarding milestone. The fish is
  // already persisted by the existing creator; when the user returns to this
  // dashboard, persist completion once (without blocking the aquarium list).
  useEffect(() => {
    if (loading || onboardingCompleted !== false) return;
    if (!aquariums.some((aquarium) => aquarium.fish.length > 0)) return;

    let cancelled = false;
    void onboardingApi
      .complete()
      .then(() => {
        if (!cancelled) setOnboardingCompleted(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error('Could not complete Finny onboarding:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [aquariums, loading, onboardingCompleted]);

  async function skipOnboarding() {
    if (completingOnboarding) return;
    setCompletingOnboarding(true);
    setOnboardingError(null);
    try {
      await onboardingApi.complete();
      setOnboardingCompleted(true);
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : 'Could not save your preference');
    } finally {
      setCompletingOnboarding(false);
    }
  }

  // The API provisions a blank default aquarium for every new account.
  // Treat it as the first aquarium instead of asking the user to create a duplicate.
  // Only show the introduction while the server says onboarding is incomplete.
  const starterAquarium =
    aquariums.length === 1 &&
    aquariums[0].isDefault &&
    aquariums[0].themeId === null &&
    Object.keys(aquariums[0].appearance ?? {}).length === 0 &&
    aquariums[0].fish.length === 0
      ? aquariums[0]
      : null;
  const showWelcome =
    !loading &&
    !error &&
    onboardingCompleted === false &&
    (aquariums.length === 0 || starterAquarium !== null);

  return (
    <>
      <header className="aquariums-header">
        <div>
          <h1>My Aquariums</h1>

          <p className="aquariums-header__description">
            Create, customize, and explore your underwater worlds
          </p>

          <p className="aquariums-header__count">
            {aquariums.length} {aquariums.length === 1 ? 'aquarium' : 'aquariums'}
          </p>
        </div>

        <button
          className="aquariums-mobile-add-button"
          hidden={showWelcome}
          type="button"
          onClick={openCreateModal}
          aria-label="Create a new aquarium"
          title="Create a new aquarium"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <button
          className="aquariums-create-button"
          type="button"
          onClick={openCreateModal}
          hidden={showWelcome}
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

      {showWelcome && (
        <section className="finny-welcome" aria-labelledby="finny-welcome-title">
          <div className="finny-welcome__intro">
            <img src="/finny-icon.png" alt="" className="finny-welcome__mascot" />
            <div>
              <span className="finny-welcome__eyebrow">YOUR UNDERWATER ADVENTURE STARTS HERE</span>
              <h2 id="finny-welcome-title">Welcome to Finny!</h2>
              <p>Draw it. Watch it swim. Let's bring your underwater world to life!</p>
            </div>
          </div>
          <ol className="finny-welcome__steps">
            <li>
              <span aria-hidden="true">🌊</span>
              <strong>Pick your world</strong>
              <small>Choose a colorful aquarium theme.</small>
            </li>
            <li>
              <span aria-hidden="true">🎨</span>
              <strong>Make a fish</strong>
              <small>Draw, scan, or customize your fish.</small>
            </li>
            <li>
              <span aria-hidden="true">🐠</span>
              <strong>Watch it swim</strong>
              <small>See your fish come to life. TV is optional!</small>
            </li>
          </ol>
          <div className="finny-welcome__actions">
            <button
              className="finny-welcome__start"
              type="button"
              onClick={() =>
                starterAquarium
                  ? navigate(`/fish/create?aquariumId=${encodeURIComponent(starterAquarium.id)}`)
                  : openCreateModal()
              }
            >
              {starterAquarium ? 'Create my first fish' : 'Create my first aquarium'}{' '}
              <span aria-hidden="true">→</span>
            </button>
            {starterAquarium && (
              <button
                className="finny-welcome__secondary finny-welcome__customize"
                type="button"
                onClick={() =>
                  navigate(`/aquariums/edit/${encodeURIComponent(starterAquarium.id)}`)
                }
              >
                Customize my aquarium
              </button>
            )}
            <button
              className="finny-welcome__secondary finny-welcome__skip"
              type="button"
              disabled={completingOnboarding}
              onClick={() => void skipOnboarding()}
            >
              {completingOnboarding ? 'Saving...' : 'Skip intro'}
            </button>
          </div>
          {onboardingError && (
            <p className="aquariums-error" role="alert">
              {onboardingError}
            </p>
          )}
        </section>
      )}

      {loading ? (
        <p className="aquariums-message">Loading your aquariums...</p>
      ) : aquariums.length > 0 && !showWelcome ? (
        <div className="aquariums-grid">
          {aquariums.map((aquarium) => {
            const isBroadcasting = broadcastAquariumIds.has(aquarium.id);

            return (
              <AquariumCard key={aquarium.id} aquarium={aquarium} isBroadcasting={isBroadcasting} />
            );
          })}

          <button type="button" className="aquariums-new-card" onClick={openCreateModal}>
            <span className="aquariums-new-card__icon">+</span>

            <strong>Create a new aquarium</strong>
            <small>Choose a theme, add fish, and make it your own.</small>
          </button>
        </div>
      ) : null}

      <Modal
        open={createOpen}
        title="Create an Aquarium"
        description="Name your underwater world and choose how to begin."
        onClose={closeCreateModal}
        footer={
          <>
            <Button variant="ghost" disabled={creating} onClick={closeCreateModal}>
              Cancel
            </Button>

            <Button
              type="submit"
              form="dashboard-create-aquarium-form"
              disabled={creating || !newAquariumName.trim() || newAquariumName.trim().length > 100}
            >
              {creating ? 'Creating...' : 'Create Aquarium'}
            </Button>
          </>
        }
      >
        <form id="dashboard-create-aquarium-form" onSubmit={(event) => void handleCreate(event)}>
          <label className="aquarium-settings-label" htmlFor="dashboard-aquarium-name">
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

          <fieldset className="aquariums-create-choices" disabled={creating}>
            <legend>How would you like to start?</legend>
            <label
              className={`aquariums-create-choice${createMode === 'empty' ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="aquarium-start"
                value="empty"
                checked={createMode === 'empty'}
                onChange={() => setCreateMode('empty')}
              />
              <span className="aquariums-create-choice__icon" aria-hidden="true">
                ◯
              </span>
              <span>
                <strong>Empty Aquarium</strong>
                <small>Start from scratch with water and light</small>
              </span>
            </label>
            <label
              className={`aquariums-create-choice${createMode === 'starter' ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="aquarium-start"
                value="starter"
                checked={createMode === 'starter'}
                onChange={() => setCreateMode('starter')}
              />
              <span className="aquariums-create-choice__icon" aria-hidden="true">
                ✦
              </span>
              <span>
                <strong>Starter Theme</strong>
                <small>Begin with a ready-made underwater world</small>
              </span>
            </label>
            {createMode === 'starter' && (
              <label className="aquariums-create-theme">
                Choose a theme
                <select
                  value={starterThemeId}
                  onChange={(event) => setStarterThemeId(event.target.value)}
                >
                  {AQUARIUM_THEMES.filter((theme) => theme.access === 'free').map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>

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

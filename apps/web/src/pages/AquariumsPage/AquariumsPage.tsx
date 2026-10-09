import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { authClient } from '../../lib/auth-client';
import { aquariumApi, type ApiAquarium } from '../../lib/aquarium-api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { AquariumCard } from './AquariumCard';
import './AquariumsPage.css';

type DashboardUser = { name: string };

export function AquariumsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [aquariums, setAquariums] = useState<ApiAquarium[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newAquariumName, setNewAquariumName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const items = await aquariumApi.list();
        if (!cancelled) setAquariums(items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load aquariums');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadUser() {
      try {
        // Avoid the Better Auth useSession() inference issue in this project.
        // Validate the response shape before reading user properties.
        const result: unknown = await authClient.getSession({
          query: {},
        });
        if (typeof result !== 'object' || result === null || !('data' in result)) return;
        const data = result.data;
        if (typeof data !== 'object' || data === null || !('user' in data)) return;
        const sessionUser = data.user;
        if (typeof sessionUser !== 'object' || sessionUser === null || !('name' in sessionUser)) return;
        if (!cancelled && typeof sessionUser.name === 'string') {
          setUser({ name: sessionUser.name });
        }
      } catch {
        // The dashboard remains usable with the fallback account label.
      }
    }

    void loadDashboard();
    void loadUser();
    return () => { cancelled = true; };
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newAquariumName.trim();
    if (!name || name.length > 100 || creating) return;

    setCreating(true);
    setCreateError(null);
    try {
      const aquarium = await aquariumApi.create(name);
      setCreateOpen(false);
      navigate(`/aquariums/${aquarium.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create aquarium');
    } finally {
      setCreating(false);
    }
  }

  async function handleSignOut() {
    const result = await authClient.signOut({});
    if (result.error) {
      setError(result.error.message ?? 'Failed to sign out');
      return;
    }
    navigate('/login', { replace: true });
  }

  return (
    <div className="aquariums-layout">
      <aside className="aquariums-sidebar">
        <Link className="aquariums-brand" to="/aquariums">
          <span className="aquariums-brand__icon">🐠</span>
          <span><strong>Family</strong><small>Aquarium</small></span>
        </Link>

        <nav className="aquariums-navigation" aria-label="Main navigation">
          <Link className="aquariums-navigation__item active" to="/aquariums">
            <span>▣</span> Aquariums
          </Link>
          <button className="aquariums-navigation__item" type="button" disabled title="Coming soon">
            <span>✧</span> Create Fish
          </button>
          <div className="aquariums-navigation__item aquariums-navigation__item--disabled">
            <span>♙</span> Profile
          </div>
        </nav>

        <div className="aquariums-sidebar__bottom">
          <div className="aquariums-user">
            <div className="aquariums-user__avatar">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="aquariums-user__details">
              <strong>{user?.name ?? 'Aquarium User'}</strong>
              <button type="button" onClick={() => void handleSignOut()}>Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      <main className="aquariums-content">
        <header className="aquariums-header">
          <div><h1>My Aquariums</h1><p>Create different underwater worlds</p></div>
          <button className="aquariums-create-button" type="button" onClick={openCreateModal}>
            <span>＋</span> New Aquarium
          </button>
        </header>

        {error && <div className="aquariums-error" role="alert">{error}</div>}

        {loading ? (
          <p className="aquariums-message">Loading your aquariums...</p>
        ) : (
          <div className="aquariums-grid">
            {aquariums.map((aquarium) => (
              <AquariumCard key={aquarium.id} aquarium={aquarium} />
            ))}
            <button type="button" className="aquariums-new-card" onClick={openCreateModal}>
              <span className="aquariums-new-card__icon">+</span>
              <strong>Create a new aquarium</strong>
              <small>Design a new underwater world</small>
            </button>
          </div>
        )}
      </main>

      <Modal
        open={createOpen}
        title="Create an Aquarium"
        description="Give your new underwater world a name."
        onClose={closeCreateModal}
        footer={
          <>
            <Button variant="ghost" disabled={creating} onClick={closeCreateModal}>Cancel</Button>
            <Button type="submit" form="dashboard-create-aquarium-form" disabled={creating || !newAquariumName.trim()}>
              {creating ? 'Creating...' : 'Create Aquarium'}
            </Button>
          </>
        }
      >
        <form id="dashboard-create-aquarium-form" onSubmit={(event) => void handleCreate(event)}>
          <label className="aquarium-settings-label" htmlFor="dashboard-aquarium-name">Aquarium Name</label>
          <input
            id="dashboard-aquarium-name"
            className="ui-input"
            autoFocus
            required
            maxLength={100}
            placeholder="e.g. Coral Paradise"
            value={newAquariumName}
            onChange={(event) => setNewAquariumName(event.target.value)}
            disabled={creating}
          />
          {createError && <p className="aquarium-form-error" role="alert">{createError}</p>}
        </form>
      </Modal>
    </div>
  );
}

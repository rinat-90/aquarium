
import { useEffect, useState, type FormEvent } from 'react';
import { authClient } from '../../lib/auth-client';
import { aquariumApi } from '../../lib/aquarium-api';
import './ProfilePage.css';

type ProfileUser = {
  name: string;
  email: string;
  createdAt?: string | Date;
};

export function ProfilePage() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [name, setName] = useState('');
  const [aquariumCount, setAquariumCount] = useState<number | null>(null);
  const [fishCount, setFishCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const result = await authClient.getSession({
          query: {},
        });

        if (result.error) {
          throw new Error(
            result.error.message ?? 'Failed to load profile',
          );
        }

        const sessionUser = result.data?.user;

        if (!sessionUser) {
          throw new Error('Your session has expired.');
        }

        if (!cancelled) {
          setUser({
            name: sessionUser.name,
            email: sessionUser.email,
            createdAt: sessionUser.createdAt,
          });

          setName(sessionUser.name);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load profile',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    async function loadStatistics() {
      try {
        const aquariums = await aquariumApi.list();

        if (cancelled) return;

        setAquariumCount(aquariums.length);
        setFishCount(
          aquariums.reduce(
            (total, aquarium) => total + aquarium.fish.length,
            0,
          ),
        );
      } catch {
        if (!cancelled) {
          setStatsError('Could not load aquarium statistics.');
        }
      }
    }

    void loadProfile();
    void loadStatistics();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (
      !user ||
      !trimmedName ||
      trimmedName.length > 100 ||
      trimmedName === user.name ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await authClient.updateUser({
        name: trimmedName,
      });

      if (result.error) {
        throw new Error(
          result.error.message ?? 'Failed to update profile',
        );
      }

      setUser((previous) =>
        previous
          ? { ...previous, name: trimmedName }
          : previous,
      );

      setName(trimmedName);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update profile',
      );
    } finally {
      setSaving(false);
    }
  }

  const initials = user?.name?.trim().charAt(0).toUpperCase() || 'U';

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
    : '—';

  if (loading) {
    return <p className="profile-message">Loading your profile...</p>;
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>My Profile</h1>
        <p>Manage your account and aquarium collection.</p>
      </header>

      <section className="profile-summary">
        <div className="profile-avatar">{initials}</div>

        <div>
          <h2>{user?.name ?? 'Aquarium User'}</h2>
          <p>{user?.email ?? ''}</p>
          <span>Member since {memberSince}</span>
        </div>
      </section>

      <div className="profile-grid">
        <section className="profile-card">
          <h2>Account Information</h2>
          <p>Update how your name appears in Family Aquarium.</p>

          <form onSubmit={(event) => void handleSave(event)}>
            <label htmlFor="profile-name">Display Name</label>

            <input
              id="profile-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSuccess(false);
              }}
              maxLength={100}
              required
              disabled={saving || !user}
            />

            <label htmlFor="profile-email">Email Address</label>

            <input
              id="profile-email"
              value={user?.email ?? ''}
              readOnly
            />

            {error && (
              <p className="profile-error" role="alert">
                {error}
              </p>
            )}

            {success && (
              <p className="profile-success" role="status">
                Profile updated successfully.
              </p>
            )}

            <button
              type="submit"
              disabled={
                saving ||
                !user ||
                !name.trim() ||
                name.trim() === user.name
              }
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        <section className="profile-card">
          <h2>My Aquarium World</h2>
          <p>Your underwater collection at a glance.</p>

          <div className="profile-stats">
            <div className="profile-stat">
              <strong>{aquariumCount ?? '—'}</strong>
              <span>Aquariums</span>
            </div>

            <div className="profile-stat">
              <strong>{fishCount ?? '—'}</strong>
              <span>Fish</span>
            </div>
          </div>

          {statsError && (
            <p className="profile-error" role="alert">
              {statsError}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

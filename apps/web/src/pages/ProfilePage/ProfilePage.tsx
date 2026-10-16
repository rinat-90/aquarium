import { useNavigate } from 'react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { authClient } from '../../lib/auth-client';
import { aquariumApi } from '../../lib/aquarium-api';
import './ProfilePage.css';
import './ProfileAccount.css';

type ProfileUser = {
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt?: string | Date;
};

export function ProfilePage() {
  const navigate = useNavigate();

  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [changeEmailMessage, setChangeEmailMessage] = useState('');
  const [changeEmailError, setChangeEmailError] = useState('');
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState('');

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
        // Fetch current account data after an email verification callback.
        // Do not use the potentially stale cookie-cached session here.
        const result = await authClient.getSession({
          query: { disableCookieCache: true },
        });

        if (result.error) {
          throw new Error(result.error.message ?? 'Failed to load profile');
        }

        const sessionUser = result.data?.user;

        if (!sessionUser) {
          throw new Error('Your session has expired.');
        }

        if (!cancelled) {
          setUser({
            name: sessionUser.name,
            email: sessionUser.email,
            emailVerified: sessionUser.emailVerified,
            createdAt: sessionUser.createdAt,
          });

          setName(sessionUser.name);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load profile');
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
        setFishCount(aquariums.reduce((total, aquarium) => total + aquarium.fish.length, 0));
      } catch {
        if (!cancelled) {
          setStatsError('Could not load aquarium statistics.');
        }
      }
    }

    void loadProfile();
    void loadStatistics();

    // Verification links may return to an already-open profile tab.
    // Re-read the account when the tab becomes active again.
    const refreshOnFocus = () => {
      void loadProfile();
    };
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') void loadProfile();
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!user || !trimmedName || trimmedName.length > 100 || trimmedName === user.name || saving) {
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
        throw new Error(result.error.message ?? 'Failed to update profile');
      }

      setUser((previous) => (previous ? { ...previous, name: trimmedName } : previous));

      setName(trimmedName);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
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

  async function handleResendVerification() {
    if (!user || user.emailVerified || sendingVerification) return;
    setSendingVerification(true);
    setVerificationMessage('');
    setVerificationError('');

    try {
      const result = await authClient.sendVerificationEmail({
        email: user.email,
        callbackURL: `${window.location.origin}/profile`,
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Unable to send verification email');
      }
      setVerificationMessage('Verification email sent. Please check your inbox.');
    } catch {
      setVerificationError('Unable to send verification email. Please try again.');
    } finally {
      setSendingVerification(false);
    }
  }

  async function handleChangeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || changingEmail) return;
    const nextEmail = newEmail.trim().toLowerCase();
    if (!nextEmail || nextEmail === user.email.toLowerCase()) {
      setChangeEmailError('Enter a different email address.');
      return;
    }
    setChangingEmail(true);
    setChangeEmailError('');
    setChangeEmailMessage('');
    try {
      const result = await authClient.changeEmail({
        newEmail: nextEmail,
        callbackURL: `${window.location.origin}/profile`,
      });
      if (result.error) throw new Error(result.error.message ?? 'Unable to change email');
      setChangeEmailMessage(
        'Verification email sent to your new address. Open that email and click Verify My Email to complete the change.',
      );
      setEditingEmail(false);
      setNewEmail('');
    } catch (err) {
      setChangeEmailError(err instanceof Error ? err.message : 'Unable to change email.');
    } finally {
      setChangingEmail(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setSignOutError(null);

    try {
      const result = await authClient.signOut({});

      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to sign out');
      }

      navigate('/login', { replace: true });
    } catch (err) {
      setSignOutError(err instanceof Error ? err.message : 'Failed to sign out');
    } finally {
      setSigningOut(false);
    }
  }

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

      <form id="profile-change-email-form" onSubmit={(event) => void handleChangeEmail(event)} />

      <div className="profile-grid">
        <section className="profile-card">
          <h2>Account Information</h2>
          <p>Update how your name appears in Finny.</p>

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

            <input id="profile-email" value={user?.email ?? ''} readOnly />

            <div className="profile-change-email">
              {!editingEmail ? (
                <button
                  type="button"
                  className="profile-secondary-action"
                  onClick={() => {
                    setEditingEmail(true);
                    setChangeEmailError('');
                    setChangeEmailMessage('');
                  }}
                  disabled={!user}
                >
                  Change Email
                </button>
              ) : (
                <div className="profile-email-editor">
                  <label htmlFor="profile-new-email">New email address</label>
                  <input
                    form="profile-change-email-form"
                    id="profile-new-email"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="new@example.com"
                    required
                  />
                  <div className="profile-email-actions">
                    <button
                      type="button"
                      className="profile-secondary-action"
                      onClick={() => {
                        setEditingEmail(false);
                        setNewEmail('');
                        setChangeEmailError('');
                      }}
                      disabled={changingEmail}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="profile-change-email-form"
                      disabled={changingEmail || !newEmail.trim()}
                    >
                      {changingEmail ? 'Sending...' : 'Continue'}
                    </button>
                  </div>
                </div>
              )}
              {changeEmailMessage && (
                <p className="profile-success" role="status">
                  {changeEmailMessage}
                </p>
              )}
              {changeEmailError && (
                <p className="profile-error" role="alert">
                  {changeEmailError}
                </p>
              )}
            </div>

            <div className="profile-email-verification" style={{ marginTop: 12, marginBottom: 20 }}>
              {user?.emailVerified ? (
                <p className="profile-success" role="status">
                  ✓ Email verified
                </p>
              ) : user ? (
                <>
                  <p>Your email address hasn't been verified yet.</p>
                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    disabled={sendingVerification}
                  >
                    {sendingVerification ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                  {verificationMessage && (
                    <p className="profile-success" role="status">
                      {verificationMessage}
                    </p>
                  )}
                  {verificationError && (
                    <p className="profile-error" role="alert">
                      {verificationError}
                    </p>
                  )}
                </>
              ) : null}
            </div>

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
              disabled={saving || !user || !name.trim() || name.trim() === user.name}
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

      <section className="profile-account-signout">
        <button type="button" onClick={() => void handleSignOut()} disabled={signingOut}>
          <span aria-hidden="true">↪</span>
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </button>

        {signOutError && (
          <p className="profile-error" role="alert">
            {signOutError}
          </p>
        )}
      </section>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';

import { aquariumApi, type ApiAquarium } from '../../lib/aquarium-api';
import { tvPairingApi } from '../../lib/tv-pairing-api';
import { authClient } from '../../lib/auth-client';

export function TvPairPage() {
  const { code = '' } = useParams<{ code: string }>();

  const [aquariums, setAquariums] = useState<ApiAquarium[]>([]);
  const [aquariumId, setAquariumId] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAquariums() {
      setLoading(true);
      setError(null);

      try {
        const session = await authClient.getSession({ query: {} });

        if (cancelled) return;

        if (!session.data?.user) {
          setNeedsLogin(true);
          return;
        }

        setNeedsLogin(false);

        const items = await aquariumApi.list();

        if (cancelled) return;

        setAquariums(items);
        setAquariumId(items[0]?.id ?? '');
      } catch (err) {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : 'Could not load aquariums.');
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

  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!aquariumId || submitting || !code) return;

    setSubmitting(true);
    setError(null);

    try {
      await tvPairingApi.approve(code, aquariumId);
      setApproved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve TV.');
    } finally {
      setSubmitting(false);
    }
  }

  const returnTo = `/tv/pair/${encodeURIComponent(code)}`;
  const loginUrl = `/login?redirect=${encodeURIComponent(returnTo)}`;

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#092b3a',
        color: 'white',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 28,
          borderRadius: 20,
          background: '#12465b',
        }}
      >
        <h1>Connect your TV</h1>

        {approved ? (
          <>
            <p>TV approved! Your aquarium should appear on the TV shortly.</p>

            <Link to="/aquariums" style={{ color: '#9de8ff' }}>
              Back to aquariums
            </Link>
          </>
        ) : loading ? (
          <p>Checking your account...</p>
        ) : needsLogin ? (
          <>
            <p>Please sign in to connect your aquarium to this TV.</p>

            <Link to={loginUrl} style={{ color: '#9de8ff' }}>
              Sign in
            </Link>
          </>
        ) : (
          <form onSubmit={approve}>
            <p>Select which aquarium this TV can display.</p>

            <select
              aria-label="Aquarium"
              value={aquariumId}
              onChange={(event) => setAquariumId(event.target.value)}
              disabled={aquariums.length === 0}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              {aquariums.length === 0 && <option value="">No aquariums available</option>}

              {aquariums.map((aquarium) => (
                <option key={aquarium.id} value={aquarium.id}>
                  {aquarium.name}
                </option>
              ))}
            </select>

            {error && (
              <p role="alert" style={{ color: '#ffd1d1' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!aquariumId || submitting || aquariums.length === 0}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 10,
                border: 0,
                cursor: 'pointer',
              }}
            >
              {submitting ? 'Connecting...' : 'Connect TV'}
            </button>

            {aquariums.length === 0 && (
              <p>
                No aquariums found.{' '}
                <Link to="/aquariums" style={{ color: '#9de8ff' }}>
                  Create one
                </Link>{' '}
                first.
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}

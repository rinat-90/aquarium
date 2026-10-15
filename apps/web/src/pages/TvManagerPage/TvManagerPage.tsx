import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { tvPairingApi } from '../../lib/tv-pairing-api';
import { aquariumApi } from '../../lib/aquarium-api';
const TvQrScanner = lazy(() =>
  import('./TvQrScanner').then((module) => ({ default: module.TvQrScanner })),
);
import './TvManagerPage.css';

type TvSession = Awaited<ReturnType<typeof tvPairingApi.sessions>>['sessions'][number];

type Aquarium = Awaited<ReturnType<typeof aquariumApi.list>>[number];

export function TvManagerPage() {
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);

  const [sessions, setSessions] = useState<TvSession[]>([]);
  const [aquariums, setAquariums] = useState<Aquarium[]>([]);
  const [selectedAquariumId, setSelectedAquariumId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');

  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sessionResult, aquariumResult] = await Promise.all([
        tvPairingApi.sessions(),
        aquariumApi.list(),
      ]);

      const activeSessions = sessionResult.sessions.filter(
        (session) => session.isOnline && Date.parse(session.expiresAt) > Date.now(),
      );

      setSessions(activeSessions);
      setAquariums(aquariumResult);

      setSelectedSessionId((current) =>
        activeSessions.some((session) => session.id === current)
          ? current
          : activeSessions.length === 1
            ? activeSessions[0].id
            : '',
      );

      setSelectedAquariumId((current) =>
        aquariumResult.some((aquarium) => aquarium.id === current)
          ? current
          : activeSessions.length === 1
            ? activeSessions[0].aquariumId
            : (aquariumResult[0]?.id ?? ''),
      );

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TV connections.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId);

  const currentAquarium = aquariums.find((aquarium) => aquarium.id === selectedSession?.aquariumId);

  const selectedAquarium = aquariums.find((aquarium) => aquarium.id === selectedAquariumId);

  const isCurrentAquarium = selectedSession?.aquariumId === selectedAquariumId;

  async function handleSwitchAquarium() {
    if (!selectedSession || !selectedAquariumId || actionPending) return;
    if (isCurrentAquarium) return;

    setActionPending(true);
    setError(null);

    try {
      await tvPairingApi.switchAquarium(selectedSession.id, selectedAquariumId);

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch aquarium.');
    } finally {
      setActionPending(false);
    }
  }

  async function handleEndBroadcast() {
    if (!selectedSession || actionPending) return;

    if (!window.confirm('End this TV broadcast?')) return;

    setActionPending(true);
    setError(null);

    try {
      await tvPairingApi.revoke(selectedSession.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end broadcast.');
    } finally {
      setActionPending(false);
    }
  }

  return (
    <main className="tv-manager">
      <header className="tv-manager__header">
        <div className="tv-manager__header-icon">📺</div>

        <div className="tv-manager__header-content">
          <h1>TV Broadcast</h1>
          <p>Manage your connected aquarium</p>
        </div>
      </header>

      {loading ? (
        <p>Loading TV connections...</p>
      ) : (
        <>
          {error && (
            <div className="tv-manager__error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => void load()}>
                Retry
              </button>
            </div>
          )}

          {sessions.length === 0 ? (
            <section className="tv-manager__card tv-manager__empty">
              <div className="tv-manager__icon">📺</div>

              <h2>Connect Your TV</h2>

              <p>Display your aquarium on the big screen.</p>

              <ol>
                <li>Open Family Aquarium on your TV.</li>
                <li>Scan the QR code displayed on the TV.</li>
                <li>Select the aquarium you want to display.</li>
              </ol>

              <button
                type="button"
                className="tv-manager__primary"
                onClick={() => setScannerOpen(true)}
              >
                📷 Scan TV QR Code
              </button>

              <small>
                QR scanner is coming next. You can currently use your phone camera to scan the TV
                code.
              </small>
            </section>
          ) : (
            <section className="tv-manager__card tv-manager__control">
              {sessions.length === 1 ? (
                <div className="tv-manager__status">
                  <span className="tv-manager__status-dot" />
                  TV Session Available
                </div>
              ) : (
                <div className="tv-manager__section">
                  <label htmlFor="tv-session">Select TV Session</label>

                  <select
                    id="tv-session"
                    value={selectedSessionId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      const session = sessions.find((item) => item.id === nextId);

                      setSelectedSessionId(nextId);

                      if (session) {
                        setSelectedAquariumId(session.aquariumId);
                      }
                    }}
                  >
                    <option value="">Choose a TV session</option>

                    {sessions.map((session, index) => (
                      <option key={session.id} value={session.id}>
                        TV Session {index + 1} —{' '}
                        {aquariums.find((item) => item.id === session.aquariumId)?.name ??
                          'Unknown Aquarium'}
                      </option>
                    ))}
                  </select>

                  <small>
                    Multiple unexpired sessions found. Select the TV you want to control.
                  </small>
                </div>
              )}

              {selectedSession ? (
                <>
                  <div className="tv-manager__section">
                    <span className="tv-manager__label">Currently Broadcasting</span>

                    <button
                      type="button"
                      className="tv-manager__current"
                      onClick={() =>
                        navigate(`/aquariums/${encodeURIComponent(selectedSession.aquariumId)}`)
                      }
                    >
                      <span className="tv-manager__fish-icon">🐠</span>

                      <span className="tv-manager__current-info">
                        <strong>{currentAquarium?.name ?? 'My Aquarium'}</strong>
                        <small>Open Aquarium</small>
                      </span>

                      <span aria-hidden="true">›</span>
                    </button>
                  </div>

                  <div className="tv-manager__section">
                    <h2>Select Aquarium</h2>

                    <p className="tv-manager__description">
                      Choose which aquarium to display on your TV.
                    </p>

                    <div className="tv-manager__aquarium-list">
                      {aquariums.map((aquarium) => {
                        const selected = selectedAquariumId === aquarium.id;

                        const onTv = selectedSession.aquariumId === aquarium.id;

                        return (
                          <button
                            key={aquarium.id}
                            type="button"
                            className={[
                              'tv-manager__aquarium-option',
                              selected ? 'tv-manager__aquarium-option--selected' : '',
                            ].join(' ')}
                            onClick={() => setSelectedAquariumId(aquarium.id)}
                          >
                            <span className="tv-manager__fish-icon">🐠</span>

                            <span className="tv-manager__aquarium-info">
                              <strong>{aquarium.name}</strong>

                              {onTv && <small className="tv-manager__on-tv">On TV</small>}
                            </span>

                            <span className="tv-manager__radio">{selected ? '✓' : ''}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="tv-manager__actions">
                    <button
                      type="button"
                      className="tv-manager__primary"
                      disabled={actionPending || !selectedAquarium || isCurrentAquarium}
                      onClick={() => void handleSwitchAquarium()}
                    >
                      {actionPending
                        ? 'Please wait...'
                        : isCurrentAquarium
                          ? 'Currently Broadcasting'
                          : '📺 Switch Aquarium'}
                    </button>

                    <button
                      type="button"
                      className="tv-manager__end"
                      disabled={actionPending}
                      onClick={() => void handleEndBroadcast()}
                    >
                      ⏹ End Broadcast
                    </button>
                  </div>
                </>
              ) : (
                <p className="tv-manager__description">
                  Select a TV session above to manage its broadcast.
                </p>
              )}
            </section>
          )}
        </>
      )}

      {scannerOpen && (
        <Suspense fallback={<p role="status">Loading QR scanner…</p>}>
          <TvQrScanner
            onClose={() => setScannerOpen(false)}
            onScanned={(path) => {
              setScannerOpen(false);
              navigate(path);
            }}
          />
        </Suspense>
      )}
    </main>
  );
}

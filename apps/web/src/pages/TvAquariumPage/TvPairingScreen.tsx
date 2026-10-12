
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { tvPairingApi } from '../../lib/tv-pairing-api';

export type TvDisplayCredentials = {
  token: string;
  aquariumId: string;
  expiresAt: string;
};

type PairingChallenge = {
  code: string;
  expiresAt: string;
};

export function TvPairingScreen({
                                  onPaired,
                                }: {
  onPaired: (credentials: TvDisplayCredentials) => void;
}) {
  const [challenge, setChallenge] =
    useState<PairingChallenge | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const onPairedRef = useRef(onPaired);

  useEffect(() => {
    onPairedRef.current = onPaired;
  }, [onPaired]);

  useEffect(() => {
    console.log('[TV] Pairing screen mounted');

    return () => {
      console.log('[TV] Pairing screen unmounted');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let completed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    console.log('[TV] Starting pairing attempt:', attempt);

    async function start() {
      try {
        const next = await tvPairingApi.create();

        if (cancelled) {
          console.log('[TV] Ignoring cancelled pairing creation');
          return;
        }

        console.log('[TV] Pairing challenge created', {
          expiresAt: next.expiresAt,
        });

        setChallenge(next);
        setError(null);

        async function poll() {
          if (cancelled || completed) return;

          if (Date.now() >= Date.parse(next.expiresAt)) {
            console.warn('[TV] Pairing challenge expired');
            setError('Pairing code expired. Generate a new code.');
            return;
          }

          try {
            const result = await tvPairingApi.poll(next.code);

            if (cancelled || completed) return;

            console.log('[TV] Pairing poll:', result.status);

            if (result.status === 'paired') {
              completed = true;

              if (timer) clearTimeout(timer);

              console.log('[TV] Paired successfully', {
                aquariumId: result.aquariumId,
                expiresAt: result.expiresAt,
              });

              onPairedRef.current({
                token: result.token,
                aquariumId: result.aquariumId,
                expiresAt: result.expiresAt,
              });

              return;
            }

            if (result.status === 'expired') {
              console.warn('[TV] Server reports expired pairing');

              setError('Pairing code expired. Generate a new code.');
              return;
            }
          } catch (err) {
            if (cancelled) return;

            console.error('[TV] Pairing poll failed:', err);

            setError(
              err instanceof Error
                ? err.message
                : 'Pairing failed',
            );

            return;
          }

          if (!cancelled && !completed) {
            timer = setTimeout(poll, 2000);
          }
        }

        timer = setTimeout(poll, 2000);
      } catch (err) {
        if (cancelled) return;

        console.error('[TV] Failed to create pairing:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Could not create pairing code',
        );
      }
    }

    void start();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }

      console.log('[TV] Pairing attempt cleaned up:', attempt);
    };
  }, [attempt]);

  const url = challenge
    ? `${window.location.origin}/tv/pair/${encodeURIComponent(
      challenge.code,
    )}`
    : '';

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: '#087fc4',
        color: '#fff',
        textAlign: 'center',
      }}
    >
      <section
        style={{
          padding: 32,
          background: '#0b3b55',
          borderRadius: 24,
          maxWidth: 600,
        }}
      >
        <h1>Pair your aquarium TV</h1>

        <p>
          Scan this QR code with your phone and select an aquarium.
        </p>

        {challenge && !error ? (
          <div
            style={{
              display: 'inline-block',
              background: 'white',
              padding: 20,
              borderRadius: 16,
            }}
          >
            <QRCodeSVG value={url} size={260} />
          </div>
        ) : (
          !error && <p>Creating pairing code...</p>
        )}

        {error && (
          <>
            <p role="alert">{error}</p>

            <button
              onClick={() => {
                console.log('[TV] User requested a new pairing code');

                setChallenge(null);
                setError(null);
                setAttempt((value) => value + 1);
              }}
            >
              Generate new code
            </button>
          </>
        )}
      </section>
    </main>
  );
}

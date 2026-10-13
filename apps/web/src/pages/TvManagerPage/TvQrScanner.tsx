
import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';

type Props = {
  onClose: () => void;
  onScanned: (url: string) => void;
};

export function TvQrScanner({ onClose, onScanned }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScannedRef = useRef(onScanned);
  const scanCompletedRef = useRef(false);

  const [error, setError] = useState('');
  const [scanned, setScanned] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    onScannedRef.current = onScanned;
  }, [onScanned]);

  useEffect(() => {
    let cancelled = false;
    let controls: { stop: () => void } | undefined;

    const reader = new BrowserQRCodeReader();

    async function start() {
      if (!window.isSecureContext) {
        setError('Camera requires HTTPS.');
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access is unavailable in this browser.');
        return;
      }

      if (!videoRef.current) return;

      try {
        setError('');

        const devices =
          await BrowserQRCodeReader.listVideoInputDevices();

        if (cancelled) return;

        const rearCamera = devices.find((device) =>
          /back|rear|environment/i.test(device.label),
        );

        controls = await reader.decodeFromVideoDevice(
          rearCamera?.deviceId,
          videoRef.current,
          (result) => {
            if (
              !result ||
              cancelled ||
              scanCompletedRef.current
            ) {
              return;
            }

            try {
              const url = new URL(result.getText());

              const isValidPairingUrl =
                url.origin === window.location.origin &&
                /^\/tv\/pair\/[^/]+\/?$/.test(url.pathname);

              if (!isValidPairingUrl) {
                setError(
                  'Scan a Family Aquarium TV QR code.',
                );
                return;
              }

              scanCompletedRef.current = true;
              cancelled = true;

              setScanned(true);
              setError('');

              controls?.stop();

              onScannedRef.current(
                url.pathname + url.search,
              );
            } catch {
              setError('Invalid QR code. Try again.');
            }
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        const video = videoRef.current;

        if (video) {
          video.muted = true;
          video.playsInline = true;

          try {
            await video.play();

            if (!cancelled) {
              setCameraReady(true);
            }
          } catch (playbackError) {
            if (!cancelled) {
              console.warn(
                '[TV Scanner] Video playback failed:',
                playbackError,
              );

              setError(
                'Camera started, but video playback failed.',
              );
            }
          }
        }
      } catch (cameraError) {
        if (cancelled) return;

        console.error(
          '[TV Scanner] Camera error:',
          cameraError,
        );

        setError(
          cameraError instanceof Error
            ? cameraError.message
            : 'Unable to start camera.',
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div
      className="tv-qr-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Scan TV QR Code"
    >
      <div className="tv-qr-panel">
        <div className="tv-qr-heading">
          <h2>Scan TV QR Code</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
          >
            ✕
          </button>
        </div>

        <p>
          Point your camera at the QR code on your TV.
        </p>

        <div className="tv-qr-camera">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
          />

          <div
            className={`tv-qr-frame ${
              scanned ? 'tv-qr-frame--success' : ''
            }`}
          />
        </div>

        <p
          className="tv-qr-status"
          aria-live="polite"
        >
          {scanned
            ? 'QR code detected! Connecting...'
            : error
              ? 'Scanner needs attention'
              : cameraReady
                ? 'Looking for TV QR code...'
                : 'Starting camera...'}
        </p>

        {error && (
          <p
            role="alert"
            className="tv-qr-error"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          className="tv-qr-cancel"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

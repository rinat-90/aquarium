import { useEffect, useRef, useState } from 'react';
import type { FishTemplateId } from '../../lib/image-processing/fishTemplateRegistry';

type GuidedFishCameraProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
  mode?: 'freehand' | 'template';
  selectedTemplate?: FishTemplateId | null;
};

export function GuidedFishCamera({ onCapture, onClose, mode = 'freehand', selectedTemplate }: GuidedFishCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [guideSize, setGuideSize] = useState(82);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access requires HTTPS or localhost.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;

        if (video) {
          video.srcObject = stream;
          await video.play();

          if (!cancelled) setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to access camera.');
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;

    if (!video || !ready) return;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) return;

    const bounds = video.getBoundingClientRect();

    if (!bounds.width || !bounds.height) return;

    // These values match the guide's CSS:
    // left/right: 5%, top: 30%, height: 40%.
    const guideLeft = bounds.width * 0.05;
    const guideTop = bounds.height * 0.3;
    const guideWidth = bounds.width * 0.9;
    const guideHeight = bounds.height * 0.4;

    // The video uses object-fit: cover.
    // Calculate the visible portion of the camera image.
    const scale = Math.max(bounds.width / videoWidth, bounds.height / videoHeight);

    const displayedWidth = videoWidth * scale;
    const displayedHeight = videoHeight * scale;

    const offsetX = (displayedWidth - bounds.width) / 2;
    const offsetY = (displayedHeight - bounds.height) / 2;

    // Convert the guide's screen coordinates to camera pixels.
    // Template processing needs the entire image; freehand uses the narrow guide crop.
    const sourceX = mode === 'template' ? 0 : (guideLeft + offsetX) / scale;
    const sourceY = mode === 'template' ? 0 : (guideTop + offsetY) / scale;
    const sourceWidth = mode === 'template' ? videoWidth : guideWidth / scale;
    const sourceHeight = mode === 'template' ? videoHeight : guideHeight / scale;

    const canvas = document.createElement('canvas');

    canvas.width = Math.round(sourceWidth);
    canvas.height = Math.round(sourceHeight);

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setError('Unable to capture image.');
      return;
    }

    ctx.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Unable to capture photo.');
          return;
        }

        const file = new File([blob], 'fish-drawing.jpg', { type: 'image/jpeg' });

        onCapture(file);
      },
      'image/jpeg',
      0.95,
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#020617',
        display: 'flex',
        flexDirection: 'column',
        padding: 'max(env(safe-area-inset-top), 20px) 16px max(env(safe-area-inset-bottom), 20px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#fff',
          marginBottom: 16,
        }}
      >
        <button type="button" onClick={onClose}>
          ✕ Close
        </button>

        <strong>Scan Your Fish</strong>

        <span style={{ width: 60 }} />
      </div>

      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          borderRadius: 16,
          background: '#111827',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* The outline is a positioning aid, not a claimed auto-detection result. */}
        {mode === 'template' && selectedTemplate ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', pointerEvents: 'none',
              background: 'rgba(2, 6, 23, 0.12)',
            }}
          >
            <img
              src={`/fish-templates/guides/${selectedTemplate}.png`}
              alt=""
              draggable={false}
              style={{
                display: 'block', width: `${guideSize}%`, height: `${guideSize}%`,
                objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.85))',
              }}
            />
          </div>
        ) : (
          <div
            style={{
              position: 'absolute', left: '5%', right: '5%', top: '30%', height: '40%',
              border: '2px dashed #38bdf8', borderRadius: 16,
              boxShadow: '0 0 0 100vmax rgba(0,0,0,0.35)', pointerEvents: 'none',
            }}
          />
        )}

        {!ready && !error && (
          <p
            style={{
              position: 'absolute',
              top: '50%',
              width: '100%',
              textAlign: 'center',
              color: '#fff',
            }}
          >
            Starting camera...
          </p>
        )}
      </div>

      <p
        style={{
          textAlign: 'center',
          color: '#fff',
          margin: '16px 0',
        }}
      >
        {mode === 'template' ? 'Match your colored fish to the glowing outline' : 'Keep your entire fish inside the blue frame'}
      </p>

      {mode === 'template' && selectedTemplate && (
        <label style={{ color: '#e0f2fe', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ whiteSpace: 'nowrap' }}>Guide size</span>
          <input
            type="range" min={55} max={100} step={5}
            value={guideSize}
            onChange={(event) => setGuideSize(Number(event.target.value))}
            style={{ flex: 1, minWidth: 0 }}
            aria-label="Adjust fish guide size"
          />
          <span>{guideSize}%</span>
        </label>
      )}

      {error && (
        <p role="alert" style={{ color: '#f87171' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={capture}
        disabled={!ready}
        style={{
          alignSelf: 'center',
          width: 72,
          height: 72,
          borderRadius: '50%',
          border: '5px solid #fff',
          background: '#38bdf8',
          cursor: ready ? 'pointer' : 'not-allowed',
        }}
        aria-label="Capture fish drawing"
      />
    </div>
  );
}

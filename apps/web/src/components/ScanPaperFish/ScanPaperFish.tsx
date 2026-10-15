import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useNavigate } from 'react-router';

import { AQUARIUM_CAPACITY, createFish } from '../../lib/create-fish';
import { fishApi } from '../../lib/aquarium-api';

import { removePaperBackground } from '../../lib/image-processing/removePaperBackground';
import { cropDrawingWithBounds } from '../../lib/image-processing/cropDrawing';
import { createFishSilhouette } from '../../lib/image-processing/createFishSilhouette';
import {
  detectFishOrientation,
  type FishOrientation,
} from '../../lib/image-processing/detectFishOrientation';
import { flipFishImage } from '../../lib/image-processing/flipFishImage';

import { GuidedFishCamera } from './GuidedFishCamera';
import './ScanPaperFishPriority.css';

type ScanPaperFishProps = {
  aquariumId: string;
  onSaved?: () => void;
  variant?: 'default' | 'studio';
};

export function ScanPaperFish({ aquariumId, onSaved, variant = 'default' }: ScanPaperFishProps) {
  const navigate = useNavigate();

  const inputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<FishOrientation>('right');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  // Both camera methods use the same processing pipeline.
  const processPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image.');
      return;
    }

    setError(null);
    setSaveError(null);
    setProcessedImage(null);
    setIsProcessing(true);

    const url = URL.createObjectURL(file);
    setImageUrl(url);

    try {
      const result = await removePaperBackground(file);

      // Get the cropped drawing and its coordinates.
      const crop = await cropDrawingWithBounds(result);

      const silhouetteResult = await createFishSilhouette(crop.image, url, crop);

      const detectedOrientation = await detectFishOrientation(silhouetteResult);

      setOrientation(detectedOrientation);
      setProcessedImage(silhouetteResult);
    } catch (err) {
      console.error('[ScanPaperFish] Processing failed:', err);

      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);

      setError(`Processing failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Native camera / photo picker fallback.
  const handlePhotoSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      void processPhoto(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isProcessing || saving) return;
    const file = event.dataTransfer.files[0];
    if (file) void processPhoto(file);
  };

  // Guided browser camera.
  const handleGuidedCapture = (file: File) => {
    setCameraOpen(false);
    void processPhoto(file);
  };

  const handleAddToAquarium = async () => {
    if (!processedImage || savingRef.current || isProcessing || isFlipping) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError(null);

    try {
      const items = await fishApi.list();

      const aquariumFish = items.filter((item) => item.aquariumId === aquariumId);

      const usedCapacity = aquariumFish.reduce((total, item) => total + item.size * item.size, 0);

      const size = 1;

      if (usedCapacity + size * size > AQUARIUM_CAPACITY + 0.0001) {
        throw new Error('Not enough space in this aquarium.');
      }

      await createFish(
        aquariumId,
        {
          type: 'drawn',
          image: processedImage,
          size,
          headDirection: orientation,
        },
        aquariumFish.length,
      );

      if (onSaved) {
        onSaved();
      } else {
        navigate(`/aquariums/${encodeURIComponent(aquariumId)}`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to add fish to aquarium.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleFlip = async () => {
    if (!processedImage || isFlipping || savingRef.current) {
      return;
    }

    setIsFlipping(true);
    setSaveError(null);

    try {
      const flipped = await flipFishImage(processedImage);

      setProcessedImage(flipped);

      setOrientation((current) => (current === 'left' ? 'right' : 'left'));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to flip fish.');
    } finally {
      setIsFlipping(false);
    }
  };

  return (
    <div
      className={
        variant === 'studio' ? 'scan-paper-fish scan-paper-fish--studio' : 'scan-paper-fish'
      }
      style={{ padding: variant === 'studio' ? 0 : 20 }}
    >
      {cameraOpen && (
        <GuidedFishCamera onCapture={handleGuidedCapture} onClose={() => setCameraOpen(false)} />
      )}

      {variant === 'studio' ? (
        <div className="scan-studio">
          <div className="scan-studio__intro">
            <div className="scan-studio__intro-text">
              <span className="scan-studio__eyebrow">YOUR ART COMES ALIVE</span>
              <h2>Bring your paper fish to life!</h2>
              <p>
                Draw a fish on white paper, then upload a clear photo. We'll remove the paper and
                get your fish ready to swim.
              </p>
            </div>
            <div className="scan-studio__illustration" aria-hidden="true">
              <span className="scan-studio__paper">🐠</span>
              <span className="scan-studio__sparkle">✦</span>
              <span className="scan-studio__pencil">🖍️</span>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelected}
            style={{ display: 'none' }}
            aria-label="Choose a fish drawing photo"
          />
          <div className="scan-studio__guided-primary">
            <div className="scan-studio__guided-icon" aria-hidden="true">
              📷
            </div>
            <h3>Scan your drawing with the camera</h3>
            <p>Point your camera at your paper fish and follow the guide.</p>
            <button
              className="scan-studio__primary"
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={isProcessing || saving}
            >
              {imageUrl ? 'Scan Another Drawing' : 'Scan with Guide'} →
            </button>
          </div>
          <div
            className={`scan-studio__dropzone${isDragging ? ' scan-studio__dropzone--active' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!isProcessing && !saving) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="scan-studio__upload-icon" aria-hidden="true">
              📷
            </div>
            <h3>{imageUrl ? 'Try another drawing?' : 'Upload your fish drawing'}</h3>
            <p className="scan-studio__upload-description">
              Choose a photo from your device, or take one with your camera.
            </p>
            <button
              className="scan-studio__primary"
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing || saving}
            >
              {imageUrl ? 'Choose Another Photo' : 'Choose a Photo'} →
            </button>
            <small>JPG, PNG, or WebP · White paper works best</small>
          </div>
          <div className="scan-studio__camera-option">
            <span>Have a webcam?</span>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={isProcessing || saving}
            >
              📷 Scan with Guide
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2>Scan Paper Fish</h2>
          <p>
            Take a picture of your fish drawing on white paper. Keep the entire fish inside the
            guide.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelected}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={isProcessing || saving}
            >
              📷 {imageUrl ? 'Retake with Guide' : 'Scan with Guide'}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing || saving}
            >
              Upload Photo
            </button>
          </div>
        </>
      )}

      {error && (
        <p
          role="alert"
          style={{
            color: '#ef4444',
            marginTop: 16,
            overflowWrap: 'anywhere',
          }}
        >
          {error}
        </p>
      )}

      {imageUrl && (
        <section style={{ marginTop: 20 }}>
          <h3>Original Photo</h3>

          <img
            src={imageUrl}
            alt="Original fish drawing"
            style={{
              display: 'block',
              width: '100%',
              maxWidth: 400,
              height: 'auto',
              borderRadius: 12,
            }}
          />
        </section>
      )}

      {isProcessing && (
        <p role="status" style={{ marginTop: 16 }}>
          Processing your fish drawing...
        </p>
      )}

      {processedImage && (
        <section style={{ marginTop: 20 }}>
          <h3>Fish Preview</h3>

          <div
            style={{
              boxSizing: 'border-box',
              width: '100%',
              maxWidth: 400,
              padding: 12,
              borderRadius: 12,
              backgroundColor: '#dbeafe',
              backgroundImage: `
                linear-gradient(45deg, #ffffff80 25%, transparent 25%),
                linear-gradient(-45deg, #ffffff80 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #ffffff80 75%),
                linear-gradient(-45deg, transparent 75%, #ffffff80 75%)
              `,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
            }}
          >
            <img
              src={processedImage}
              alt="Fish drawing with transparent background"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                marginTop: 16,
              }}
            >
              <span
                style={{
                  color: '#0f2940',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Head facing: <strong>{orientation}</strong>
              </span>

              <button
                type="button"
                onClick={() => void handleFlip()}
                disabled={isFlipping || saving || isProcessing}
              >
                {isFlipping ? 'Flipping...' : '↔ Flip Fish'}
              </button>
            </div>

            {saveError && (
              <p
                role="alert"
                style={{
                  color: '#ef4444',
                  overflowWrap: 'anywhere',
                }}
              >
                {saveError}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleAddToAquarium()}
              disabled={saving || isFlipping || isProcessing}
              style={{
                width: '100%',
                padding: '14px 20px',
                marginTop: 16,
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 16,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? 'Adding Fish...' : '🐠 Add to Aquarium'}
            </button>
          </div>

          <p>Background removed! Your fish is almost ready to swim.</p>
        </section>
      )}
    </div>
  );
}

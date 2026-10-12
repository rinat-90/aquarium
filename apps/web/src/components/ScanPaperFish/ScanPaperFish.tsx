
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { AQUARIUM_CAPACITY, createFish } from '../../lib/create-fish';
import { fishApi } from '../../lib/aquarium-api';

import { removePaperBackground } from '../../lib/image-processing/removePaperBackground';
import { cropDrawing } from '../../lib/image-processing/cropDrawing';
import { createFishSilhouette } from '../../lib/image-processing/createFishSilhouette';
import {
  detectFishOrientation,
  type FishOrientation,
} from '../../lib/image-processing/detectFishOrientation';

import { flipFishImage } from '../../lib/image-processing/flipFishImage';

type ScanPaperFishProps = {
  aquariumId: string;
  onSaved?: () => void;
};

export function ScanPaperFish({
                                aquariumId,
                                onSaved,
                              }: ScanPaperFishProps) {
  const navigate = useNavigate();

  // Keep your existing state and refs.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [orientation, setOrientation] =
    useState<FishOrientation>('right');

  const [isFlipping, setIsFlipping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handlePhotoSelected = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image.');
      return;
    }

    setError(null);
    setProcessedImage(null);
    setIsProcessing(true);

    const url = URL.createObjectURL(file);
    setImageUrl(url);

    try {
      const result = await removePaperBackground(file);
      const croppedResult = await cropDrawing(result);
      const silhouetteResult = await createFishSilhouette(croppedResult);
      const detectedOrientation =
        await detectFishOrientation(silhouetteResult);

      setOrientation(detectedOrientation);

      setProcessedImage(silhouetteResult);
    } catch (err) {
      console.error('Failed to process drawing:', err);
      setError('Could not process this photo. Please try another.');
    } finally {
      setIsProcessing(false);
    }
  };


  const handleAddToAquarium = async () => {
    if (!processedImage || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setSaveError(null);

    try {
      const items = await fishApi.list();

      const aquariumFish = items.filter(
        (item) => item.aquariumId === aquariumId,
      );

      const usedCapacity = aquariumFish.reduce(
        (total, item) => total + item.size * item.size,
        0,
      );

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
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Failed to add fish to aquarium.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };


  const handleFlip = async () => {
    if (!processedImage || isFlipping || savingRef.current) return;

    setIsFlipping(true);
    setSaveError(null);

    try {
      const flipped = await flipFishImage(processedImage);

      setProcessedImage(flipped);

      setOrientation((current) =>
        current === 'left' ? 'right' : 'left',
      );
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Failed to flip fish.',
      );
    } finally {
      setIsFlipping(false);
    }
  };



  return (
    <div style={{ padding: 20 }}>
      <h2>Scan Paper Fish</h2>

      <p>Take a picture of your fish drawing on white paper.</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelected}
        style={{ display: 'none' }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isProcessing}
      >
        {imageUrl ? 'Retake Photo' : 'Take Photo'}
      </button>

      {error && (
        <p role="alert" style={{ color: '#dc2626' }}>
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
              borderRadius: 12,
            }}
          />
        </section>
      )}

      {isProcessing && <p>Removing background...</p>}

      {processedImage && (
        <section style={{ marginTop: 20 }}>
          <h3>Fish Preview</h3>

          <div
            style={{
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
              backgroundPosition:
                '0 0, 0 10px, 10px -10px, -10px 0',
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
                gap: 12,
                marginTop: 16,
              }}
            >
              <span>
                Head facing: <strong>{orientation}</strong>
              </span>

              <button
                type="button"
                onClick={() => void handleFlip()}
                disabled={isFlipping || saving}
              >
                {isFlipping ? 'Flipping...' : '↔ Flip Fish'}
              </button>
            </div>

            {saveError && (
              <p role="alert" style={{ color: '#ef4444' }}>
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
              }}
            >
              {saving ? 'Adding Fish...' : '🐠 Add to Aquarium'}
            </button>
          </div>

          <p>
            Background removed! Your fish is almost ready to swim.
          </p>
        </section>
      )}
    </div>
  );
}

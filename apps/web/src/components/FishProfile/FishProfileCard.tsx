
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { CreatedFish } from '../../App';
import type { ApiAquarium } from '../../lib/aquarium-api';

import { Fish3DPreview } from '../Fish3D/Fish3DPreview';
import { Select } from '../ui/Select';

import './FishProfileCard.css';

type FishProfileCardProps = {
  fish: CreatedFish;
  aquariums: ApiAquarium[];
  currentAquariumId: string;

  onRename: (name: string) => void;
  onRelease: () => void;
  onClose: () => void;

  onMove: (
    fishId: string,
    aquariumId: string,
  ) => Promise<void>;
};

export function FishProfileCard({
                                  fish,
                                  aquariums,
                                  currentAquariumId,
                                  onRename,
                                  onRelease,
                                  onClose,
                                  onMove,
                                }: FishProfileCardProps) {
  const [name, setName] = useState(fish.name);
  const [confirmingRelease, setConfirmingRelease] = useState(false);

  const [destinationId, setDestinationId] = useState('');
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const destinations = aquariums.filter(
    (aquarium) => aquarium.id !== currentAquariumId,
  );

  useEffect(() => {
    setName(fish.name);
    setConfirmingRelease(false);
    setDestinationId('');
    setMoveError(null);
  }, [fish.id, fish.name, currentAquariumId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !moving) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, moving]);

  const handleSave = () => {
    const trimmedName = name.trim();

    if (!trimmedName || trimmedName === fish.name) {
      return;
    }

    onRename(trimmedName);
  };

  const handleMove = async () => {
    if (
      moving ||
      !destinationId ||
      destinationId === currentAquariumId
    ) {
      return;
    }

    setMoving(true);
    setMoveError(null);

    try {
      await onMove(fish.id, destinationId);
    } catch (error) {
      setMoveError(
        error instanceof Error
          ? error.message
          : 'Failed to move fish. Please try again.',
      );
    } finally {
      setMoving(false);
    }
  };

  const createdDate = new Date(fish.createdAt);

  const isSaveDisabled =
    !name.trim() || name.trim() === fish.name;

  return createPortal(
    <aside
      className="fish-profile-card"
      aria-label={`${fish.name} profile`}
    >
      <button
        type="button"
        className="fish-profile-close"
        aria-label="Close fish profile"
        onClick={onClose}
        disabled={moving}
      >
        ✕
      </button>

      <div className="fish-profile-preview">
        {fish.type === 'drawn' ? (
          <img
            className="fish-profile-image"
            src={fish.image}
            alt={fish.name}
          />
        ) : (
          <div className="fish-profile-3d">
            <Fish3DPreview
              key={`${fish.id}-${fish.model}`}
              species={
                fish.model === 'angelfish'
                  ? 'angelfish'
                  : 'classic'
              }
              bodyColor={fish.bodyColor}
              finColor={fish.finColor}
              paintImage={fish.paintImage}
              size={fish.size}
              height={150}
              editable={false}
            />
          </div>
        )}
      </div>

      <div className="fish-profile-type">
        {fish.type === '3d' ? 'My 3D Fish' : 'My Fish'}
      </div>

      <div className="fish-profile-name">
        {fish.name}
      </div>

      <div className="fish-profile-created">
        🐠 Created{' '}
        {createdDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </div>

      <label
        className="fish-profile-label"
        htmlFor="fish-profile-name-input"
      >
        Fish name
      </label>

      <input
        id="fish-profile-name-input"
        className="fish-profile-input"
        value={name}
        maxLength={30}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            handleSave();
          }
        }}
        disabled={moving}
      />

      <button
        type="button"
        className="fish-profile-save"
        onClick={handleSave}
        disabled={isSaveDisabled || moving}
      >
        Save Name
      </button>

      {destinations.length > 0 && (
        <>
          <div className="fish-profile-divider" />

          <div className="fish-profile-move">
            <div className="fish-profile-section-title">
              Move to Aquarium
            </div>

            <p className="fish-profile-section-description">
              Choose another aquarium for this fish.
            </p>

            <Select
              ariaLabel="Destination aquarium"
              value={destinationId}
              options={[
                {
                  value: '',
                  label: 'Choose an aquarium',
                },
                ...destinations.map((aquarium) => ({
                  value: aquarium.id,
                  label: aquarium.name,
                })),
              ]}
              onChange={(value) => {
                setDestinationId(value);
                setMoveError(null);
              }}
              disabled={moving}
            />

            {moveError && (
              <p className="fish-profile-move-error" role="alert">
                {moveError}
              </p>
            )}

            <button
              type="button"
              className="fish-profile-move-button"
              onClick={() => void handleMove()}
              disabled={!destinationId || moving}
            >
              {moving ? 'Moving...' : 'Move Fish →'}
            </button>
          </div>
        </>
      )}

      <div className="fish-profile-divider" />

      {!confirmingRelease ? (
        <button
          type="button"
          className="fish-profile-release"
          onClick={() => setConfirmingRelease(true)}
          disabled={moving}
        >
          🌊 Release Fish
        </button>
      ) : (
        <div className="fish-profile-confirm">
          <div className="fish-profile-confirm-text">
            Release {fish.name} from your aquarium?
          </div>

          <div className="fish-profile-confirm-actions">
            <button
              type="button"
              className="fish-profile-confirm-button fish-profile-keep"
              onClick={() => setConfirmingRelease(false)}
              disabled={moving}
            >
              Keep
            </button>

            <button
              type="button"
              className="fish-profile-confirm-button fish-profile-confirm-release"
              onClick={onRelease}
              disabled={moving}
            >
              Release
            </button>
          </div>
        </div>
      )}
    </aside>,
    document.body,
  );
}

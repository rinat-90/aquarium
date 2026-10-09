
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { CreatedFish } from '../../App';
import { Fish3DPreview } from '../Fish3D/Fish3DPreview';

import './FishProfileCard.css';

type FishProfileCardProps = {
  fish: CreatedFish;
  onRename: (name: string) => void;
  onRelease: () => void;
  onClose: () => void;
};

export function FishProfileCard({
                                  fish,
                                  onRename,
                                  onRelease,
                                  onClose,
                                }: FishProfileCardProps) {
  const [name, setName] = useState(fish.name);
  const [confirmingRelease, setConfirmingRelease] = useState(false);

  useEffect(() => {
    setName(fish.name);
    setConfirmingRelease(false);
  }, [fish.id, fish.name]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleSave = () => {
    const trimmedName = name.trim();

    if (!trimmedName || trimmedName === fish.name) {
      return;
    }

    onRename(trimmedName);
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
      />

      <button
        type="button"
        className="fish-profile-save"
        onClick={handleSave}
        disabled={isSaveDisabled}
      >
        Save Name
      </button>

      <div className="fish-profile-divider" />

      {!confirmingRelease ? (
        <button
          type="button"
          className="fish-profile-release"
          onClick={() => setConfirmingRelease(true)}
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
            >
              Keep
            </button>

            <button
              type="button"
              className="fish-profile-confirm-button fish-profile-confirm-release"
              onClick={onRelease}
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

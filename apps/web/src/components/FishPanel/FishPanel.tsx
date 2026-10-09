
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { CreatedFish } from '../../types/fish';
import type { ApiAquarium } from '../../lib/aquarium-api';
import { Fish3DPreview } from '../Fish3D/Fish3DPreview';
import { Select } from '../ui/Select';

import './FishPanel.css';

type FishPanelProps = {
  open: boolean;
  fish: CreatedFish[];
  selectedFishId: string | null;
  onSelectFish: (id: string | null) => void;
  onClose: () => void;
  onAddFish: () => void;
  onRename: (id: string, name: string) => Promise<void>;
  onRelease: (id: string) => Promise<void>;
  onMove: (id: string, aquariumId: string) => Promise<void>;
  aquariums: ApiAquarium[];
  currentAquariumId: string;
};

function getFishColor(fish: CreatedFish): string {
  return fish.type === '3d' ? fish.bodyColor : '#168ee1';
}

function getFishType(fish: CreatedFish): string {
  if (fish.type === 'drawn') return 'Hand-drawn Fish';

  return fish.model === 'angelfish'
    ? 'Angelfish'
    : 'Classic Fish';
}

function FishPreview({
                       fish,
                       large = false,
                     }: {
  fish: CreatedFish;
  large?: boolean;
}) {
  return (
    <div
      className={`fish-panel__avatar ${
        large ? 'fish-panel__avatar--large' : ''
      }`}
      style={{
        background: `radial-gradient(circle at 30% 30%, ${getFishColor(fish)}, #103b60)`,
      }}
    >
      {fish.type === 'drawn' ? (
        <img
          src={fish.image}
          alt={fish.name}
          className="fish-panel__image"
        />
      ) : large ? (
        <Fish3DPreview
          key={`${fish.id}-${fish.model}`}
          species={
            fish.model === 'angelfish' ? 'angelfish' : 'classic'
          }
          bodyColor={fish.bodyColor}
          finColor={fish.finColor}
          paintImage={fish.paintImage}
          size={fish.size}
          height={160}
          editable={false}
        />
      ) : (
        <span aria-hidden="true">🐟</span>
      )}
    </div>
  );
}

type FishDetailsProps = {
  fish: CreatedFish;
  aquariums: ApiAquarium[];
  currentAquariumId: string;
  onBack: () => void;
  onRename: FishPanelProps['onRename'];
  onMove: FishPanelProps['onMove'];
  onRelease: FishPanelProps['onRelease'];
};

function FishDetails({
                       fish,
                       aquariums,
                       currentAquariumId,
                       onBack,
                       onRename,
                       onMove,
                       onRelease,
                     }: FishDetailsProps) {
  const [name, setName] = useState(fish.name);
  const [destinationId, setDestinationId] = useState('');
  const [confirmingRelease, setConfirmingRelease] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destinations = aquariums.filter(
    (aquarium) => aquarium.id !== currentAquariumId,
  );

  useEffect(() => {
    setName(fish.name);
    setDestinationId('');
    setConfirmingRelease(false);
    setError(null);
  }, [fish.id, fish.name, currentAquariumId]);

  const createdDate = new Date(fish.createdAt);

  const formattedDate = Number.isNaN(createdDate.getTime())
    ? 'Unknown'
    : createdDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const trimmedName = name.trim();

  const canSaveName =
    trimmedName.length > 0 &&
    trimmedName !== fish.name &&
    !busy;

  async function handleRename() {
    if (!canSaveName) return;

    setBusy(true);
    setError(null);

    try {
      await onRename(fish.id, trimmedName);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to rename fish.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleMove() {
    if (!destinationId || busy) return;

    setBusy(true);
    setError(null);

    try {
      await onMove(fish.id, destinationId);
      onBack();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to move fish.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease() {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      await onRelease(fish.id);
      onBack();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to release fish.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fish-panel__profile">
      <div className="fish-panel__hero">
        <FishPreview fish={fish} large />

        <h3>{fish.name}</h3>
        <span>{getFishType(fish)}</span>

        <p className="fish-panel__created">
          Created {formattedDate}
        </p>
      </div>

      <div className="fish-panel__details">
        <div className="fish-panel__detail">
          <span>Aquarium</span>
          <strong>
            {aquariums.find(
              (item) => item.id === currentAquariumId,
            )?.name ?? 'My Aquarium'}
          </strong>
        </div>

        <div className="fish-panel__detail">
          <span>Appearance</span>
          <strong>{getFishType(fish)}</strong>
        </div>
      </div>

      <section className="fish-panel__section">
        <h3>Rename Fish</h3>
        <p>Give your little swimmer a new name.</p>

        <label
          className="fish-panel__label"
          htmlFor="fish-panel-name"
        >
          Fish name
        </label>

        <input
          id="fish-panel-name"
          className="fish-panel__input"
          value={name}
          maxLength={30}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleRename();
            }
          }}
        />

        <button
          type="button"
          className="fish-panel__primary"
          disabled={!canSaveName}
          onClick={() => void handleRename()}
        >
          {busy ? 'Saving...' : 'Save Name'}
        </button>
      </section>

      {destinations.length > 0 && (
        <section className="fish-panel__section">
          <h3>Move to Another Aquarium</h3>
          <p>Choose a new home for this fish.</p>

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
            disabled={busy}
            onChange={(value) => {
              setDestinationId(value);
              setError(null);
            }}
          />

          <button
            type="button"
            className="fish-panel__secondary"
            disabled={!destinationId || busy}
            onClick={() => void handleMove()}
          >
            {busy ? 'Please wait...' : 'Move Fish →'}
          </button>
        </section>
      )}

      <section className="fish-panel__section">
        <h3>Release Fish</h3>
        <p>Remove this fish from your aquarium.</p>

        {!confirmingRelease ? (
          <button
            type="button"
            className="fish-panel__danger"
            disabled={busy}
            onClick={() => setConfirmingRelease(true)}
          >
            🌊 Release Fish
          </button>
        ) : (
          <div className="fish-panel__confirm">
            <p>
              Are you sure you want to release{' '}
              <strong>{fish.name}</strong>?
            </p>

            <div className="fish-panel__confirm-actions">
              <button
                type="button"
                className="fish-panel__secondary"
                disabled={busy}
                onClick={() => setConfirmingRelease(false)}
              >
                Keep Fish
              </button>

              <button
                type="button"
                className="fish-panel__danger"
                disabled={busy}
                onClick={() => void handleRelease()}
              >
                {busy ? 'Releasing...' : 'Release'}
              </button>
            </div>
          </div>
        )}
      </section>

      {error && (
        <p className="fish-panel__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FishPanel({
                            open,
                            fish,
                            selectedFishId,
                            onSelectFish,
                            onClose,
                            onAddFish,
                            onRename,
                            onRelease,
                            onMove,
                            aquariums,
                            currentAquariumId,
                          }: FishPanelProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const selectedFish =
    fish.find((item) => item.id === selectedFishId) ?? null;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;

    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const elements = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );

      if (!elements?.length) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fish-panel">
      <button
        type="button"
        className="fish-panel__backdrop"
        aria-label="Close fish panel"
        tabIndex={-1}
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        className="fish-panel__sidebar"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="fish-panel__header">
          <div className="fish-panel__heading">
            {selectedFish && (
              <button
                type="button"
                className="fish-panel__back"
                aria-label="Back to fish list"
                onClick={() => onSelectFish(null)}
              >
                ←
              </button>
            )}

            <div>
              <h2 id={titleId}>
                {selectedFish ? 'Fish Profile' : 'My Fish'}
              </h2>

              <p>
                {selectedFish
                  ? 'Meet your little swimmer'
                  : `${fish.length} fish in this aquarium`}
              </p>
            </div>
          </div>

          <button
            ref={closeRef}
            type="button"
            className="fish-panel__close"
            aria-label="Close fish panel"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="fish-panel__body">
          {selectedFish ? (
            <FishDetails
              key={selectedFish.id}
              fish={selectedFish}
              aquariums={aquariums}
              currentAquariumId={currentAquariumId}
              onBack={() => onSelectFish(null)}
              onRename={onRename}
              onMove={onMove}
              onRelease={onRelease}
            />
          ) : fish.length === 0 ? (
            <div className="fish-panel__empty">
              <span aria-hidden="true">🐠</span>
              <h3>No fish yet</h3>
              <p>
                Create your first fish and add it to your aquarium.
              </p>

              <button
                type="button"
                className="fish-panel__primary"
                onClick={onAddFish}
              >
                + Add Fish
              </button>
            </div>
          ) : (
            <div className="fish-panel__list">
              {fish.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="fish-panel__item"
                  onClick={() => onSelectFish(item.id)}
                >
                  <FishPreview fish={item} />

                  <div className="fish-panel__info">
                    <strong>{item.name}</strong>
                    <span>{getFishType(item)}</span>
                  </div>

                  <span
                    className="fish-panel__arrow"
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!selectedFish && fish.length > 0 && (
          <footer className="fish-panel__footer">
            <button
              type="button"
              className="fish-panel__primary"
              onClick={onAddFish}
            >
              + Add Fish
            </button>
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}

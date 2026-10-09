import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import type { CreatedFish } from '../../types/fish';

import './FishCollection.css';

type FishCollectionProps = {
  open: boolean;
  fish: CreatedFish[];
  onClose: () => void;
  onSelectFish: (id: string) => void;
  onAddFish: () => void;
};

function getFishColor(fish: CreatedFish): string {
  if ('bodyColor' in fish && typeof fish.bodyColor === 'string') {
    return fish.bodyColor;
  }

  return '#168ee1';
}

function getFishSpecies(fish: CreatedFish): string {
  if ('species' in fish && typeof fish.species === 'string') {
    return fish.species;
  }

  return 'Custom Fish';
}

export function FishCollection({
                                 open,
                                 fish,
                                 onClose,
                                 onSelectFish,
                                 onAddFish,
                               }: FishCollectionProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleSelectFish(id: string) {
    onSelectFish(id);
  }

  function handleAddFish() {
    onAddFish();
  }

  return createPortal (
    <div className="fish-collection">
      <button
        type="button"
        className="fish-collection__backdrop"
        aria-label="Close fish collection"
        tabIndex={-1}
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        className="fish-collection__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="fish-collection__header">
          <div>
            <h2 id={titleId}>My Fish</h2>
            <p>
              {fish.length} fish in this aquarium
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="fish-collection__close"
            aria-label="Close fish collection"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="fish-collection__body">
          {fish.length === 0 ? (
            <div className="fish-collection__empty">
              <span aria-hidden="true">🐠</span>
              <h3>No fish yet</h3>
              <p>
                Create your first fish and add it to your aquarium.
              </p>

              <button type="button" onClick={handleAddFish}>
                + Add Fish
              </button>
            </div>
          ) : (
            <div className="fish-collection__list">
              {fish.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="fish-collection__item"
                  onClick={() => handleSelectFish(item.id)}
                >
                  <div
                    className="fish-collection__avatar"
                    style={{
                      background: `radial-gradient(
                        circle at 30% 30%,
                        ${getFishColor(item)},
                        #103b60
                      )`,
                    }}
                    aria-hidden="true"
                  >
                    🐟
                  </div>

                  <div className="fish-collection__info">
                    <strong>{item.name}</strong>
                    <span>{getFishSpecies(item)}</span>
                  </div>

                  <span
                    className="fish-collection__arrow"
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {fish.length > 0 && (
          <footer className="fish-collection__footer">
            <button type="button" onClick={handleAddFish}>
              + Add Fish
            </button>
          </footer>
        )}
      </aside>
    </div>,
    document.body
  );
}

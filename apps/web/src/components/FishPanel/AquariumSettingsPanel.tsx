
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import '../FishPanel/FishPanel.css';
import './AquariumSettingsPanel.css';

type AquariumSettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  fishCount: number;
};

export function AquariumSettingsPanel({
                                        open,
                                        onClose,
                                        name,
                                        fishCount,
                                      }: AquariumSettingsPanelProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

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
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );

      if (!elements?.length) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

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

      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fish-panel aquarium-settings-panel">
      <button
        type="button"
        className="fish-panel__backdrop"
        aria-label="Close aquarium settings"
        tabIndex={-1}
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        className="fish-panel__sidebar aquarium-settings__sidebar"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="fish-panel__header">
          <div className="fish-panel__heading">
            <div>
              <h2 id={titleId}>Aquarium Settings</h2>
              <p>Manage your aquarium</p>
            </div>
          </div>

          <button
            ref={closeRef}
            type="button"
            className="fish-panel__close"
            aria-label="Close aquarium settings"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="fish-panel__body">
          <div className="fish-panel__details">
            <div className="fish-panel__detail">
              <span>Aquarium</span>
              <strong>{name}</strong>
            </div>

            <div className="fish-panel__detail">
              <span>Fish</span>
              <strong>{fishCount}</strong>
            </div>
          </div>
        </div>

        <footer className="fish-panel__footer">
          <button
            type="button"
            className="fish-panel__primary"
            onClick={onClose}
          >
            Done
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

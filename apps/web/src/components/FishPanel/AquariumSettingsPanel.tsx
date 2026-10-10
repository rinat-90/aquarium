
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import '../FishPanel/FishPanel.css';
import './AquariumSettingsPanel.css';

type AquariumSettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  fishCount: number;
  onRename: (name: string) => Promise<void>;
};

export function AquariumSettingsPanel({
                                        open,
                                        onClose,
                                        name,
                                        fishCount,
                                        onRename
                                      }: AquariumSettingsPanelProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const [draftName, setDraftName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setDraftName(name);
    setError(null);
  }, [open, name]);

  const trimmedName = draftName.trim();

  const canSave =
    trimmedName.length > 0 &&
    trimmedName !== name &&
    !saving;

  async function handleSaveName() {
    if (!canSave) return;

    setSaving(true);
    setError(null);

    try {
      await onRename(trimmedName);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to rename aquarium.',
      );
    } finally {
      setSaving(false);
    }
  }


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

          <section className="fish-panel__section">
            <h3>Rename Aquarium</h3>
            <p>Give your aquarium a new name.</p>

            <label
              className="fish-panel__label"
              htmlFor="aquarium-settings-name"
            >
              Aquarium name
            </label>

            <input
              id="aquarium-settings-name"
              className="fish-panel__input"
              value={draftName}
              maxLength={50}
              disabled={saving}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleSaveName();
                }
              }}
            />

            <button
              type="button"
              className="fish-panel__primary"
              disabled={!canSave}
              onClick={() => void handleSaveName()}
            >
              {saving ? 'Saving...' : 'Save Name'}
            </button>

            {error && (
              <p className="fish-panel__error" role="alert">
                {error}
              </p>
            )}
          </section>
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

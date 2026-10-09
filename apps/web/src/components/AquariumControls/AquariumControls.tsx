
import { useState, type FormEvent } from 'react';

import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';

import type { ApiAquarium } from '../../lib/aquarium-api';

import './AquariumControls.css';

type AquariumControlsProps = {
  aquarium: ApiAquarium | null;
  aquariums: ApiAquarium[];
  disabled?: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
};

type Dialog = 'create' | 'rename' | 'delete' | null;

export function AquariumControls({
                                   aquarium,
                                   aquariums,
                                   disabled = false,
                                   onSelect,
                                   onCreate,
                                   onRename,
                                   onDelete,
                                   onSetDefault,
                                 }: AquariumControlsProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog(next: Dialog) {
    if (saving) return;

    setName(next === 'rename' ? aquarium?.name ?? '' : '');
    setError(null);
    setDialog(next);
  }

  function closeDialog() {
    if (saving) return;

    setDialog(null);
    setName('');
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || disabled) return;

    const trimmed = name.trim();

    if (!trimmed || trimmed.length > 100) return;

    setSaving(true);
    setError(null);

    try {
      if (dialog === 'create') {
        await onCreate(trimmed);
      } else if (dialog === 'rename' && aquarium) {
        await onRename(aquarium.id, trimmed);
      }

      setDialog(null);
      setName('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!aquarium || saving || disabled) return;

    setSaving(true);
    setError(null);

    try {
      await onDelete(aquarium.id);

      setDialog(null);
      setName('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete aquarium',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault() {
    if (!aquarium || aquarium.isDefault || saving || disabled) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSetDefault(aquarium.id);

      setDialog(null);
      setName('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to set default aquarium',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="aquarium-controls">
        <Select
          ariaLabel="Select aquarium"
          value={aquarium?.id ?? ''}
          options={aquariums.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          onChange={onSelect}
          disabled={disabled || saving}
        />

        <Button
          variant="secondary"
          disabled={disabled || saving}
          onClick={() => openDialog('create')}
        >
          + Aquarium
        </Button>

        <button
          type="button"
          className="aquarium-settings-button"
          aria-label="Aquarium settings"
          title="Aquarium settings"
          disabled={!aquarium || disabled || saving}
          onClick={() => openDialog('rename')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.88 1.88-.06-.06A1.7 1.7 0 0 0 16 18.4a1.7 1.7 0 0 0-1 .58 1.7 1.7 0 0 0-.4 1.1V21h-2.6v-.92A1.7 1.7 0 0 0 10.6 18.4a1.7 1.7 0 0 0-1.88.34l-.06-.06-1.88-1.88.06-.06A1.7 1.7 0 0 0 10 6.4a1.7 1.7 0 0 0 1-1.48V4h2.6v.92A1.7 1.7 0 0 0 15 6.4a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.88 1.88-.06.06A1.7 1.7 0 0 0 18.4 10a1.7 1.7 0 0 0 1.48 1H21v2.6h-.92A1.7 1.7 0 0 0 19.4 15Z" />
          </svg>
        </button>
      </div>

      {/* Create Aquarium */}
      <Modal
        open={dialog === 'create'}
        title="Create an aquarium"
        description="Give your new underwater world a name."
        onClose={closeDialog}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={closeDialog}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="aquarium-create-form"
              disabled={saving || !name.trim()}
            >
              {saving ? 'Creating...' : 'Create Aquarium'}
            </Button>
          </>
        }
      >
        <form
          id="aquarium-create-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <input
            className="ui-input"
            autoFocus
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Coral Paradise"
            required
          />

          {error && (
            <p className="aquarium-form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </Modal>

      {/* Aquarium Settings */}
      <Modal
        open={dialog === 'rename'}
        title="Aquarium Settings"
        description={`Manage ${aquarium?.name ?? 'your aquarium'}.`}
        onClose={closeDialog}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={closeDialog}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="aquarium-rename-form"
              disabled={
                saving ||
                !name.trim() ||
                name.trim() === aquarium?.name
              }
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <form
          id="aquarium-rename-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label
            className="aquarium-settings-label"
            htmlFor="aquarium-rename-input"
          >
            Aquarium Name
          </label>

          <input
            id="aquarium-rename-input"
            className="ui-input"
            autoFocus
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </form>

        {/* Default Aquarium */}
        <div className="aquarium-default-section">
          <div className="aquarium-default-info">
            <strong>Default Aquarium</strong>

            <p>
              This aquarium will open automatically when you return.
            </p>
          </div>

          {aquarium?.isDefault ? (
            <span className="aquarium-default-badge">
              ★ Current Default
            </span>
          ) : (
            <Button
              variant="secondary"
              disabled={saving || disabled}
              onClick={() => void handleSetDefault()}
            >
              {saving ? 'Saving...' : 'Set as Default'}
            </Button>
          )}
        </div>

        {error && (
          <p className="aquarium-form-error" role="alert">
            {error}
          </p>
        )}

        {/* Delete Aquarium */}
        <button
          type="button"
          className="aquarium-delete-link"
          disabled={saving || disabled}
          onClick={() => openDialog('delete')}
        >
          Delete this aquarium
        </button>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={dialog === 'delete'}
        title="Delete aquarium?"
        description={`Are you sure you want to delete "${aquarium?.name ?? 'this aquarium'}"?`}
        onClose={closeDialog}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={closeDialog}
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              disabled={saving || disabled}
              onClick={() => void handleDelete()}
            >
              {saving ? 'Deleting...' : 'Delete Aquarium'}
            </Button>
          </>
        }
      >
        <p className="aquarium-delete-warning">
          This aquarium will be permanently removed.
          Its fish will become unassigned rather than being deleted.
        </p>

        {error && (
          <p className="aquarium-form-error" role="alert">
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}

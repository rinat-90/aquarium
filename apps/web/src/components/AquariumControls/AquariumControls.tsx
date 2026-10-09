
import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import type { ApiAquarium } from '../../lib/aquarium-api';

type AquariumControlsProps = {
  aquarium: ApiAquarium | null;
  aquariums: ApiAquarium[];
  disabled?: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
};

export function AquariumControls({
                                   aquarium,
                                   aquariums,
                                   disabled = false,
                                   onSelect,
                                   onCreate,
                                 }: AquariumControlsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmed = name.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setError(null);

    try {
      await onCreate(trimmed);
      setModalOpen(false);
      setName('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create aquarium',
      );
    } finally {
      setSaving(false);
    }
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setName('');
    setError(null);
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Select
          ariaLabel="Select aquarium"
          value={aquarium?.id ?? ''}
          options={aquariums.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          onChange={onSelect}
          disabled={disabled}
        />

        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => setModalOpen(true)}
        >
          + Aquarium
        </Button>
      </div>

      <Modal
        open={modalOpen}
        title="Create an aquarium"
        description="Give your new underwater world a name."
        onClose={closeModal}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={closeModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-aquarium-form"
              disabled={saving || !name.trim()}
            >
              {saving ? 'Creating...' : 'Create Aquarium'}
            </Button>
          </>
        }
      >
        <form
          id="create-aquarium-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <input
            className="ui-input"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Coral Paradise"
            maxLength={100}
            required
          />
          {error && (
            <p role="alert" style={{ color: '#ffc5c5' }}>
              {error}
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}

import type {
  AquariumCustomization,
  AquariumBackground,
  AquariumSubstrate,
  AquariumLighting,
  AquariumBubbles,
} from '../../features/aquarium-customization/types';

type Props = {
  open: boolean;
  value: AquariumCustomization;
  onChange: (next: AquariumCustomization) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
};

const backgrounds: { id: AquariumBackground; label: string; emoji: string; gradient: string }[] = [
  { id: 'ocean', label: 'Ocean', emoji: '🌊', gradient: 'linear-gradient(#075b91, #04132f)' },
  { id: 'coral', label: 'Coral', emoji: '🪸', gradient: 'linear-gradient(#26b9c5, #07586e)' },
  { id: 'deep-sea', label: 'Deep Sea', emoji: '🐙', gradient: 'linear-gradient(#182b61, #020818)' },
  { id: 'fantasy', label: 'Fantasy', emoji: '✨', gradient: 'linear-gradient(#6951bd, #15113d)' },
];

const substrates: {
  id: AquariumSubstrate;
  label: string;
  emoji: string;
  gradient: string;
}[] = [
  {
    id: 'sand',
    label: 'Sand',
    emoji: '🏖️',
    gradient: 'linear-gradient(160deg, #e4cf9c, #aa8650)',
  },
  {
    id: 'white-sand',
    label: 'White Sand',
    emoji: '🤍',
    gradient: 'linear-gradient(160deg, #fff9e9, #c8c5b8)',
  },
  {
    id: 'pebbles',
    label: 'Pebbles',
    emoji: '🪨',
    gradient: 'linear-gradient(160deg, #a9a293, #555c58)',
  },
  {
    id: 'dark-gravel',
    label: 'Dark Gravel',
    emoji: '🌑',
    gradient: 'linear-gradient(160deg, #50545b, #171b23)',
  },
];

const lighting: { id: AquariumLighting; label: string; emoji: string }[] = [
  { id: 'sunny', label: 'Sunny', emoji: '☀️' },
  { id: 'soft', label: 'Soft', emoji: '🌤️' },
  { id: 'night', label: 'Night', emoji: '🌙' },
];

const bubbles: { id: AquariumBubbles; label: string; emoji: string }[] = [
  { id: 'none', label: 'None', emoji: '🚫' },
  { id: 'some', label: 'Some', emoji: '🫧' },
  { id: 'lots', label: 'Lots', emoji: '🫧🫧' },
];

export function AquariumAppearanceEditor({ open, value, onChange, onClose, onSave, saving, saveError }: Props) {
  if (!open) return null;

  return (
    <aside className="aquarium-appearance-editor" aria-label="Decorate your aquarium">
      <header className="aquarium-appearance-header">
        <div>
          <div className="aquarium-appearance-eyebrow">MY AQUARIUM</div>
          <h2>🎨 Let's decorate!</h2>
          <p>Make your aquarium your own.</p>
        </div>
        <button type="button" className="aquarium-appearance-close" onClick={onClose} disabled={saving} aria-label="Close editor">×</button>
      </header>

      <div className="aquarium-appearance-scroll">
        <section>
          <h3>🌊 Pick your world</h3>
          <div className="aquarium-appearance-worlds">
            {backgrounds.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`aquarium-appearance-world ${value.background === option.id ? 'is-selected' : ''}`}
                aria-pressed={value.background === option.id}
                onClick={() => onChange({ ...value, background: option.id })}
              >
                <span className="aquarium-appearance-preview" style={{ background: option.gradient }}>
                  <span aria-hidden="true">{option.emoji}</span>
                </span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>🏖️ Choose your floor</h3>

          <div className="aquarium-appearance-worlds">
            {substrates.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`aquarium-appearance-world ${
                  value.substrate === option.id ? 'is-selected' : ''
                }`}
                aria-pressed={value.substrate === option.id}
                onClick={() =>
                  onChange({
                    ...value,
                    substrate: option.id,
                  })
                }
              >
        <span
          className="aquarium-appearance-preview"
          style={{ background: option.gradient }}
        >
          <span aria-hidden="true">{option.emoji}</span>
        </span>

                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>💡 Set the mood</h3>
          <div className="aquarium-appearance-options">
            {lighting.map((option) => (
              <button
                type="button"
                key={option.id}
                className={value.lighting === option.id ? 'is-selected' : ''}
                aria-pressed={value.lighting === option.id}
                onClick={() => onChange({ ...value, lighting: option.id })}
              >
                <span aria-hidden="true">{option.emoji}</span>{option.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>🫧 Add bubbles</h3>
          <div className="aquarium-appearance-options">
            {bubbles.map((option) => (
              <button
                type="button"
                key={option.id}
                className={value.bubbles === option.id ? 'is-selected' : ''}
                aria-pressed={value.bubbles === option.id}
                onClick={() => onChange({ ...value, bubbles: option.id })}
              >
                <span aria-hidden="true">{option.emoji}</span>{option.label}
              </button>
            ))}
          </div>
        </section>
      </div>
      <footer className="aquarium-appearance-footer">
        <p>Changes appear instantly. Tap Done to save them.</p>
        {saveError && <p role="alert" style={{ color: '#ffb6b6' }}>{saveError}</p>}
        <button type="button" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Done ✓'}
        </button>
      </footer>
    </aside>
  );
}

import { useState } from 'react';
import './AquariumDecorationCatalog.css';
import './AquariumWorkspace.css';
import type {
  AquariumDecorationAssetId,
  AquariumDecorationInstance,
} from '../../features/aquarium-customization/types';

import {
  DECORATION_REGISTRY,
} from '../../features/aquarium-customization/decorationRegistry';

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
  selectedDecorationId?: string | null;
  onDecorationSelect?: (id: string | null) => void;
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

const catalogItems = [
  { id: 'rocks', label: 'Rocks', emoji: '🪨', category: 'rocks' },
  { id: 'seaweed', label: 'Seaweed', emoji: '🌿', category: 'plants' },
  { id: 'coral', label: 'Coral', emoji: '🪸', category: 'plants' },
] as const;

type CatalogCategory = 'all' | 'plants' | 'rocks';

export function AquariumAppearanceEditor({ open, value, onChange, onClose, onSave, saving, saveError, selectedDecorationId = null, onDecorationSelect }: Props) {

  const [catalogCategory, setCatalogCategory] = useState<CatalogCategory>('all');
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const decorationInstances = value.decorationInstances ?? [];

  const selectedDecoration = decorationInstances.find(
    (decoration) => decoration.id === selectedDecorationId,
  );

  const addDecoration = (assetId: AquariumDecorationAssetId) => {
    if (decorationInstances.length >= 30) return;

    const asset = DECORATION_REGISTRY[assetId];

    const instance: AquariumDecorationInstance = {
      id: crypto.randomUUID(),
      assetId,
      x: 0.5,
      depth: 0.5,
      scale: asset.defaultScale,
      rotation: 0,
      color: asset.defaultColor,
    };

    onChange({
      ...value,
      decorationInstances: [
        ...decorationInstances,
        instance,
      ],
    });

    onDecorationSelect?.(instance.id);
  };

  const updateDecoration = (
    id: string,
    changes: Partial<AquariumDecorationInstance>,
  ) => {
    onChange({
      ...value,
      decorationInstances: decorationInstances.map(
        (decoration) =>
          decoration.id === id
            ? { ...decoration, ...changes }
            : decoration,
      ),
    });
  };

  const removeDecoration = (id: string) => {
    onChange({
      ...value,
      decorationInstances: decorationInstances.filter(
        (decoration) => decoration.id !== id,
      ),
    });

    onDecorationSelect?.(null);
  };

  if (!open) return null;

  return (
    <aside className={`aquarium-appearance-editor aquarium-workspace ${sheetCollapsed ? 'is-collapsed' : ''}`} aria-label="Decorate your aquarium">
      <header className="aquarium-appearance-header">
        <button type="button" className="aquarium-workspace-sheet-toggle" aria-expanded={!sheetCollapsed} aria-label={sheetCollapsed ? "Expand decoration panel" : "Collapse decoration panel"} onClick={() => setSheetCollapsed((current) => !current)}><span className="aquarium-workspace-grip" aria-hidden="true" /><span className="aquarium-workspace-sheet-label">{sheetCollapsed ? "🎨 Tap to decorate" : "Drag decorations in the aquarium"}</span><span aria-hidden="true">{sheetCollapsed ? "⌃" : "⌄"}</span></button>
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

        <section className="aquarium-decoration-section aquarium-catalog">
          <div className="aquarium-catalog-heading">
            <div>
              <h3>🪸 Pick a decoration</h3>
              <p>Tap something you love to add it to your aquarium!</p>
            </div>
            <span className="aquarium-catalog-counter">{decorationInstances.length}/30</span>
          </div>

          <div className="aquarium-catalog-tabs" role="group" aria-label="Decoration categories">
            {([
              ['all', '✨ All'],
              ['plants', '🌿 Plants'],
              ['rocks', '🪨 Rocks'],
            ] as const).map(([category, label]) => (
              <button
                key={category}
                type="button"
                className={catalogCategory === category ? 'is-active' : ''}
                aria-pressed={catalogCategory === category}
                onClick={() => setCatalogCategory(category)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="aquarium-catalog-grid">
            {catalogItems
              .filter((item) => catalogCategory === 'all' || item.category === catalogCategory)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`aquarium-catalog-card aquarium-catalog-card--${item.id}`}
                  disabled={decorationInstances.length >= 30}
                  onClick={() => addDecoration(item.id)}
                  aria-label={`Add ${item.label}`}
                >
                  <span className="aquarium-catalog-art" aria-hidden="true">
                    <span className="aquarium-catalog-emoji">{item.emoji}</span>
                    <span className="aquarium-catalog-plus">+</span>
                  </span>
                  <span className="aquarium-catalog-name">{item.label}</span>
                </button>
              ))}
          </div>

          {decorationInstances.length > 0 && (
            <div className="aquarium-catalog-owned">
              <div className="aquarium-catalog-owned-heading">
                <h3>✨ In your aquarium</h3>
                <span>Tap to edit · drag in the tank to move</span>
              </div>
              <div className="aquarium-catalog-owned-list">
                {decorationInstances.map((decoration, index) => {
                  const item = catalogItems.find((entry) => entry.id === decoration.assetId);
                  return (
                    <button
                      key={decoration.id}
                      type="button"
                      className={`aquarium-catalog-owned-item ${selectedDecorationId === decoration.id ? 'is-selected' : ''}`}
                      aria-pressed={selectedDecorationId === decoration.id}
                      onClick={() => onDecorationSelect?.(decoration.id)}
                    >
                      <span aria-hidden="true">{item?.emoji ?? '🪸'}</span>
                      <span>{DECORATION_REGISTRY[decoration.assetId].name} {index + 1}</span>
                      <span aria-hidden="true">{selectedDecorationId === decoration.id ? '✓' : '›'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedDecoration && (
            <div className="aquarium-decoration-controls">
              <div className="aquarium-decoration-controls-header">
                <div>
                  <h3>
                    {DECORATION_REGISTRY[selectedDecoration.assetId].name}
                  </h3>
                  <p>Make it just how you like!</p>
                </div>
                <span aria-hidden="true">✨</span>
              </div>

              <div className="aquarium-decoration-control-group">
      <span className="aquarium-decoration-label">
        ↔️ Move decoration
      </span>

                <div className="aquarium-decoration-stepper">
                  <button
                    type="button"
                    aria-label="Move left"
                    disabled={selectedDecoration.x <= 0.06}
                    onClick={() =>
                      updateDecoration(selectedDecoration.id, {
                        x: Math.max(
                          0.06,
                          Number((selectedDecoration.x - 0.05).toFixed(2)),
                        ),
                      })
                    }
                  >
                    ←
                  </button>

                  <span>Position</span>

                  <button
                    type="button"
                    aria-label="Move right"
                    disabled={selectedDecoration.x >= 0.94}
                    onClick={() =>
                      updateDecoration(selectedDecoration.id, {
                        x: Math.min(
                          0.94,
                          Number((selectedDecoration.x + 0.05).toFixed(2)),
                        ),
                      })
                    }
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="aquarium-decoration-control-group">
      <span className="aquarium-decoration-label">
        📏 Change size
      </span>

                <div className="aquarium-decoration-stepper">
                  <button
                    type="button"
                    aria-label="Make smaller"
                    onClick={() => {
                      const asset =
                        DECORATION_REGISTRY[selectedDecoration.assetId];

                      updateDecoration(selectedDecoration.id, {
                        scale: Math.max(
                          asset.minScale,
                          Number((selectedDecoration.scale - 0.1).toFixed(2)),
                        ),
                      });
                    }}
                  >
                    −
                  </button>

                  <span>
          {selectedDecoration.scale < 0.8
            ? 'Small'
            : selectedDecoration.scale > 1.2
              ? 'Large'
              : 'Medium'}
        </span>

                  <button
                    type="button"
                    aria-label="Make bigger"
                    onClick={() => {
                      const asset =
                        DECORATION_REGISTRY[selectedDecoration.assetId];

                      updateDecoration(selectedDecoration.id, {
                        scale: Math.min(
                          asset.maxScale,
                          Number((selectedDecoration.scale + 0.1).toFixed(2)),
                        ),
                      });
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="aquarium-decoration-control-group">
      <span className="aquarium-decoration-label">
        🎨 Pick a color
      </span>

                <div className="aquarium-decoration-colors">
                  {[
                    '#739fc8',
                    '#43ca78',
                    '#ff83a9',
                    '#ffcf64',
                    '#aa8be8',
                    '#ff9466',
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={
                        selectedDecoration.color === color
                          ? 'is-selected'
                          : ''
                      }
                      style={{ backgroundColor: color }}
                      aria-label={`Choose color ${color}`}
                      aria-pressed={selectedDecoration.color === color}
                      onClick={() =>
                        updateDecoration(selectedDecoration.id, {
                          color,
                        })
                      }
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="aquarium-decoration-remove"
                onClick={() => removeDecoration(selectedDecoration.id)}
              >
                🗑️ Remove decoration
              </button>
            </div>
          )}

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

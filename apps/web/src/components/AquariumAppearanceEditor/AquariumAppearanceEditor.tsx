import { useEffect, useRef, useState } from 'react';
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

const decorationColors = [
  { name: 'Ocean blue', hex: '#739fc8' },
  { name: 'Leaf green', hex: '#43ca78' },
  { name: 'Candy pink', hex: '#ff83a9' },
  { name: 'Sunshine yellow', hex: '#ffcf64' },
  { name: 'Magic purple', hex: '#aa8be8' },
  { name: 'Sunset orange', hex: '#ff9466' },
] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function AquariumAppearanceEditor({ open, value, onChange, onClose, onSave, saving, saveError, selectedDecorationId = null, onDecorationSelect }: Props) {

  const [catalogCategory, setCatalogCategory] = useState<CatalogCategory>('all');
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedDecorationId);
  const controlsRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const decorationInstances = value.decorationInstances ?? [];

  // The panel responds immediately to taps, even if its parent does not
  // update selectedDecorationId. External tank selections still sync here.
  useEffect(() => {
    setLocalSelectedId(selectedDecorationId);
  }, [selectedDecorationId]);

  const activeSelectedId = localSelectedId;
  const selectedDecoration = decorationInstances.find(
    (decoration) => decoration.id === activeSelectedId,
  );

  const selectDecoration = (id: string | null) => {
    setLocalSelectedId(id);
    if (id) setSheetCollapsed(false);
    onDecorationSelect?.(id);
  };

  // Selecting a decoration in the list (or directly in the tank) should
  // reveal its controls immediately, even when the panel is scrolled above them.
  useEffect(() => {
    if (!open || !selectedDecoration) return;

    setSheetCollapsed(false);
    const frame = requestAnimationFrame(() => {
      const controls = controlsRef.current;
      const scroller = scrollRef.current;
      if (!controls || !scroller) return;

      // Scroll only the editor, not the entire aquarium page.
      const controlsTop = controls.getBoundingClientRect().top;
      const scrollTop = scroller.getBoundingClientRect().top;
      scroller.scrollTo({
        top: scroller.scrollTop + controlsTop - scrollTop - 12,
        behavior: 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, activeSelectedId]);

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

    selectDecoration(instance.id);
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

    selectDecoration(null);
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

      <div className="aquarium-appearance-scroll" ref={scrollRef}>
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

          {selectedDecoration && (
            <div className="aquarium-decoration-controls" ref={controlsRef}>
              <div className="aquarium-decoration-controls-header">
                <div>
                  <h3>
                    {catalogItems.find((item) => item.id === selectedDecoration.assetId)?.emoji ?? '🪸'}{' '}
                    {DECORATION_REGISTRY[selectedDecoration.assetId].name}
                  </h3>
                  <p>Make it just how you like!</p>
                </div>
                <span aria-hidden="true">✨</span>
              </div>

                             <div className="aquarium-decoration-control-group">
                 <span className="aquarium-decoration-label">↔️ Move</span>
                 <div className="aquarium-kid-stepper" role="group" aria-label="Move decoration">
                   <button type="button" aria-label="Move left" disabled={selectedDecoration.x <= 0.06}
                     onClick={() => updateDecoration(selectedDecoration.id, { x: clamp(Number((selectedDecoration.x - 0.05).toFixed(2)), 0.06, 0.94) })}>←</button>
                   <span>Left / Right</span>
                   <button type="button" aria-label="Move right" disabled={selectedDecoration.x >= 0.94}
                     onClick={() => updateDecoration(selectedDecoration.id, { x: clamp(Number((selectedDecoration.x + 0.05).toFixed(2)), 0.06, 0.94) })}>→</button>
                 </div>
               </div>

               <div className="aquarium-decoration-control-group">
                 <label className="aquarium-decoration-label" htmlFor={`decoration-size-${selectedDecoration.id}`}>📏 How big?</label>
                 <div className="aquarium-kid-slider">
                   <span aria-hidden="true">🐟</span>
                   <input
                     id={`decoration-size-${selectedDecoration.id}`}
                     type="range"
                     min={DECORATION_REGISTRY[selectedDecoration.assetId].minScale}
                     max={DECORATION_REGISTRY[selectedDecoration.assetId].maxScale}
                     step="0.05"
                     value={selectedDecoration.scale}
                     onChange={(event) => updateDecoration(selectedDecoration.id, { scale: Number(event.target.value) })}
                     aria-label="Decoration size"
                   />
                   <span className="aquarium-kid-large" aria-hidden="true">🐟</span>
                 </div>
                 <span className="aquarium-kid-hint">Slide to make it smaller or bigger</span>
               </div>

               <div className="aquarium-decoration-control-group">
                 <span className="aquarium-decoration-label">🔄 Turn it</span>
                 <div className="aquarium-kid-stepper" role="group" aria-label="Rotate decoration">
                   <button type="button" aria-label="Rotate left" onClick={() => updateDecoration(selectedDecoration.id, {
                     rotation: clamp(Number((selectedDecoration.rotation - Math.PI / 12).toFixed(3)), -Math.PI, Math.PI),
                   })}>↶</button>
                   <span>Rotate</span>
                   <button type="button" aria-label="Rotate right" onClick={() => updateDecoration(selectedDecoration.id, {
                     rotation: clamp(Number((selectedDecoration.rotation + Math.PI / 12).toFixed(3)), -Math.PI, Math.PI),
                   })}>↷</button>
                 </div>
               </div>

               <div className="aquarium-decoration-control-group">
                 <span className="aquarium-decoration-label">🎨 Pick a color</span>
                 <div className="aquarium-kid-colors" role="group" aria-label="Decoration colors">
                   {decorationColors.map(({ name, hex }) => (
                     <button
                       key={hex}
                       type="button"
                       className={selectedDecoration.color?.toLowerCase() === hex ? 'is-selected' : ''}
                       style={{ backgroundColor: hex }}
                       aria-label={name}
                       title={name}
                       aria-pressed={selectedDecoration.color?.toLowerCase() === hex}
                       onClick={() => updateDecoration(selectedDecoration.id, { color: hex })}
                     >
                       {selectedDecoration.color?.toLowerCase() === hex && <span aria-hidden="true">✓</span>}
                     </button>
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
                      className={`aquarium-catalog-owned-item ${activeSelectedId === decoration.id ? 'is-selected' : ''}`}
                      aria-pressed={activeSelectedId === decoration.id}
                      onClick={() => selectDecoration(decoration.id)}
                    >
                      <span aria-hidden="true">{item?.emoji ?? '🪸'}</span>
                      <span>{DECORATION_REGISTRY[decoration.assetId].name} {index + 1}</span>
                      <span aria-hidden="true">{activeSelectedId === decoration.id ? '✓' : '›'}</span>
                    </button>
                  );
                })}
              </div>
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

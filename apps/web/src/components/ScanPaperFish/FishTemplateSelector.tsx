import {
  FISH_TEMPLATES,
  getFishTemplateAssets,
  type FishTemplateId,
} from '../../lib/image-processing/fishTemplateRegistry';

type Props = {
  selected: FishTemplateId | null;
  onSelect: (id: FishTemplateId) => void;
};

export function FishTemplateSelector({ selected, onSelect }: Props) {
  return (
    <div>
      <h3>Choose your fish template</h3>
      <p>Select the fish you printed and colored.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 16 }}>
        {FISH_TEMPLATES.map((fish) => {
          const isSelected = selected === fish.id;
          return (
            <div key={fish.id}
              style={{ padding: 12, borderRadius: 14, border: isSelected ? '2px solid #38bdf8' : '2px solid #334155', background: isSelected ? '#164e63' : '#0f172a', color: '#fff', cursor: 'pointer' }}>
              <button type="button" onClick={() => onSelect(fish.id)} aria-pressed={isSelected}
                style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
                <img src={getFishTemplateAssets(fish.id).reference} alt={fish.name}
                  style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'contain', background: '#fff', borderRadius: 8 }} />
                <strong style={{ display: 'block', marginTop: 8 }}>{fish.name}</strong>
              </button>
              <a
                href={getFishTemplateAssets(fish.id).reference}
                download={`finny-${fish.id}-template.png`}
                onClick={(event) => event.stopPropagation()}
                style={{ display: 'inline-block', marginTop: 10, padding: '9px 12px', borderRadius: 9, background: '#e0f2fe', color: '#075985', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
                aria-label={`Download printable ${fish.name} template`}
              >
                ↓ Download template
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

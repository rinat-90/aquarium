import type { CreatedFish } from '../../types/fish';
import './FishCollection.css';

type FishCollectionProps = {
  open: boolean;
  fish: CreatedFish[];
  onClose: () => void;
  onSelectFish: (id: string) => void;
  onAddFish: () => void;
};

export function FishCollection({
                                 open,
                                 fish,
                                 onClose,
                                 onSelectFish,
                                 onAddFish,
                               }: FishCollectionProps) {
  if (!open) return null;

  return (
    <div className="fish-collection">
      <button
        type="button"
        className="fish-collection__backdrop"
        aria-label="Close fish collection"
        onClick={onClose}
      />

      <aside
        className="fish-collection__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fish-collection-title"
      >
        <header className="fish-collection__header">
          <div>
            <h2 id="fish-collection-title">My Fish</h2>
            <p>
              {fish.length} {fish.length === 1 ? 'fish' : 'fish'} in this aquarium
            </p>
          </div>

          <button
            type="button"
            className="fish-collection__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="fish-collection__body">
          {fish.length === 0 ? (
            <div className="fish-collection__empty">
              <span>🐠</span>
              <h3>No fish yet</h3>
              <p>Create your first fish and add it to your aquarium.</p>
              <button type="button" onClick={onAddFish}>
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
                  onClick={() => onSelectFish(item.id)}
                >
                  <div
                    className="fish-collection__avatar"
                    style={{
                      background: `radial-gradient(
                        circle at 30% 30%,
                        ${'bodyColor' in item && typeof item.bodyColor === 'string'
                                          ? item.bodyColor
                                          : '#168ee1'},
                        #103b60
                      )`,
                    }}
                  >
                    🐟
                  </div>

                  <div className="fish-collection__info">
                    <strong>{item.name}</strong>
                    <span>
                      {'species' in item && typeof item.species === 'string'
                        ? item.species
                        : 'Custom Fish'}
                    </span>
                  </div>

                  <span className="fish-collection__arrow">›</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {fish.length > 0 && (
          <footer className="fish-collection__footer">
            <button type="button" onClick={onAddFish}>
              + Add Fish
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
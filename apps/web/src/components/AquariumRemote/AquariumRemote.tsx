
import { useState } from 'react';
import { ScanPaperFish } from '../ScanPaperFish/ScanPaperFish';
import './AquariumRemote.css';

type RemoteFish = {
  id: string;
  name?: string | null;
  size: number;
};

type AquariumRemoteProps = {
  aquariumId: string;
  name: string;
  fish: RemoteFish[];
  onBack: () => void;
  onFeed: () => void;
  onAddFish: () => void;
  onSelectFish: (id: string) => void;
  onSettings: () => void;
  onViewAquarium: () => void;
};

export function AquariumRemote({
                                 aquariumId,
                                 name,
                                 fish,
                                 onBack,
                                 onFeed,
                                 onAddFish,
                                 onSelectFish,
                                 onSettings,
                                 onViewAquarium,
                               }: AquariumRemoteProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [fishExpanded, setFishExpanded] = useState(false);

  if (isScanning) {
    return (
      <div className="aquarium-remote">
        <header className="aquarium-remote__header">
          <button
            type="button"
            className="aquarium-remote__icon-button"
            onClick={() => setIsScanning(false)}
            aria-label="Back to aquarium remote"
          >
            ←
          </button>

          <div className="aquarium-remote__heading">
            <h1>Scan Drawing</h1>
            <span>📸 Bring your fish to life</span>
          </div>
        </header>

        <ScanPaperFish
          aquariumId={aquariumId}
          onSaved={() => {
            setIsScanning(false);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="aquarium-remote">
      <header className="aquarium-remote__header">
        <button
          type="button"
          className="aquarium-remote__icon-button"
          onClick={onBack}
          aria-label="Back to aquariums"
        >
          ←
        </button>

        <div className="aquarium-remote__heading">
          <h1>{name}</h1>
          <span>🐠 Aquarium Remote</span>
        </div>

        <button
          type="button"
          className="aquarium-remote__icon-button"
          onClick={onSettings}
          aria-label="Aquarium settings"
        >
          ⚙
        </button>
      </header>

      <section className="aquarium-remote__hero">
        <button
          type="button"
          className="aquarium-remote__hero-toggle"
          onClick={() => setFishExpanded((current) => !current)}
          aria-expanded={fishExpanded}
          aria-controls="aquarium-remote-fish-panel"
        >
          <span className="aquarium-remote__hero-icon">
            🐠
          </span>

          <span className="aquarium-remote__hero-content">
            <strong>Your fish are swimming!</strong>
            <small>
              {fish.length} {fish.length === 1 ? 'fish' : 'fish'} in
              your aquarium
            </small>
          </span>

          <span
            className={`aquarium-remote__hero-chevron ${
              fishExpanded
                ? 'aquarium-remote__hero-chevron--expanded'
                : ''
            }`}
            aria-hidden="true"
          >
            ⌄
          </span>
        </button>

        {fishExpanded && (
          <div
            id="aquarium-remote-fish-panel"
            className="aquarium-remote__hero-panel"
          >
            <div className="aquarium-remote__section-heading">
              <h2>Your Fish</h2>
              <span>{fish.length} total</span>
            </div>

            {fish.length === 0 ? (
              <div className="aquarium-remote__empty">
                No fish yet. Add your first fish!
              </div>
            ) : (
              <div className="aquarium-remote__fish-list">
                {fish.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className="aquarium-remote__fish-item"
                    onClick={() => onSelectFish(item.id)}
                  >
                    <span className="aquarium-remote__fish-avatar">
                      {['🐠', '🐟', '🐡'][index % 3]}
                    </span>

                    <span className="aquarium-remote__fish-info">
                      <strong>
                        {item.name || `Fish ${index + 1}`}
                      </strong>
                      <small>Size {item.size}</small>
                    </span>

                    <span className="aquarium-remote__chevron">
                      ›
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="aquarium-remote__view-button"
              onClick={onViewAquarium}
            >
              <span className="aquarium-remote__view-icon">
                ▣
              </span>

              <span>
                <strong>View Aquarium</strong>
                <small>
                  Open the 3D aquarium in landscape
                </small>
              </span>

              <span className="aquarium-remote__chevron">
                ›
              </span>
            </button>
          </div>
        )}
      </section>

      <div className="aquarium-remote__actions">
        <button
          type="button"
          className="aquarium-remote__action"
          onClick={onFeed}
        >
          <span className="aquarium-remote__action-icon">
            🍽️
          </span>
          <strong>Feed Fish</strong>
          <small>Drop some food</small>
        </button>

        <button
          type="button"
          className="aquarium-remote__action"
          onClick={onAddFish}
        >
          <span className="aquarium-remote__action-icon">
            🐟
          </span>
          <strong>Add Fish</strong>
          <small>Create a new friend</small>
        </button>

        <button
          type="button"
          className="aquarium-remote__action aquarium-remote__action--scan"
          onClick={() => setIsScanning(true)}
        >
          <span className="aquarium-remote__action-icon">
            📸
          </span>
          <strong>Scan Drawing</strong>
          <small>Bring your drawing to life</small>
        </button>
      </div>
    </div>
  );
}

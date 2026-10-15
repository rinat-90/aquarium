import { useState } from 'react';
import { ScanPaperFish } from '../ScanPaperFish/ScanPaperFish';
import './AquariumRemote.css';
import './AquariumRemoteOcean.css';

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
  onViewFish: () => void;
  onSettings: () => void;
  feedCooldownSeconds: number;
  feedPending: boolean;
  onEndBroadcast: () => void;
  endingBroadcast: boolean;
  isBroadcasting: boolean;
  onDecorate: () => void;
};

export function AquariumRemote({
  aquariumId,
  name,
  fish,
  onBack,
  onFeed,
  onAddFish,
  onViewFish,
  onSettings,
  feedCooldownSeconds,
  feedPending,
  onEndBroadcast,
  endingBroadcast,
  isBroadcasting,
  onDecorate,
}: AquariumRemoteProps) {
  const [isScanning, setIsScanning] = useState(false);

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
          onClick={onViewFish}
          aria-label="View your fish collection"
        >
          <span className="aquarium-remote__hero-icon">🐠</span>

          <span className="aquarium-remote__hero-content">
            <strong>Your fish are swimming!</strong>
            <small>{fish.length} fish in your aquarium</small>
          </span>

          <span className="aquarium-remote__hero-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      </section>

      <div className="aquarium-remote__actions">
        <button
          type="button"
          className="aquarium-remote__action"
          onClick={onFeed}
          disabled={feedPending || feedCooldownSeconds > 0}
        >
          <span className="aquarium-remote__action-icon">🍽️</span>

          <strong>
            {feedPending
              ? 'Feeding...'
              : feedCooldownSeconds > 0
                ? `Feed in ${feedCooldownSeconds}s`
                : 'Feed Fish'}
          </strong>

          <small>{feedCooldownSeconds > 0 ? 'Let your fish eat' : 'Drop some food'}</small>
        </button>

        <button type="button" className="aquarium-remote__action" onClick={onAddFish}>
          <span className="aquarium-remote__action-icon">🐟</span>
          <strong>Add Fish</strong>
          <small>Create a new friend</small>
        </button>

        <button
          type="button"
          className="aquarium-remote__action aquarium-remote__action--scan"
          onClick={() => setIsScanning(true)}
        >
          <span className="aquarium-remote__action-icon">📸</span>
          <strong>Scan Drawing</strong>
          <small>Bring your drawing to life</small>
        </button>
        <button
          type="button"
          className="aquarium-remote__action aquarium-remote__action--scan"
          onClick={onDecorate}
        >
          <span className="aquarium-remote__action-icon">🎨</span>
          <strong>Decorate Aquarium</strong>
          <small>Make your own underwater world</small>
        </button>
      </div>
      {isBroadcasting && (
        <div className="aquarium-remote__broadcast-controls">
          <button
            type="button"
            className="aquarium-remote__end-broadcast aquarium-remote__end-broadcast--ocean"
            onClick={onEndBroadcast}
            disabled={endingBroadcast}
          >
            <span aria-hidden="true">■</span>
            {endingBroadcast ? 'Ending broadcast…' : 'End Broadcast'}
          </button>
        </div>
      )}
    </div>
  );
}

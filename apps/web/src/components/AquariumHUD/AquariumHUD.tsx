
import './AquariumHUD.css';

type AquariumHUDProps = {
  name: string;
  fishCount: number;
  onBack: () => void;
  onAddFish: () => void;
  onSettings: () => void;
  onViewFish: () => void;
  onFeed: () => void;
};

export function AquariumHUD({
                              name,
                              fishCount,
                              onBack,
                              onAddFish,
                              onSettings,
                              onViewFish,
                              onFeed,
                            }: AquariumHUDProps) {
  return (
    <div className="aquarium-hud">
      <header className="aquarium-hud__header">
        <button
          className="aquarium-hud__icon-button"
          type="button"
          onClick={onBack}
          aria-label="Back to aquariums"
        >
          ←
        </button>

        <div className="aquarium-hud__title">
          <strong>{name}</strong>
          <span>{fishCount} fish</span>
        </div>
      </header>

      <nav
        className="aquarium-hud__actions"
        aria-label="Aquarium actions"
      >
        <button type="button" onClick={onAddFish}>
          <span>🐠</span>
          Add Fish
        </button>

        <button type="button" onClick={onFeed}>
          <span>🫧</span>
          Feed Fish
        </button>

        <button type="button" onClick={onViewFish}>
          <span>🤿 </span>
          View Fish
        </button>

        <button type="button" onClick={onSettings}>
          <span>🛠️</span>
          Settings
        </button>
      </nav>
    </div>
  );
}

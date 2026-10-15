import './AquariumHUD.css';

type AquariumHUDProps = {
  name: string;
  fishCount: number;
  feedCooldownSeconds: number;
  feedPending: boolean;
  onBack: () => void;
  onAddFish: () => void;
  onSettings: () => void;
  onDecorate: () => void;
  onViewFish: () => void;
  onFeed: () => void;
};

export function AquariumHUD({
  name,
  fishCount,
  feedCooldownSeconds,
  feedPending,
  onBack,
  onAddFish,
  onSettings,
  onDecorate,
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

        <button
          className="aquarium-hud__icon-button aquarium-hud__settings"
          type="button"
          onClick={onSettings}
          aria-label="Aquarium settings"
          title="Settings"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
            <circle cx="15" cy="7" r="2" />
            <circle cx="9" cy="17" r="2" />
          </svg>
        </button>
      </header>

      <nav className="aquarium-hud__actions" aria-label="Aquarium actions">
        <button type="button" onClick={onAddFish}>
          <span>🐠</span>
          Add Fish
        </button>

        <button type="button" onClick={onFeed} disabled={feedPending || feedCooldownSeconds > 0}>
          <span>🍽️</span>
          <span>
            {feedPending
              ? 'Feeding...'
              : feedCooldownSeconds > 0
                ? `Feed in ${feedCooldownSeconds}s`
                : 'Feed Fish'}
          </span>
        </button>

        <button type="button" onClick={onViewFish}>
          <span>🤿 </span>
          View Fish
        </button>

        <button type="button" onClick={onDecorate}>
          <span aria-hidden="true">🎨</span>
          Decorate
        </button>
      </nav>
    </div>
  );
}

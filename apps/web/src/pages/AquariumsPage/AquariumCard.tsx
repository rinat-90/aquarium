
import { Link } from 'react-router';
import type { ApiAquarium } from '../../lib/aquarium-api';

type AquariumCardProps = {
  aquarium: ApiAquarium;
  isBroadcasting?: boolean;
};

export function AquariumCard({
                               aquarium,
                               isBroadcasting = false,
                             }: AquariumCardProps) {
  const aquariumUrl = `/aquariums/${encodeURIComponent(aquarium.id)}`;

  return (
    <article
      className={`aquarium-card${isBroadcasting ? ' aquarium-card--broadcasting' : ''}`}
    >
      <Link
        className="aquarium-card__preview"
        to={aquariumUrl}
        aria-label={`Open ${aquarium.name}`}
      >
        <div className="aquarium-card__water">
          <span className="aquarium-card__light" />

          <span className="aquarium-card__fish aquarium-card__fish--one">
            🐠
          </span>

          <span className="aquarium-card__fish aquarium-card__fish--two">
            🐟
          </span>

          <span className="aquarium-card__fish aquarium-card__fish--three">
            🐡
          </span>

          <span className="aquarium-card__plants">
            🌿 🪸 🌱
          </span>

          <span className="aquarium-card__sand" />
        </div>

        {isBroadcasting && (
          <span className="aquarium-card__live-badge">
            <span
              className="aquarium-card__live-dot"
              aria-hidden="true"
            />
            Live on TV
          </span>
        )}
      </Link>

      <div className="aquarium-card__footer">
        <div className="aquarium-card__info">
          <Link to={aquariumUrl}>
            {aquarium.name}
          </Link>

          <span>
            {aquarium.fish.length} fish
          </span>
        </div>

        <Link
          className="aquarium-card__action"
          to={aquariumUrl}
          aria-label={`Open ${aquarium.name}`}
          title="Open aquarium"
        >
          ↗
        </Link>
      </div>
    </article>
  );
}

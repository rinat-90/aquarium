
import { Link } from 'react-router';
import type { ApiAquarium } from '../../lib/aquarium-api';

type AquariumCardProps = {
  aquarium: ApiAquarium;
};

export function AquariumCard({ aquarium }: AquariumCardProps) {
  return (
    <article className="aquarium-card">
      <Link
        className="aquarium-card__preview"
        to={`/aquariums/${aquarium.id}`}
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
          <span className="aquarium-card__plants">🌿 🪸 🌱</span>
          <span className="aquarium-card__sand" />
        </div>
      </Link>

      <div className="aquarium-card__footer">
        <div className="aquarium-card__info">
          <Link to={`/aquariums/${aquarium.id}`}>
            {aquarium.name}
          </Link>
          <span>
            {aquarium.fish.length} {aquarium.fish.length === 1 ? 'fish' : 'fish'}
          </span>
        </div>

        <Link
          className="aquarium-card__action"
          to={`/aquariums/${aquarium.id}`}
          aria-label={`Open ${aquarium.name}`}
          title="Open aquarium"
        >
          ↗
        </Link>
      </div>
    </article>
  );
}

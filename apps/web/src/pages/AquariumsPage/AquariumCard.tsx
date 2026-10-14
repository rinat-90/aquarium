import { Link } from 'react-router';
import type { CSSProperties } from 'react';
import type { ApiAquarium, ApiFish } from '../../lib/aquarium-api';
import { AQUARIUM_THEMES } from '../../features/aquarium-customization/themeRegistry';

type AquariumCardProps = { aquarium: ApiAquarium; isBroadcasting?: boolean };

type PreviewStyle = CSSProperties & { '--fish-body'?: string; '--fish-fin'?: string };

const THEME_BACKGROUNDS: Record<string, string> = {
  coral: 'sunny-reef', ocean: 'ocean-garden', 'deep-sea': 'midnight-sea', fantasy: 'magic-lagoon',
};
const VALID_COLOR = /^#[\da-fA-F]{6}$/;

function getThemeId(aquarium: ApiAquarium): string {
  const appearance = aquarium.appearance;
  const explicit = appearance?.themeId ?? aquarium.themeId;
  if (explicit && AQUARIUM_THEMES.some((theme) => theme.id === explicit)) return explicit;
  if (appearance?.background) return THEME_BACKGROUNDS[appearance.background] ?? 'sunny-reef';
  return 'sunny-reef';
}

function previewFishStyle(fish: ApiFish, index: number): PreviewStyle {
  const positions = [
    { left: '18%', top: '31%', transform: 'scale(1.05)' },
    { left: '60%', top: '48%', transform: 'scale(.76) scaleX(-1)' },
    { left: '48%', top: '19%', transform: 'scale(.64)' },
    { left: '31%', top: '62%', transform: 'scale(.7) scaleX(-1)' },
    { left: '76%', top: '23%', transform: 'scale(.8)' },
  ];
  return {
    ...positions[index % positions.length],
    '--fish-body': VALID_COLOR.test(fish.bodyColor) ? fish.bodyColor : '#f9c34b',
    '--fish-fin': VALID_COLOR.test(fish.finColor) ? fish.finColor : '#ff9a4b',
  };
}

export function AquariumCard({ aquarium, isBroadcasting = false }: AquariumCardProps) {
  const aquariumUrl = `/aquariums/${encodeURIComponent(aquarium.id)}`;
  const themeId = getThemeId(aquarium);
  const theme = AQUARIUM_THEMES.find((item) => item.id === themeId);
  const count = aquarium.fish.length;

  return (
    <article className={`aquarium-card aquarium-card--${themeId}${isBroadcasting ? ' aquarium-card--broadcasting' : ''}`}>
      <Link className="aquarium-card__preview" to={aquariumUrl} aria-label={`Open ${aquarium.name}`}>
        <div className="aquarium-card__water">
          <span className="aquarium-card__light" aria-hidden="true" />
          <span className="aquarium-card__preview-scenery" aria-hidden="true">
            {themeId === 'sunny-reef' ? '🪸 🪨 🪸' : themeId === 'ocean-garden' ? '🌿 🌱 🌿' : themeId === 'midnight-sea' ? '🌿 ✨ 🌱' : '🍄 ✨ 🍄'}
          </span>
          {aquarium.fish.slice(0, 5).map((fish, index) => (
            <span
              key={fish.id}
              className={`aquarium-card__preview-fish aquarium-card__preview-fish--${fish.species}`}
              style={previewFishStyle(fish, index)}
              aria-hidden="true"
            />
          ))}
          {count === 0 && <span className="aquarium-card__empty-preview">Your underwater world is waiting for fish!</span>}
          <span className="aquarium-card__sand" aria-hidden="true" />
        </div>
      </Link>
      {isBroadcasting && (
        <span className="aquarium-card__live-badge"><span className="aquarium-card__live-dot" aria-hidden="true" />Live on TV</span>
      )}
      <div className="aquarium-card__footer">
        <div className="aquarium-card__info">
          <Link to={aquariumUrl}>{aquarium.name}</Link>
          <span>{count} {count === 1 ? 'fish' : 'fish'} · {theme?.name ?? 'Custom World'}</span>
        </div>
        <div className="aquarium-card__actions">
          <Link className="aquarium-card__action aquarium-card__action--open" to={aquariumUrl} aria-label={`Open ${aquarium.name}`}><span aria-hidden="true">▷</span> Open</Link>
          <Link className="aquarium-card__action aquarium-card__action--edit" to={`${aquariumUrl}?decorate=1`} aria-label={`Decorate ${aquarium.name}`}><span aria-hidden="true">⚙</span> Edit</Link>
        </div>
      </div>
    </article>
  );
}

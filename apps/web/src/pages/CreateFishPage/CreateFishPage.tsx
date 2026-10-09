import { useNavigate, useSearchParams } from 'react-router';
import './CreateFishPage.css';

export function CreateFishPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const aquariumId = searchParams.get('aquariumId');

  const backToAquarium = () => {
    navigate(aquariumId ? `/aquariums/${aquariumId}` : '/aquariums');
  };

  const handleDrawFish = () => {
    if (!aquariumId) return;

    navigate(`/fish/create/draw?aquariumId=${encodeURIComponent(aquariumId)}`);
  };

  const handleCustomizeFish = () => {
    if (!aquariumId) return;

    navigate(`/fish/create/3d?aquariumId=${encodeURIComponent(aquariumId)}`);
  };

  return (
    <main className="create-fish-page">
      <header className="create-fish-header">
        <button
          type="button"
          className="create-fish-back"
          onClick={backToAquarium}
        >
          ← Back
        </button>

        <div>
          <h1>Create a Fish</h1>
          <p>Choose how you want to bring your fish to life.</p>
        </div>
      </header>

      <div className="create-fish-options">
        <button
          type="button"
          className="create-fish-card"
          disabled={!aquariumId}
          onClick={handleDrawFish}
        >
          <div className="create-fish-card__art create-fish-card__art--draw">
            <span>🎨</span>
            <span>🐠</span>
          </div>

          <div className="create-fish-card__content">
            <h2>Draw Your Fish</h2>
            <p>
              Draw your own fish, give it a name, and watch it swim in your
              aquarium.
            </p>
            <span className="create-fish-card__action">Start Drawing →</span>
          </div>
        </button>

        <button
          type="button"
          className="create-fish-card"
          disabled={!aquariumId}
          onClick={handleCustomizeFish}
        >
          <div className="create-fish-card__art create-fish-card__art--3d">
            <span>🐟</span>
            <span>✨</span>
          </div>

          <div className="create-fish-card__content">
            <h2>Customize 3D Fish</h2>
            <p>
              Choose a fish, change its colors and appearance, and make it
              your own.
            </p>
            <span className="create-fish-card__action">Customize Fish →</span>
          </div>
        </button>
      </div>

      {!aquariumId && (
        <p className="create-fish-error">
          Please open an aquarium before creating a fish.
        </p>
      )}
    </main>
  );
}
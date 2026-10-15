import { useSearchParams, Link, Navigate, useNavigate } from 'react-router';
import { ScanPaperFish } from '../../components/ScanPaperFish/ScanPaperFish';
import './ScanFishPage.css';

export function ScanFishPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const aquariumId = params.get('aquariumId');

  if (!aquariumId) {
    return <Navigate to="/fish/create" replace />;
  }

  return (
    <main className="scan-fish-page">
      <header className="scan-fish-page__header">
        <Link
          to={`/fish/create?aquariumId=${encodeURIComponent(aquariumId)}`}
          className="scan-fish-page__back"
        >
          ← Back
        </Link>
        <div>
          <h1>Scan Your Drawing</h1>
          <p>Turn your paper fish into a swimming friend!</p>
        </div>
      </header>
      <section className="scan-fish-page__panel">
        <ScanPaperFish
          variant="studio"
          aquariumId={aquariumId}
          onSaved={() => navigate(`/aquariums/${encodeURIComponent(aquariumId)}`)}
        />
      </section>
    </main>
  );
}

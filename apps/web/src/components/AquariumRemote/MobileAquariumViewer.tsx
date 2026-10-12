import { useEffect, useRef, useState } from 'react';

import { ThreeAquariumView } from '../Aquarium3D/ThreeAquariumView';
import type { CreatedFish } from '../../types/fish';

import './MobileAquariumViewer.css';

type Props = {
  fish: CreatedFish[];
  feedSequence: number;
  onClose: () => void;
};

export function MobileAquariumViewer({
                                       fish,
                                       feedSequence,
                                       onClose,
                                     }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [landscape, setLandscape] = useState(
    () => window.matchMedia('(orientation: landscape)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(orientation: landscape)');

    const updateOrientation = () => {
      setLandscape(media.matches);
    };

    media.addEventListener('change', updateOrientation);

    return () => {
      media.removeEventListener('change', updateOrientation);
    };
  }, []);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    // Fullscreen isn't supported in every mobile browser.
    if (element.requestFullscreen) {
      void element.requestFullscreen().catch(() => {
        // Manual landscape mode still works.
      });
    }

    return () => {
      if (document.fullscreenElement === element) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="mobile-aquarium-viewer"
    >
      <button
        type="button"
        className="mobile-aquarium-viewer__close"
        onClick={handleClose}
        aria-label="Close aquarium viewer"
      >
        ✕
      </button>

      {landscape ? (
        <div className="mobile-aquarium-viewer__scene">
          <ThreeAquariumView
            createdFish={fish}
            feedSequence={feedSequence}
            interactive={false}
            showDebugStats={false}
          />
        </div>
      ) : (
        <div className="mobile-aquarium-viewer__rotate">
          <div className="mobile-aquarium-viewer__rotate-icon">
            📱
          </div>

          <h2>Rotate your phone</h2>
          <p>Turn your phone sideways to view your aquarium.</p>
        </div>
      )}
    </div>
  );
}
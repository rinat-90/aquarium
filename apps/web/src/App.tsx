import { useState } from 'react';

import { AquariumView } from './components/Aquarium/AquariumView';
import { FishDrawingCanvas } from './components/FishDrawing/FishDrawingCanvas';

export type CreatedFish = {
  id: string;
  image: string;
};

function App() {
  const [drawing, setDrawing] = useState(false);
  const [fish, setFish] = useState<CreatedFish[]>([]);

  const handleFishCreated = (image: string) => {
    setFish((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        image,
      },
    ]);

    setDrawing(false);
  };

  return (
    <>
      <AquariumView createdFish={fish} />

      <button
        onClick={() => setDrawing(true)}
        style={{
          position: 'fixed',
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          padding: '14px 24px',
          borderRadius: 30,
          border: 0,
          fontSize: 18,
          cursor: 'pointer',
        }}
      >
        ✏️ Draw Fish
      </button>

      {drawing && (
        <FishDrawingCanvas
          onDone={handleFishCreated}
          onCancel={() => setDrawing(false)}
        />
      )}
    </>
  );
}

export default App;
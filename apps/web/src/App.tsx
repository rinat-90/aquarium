import {
  useState,
} from 'react';

import {
  loadFish,
  saveFish,
} from './storage/fishStorage';

import {
  FishDrawingCanvas,
  type FishCreation,
} from './components/FishDrawing/FishDrawingCanvas';
import {
  FishProfileCard,
} from './components/FishProfile/FishProfileCard';

import {
  ThreeAquariumView,
} from './components/Aquarium3D/ThreeAquariumView';

const AQUARIUM_CAPACITY = 8;

export type DrawnFish = {
  id: string;
  type: 'drawn';
  image: string;
  size: number;
  name: string;
  createdAt: string;
};

export type ThreeDFish = {
  id: string;
  type: '3d';
  model: 'basic' | 'angelfish';
  bodyColor: string;
  finColor: string;
  paintImage?: string;
  size: number;
  name: string;
  createdAt: string;
};

export type CreatedFish =
  | DrawnFish
  | ThreeDFish;

function App() {
  const [drawing, setDrawing] =
    useState(false);

  const [fish, setFish] =
    useState<CreatedFish[]>(
      () => loadFish(),
    );

  const [
    selectedFishId,
    setSelectedFishId,
  ] = useState<string | null>(
    null,
  );

  const usedCapacity =
    fish.reduce(
      (total, item) =>
        total +
        item.size * item.size,
      0,
    );

  const remainingCapacity =
    Math.max(
      0,
      AQUARIUM_CAPACITY -
      usedCapacity,
    );

  const selectedFish =
    fish.find(
      (item) =>
        item.id ===
        selectedFishId,
    ) ?? null;

  const handleFishCreated = (creation: FishCreation) => {
    const creationCost = creation.size * creation.size;

    setFish((current) => {
      const currentCapacity = current.reduce(
        (total, item) => total + item.size * item.size,
        0,
      );

      if (
        currentCapacity + creationCost >
        AQUARIUM_CAPACITY + 0.0001
      ) {
        return current;
      }

      const baseFish = {
        id: crypto.randomUUID(),
        name: `Fish ${current.length + 1}`,
        createdAt: new Date().toISOString(),
        size: creation.size,
      };

      const newFish: CreatedFish =
        creation.type === 'drawn'
          ? {
            ...baseFish,
            type: 'drawn',
            image: creation.image,
          }
          : {
            ...baseFish,
            type: '3d',

            // Convert preview species to saved model type
            model:
              creation.model === 'angelfish'
                ? 'angelfish'
                : 'basic',

            bodyColor: creation.bodyColor,
            finColor: creation.finColor,
            paintImage: creation.paintImage,
          };

      const next: CreatedFish[] = [
        ...current,
        newFish,
      ];

      saveFish(next);

      return next;
    });

    setDrawing(false);
  };

  const handleRenameFish = (
    name: string,
  ) => {
    if (!selectedFishId) {
      return;
    }

    setFish((current) => {
      const next =
        current.map((item) =>
          item.id ===
          selectedFishId
            ? {
              ...item,
              name,
            }
            : item,
        );

      saveFish(next);

      return next;
    });
  };

  const handleReleaseFish = () => {
    if (!selectedFishId) {
      return;
    }

    setFish((current) => {
      const next =
        current.filter(
          (item) =>
            item.id !==
            selectedFishId,
        );

      saveFish(next);

      return next;
    });

    setSelectedFishId(null);
  };

  const handleReleaseAllFish = () => {
    if (fish.length === 0) {
      return;
    }

    const confirmed =
      window.confirm(
        `Release all ${fish.length} fish from the aquarium? This can't be undone.`,
      );

    if (!confirmed) {
      return;
    }

    setFish([]);
    saveFish([]);

    setSelectedFishId(null);
  };

  return (
    <>
      <ThreeAquariumView
        createdFish={fish}
        onFishSelect={(
          selectedFish,
        ) => {
          setSelectedFishId(
            selectedFish.id,
          );
        }}
      />

      <button
        onClick={() =>
          setDrawing(true)
        }
        style={{
          position: 'fixed',

          bottom: 30,
          left: '50%',

          transform:
            'translateX(-50%)',

          zIndex: 10,

          padding:
            '14px 24px',

          borderRadius: 30,
          border: 0,

          fontSize: 18,

          cursor: 'pointer',
        }}
      >
        ✏️ Draw Fish
      </button>

      {selectedFish && (
        <FishProfileCard
          fish={selectedFish}
          onRename={
            handleRenameFish
          }
          onRelease={
            handleReleaseFish
          }
          onClose={() =>
            setSelectedFishId(
              null,
            )
          }
        />
      )}

      {fish.length > 0 && (
        <button
          type="button"
          onClick={
            handleReleaseAllFish
          }
          style={{
            position: 'fixed',

            bottom: 30,
            right: 30,

            zIndex: 10,

            padding:
              '12px 18px',

            border:
              '2px solid rgba(255, 255, 255, 0.8)',

            borderRadius: 30,

            background:
              'rgba(255, 255, 255, 0.9)',

            color: '#c44747',

            fontSize: 15,
            fontWeight: 800,

            cursor: 'pointer',

            boxShadow:
              '0 6px 20px rgba(0, 0, 0, 0.15)',

            backdropFilter:
              'blur(10px)',
          }}
        >
          🌊 Release All
        </button>
      )}

      {drawing && (
        <FishDrawingCanvas
          remainingCapacity={
            remainingCapacity
          }
          onDone={
            handleFishCreated
          }
          onCancel={() =>
            setDrawing(false)
          }
        />
      )}
    </>
  );
}

export default App;

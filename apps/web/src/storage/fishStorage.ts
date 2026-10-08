import type {
  CreatedFish,
} from '../App';

const STORAGE_KEY =
  'aquarium-created-fish';

type StoredFish = {
  id?: unknown;
  type?: unknown;
  image?: unknown;
  model?: unknown;
  bodyColor?: unknown;
  finColor?: unknown;
  name?: unknown;
  createdAt?: unknown;
};

export function loadFish():
  CreatedFish[] {
  try {
    const stored =
      localStorage.getItem(
        STORAGE_KEY,
      );

    if (!stored) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const fish: CreatedFish[] = [];

    parsed.forEach(
      (
        value: unknown,
        index,
      ) => {
        if (
          typeof value !==
          'object' ||
          value === null
        ) {
          return;
        }

        const storedFish =
          value as StoredFish;

        if (
          typeof storedFish.id !==
          'string'
        ) {
          return;
        }

        const name =
          typeof storedFish.name ===
          'string'
            ? storedFish.name
            : `Fish ${index + 1}`;

        const createdAt =
          typeof storedFish.createdAt ===
          'string'
            ? storedFish.createdAt
            : new Date().toISOString();

        /**
         * New 3D fish format.
         */
        if (
          storedFish.type === '3d' &&
          storedFish.model ===
          'basic' &&
          typeof storedFish.bodyColor ===
          'string' &&
          typeof storedFish.finColor ===
          'string'
        ) {
          fish.push({
            id: storedFish.id,
            type: '3d',
            model: 'basic',
            bodyColor:
            storedFish.bodyColor,
            finColor:
            storedFish.finColor,
            name,
            createdAt,
          });

          return;
        }

        /**
         * Drawn fish.
         *
         * This also handles the OLD
         * storage format where `type`
         * didn't exist yet.
         */
        if (
          typeof storedFish.image ===
          'string'
        ) {
          fish.push({
            id: storedFish.id,
            type: 'drawn',
            image:
            storedFish.image,
            name,
            createdAt,
          });
        }
      },
    );

    return fish;
  } catch (error) {
    console.error(
      'Failed to load fish:',
      error,
    );

    return [];
  }
}

export function saveFish(
  fish: CreatedFish[],
) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(fish),
    );
  } catch (error) {
    console.error(
      'Failed to save fish:',
      error,
    );
  }
}
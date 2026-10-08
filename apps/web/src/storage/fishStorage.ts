import type {
  CreatedFish,
} from '../App';

const STORAGE_KEY =
  'aquarium-created-fish';

const MIN_FISH_SIZE = 0.6;
const MAX_FISH_SIZE = 1.4;
const DEFAULT_FISH_SIZE = 1;

type StoredFish = {
  id?: unknown;
  type?: unknown;
  image?: unknown;
  model?: unknown;
  bodyColor?: unknown;
  finColor?: unknown;

  // Saved PNG data URL containing
  // the child's 3D fish painting.
  paintImage?: unknown;

  // Added after the original fish
  // storage format.
  size?: unknown;

  name?: unknown;
  createdAt?: unknown;
};

function getFishSize(
  value: unknown,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_FISH_SIZE;
  }

  return Math.max(
    MIN_FISH_SIZE,
    Math.min(
      MAX_FISH_SIZE,
      value,
    ),
  );
}

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
            : new Date()
              .toISOString();

        /*
         * Existing fish created before
         * size support default to 1.
         */
        const size =
          getFishSize(
            storedFish.size,
          );

        /**
         * 3D fish.
         *
         * paintImage is optional so fish
         * created before painting support
         * continue loading normally.
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

            ...(typeof storedFish.paintImage ===
            'string'
              ? {
                paintImage:
                storedFish.paintImage,
              }
              : {}),

            size,

            name,
            createdAt,
          });

          return;
        }

        /**
         * Drawn fish.
         *
         * This also handles the old
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

            size,

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
import type {
  CreatedFish,
} from '../App';

const STORAGE_KEY =
  'aquarium-created-fish';

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

    return parsed
      .filter(
        (
          fish,
        ): fish is {
          id: string;
          image: string;
          name?: string;
          createdAt?: string;
        } => {
          return (
            typeof fish ===
            'object' &&
            fish !== null &&
            typeof fish.id ===
            'string' &&
            typeof fish.image ===
            'string'
          );
        },
      )
      .map(
        (fish, index) => ({
          id: fish.id,
          image: fish.image,

          name:
            fish.name ??
            `Fish ${index + 1}`,

          createdAt:
            fish.createdAt ??
            new Date()
              .toISOString(),
        }),
      );
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
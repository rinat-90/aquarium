
import { fishApi } from './aquarium-api';
import type { FishCreation } from '../components/FishDrawing/FishDrawingCanvas';

export const AQUARIUM_CAPACITY = 8;

async function imageToBlob(image: string): Promise<Blob> {
  const response = await fetch(image);

  if (!response.ok) {
    throw new Error('Failed to prepare fish texture');
  }

  return response.blob();
}

export async function createFish(
  aquariumId: string,
  creation: FishCreation,
  existingFishCount: number,
) {
  let createdId: string | null = null;

  try {
    const created = await fishApi.create({
      name: `Fish ${existingFishCount + 1}`,
      species:
        creation.type === 'drawn'
          ? 'drawn'
          : creation.model === 'angelfish'
            ? 'angelfish'
            : 'classic',
      bodyColor:
        creation.type === 'drawn'
          ? '#4F9CF9'
          : creation.bodyColor,
      finColor:
        creation.type === 'drawn'
          ? '#3B82F6'
          : creation.finColor,
      size: creation.size,
      aquariumId,
    });

    createdId = created.id;

    const image =
      creation.type === 'drawn'
        ? creation.image
        : creation.paintImage;

    if (!image) {
      return created;
    }

    return await fishApi.uploadTexture(
      created.id,
      await imageToBlob(image),
    );
  } catch (error) {
    if (createdId) {
      try {
        await fishApi.remove(createdId);
      } catch {
        // Preserve the original error.
      }
    }

    throw error;
  }
}

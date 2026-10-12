
import { fishApi, type ApiFish } from '../lib/aquarium-api';
import type { CreatedFish } from '../types/fish';

export async function mapApiFish(item: ApiFish): Promise<CreatedFish> {
  let texture: string | undefined;

  if (item.paintKey) {
    const blob = await fishApi.getTexture(item.id);

    texture = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result as string);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read fish texture'));
      };

      reader.readAsDataURL(blob);
    });
  }

  if (item.species === 'drawn') {
    return {
      id: item.id,
      type: 'drawn',
      image: texture ?? '',
      size: item.size,
      name: item.name,
      createdAt: item.createdAt,
    };
  }

  return {
    id: item.id,
    type: '3d',
    model:
      item.species === 'angelfish'
        ? 'angelfish'
        : item.species === 'guppy'
          ? 'guppy'
          : 'basic',
    bodyColor: item.bodyColor,
    finColor: item.finColor,
    paintImage: texture,
    size: item.size,
    name: item.name,
    createdAt: item.createdAt,
  };
}
